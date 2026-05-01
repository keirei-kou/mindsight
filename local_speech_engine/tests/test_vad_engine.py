from __future__ import annotations

import struct
import unittest
import wave
from datetime import datetime, timezone
from pathlib import Path

from local_speech_engine.vad_engine import (
    EnergyVadDetector,
    VadConfig,
    VadSegmenter,
    VoiceNoteFragment,
    pcm16_rms,
    save_segment_wav,
    save_voice_note_wav,
)


class SequenceDetector:
    name = "test-sequence"

    def __init__(self, decisions: list[bool]) -> None:
        self.decisions = decisions
        self.index = 0

    def is_speech(self, frame: bytes, sample_rate: int) -> bool:
        del frame, sample_rate
        decision = self.decisions[self.index] if self.index < len(self.decisions) else False
        self.index += 1
        return decision


def make_frame(value: int, config: VadConfig) -> bytes:
    return struct.pack("<h", value) * config.frame_samples


class VadEngineTests(unittest.TestCase):
    def test_segment_includes_prebuffer_and_hangover_frames(self) -> None:
        config = VadConfig(sample_rate=16000, frame_ms=20, prebuffer_ms=500, hangover_ms=300)
        decisions = ([False] * 25) + ([True] * 5) + ([False] * 15)
        segmenter = VadSegmenter(config, SequenceDetector(decisions))
        silence = make_frame(0, config)
        speech = make_frame(2000, config)
        events = []

        for index, decision in enumerate(decisions):
            frame = speech if decision else silence
            captured_at = datetime(2026, 4, 30, 12, 0, 0, index * 1000, tzinfo=timezone.utc)
            events.extend(segmenter.process_frame(frame, captured_at=captured_at))

        self.assertEqual(events[0]["type"], "vad_speech_start")
        self.assertEqual(events[-1]["type"], "vad_speech_end")
        segment = events[-1]["segment"]
        self.assertEqual(len(segment.frames), 45)
        self.assertEqual(segment.duration_ms, 900)

    def test_energy_detector_detects_loud_pcm(self) -> None:
        config = VadConfig(sample_rate=16000, frame_ms=20)
        detector = EnergyVadDetector(min_speech_rms=350.0, speech_ratio=3.0)

        self.assertEqual(pcm16_rms(make_frame(0, config)), 0)
        self.assertFalse(detector.is_speech(make_frame(0, config), config.sample_rate))
        self.assertTrue(detector.is_speech(make_frame(2000, config), config.sample_rate))

    def test_save_segment_writes_valid_wav(self) -> None:
        config = VadConfig(sample_rate=16000, frame_ms=20)
        decisions = [True, False]
        segmenter = VadSegmenter(config, SequenceDetector(decisions))
        events = []
        events.extend(segmenter.process_frame(make_frame(2000, config)))
        flush_event = segmenter.flush()
        self.assertIsNotNone(flush_event)
        events.append(flush_event)
        segment = events[-1]["segment"]

        recordings_dir = Path(__file__).resolve().parents[1] / "recordings"
        saved = save_segment_wav(segment, recordings_dir)

        try:
            with wave.open(str(saved.path), "rb") as wav_file:
                self.assertEqual(wav_file.getnchannels(), 1)
                self.assertEqual(wav_file.getsampwidth(), 2)
                self.assertEqual(wav_file.getframerate(), config.sample_rate)
                self.assertGreater(wav_file.getnframes(), 0)
        finally:
            saved.path.unlink(missing_ok=True)

    def test_save_voice_note_writes_separate_prefixed_wav(self) -> None:
        config = VadConfig(sample_rate=16000, frame_ms=20)
        started_at = datetime(2026, 5, 1, 12, 0, 0, 123000, tzinfo=timezone.utc)
        fragment = VoiceNoteFragment(
            index=1,
            frames=(make_frame(1200, config), make_frame(1200, config)),
            started_at=started_at,
            ended_at=started_at,
            sample_rate=config.sample_rate,
            frame_ms=config.frame_ms,
            session_id="session-abc123",
            trial_index=2,
        )

        recordings_dir = Path(__file__).resolve().parents[1] / "recordings"
        saved = save_voice_note_wav(fragment, recordings_dir)

        try:
            self.assertTrue(saved.filename.startswith("voice_note_session-abc1_trial_002_"))
            with wave.open(str(saved.path), "rb") as wav_file:
                self.assertEqual(wav_file.getnchannels(), 1)
                self.assertEqual(wav_file.getsampwidth(), 2)
                self.assertEqual(wav_file.getframerate(), config.sample_rate)
                self.assertGreater(wav_file.getnframes(), 0)
        finally:
            saved.path.unlink(missing_ok=True)


if __name__ == "__main__":
    unittest.main()
