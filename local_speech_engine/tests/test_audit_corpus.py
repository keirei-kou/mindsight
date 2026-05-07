from __future__ import annotations

import json
import shutil
import struct
import unittest
import wave
from pathlib import Path

from local_speech_engine.scripts.audit_corpus import apply_fixes, audit_corpus


TEST_ROOT = Path(__file__).resolve().parent / "_audit_corpus_test_data"


def reset_test_root() -> Path:
    if TEST_ROOT.exists():
        shutil.rmtree(TEST_ROOT)
    corpus_dir = TEST_ROOT / "audio_corpus"
    corpus_dir.mkdir(parents=True)
    return corpus_dir


def make_test_wav(path: Path) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(16000)
        wav_file.writeframes(struct.pack("<h", 1000) * 800)
    return path


class AuditCorpusTests(unittest.TestCase):
    def tearDown(self) -> None:
        if TEST_ROOT.exists():
            shutil.rmtree(TEST_ROOT)

    def test_dry_run_reports_issues_without_writing_files(self) -> None:
        corpus_dir = reset_test_root()
        labels_path = corpus_dir / "labels.json"
        labels = [
            {"file": "commands/colors/red/red_001.wav", "expected": "red"},
            {"file": "commands/colors/blue_001.wav", "expected": "blue"},
            {"file": "commands/colors/missing.wav", "expected": "missing"},
            {"file": "commands/colors/red/red_001.wav", "expected": "red"},
        ]
        labels_path.write_text(json.dumps(labels, indent=2) + "\n", encoding="utf-8")
        original_labels = labels_path.read_text(encoding="utf-8")
        make_test_wav(corpus_dir / "commands" / "colors" / "red" / "red_001.wav")
        make_test_wav(corpus_dir / "commands" / "colors" / "blue" / "blue_001.wav")
        make_test_wav(corpus_dir / "commands" / "colors" / "green" / "green_001.wav")
        (corpus_dir / "labels.example.json").write_text(json.dumps([
            {"file": "commands/colors/example.wav", "expected": "example"}
        ]), encoding="utf-8")

        report = audit_corpus(corpus_dir)

        self.assertEqual(report["summary"]["label_files"], 1)
        self.assertEqual(report["summary"]["label_entries"], 4)
        self.assertEqual(report["summary"]["repairable_path_drift"], 1)
        self.assertEqual(report["summary"]["stale_labels"], 1)
        self.assertEqual(report["summary"]["orphan_wavs"], 1)
        self.assertEqual(report["summary"]["duplicate_refs_extra"], 1)
        self.assertEqual(report["summary"]["exact_duplicate_entries_extra"], 1)
        self.assertEqual(labels_path.read_text(encoding="utf-8"), original_labels)
        self.assertEqual(list(corpus_dir.glob("*.bak.*")), [])

    def test_fix_repairs_paths_removes_stale_and_duplicates_and_keeps_orphan_wavs(self) -> None:
        corpus_dir = reset_test_root()
        labels_path = corpus_dir / "labels.json"
        labels_path.write_text(json.dumps([
            {"file": "commands/colors/red/red_001.wav", "expected": "red"},
            {"file": "commands/colors/blue_001.wav", "expected": "blue"},
            {"file": "commands/colors/missing.wav", "expected": "missing"},
            {"file": "commands/colors/red/red_001.wav", "expected": "red"},
        ], indent=2) + "\n", encoding="utf-8")
        make_test_wav(corpus_dir / "commands" / "colors" / "red" / "red_001.wav")
        make_test_wav(corpus_dir / "commands" / "colors" / "blue" / "blue_001.wav")
        orphan = make_test_wav(corpus_dir / "commands" / "colors" / "green" / "green_001.wav")

        report = apply_fixes(corpus_dir)
        fixed_labels = json.loads(labels_path.read_text(encoding="utf-8"))

        self.assertEqual(report["summary"]["repairable_path_drift"], 0)
        self.assertEqual(report["summary"]["stale_labels"], 0)
        self.assertEqual(report["summary"]["exact_duplicate_entries_extra"], 0)
        self.assertEqual(report["summary"]["orphan_wavs"], 1)
        self.assertTrue(orphan.exists())
        self.assertEqual(len(fixed_labels), 2)
        self.assertEqual(fixed_labels[0]["file"], "commands/colors/red/red_001.wav")
        self.assertEqual(fixed_labels[1]["file"], "commands/colors/blue/blue_001.wav")
        self.assertEqual(len(list(corpus_dir.glob("labels.json.bak.*"))), 1)


if __name__ == "__main__":
    unittest.main()
