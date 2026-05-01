from __future__ import annotations

import shutil
import struct
import unittest
import wave
from pathlib import Path

from local_speech_engine.corpus import load_labels, save_segment_to_corpus


TEST_ROOT = Path(__file__).resolve().parent / "_corpus_test_data"


def reset_test_root() -> tuple[Path, Path, Path]:
    if TEST_ROOT.exists():
        shutil.rmtree(TEST_ROOT)
    recordings_dir = TEST_ROOT / "recordings"
    corpus_dir = TEST_ROOT / "audio_corpus"
    recordings_dir.mkdir(parents=True)
    corpus_dir.mkdir(parents=True)
    return recordings_dir, corpus_dir, corpus_dir / "labels.json"


def make_test_wav(path: Path) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(16000)
        wav_file.writeframes(struct.pack("<h", 1000) * 800)
    return path


class CorpusTests(unittest.TestCase):
    def tearDown(self) -> None:
        if TEST_ROOT.exists():
            shutil.rmtree(TEST_ROOT)

    def test_save_segment_to_corpus_copies_file_and_creates_label(self) -> None:
        recordings_dir, corpus_dir, labels_path = reset_test_root()
        source = make_test_wav(recordings_dir / "vad_segment_20260501T000000_000Z_0001.wav")

        sample = save_segment_to_corpus(
            source_filename=source.name,
            expected="red",
            sample_type="command",
            category="colors",
            notes="first pass",
            recordings_dir=recordings_dir,
            corpus_dir=corpus_dir,
            labels_path=labels_path,
        )

        copied = corpus_dir / sample["file"]
        self.assertTrue(copied.exists())
        self.assertEqual(sample["expected"], "red")
        self.assertEqual(sample["type"], "command")
        self.assertEqual(sample["category"], "colors")
        self.assertEqual(load_labels(labels_path)[0]["file"], "commands/colors/" + source.name)

    def test_save_segment_to_corpus_updates_existing_label_for_same_file(self) -> None:
        recordings_dir, corpus_dir, labels_path = reset_test_root()
        source = make_test_wav(recordings_dir / "vad_segment_20260501T000000_000Z_0002.wav")

        first = save_segment_to_corpus(
            source_filename=source.name,
            expected="red",
            sample_type="command",
            category="colors",
            notes="first",
            recordings_dir=recordings_dir,
            corpus_dir=corpus_dir,
            labels_path=labels_path,
        )
        second = save_segment_to_corpus(
            source_filename=source.name,
            expected="blue",
            sample_type="command",
            category="colors",
            notes="corrected",
            recordings_dir=recordings_dir,
            corpus_dir=corpus_dir,
            labels_path=labels_path,
        )

        labels = load_labels(labels_path)
        self.assertEqual(len(labels), 1)
        self.assertEqual(first["id"], second["id"])
        self.assertEqual(labels[0]["expected"], "blue")
        self.assertEqual(labels[0]["notes"], "corrected")


if __name__ == "__main__":
    unittest.main()
