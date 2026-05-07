from __future__ import annotations

import json
import shutil
import unittest
from pathlib import Path

from local_speech_engine.asr.base import AsrTranscript, ProviderStatus
from local_speech_engine.benchmark_asr import run_benchmark


TEST_ROOT = Path(__file__).resolve().parent / "_benchmark_test_data"


class FakeProvider:
    name = "fake"

    def __init__(self, text: str = "read", available: bool = True, transcripts: dict[str, str] | None = None, fail: bool = False) -> None:
        self.text = text
        self.available = available
        self.transcripts = transcripts or {}
        self.fail = fail
        self.loaded = False

    def status(self) -> ProviderStatus:
        return ProviderStatus(
            name=self.name,
            enabled=True,
            available=self.available,
            loaded=self.loaded,
            model_path="fake",
            message="fake status",
        )

    def load(self) -> ProviderStatus:
        self.loaded = True
        return self.status()

    def transcribe_wav(self, path: Path) -> AsrTranscript:
        if self.fail:
            raise RuntimeError("fake provider failed")
        return AsrTranscript(
            provider=self.name,
            filename=path.name,
            text=self.transcripts.get(path.name, self.text),
            confidence=0.8,
        )

    def unload(self) -> None:
        self.loaded = False


class FakeRegistry:
    def __init__(self, provider: FakeProvider) -> None:
        self.provider = provider

    def get_provider(self, provider_name: str | None = None) -> FakeProvider:
        self.provider.name = provider_name or self.provider.name
        return self.provider


def reset_test_root() -> tuple[Path, Path, Path]:
    if TEST_ROOT.exists():
        shutil.rmtree(TEST_ROOT)
    corpus_dir = TEST_ROOT / "audio_corpus"
    labels_path = corpus_dir / "labels.json"
    output_dir = TEST_ROOT / "benchmark_results"
    sample_dir = corpus_dir / "commands" / "colors"
    sample_dir.mkdir(parents=True)
    (sample_dir / "red.wav").write_bytes(b"fake wav")
    labels_path.write_text(json.dumps([
        {
            "id": "sample_red",
            "file": "commands/colors/red.wav",
            "expected": "red",
            "type": "command",
            "category": "colors",
            "notes": "",
            "created_at": "2026-05-01T00:00:00Z",
        }
    ]), encoding="utf-8")
    return corpus_dir, labels_path, output_dir


