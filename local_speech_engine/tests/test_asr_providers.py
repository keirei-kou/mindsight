from __future__ import annotations

import json
import shutil
import struct
import sys
import types
import unittest
import wave
from pathlib import Path
from unittest.mock import patch

from local_speech_engine.asr.base import AsrProviderError
from local_speech_engine.asr.config import LocalSpeechConfig
from local_speech_engine.asr.registry import AsrRegistry
from local_speech_engine.asr.sherpa_provider import SherpaOnnxAsrProvider
from local_speech_engine.asr.vosk_provider import VoskAsrProvider, validate_vosk_model_dir


PROJECT_ROOT = Path(__file__).resolve().parents[2]
TEST_ROOT = Path(__file__).resolve().parent / "_asr_test_data"
RECORDINGS_DIR = Path(__file__).resolve().parents[1] / "recordings"


def reset_test_root() -> None:
    if TEST_ROOT.exists():
        shutil.rmtree(TEST_ROOT)
    TEST_ROOT.mkdir(parents=True)


def make_valid_vosk_model_dir(path: Path) -> Path:
    (path / "am").mkdir(parents=True)
    (path / "conf").mkdir()
    (path / "graph").mkdir()
    (path / "am" / "final.mdl").write_bytes(b"model")
    (path / "conf" / "model.conf").write_text("--sample-frequency=16000\n", encoding="utf-8")
    (path / "graph" / "HCLr.fst").write_bytes(b"hclr")
    (path / "graph" / "Gr.fst").write_bytes(b"gr")
    return path


def make_test_wav(path: Path) -> Path:
    with wave.open(str(path), "wb") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(16000)
        wav_file.writeframes(struct.pack("<h", 1000) * 1600)
    return path


class MockModel:
    def __init__(self, path: str) -> None:
        self.path = path


class MockRecognizer:
    def __init__(self, model: MockModel, sample_rate: int) -> None:
        self.model = model
        self.sample_rate = sample_rate
        self.words = False

    def SetWords(self, enabled: bool) -> None:
        self.words = enabled

    def AcceptWaveform(self, data: bytes) -> bool:
        return bool(data)

    def FinalResult(self) -> str:
        return json.dumps({
            "text": "red",
            "result": [
                {"word": "red", "conf": 0.93},
            ],
        })


def make_mock_vosk_module() -> types.SimpleNamespace:
    return types.SimpleNamespace(
        Model=MockModel,
        KaldiRecognizer=MockRecognizer,
        SetLogLevel=lambda level: None,
    )


class AsrProviderTests(unittest.TestCase):
    def tearDown(self) -> None:
        if TEST_ROOT.exists():
            shutil.rmtree(TEST_ROOT)
        for path in RECORDINGS_DIR.glob("asr_test_*.wav"):
            path.unlink(missing_ok=True)

    def test_vosk_rejects_tar_gz_path(self) -> None:
        with self.assertRaises(AsrProviderError) as context:
            validate_vosk_model_dir(Path("public/models/vosk/model.tar.gz"), PROJECT_ROOT)

        self.assertEqual(context.exception.code, "model_path_is_archive")
        self.assertIn("extracted model directory", context.exception.message)

    def test_vosk_rejects_missing_required_files(self) -> None:
        reset_test_root()
        model_dir = TEST_ROOT / "bad-vosk"
        model_dir.mkdir()

        with self.assertRaises(AsrProviderError) as context:
            validate_vosk_model_dir(model_dir, PROJECT_ROOT)

        self.assertEqual(context.exception.code, "model_files_missing")
        self.assertIn("am/final.mdl", context.exception.details["missing"])

    def test_vosk_transcribes_wav_with_mocked_package(self) -> None:
        reset_test_root()
        model_dir = make_valid_vosk_model_dir(TEST_ROOT / "valid-vosk")
        wav_path = make_test_wav(RECORDINGS_DIR / "asr_test_red.wav")
        provider = VoskAsrProvider(model_path=model_dir, project_root=PROJECT_ROOT)

        with patch.dict(sys.modules, {"vosk": make_mock_vosk_module()}):
            status = provider.load()
            transcript = provider.transcribe_wav(wav_path)

        self.assertTrue(status.loaded)
        self.assertEqual(transcript.text, "red")
        self.assertEqual(transcript.confidence, 0.93)
        self.assertEqual(transcript.sample_rate, 16000)

    def test_registry_lists_status_and_transcribes_latest_with_mocked_vosk(self) -> None:
        reset_test_root()
        model_dir = make_valid_vosk_model_dir(TEST_ROOT / "valid-vosk")
        wav_path = make_test_wav(RECORDINGS_DIR / "asr_test_latest.wav")
        registry = AsrRegistry(LocalSpeechConfig(
            project_root=PROJECT_ROOT,
            recordings_dir=RECORDINGS_DIR,
            vosk_model_path=model_dir,
            sherpa_model_dir=TEST_ROOT / "sherpa",
            default_provider="vosk",
            enable_vosk=True,
            enable_sherpa=True,
            auto_transcribe=False,
        ))
        registry.remember_segment(wav_path)

        with patch.dict(sys.modules, {"vosk": make_mock_vosk_module()}):
            statuses = registry.list_statuses()
            transcript = registry.transcribe_latest("vosk")

        self.assertEqual({status.name for status in statuses}, {"vosk", "sherpa"})
        self.assertEqual(transcript.text, "red")

    def test_sherpa_scaffold_reports_structured_error(self) -> None:
        provider = SherpaOnnxAsrProvider(model_dir=TEST_ROOT / "sherpa", project_root=PROJECT_ROOT)

        with self.assertRaises(AsrProviderError) as context:
            provider.load()

        self.assertEqual(context.exception.code, "provider_scaffolded")
        self.assertIn("No fake transcription", context.exception.setup_hint)


if __name__ == "__main__":
    unittest.main()

