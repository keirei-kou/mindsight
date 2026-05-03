from __future__ import annotations

import json
import shutil
import struct
import unittest
import wave
from pathlib import Path

from local_speech_engine.corpus import CorpusError, delete_recording_segment, load_labels, save_segment_to_corpus


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

    def test_delete_recording_segment_removes_only_inside_recordings(self) -> None:
        recordings_dir, _, _ = reset_test_root()
        source = make_test_wav(recordings_dir / "vad_segment_20260501T000000_000Z_0003.wav")

        result = delete_recording_segment(source.name, recordings_dir=recordings_dir)

        self.assertFalse(source.exists())
        self.assertTrue(result["deleted"])
        self.assertEqual(result["filename"], source.name)

    def test_delete_recording_segment_rejects_traversal(self) -> None:
        recordings_dir, _, _ = reset_test_root()
        outside = make_test_wav(recordings_dir.parent / "outside.wav")

        with self.assertRaises(CorpusError) as context:
            delete_recording_segment("../outside.wav", recordings_dir=recordings_dir)

        self.assertEqual(context.exception.code, "source_outside_recordings")
        self.assertTrue(outside.exists())

    def test_save_segment_to_corpus_writes_session_labels_when_session_id_provided(self) -> None:
        recordings_dir, corpus_dir, labels_path = reset_test_root()
        source = make_test_wav(recordings_dir / "vad_segment_20260501T000000_000Z_0004.wav")

        sample = save_segment_to_corpus(
            source_filename=source.name,
            expected="red",
            sample_type="command",
            category="colors",
            notes="session sample",
            session_id="Colors Red 2026-05-03",
            recordings_dir=recordings_dir,
            corpus_dir=corpus_dir,
            labels_path=labels_path,
        )

        session_labels_path = corpus_dir / "labels.colors_red_2026-05-03.json"
        self.assertTrue(session_labels_path.exists())
        self.assertFalse(labels_path.exists())
        payload = json.loads(session_labels_path.read_text(encoding="utf-8"))
        self.assertEqual(payload["session_id"], "Colors Red 2026-05-03")
        self.assertEqual(payload["mode"], "command")
        self.assertEqual(payload["files"][0]["filename"], "commands/colors/" + source.name)
        self.assertEqual(payload["files"][0]["expected"], "red")
        self.assertEqual(sample["expected"], "red")

    def test_save_segment_to_corpus_session_writer_upserts_files_entry(self) -> None:
        recordings_dir, corpus_dir, labels_path = reset_test_root()
        source = make_test_wav(recordings_dir / "vad_segment_20260501T000000_000Z_0005.wav")

        save_segment_to_corpus(
            source_filename=source.name,
            expected="red",
            sample_type="command",
            category="colors",
            notes="first",
            session_id="colors_red",
            recordings_dir=recordings_dir,
            corpus_dir=corpus_dir,
            labels_path=labels_path,
        )
        save_segment_to_corpus(
            source_filename=source.name,
            expected="blue",
            sample_type="command",
            category="colors",
            notes="corrected",
            session_id="colors_red",
            recordings_dir=recordings_dir,
            corpus_dir=corpus_dir,
            labels_path=labels_path,
        )

        payload = json.loads((corpus_dir / "labels.colors_red.json").read_text(encoding="utf-8"))
        self.assertEqual(len(payload["files"]), 1)
        self.assertEqual(payload["files"][0]["expected"], "blue")
        self.assertEqual(payload["files"][0]["notes"], "corrected")

    def test_save_segment_to_corpus_without_session_id_keeps_legacy_list_writer(self) -> None:
        recordings_dir, corpus_dir, labels_path = reset_test_root()
        source = make_test_wav(recordings_dir / "vad_segment_20260501T000000_000Z_0006.wav")

        save_segment_to_corpus(
            source_filename=source.name,
            expected="red",
            sample_type="command",
            category="colors",
            recordings_dir=recordings_dir,
            corpus_dir=corpus_dir,
            labels_path=labels_path,
        )

        labels = load_labels(labels_path)
        self.assertEqual(len(labels), 1)
        self.assertEqual(labels[0]["file"], "commands/colors/" + source.name)
        self.assertFalse((corpus_dir / "labels.session.json").exists())


if __name__ == "__main__":
    unittest.main()
