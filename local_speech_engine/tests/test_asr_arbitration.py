from __future__ import annotations

import shutil
import struct
import unittest
import wave
from pathlib import Path

from local_speech_engine.asr.arbitrator import AsrArbiter
from local_speech_engine.asr.base import AsrProviderError, AsrTranscript
from local_speech_engine.asr.normalization import VOICE_NOTE_PROFILE
from local_speech_engine.asr.policies import (
    CONFIDENCE_WEIGHTED_POLICY,
    HYBRID_DEFAULT_POLICY,
    PROVIDER_PRIORITY_POLICY,
)


TEST_ROOT = Path(__file__).resolve().parent / "_arbitration_test_data"


class FakeProvider:
    def __init__(
        self,
        name: str,
        text: str = "",
        *,
        confidence: float | None = None,
        error: Exception | None = None,
    ) -> None:
        self.name = name
        self.text = text
        self.confidence = confidence
        self.error = error

    def transcribe_wav(self, path: Path) -> AsrTranscript:
        if self.error:
            raise self.error

        return AsrTranscript(
            provider=self.name,
            filename=path.name,
            text=self.text,
            confidence=self.confidence,
            duration_ms=100,
            sample_rate=16000,
        )


class FakeRegistry:
    default_provider_name = "vosk"

    def __init__(self, providers: list[FakeProvider], recordings_dir: Path) -> None:
        self.providers = {provider.name: provider for provider in providers}
        self.recordings_dir = recordings_dir
        self.latest_segment_path: Path | None = None

    def get_provider(self, provider_name: str | None = None) -> FakeProvider:
        name = provider_name or self.default_provider_name
        provider = self.providers.get(name)
        if provider is None:
            raise AsrProviderError(
                provider=name,
                code="unknown_provider",
                message=f"Unknown ASR provider: {name}",
            )
        return provider

    def resolve_recording_path(self, filename_or_path: str | None) -> Path:
        if not filename_or_path:
            raise AsrProviderError(
                provider="registry",
                code="segment_path_missing",
                message="No WAV segment filename or path was provided.",
            )

        path = Path(filename_or_path)
        if not path.is_absolute():
            path = self.recordings_dir / path
        return path.resolve()

    def latest_recording_path(self) -> Path:
        if self.latest_segment_path is None:
            raise AsrProviderError(
                provider="registry",
                code="latest_segment_missing",
                message="No latest segment.",
            )
        return self.latest_segment_path


def make_test_wav(path: Path) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(16000)
        wav_file.writeframes(struct.pack("<h", 1000) * 1600)
    return path


