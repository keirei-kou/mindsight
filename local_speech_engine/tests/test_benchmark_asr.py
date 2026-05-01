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

    def __init__(self, text: str = "read", available: bool = True) -> None:
        self.text = text
        self.available = available
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
        return AsrTranscript(
            provider=self.name,
            filename=path.name,
            text=self.text,
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


if __name__ == "__main__":
    unittest.main()