class BenchmarkAsrTests(unittest.TestCase):
    def tearDown(self) -> None:
        if TEST_ROOT.exists():
            shutil.rmtree(TEST_ROOT)

    def test_benchmark_runner_uses_normalized_alias_match_and_writes_reports(self) -> None:
        corpus_dir, labels_path, output_dir = reset_test_root()
        report = run_benchmark(
            provider_names=["fake"],
            registry=FakeRegistry(FakeProvider(text="read")),
            labels_path=labels_path,
            corpus_dir=corpus_dir,
            output_dir=output_dir,
            write_reports=True,
        )

        self.assertEqual(report["total_samples"], 1)
        self.assertEqual(report["total_evaluations"], 1)
        self.assertEqual(report["total_passed"], 1)
        self.assertEqual(report["rows"][0]["normalized_transcript"], "red")
        self.assertTrue(Path(report["json_path"]).exists())
        self.assertTrue(Path(report["csv_path"]).exists())

    def test_benchmark_runner_skips_unavailable_provider(self) -> None:
        corpus_dir, labels_path, output_dir = reset_test_root()
        report = run_benchmark(
            provider_names=["fake"],
            registry=FakeRegistry(FakeProvider(available=False)),
            labels_path=labels_path,
            corpus_dir=corpus_dir,
            output_dir=output_dir,
            write_reports=False,
        )

        self.assertEqual(report["total_evaluations"], 0)
        self.assertTrue(report["providers"][0]["skipped"])
        self.assertEqual(report["providers"][0]["available"], False)

    def test_benchmark_runner_can_load_all_valid_label_files(self) -> None:
        corpus_dir, labels_path, output_dir = reset_test_root()
        (corpus_dir / "commands" / "colors" / "blue.wav").write_bytes(b"fake wav")
        (corpus_dir / "commands" / "numbers").mkdir(parents=True)
        (corpus_dir / "commands" / "numbers" / "one.wav").write_bytes(b"fake wav")
        (corpus_dir / "labels.session_blue.json").write_text(json.dumps({
            "session_id": "session_blue",
            "mode": "command",
            "files": [
                {
                    "filename": "commands/colors/blue.wav",
                    "expected": "blue",
                    "category": "colors",
                    "notes": "session sample",
                }
            ],
        }), encoding="utf-8")
        (corpus_dir / "labels.numbers.json").write_text(json.dumps({
            "session_id": "numbers",
            "mode": "command",
            "planned_sequence": ["one"],
            "auto_label_by_order": True,
            "files": [
                {"filename": "commands/numbers/one.wav", "category": "numbers"}
            ],
        }), encoding="utf-8")
        (corpus_dir / "labels.example.json").write_text(json.dumps([
            {"file": "commands/colors/example.wav", "expected": "example"}
        ]), encoding="utf-8")
        (corpus_dir / "labels.session_blue.json.bak.20260507T000000Z").write_text("[]", encoding="utf-8")

        report = run_benchmark(
            provider_names=["fake"],
            registry=FakeRegistry(FakeProvider(transcripts={
                "red.wav": "read",
                "blue.wav": "",
                "one.wav": "one",
            })),
            labels_path=labels_path,
            corpus_dir=corpus_dir,
            output_dir=output_dir,
            all_label_files=True,
            write_reports=False,
        )

        self.assertEqual(report["total_samples"], 3)
        self.assertEqual(report["label_files_loaded"], 3)
        self.assertEqual(set(report["label_files"]), {"labels.json", "labels.numbers.json", "labels.session_blue.json"})
        self.assertEqual(report["total_passed"], 2)
        self.assertEqual(report["blank_transcript_count"], 1)
        self.assertEqual(report["command_match_count"], 2)
        self.assertEqual({row["label_file"] for row in report["rows"]}, set(report["label_files"]))

    def test_benchmark_runner_reports_provider_errors(self) -> None:
        corpus_dir, labels_path, output_dir = reset_test_root()
        report = run_benchmark(
            provider_names=["fake"],
            registry=FakeRegistry(FakeProvider(fail=True)),
            labels_path=labels_path,
            corpus_dir=corpus_dir,
            output_dir=output_dir,
            write_reports=False,
        )

        self.assertEqual(report["provider_error_count"], 1)
        self.assertEqual(report["provider_error_rate"], 1.0)
        self.assertIn("fake provider failed", report["rows"][0]["error"])

    def test_benchmark_runner_reports_condition_groups_and_weighted_score(self) -> None:
        corpus_dir, labels_path, output_dir = reset_test_root()
        (corpus_dir / "commands" / "colors" / "blue.wav").write_bytes(b"fake wav")
        (corpus_dir / "commands" / "numbers").mkdir(parents=True)
        (corpus_dir / "commands" / "numbers" / "one.wav").write_bytes(b"fake wav")
        labels_path.write_text(json.dumps([
            {
                "file": "commands/colors/red.wav",
                "expected": "red",
                "type": "command",
                "category": "colors",
                "notes": "clean",
            },
            {
                "file": "commands/colors/blue.wav",
                "expected": "blue",
                "type": "command",
                "category": "colors",
                "notes": "cutoff_start",
            },
            {
                "file": "commands/numbers/one.wav",
                "expected": "one",
                "type": "command",
                "category": "numbers",
                "notes": "clean|false_positive",
            },
        ]), encoding="utf-8")

        report = run_benchmark(
            provider_names=["fake"],
            registry=FakeRegistry(FakeProvider(transcripts={
                "red.wav": "read",
                "blue.wav": "",
                "one.wav": "one",
            })),
            labels_path=labels_path,
            corpus_dir=corpus_dir,
            output_dir=output_dir,
            write_reports=False,
        )

        groups = report["condition_group_summary"]
        self.assertEqual(groups["usability"]["passed"], 1)
        self.assertEqual(groups["robustness"]["passed"], 0)
        self.assertEqual(groups["safety"]["passed"], 1)
        self.assertAlmostEqual(report["weighted_score"]["score"], 0.85)
        self.assertEqual(report["rows"][2]["condition_group"], "safety")
        self.assertEqual(report["rows"][2]["note_tags"], ["clean", "false_positive"])
        self.assertEqual(report["by_provider_condition_group"]["fake"]["condition_groups"]["robustness"]["blank_transcript_count"], 1)


if __name__ == "__main__":
    unittest.main()