class AsrArbitrationTests(unittest.TestCase):
    def setUp(self) -> None:
        if TEST_ROOT.exists():
            shutil.rmtree(TEST_ROOT)
        self.recordings_dir = TEST_ROOT / "recordings"
        self.wav_path = make_test_wav(self.recordings_dir / "segment.wav")

    def tearDown(self) -> None:
        if TEST_ROOT.exists():
            shutil.rmtree(TEST_ROOT)

    def make_arbiter(
        self,
        providers: list[FakeProvider],
        *,
        provider_priority: tuple[str, ...] = ("vosk", "sherpa"),
    ) -> AsrArbiter:
        registry = FakeRegistry(providers, self.recordings_dir)
        registry.latest_segment_path = self.wav_path
        return AsrArbiter(
            registry,
            provider_priority=provider_priority,
            command_vocabulary=("red", "blue", "green"),
        )

    def test_agreement_beats_confidence(self) -> None:
        arbiter = self.make_arbiter([
            FakeProvider("vosk", "read", confidence=0.1),
            FakeProvider("sherpa", "red", confidence=0.2),
            FakeProvider("other", "blue", confidence=0.99),
        ])

        result = arbiter.arbitrate_segment(
            filename_or_path="segment.wav",
            provider_names=["vosk", "sherpa", "other"],
        )

        self.assertEqual(result.final_command, "red")
        self.assertEqual(result.final_text, "red")
        self.assertEqual(result.decision_reason, "agreement")
        self.assertEqual(result.policy_name, HYBRID_DEFAULT_POLICY)

    def test_vocabulary_validity_beats_cross_provider_confidence(self) -> None:
        arbiter = self.make_arbiter([
            FakeProvider("confident", "table", confidence=0.99),
            FakeProvider("noisy", "bread", confidence=0.1),
        ])

        result = arbiter.arbitrate_segment(
            filename_or_path="segment.wav",
            provider_names=["confident", "noisy"],
        )

        self.assertEqual(result.final_command, "red")
        self.assertEqual(result.decision_reason, "vocabulary")

    def test_confidence_breaks_ties_after_valid_command_mapping(self) -> None:
        arbiter = self.make_arbiter([
            FakeProvider("vosk", "green", confidence=0.2),
            FakeProvider("sherpa", "blue", confidence=0.9),
        ])

        result = arbiter.arbitrate_segment(
            filename_or_path="segment.wav",
            provider_names=["vosk", "sherpa"],
        )

        self.assertEqual(result.final_command, "blue")
        self.assertEqual(result.decision_reason, "confidence")

    def test_provider_priority_breaks_remaining_ties(self) -> None:
        arbiter = self.make_arbiter([
            FakeProvider("vosk", "green"),
            FakeProvider("sherpa", "blue"),
        ])

        result = arbiter.arbitrate_segment(
            filename_or_path="segment.wav",
            provider_names=["vosk", "sherpa"],
        )

        self.assertEqual(result.final_command, "green")
        self.assertEqual(result.decision_reason, "provider_priority")

    def test_confidence_weighted_can_beat_agreement_when_explicitly_selected(self) -> None:
        arbiter = self.make_arbiter([
            FakeProvider("vosk", "read", confidence=0.1),
            FakeProvider("sherpa", "red", confidence=0.2),
            FakeProvider("other", "blue", confidence=0.99),
        ])

        hybrid_result = arbiter.arbitrate_segment(
            filename_or_path="segment.wav",
            provider_names=["vosk", "sherpa", "other"],
            policy=HYBRID_DEFAULT_POLICY,
        )
        confidence_result = arbiter.arbitrate_segment(
            filename_or_path="segment.wav",
            provider_names=["vosk", "sherpa", "other"],
            policy=CONFIDENCE_WEIGHTED_POLICY,
        )

        self.assertEqual(hybrid_result.final_command, "red")
        self.assertEqual(confidence_result.final_command, "blue")
        self.assertEqual(confidence_result.policy_name, CONFIDENCE_WEIGHTED_POLICY)
        self.assertEqual(confidence_result.decision_reason, "confidence")

    def test_provider_priority_policy_can_override_agreement(self) -> None:
        arbiter = self.make_arbiter([
            FakeProvider("vosk", "green"),
            FakeProvider("sherpa", "blue"),
            FakeProvider("other", "blue"),
        ])

        result = arbiter.arbitrate_segment(
            filename_or_path="segment.wav",
            provider_names=["vosk", "sherpa", "other"],
            policy=PROVIDER_PRIORITY_POLICY,
        )

        self.assertEqual(result.final_command, "green")
        self.assertEqual(result.policy_name, PROVIDER_PRIORITY_POLICY)
        self.assertEqual(result.decision_reason, "provider_priority")

    def test_invalid_policy_falls_back_to_default_with_metadata(self) -> None:
        arbiter = self.make_arbiter([
            FakeProvider("vosk", "red"),
        ])

        result = arbiter.arbitrate_segment(
            filename_or_path="segment.wav",
            provider_names=["vosk"],
            policy="not_real",
        )

        self.assertEqual(result.policy_name, HYBRID_DEFAULT_POLICY)
        self.assertTrue(result.details["policy_fallback"])
        self.assertEqual(result.details["requested_policy"], "not_real")
        self.assertEqual(result.final_command, "red")

    def test_provider_failures_are_preserved_as_structured_results(self) -> None:
        provider_error = AsrProviderError(
            provider="vosk",
            code="model_missing",
            message="Model missing.",
            setup_hint="Install the model.",
            details={"path": "missing"},
        )
        arbiter = self.make_arbiter([
            FakeProvider("vosk", error=provider_error),
            FakeProvider("sherpa", "red", confidence=0.4),
        ])

        result = arbiter.arbitrate_segment(
            filename_or_path="segment.wav",
            provider_names=["vosk", "sherpa"],
        )
        failed_run = next(run for run in result.provider_runs if run.provider == "vosk")

        self.assertEqual(result.final_command, "red")
        self.assertFalse(failed_run.ok)
        self.assertEqual(failed_run.error["code"], "model_missing")
        self.assertEqual(failed_run.error["details"], {"path": "missing"})

    def test_voice_note_mode_avoids_command_normalization(self) -> None:
        arbiter = self.make_arbiter([
            FakeProvider("vosk", "  Red,  bread.  ", confidence=0.7),
        ])

        result = arbiter.arbitrate_segment(
            filename_or_path="segment.wav",
            provider_names=["vosk"],
            mode=VOICE_NOTE_PROFILE,
        )

        self.assertEqual(result.final_text, "Red, bread.")
        self.assertIsNone(result.final_command)
        self.assertEqual(result.candidates[0].normalized_text, "Red, bread.")
        self.assertIsNone(result.candidates[0].command)


if __name__ == "__main__":
    unittest.main()
