from __future__ import annotations

import json
import shutil
import struct
import unittest
import wave
from pathlib import Path

from local_speech_engine.asr.base import AsrProviderError, AsrTranscript
from local_speech_engine.scripts.benchmark_arbitration import (
    load_arbitration_samples,
    parse_policy_names,
    run_benchmark,
)


TEST_ROOT = Path(__file__).resolve().parent / "_arbitration_benchmark_test_data"


class FakeProvider:
    def __init__(self, name: str, transcripts: dict[str, str], *, fail: bool = False) -> None:
        self.name = name
        self.transcripts = transcripts
        self.fail = fail

    def transcribe_wav(self, path: Path) -> AsrTranscript:
        if self.fail:
            raise AsrProviderError(
                provider=self.name,
                code="fake_failure",
                message="Fake provider failed.",
            )

        return AsrTranscript(
            provider=self.name,
            filename=path.name,
            text=self.transcripts.get(path.name, ""),
            confidence=0.8,
            duration_ms=100,
            sample_rate=16000,
        )


class FakeRegistry:
    default_provider_name = "vosk"

    def __init__(self, providers: list[FakeProvider]) -> None:
        self.providers = {provider.name: provider for provider in providers}

    def get_provider(self, provider_name: str | None = None) -> FakeProvider:
        name = provider_name or self.default_provider_name
        provider = self.providers.get(name)
        if provider is None:
            raise AsrProviderError(
                provider=name,
                code="unknown_provider",
                message=f"Unknown provider: {name}",
            )
        return provider


def make_test_wav(path: Path) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(16000)
        wav_file.writeframes(struct.pack("<h", 1000) * 1600)
    return path


