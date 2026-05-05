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

import numpy  # noqa: F401

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


class MockSherpaStream:
    def __init__(self) -> None:
        self.accepted_sample_rates: list[int] = []
        self.accepted_sample_counts: list[int] = []
        self.finished = False

    def accept_waveform(self, sample_rate: int, samples: object) -> None:
        self.accepted_sample_rates.append(sample_rate)
        self.accepted_sample_counts.append(len(samples))  # type: ignore[arg-type]

    def input_finished(self) -> None:
        self.finished = True


class MockOnlineSherpaRecognizer:
    last_instance: "MockOnlineSherpaRecognizer | None" = None
    instances: list["MockOnlineSherpaRecognizer"] = []
    result_queue: list[str] = []

    def __init__(self) -> None:
        self.ready_checks = 0
        self.decode_calls = 0
        self.stream = MockSherpaStream()
        self.result_text = self.result_queue.pop(0) if self.result_queue else "red"
        MockOnlineSherpaRecognizer.last_instance = self
        MockOnlineSherpaRecognizer.instances.append(self)

    @classmethod
    def from_transducer(cls, **_kwargs: object) -> "MockOnlineSherpaRecognizer":
        return cls()

    def create_stream(self) -> MockSherpaStream:
        return self.stream

    def is_ready(self, _stream: MockSherpaStream) -> bool:
        self.ready_checks += 1
        return self.ready_checks <= 2

    def decode_stream(self, _stream: MockSherpaStream) -> None:
        self.decode_calls += 1

    def get_result(self, _stream: MockSherpaStream) -> str:
        return self.result_text


def make_mock_sherpa_module() -> types.SimpleNamespace:
    MockOnlineSherpaRecognizer.last_instance = None
    MockOnlineSherpaRecognizer.instances = []
    return types.SimpleNamespace(
        OnlineRecognizer=MockOnlineSherpaRecognizer,
        OfflineRecognizer=types.SimpleNamespace(from_transducer=lambda **_kwargs: None),
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

    def test_sherpa_reports_structured_missing_model_error(self) -> None:
        provider = SherpaOnnxAsrProvider(model_dir=TEST_ROOT / "sherpa", project_root=PROJECT_ROOT)

        with self.assertRaises(AsrProviderError) as context:
            provider.load()

        self.assertEqual(context.exception.code, "model_dir_missing")
        self.assertIn("Sherpa ONNX streaming or offline transducer model", context.exception.setup_hint)

    def test_sherpa_streaming_transcribes_with_online_recognizer_and_diagnostics(self) -> None:
        reset_test_root()
        model_dir = TEST_ROOT / "sherpa-onnx-streaming-test-model"
        model_dir.mkdir()
        (model_dir / "tokens.txt").write_text("red\n", encoding="utf-8")
        (model_dir / "encoder.onnx").write_bytes(b"encoder")
        (model_dir / "decoder.onnx").write_bytes(b"decoder")
        (model_dir / "joiner.onnx").write_bytes(b"joiner")
        wav_path = make_test_wav(RECORDINGS_DIR / "asr_test_sherpa_short.wav")
        provider = SherpaOnnxAsrProvider(model_dir=model_dir, project_root=PROJECT_ROOT)

        with patch.dict(sys.modules, {"sherpa_onnx": make_mock_sherpa_module()}):
            status = provider.load()
            transcript = provider.transcribe_wav(wav_path)

        recognizer = MockOnlineSherpaRecognizer.last_instance
        self.assertIsNotNone(recognizer)
        assert recognizer is not None
        self.assertTrue(status.loaded)
        self.assertEqual(transcript.text, "red")
        self.assertEqual(transcript.details["model_kind"], "online")
        self.assertEqual(transcript.details["leading_padding_ms"], 500)
        self.assertEqual(transcript.details["tail_padding_ms"], 2000)
        self.assertEqual(transcript.details["decode_iterations"], 2)
        self.assertEqual(transcript.details["raw_result_type"], "str")
        self.assertGreater(transcript.details["sample_count"], 0)
        self.assertGreater(transcript.details["max_abs_amplitude"], 0)
        self.assertTrue(recognizer.stream.finished)
        self.assertEqual(recognizer.stream.accepted_sample_rates, [16000, 16000, 16000])
        self.assertEqual(recognizer.stream.accepted_sample_counts[0], 8000)
        self.assertEqual(recognizer.stream.accepted_sample_counts[-1], 32000)

    def test_sherpa_streaming_retries_short_non_silent_blank_with_modified_beam_search(self) -> None:
        reset_test_root()
        model_dir = TEST_ROOT / "sherpa-onnx-streaming-test-model"
        model_dir.mkdir()
        (model_dir / "tokens.txt").write_text("red\n", encoding="utf-8")
        (model_dir / "encoder.onnx").write_bytes(b"encoder")
        (model_dir / "decoder.onnx").write_bytes(b"decoder")
        (model_dir / "joiner.onnx").write_bytes(b"joiner")
        wav_path = make_test_wav(RECORDINGS_DIR / "asr_test_sherpa_short_retry.wav")
        provider = SherpaOnnxAsrProvider(model_dir=model_dir, project_root=PROJECT_ROOT)
        MockOnlineSherpaRecognizer.result_queue = ["", "red"]

        with patch.dict(sys.modules, {"sherpa_onnx": make_mock_sherpa_module()}):
            provider.load()
            transcript = provider.transcribe_wav(wav_path)

        self.assertEqual(transcript.text, "red")
        self.assertTrue(transcript.details["short_clip_retry_used"])
        self.assertEqual(len(MockOnlineSherpaRecognizer.instances), 2)


if __name__ == "__main__":
    unittest.main()