class BenchmarkArbitrationTests(unittest.TestCase):
    def tearDown(self) -> None:
        if TEST_ROOT.exists():
            shutil.rmtree(TEST_ROOT)

    def reset_test_root(self) -> tuple[Path, Path, Path]:
        if TEST_ROOT.exists():
            shutil.rmtree(TEST_ROOT)
        corpus_dir = TEST_ROOT / "audio_corpus"
        labels_path = corpus_dir / "labels.json"
        output_dir = TEST_ROOT / "benchmark_results"
        make_test_wav(corpus_dir / "commands" / "colors" / "red_001.wav")
        make_test_wav(corpus_dir / "commands" / "colors" / "blue_001.wav")
        return corpus_dir, labels_path, output_dir

    def test_loads_session_labels_and_applies_planned_sequence(self) -> None:
        corpus_dir, labels_path, _ = self.reset_test_root()
        labels_path.write_text(json.dumps({
            "session_id": "session_colors",
            "mode": "command",
            "planned_sequence": ["red", "blue"],
            "auto_label_by_order": True,
            "files": [
                {"filename": "commands/colors/red_001.wav", "notes": "first"},
                {"filename": "commands/colors/blue_001.wav", "expected": "blue"},
            ],
        }), encoding="utf-8")

        samples = load_arbitration_samples(labels_path)

        self.assertEqual(len(samples), 2)
        self.assertEqual(samples[0].session_id, "session_colors")
        self.assertEqual(samples[0].expected, "red")
        self.assertEqual(samples[1].expected, "blue")
        self.assertEqual(samples[0].filename, "commands/colors/red_001.wav")
        self.assertEqual(corpus_dir.name, "audio_corpus")
        self.assertEqual(samples[0].label_file, "labels.json")

    def test_benchmark_runs_arbitration_and_writes_reports(self) -> None:
        corpus_dir, labels_path, output_dir = self.reset_test_root()
        labels_path.write_text(json.dumps({
            "session_id": "session_colors",
            "mode": "command",
            "planned_sequence": ["red", "blue"],
            "auto_label_by_order": True,
            "files": [
                {"filename": "commands/colors/red_001.wav"},
                {"filename": "commands/colors/blue_001.wav"},
            ],
        }), encoding="utf-8")
        registry = FakeRegistry([
            FakeProvider("vosk", {"red_001.wav": "read", "blue_001.wav": "blue"}),
            FakeProvider("sherpa", {"red_001.wav": "red", "blue_001.wav": "blew"}),
        ])

        report = run_benchmark(
            provider_names=["vosk", "sherpa"],
            policy_names=["hybrid_default", "confidence_weighted"],
            labels_path=labels_path,
            corpus_dir=corpus_dir,
            output_dir=output_dir,
            registry=registry,
            write_reports=True,
        )

        self.assertEqual(report["total_samples"], 2)
        self.assertEqual(report["label_files_loaded"], 1)
        self.assertEqual(report["policies"], ["hybrid_default", "confidence_weighted"])
        self.assertEqual(report["arbitration"]["passed"], 4)
        self.assertEqual(report["by_policy"]["hybrid_default"]["passed"], 2)
        self.assertEqual(report["by_policy"]["confidence_weighted"]["passed"], 2)
        self.assertEqual(report["by_provider"]["vosk"]["passed"], 4)
        self.assertEqual(report["by_provider"]["sherpa"]["passed"], 4)
        self.assertEqual(report["by_command"]["red"]["arbitration_passed"], 2)
        self.assertEqual({row["policy_name"] for row in report["rows"]}, {"hybrid_default", "confidence_weighted"})
        self.assertTrue(Path(report["json_path"]).exists())
        self.assertTrue(Path(report["csv_path"]).exists())

    def test_provider_failures_are_counted_without_aborting_benchmark(self) -> None:
        corpus_dir, labels_path, output_dir = self.reset_test_root()
        labels_path.write_text(json.dumps([
            {
                "file": "commands/colors/red_001.wav",
                "expected": "red",
                "type": "command",
                "category": "colors",
            }
        ]), encoding="utf-8")
        registry = FakeRegistry([
            FakeProvider("vosk", {"red_001.wav": "red"}),
            FakeProvider("sherpa", {}, fail=True),
        ])

        report = run_benchmark(
            provider_names=["vosk", "sherpa"],
            labels_path=labels_path,
            corpus_dir=corpus_dir,
            output_dir=output_dir,
            registry=registry,
            write_reports=False,
        )

        self.assertEqual(report["arbitration"]["passed"], 1)
        self.assertEqual(report["by_provider"]["sherpa"]["errors"], 1)
        self.assertEqual(report["provider_error_count"], 1)
        self.assertEqual(report["blank_transcript_count"], 0)
        self.assertEqual(len(report["rows"]), 2)

    def test_parse_policy_names_dedupes_and_safely_falls_back_unknown_values(self) -> None:
        self.assertEqual(
            parse_policy_names("hybrid_default,not_real,confidence_weighted,hybrid_default"),
            ["hybrid_default", "confidence_weighted"],
        )

    def test_benchmark_can_load_all_valid_label_files_and_ignores_backups(self) -> None:
        corpus_dir, labels_path, output_dir = self.reset_test_root()
        labels_path.write_text(json.dumps([
            {
                "file": "commands/colors/red_001.wav",
                "expected": "red",
                "type": "command",
                "category": "colors",
            }
        ]), encoding="utf-8")
        session_labels = corpus_dir / "labels.session_blue.json"
        session_labels.write_text(json.dumps({
            "session_id": "session_blue",
            "mode": "command",
            "files": [
                {
                    "filename": "commands/colors/blue_001.wav",
                    "expected": "blue",
                    "category": "colors",
                    "notes": "session sample",
                }
            ],
        }), encoding="utf-8")
        (corpus_dir / "labels.example.json").write_text(json.dumps([
            {"file": "commands/colors/example.wav", "expected": "example"}
        ]), encoding="utf-8")
        (corpus_dir / "labels.session_blue.json.bak.20260507T000000Z").write_text("[]", encoding="utf-8")
        registry = FakeRegistry([
            FakeProvider("vosk", {"red_001.wav": "red", "blue_001.wav": "blue"}),
            FakeProvider("sherpa", {"red_001.wav": "", "blue_001.wav": "blue"}),
        ])

        report = run_benchmark(
            provider_names=["vosk", "sherpa"],
            labels_path=labels_path,
            corpus_dir=corpus_dir,
            output_dir=output_dir,
            registry=registry,
            all_label_files=True,
            write_reports=False,
        )

        self.assertEqual(report["total_samples"], 2)
        self.assertEqual(report["label_files_loaded"], 2)
        self.assertEqual(set(report["label_files"]), {"labels.json", "labels.session_blue.json"})
        self.assertEqual(report["arbitration"]["passed"], 2)
        self.assertEqual(report["blank_transcript_count"], 1)
        self.assertEqual(report["command_match_count"], 3)
        self.assertEqual({row["label_file"] for row in report["rows"]}, set(report["label_files"]))


if __name__ == "__main__":
    unittest.main()
