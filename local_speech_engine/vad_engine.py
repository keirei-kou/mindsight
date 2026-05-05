from __future__ import annotations

import math
import re
import struct
import wave
from collections import deque
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Protocol


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


@dataclass(frozen=True)
class VadConfig:
    sample_rate: int = 16000
    frame_ms: int = 20
    prebuffer_ms: int = 500
    hangover_ms: int = 300
    aggressiveness: int = 2
    min_speech_rms: float = 350.0
    energy_speech_ratio: float = 3.0

    @property
    def frame_samples(self) -> int:
        return max(1, int(self.sample_rate * self.frame_ms / 1000))

    @property
    def frame_bytes(self) -> int:
        return self.frame_samples * 2

    @property
    def prebuffer_frames(self) -> int:
        return max(1, int(round(self.prebuffer_ms / self.frame_ms)))

    @property
    def hangover_frames(self) -> int:
        return max(1, int(round(self.hangover_ms / self.frame_ms)))


class VadDetector(Protocol):
    name: str

    def is_speech(self, frame: bytes, sample_rate: int) -> bool:
        ...


class WebRtcVadDetector:
    name = "webrtcvad"

    def __init__(self, aggressiveness: int) -> None:
        import webrtcvad

        self._vad = webrtcvad.Vad(aggressiveness)

    def is_speech(self, frame: bytes, sample_rate: int) -> bool:
        return bool(self._vad.is_speech(frame, sample_rate))


class EnergyVadDetector:
    name = "energy"

    def __init__(self, min_speech_rms: float = 350.0, speech_ratio: float = 3.0) -> None:
        self.min_speech_rms = min_speech_rms
        self.speech_ratio = speech_ratio
        self.noise_floor = 80.0

    def is_speech(self, frame: bytes, sample_rate: int) -> bool:
        del sample_rate
        rms = pcm16_rms(frame)
        threshold = max(self.min_speech_rms, self.noise_floor * self.speech_ratio)
        speech = rms >= threshold

        if not speech:
            self.noise_floor = (self.noise_floor * 0.95) + (rms * 0.05)

        return speech


def pcm16_rms(frame: bytes) -> float:
    sample_count = len(frame) // 2
    if sample_count == 0:
        return 0.0

    total = 0
    for (sample,) in struct.iter_unpack("<h", frame[: sample_count * 2]):
        total += sample * sample

    return math.sqrt(total / sample_count)


def create_vad_detector(config: VadConfig) -> tuple[VadDetector, str]:
    try:
        detector = WebRtcVadDetector(config.aggressiveness)
        detector.is_speech(bytes(config.frame_bytes), config.sample_rate)
        return detector, ""
    except Exception as error:
        return (
            EnergyVadDetector(
                min_speech_rms=config.min_speech_rms,
                speech_ratio=config.energy_speech_ratio,
            ),
            f"WebRTC VAD unavailable; using energy fallback. {error}",
        )


@dataclass(frozen=True)
class SpeechSegment:
    index: int
    frames: tuple[bytes, ...]
    started_at: datetime
    ended_at: datetime
    sample_rate: int
    frame_ms: int
    prebuffer_ms: int
    hangover_ms: int

    @property
    def pcm_bytes(self) -> bytes:
        return b"".join(self.frames)

    @property
    def duration_ms(self) -> int:
        sample_count = len(self.pcm_bytes) // 2
        return int(round((sample_count / self.sample_rate) * 1000))


@dataclass(frozen=True)
class SavedSegment:
    filename: str
    path: Path
    duration_ms: int
    sample_rate: int
    prebuffer_ms: int
    hangover_ms: int


@dataclass(frozen=True)
class VoiceNoteFragment:
    index: int
    frames: tuple[bytes, ...]
    started_at: datetime
    ended_at: datetime
    sample_rate: int
    frame_ms: int
    session_id: str
    trial_index: int | None

    @property
    def pcm_bytes(self) -> bytes:
        return b"".join(self.frames)

    @property
    def duration_ms(self) -> int:
        sample_count = len(self.pcm_bytes) // 2
        return int(round((sample_count / self.sample_rate) * 1000))


@dataclass(frozen=True)
class SavedVoiceNoteFragment:
    filename: str
    path: Path
    duration_ms: int
    sample_rate: int
    trial_index: int | None
    fragment_index: int


class VadSegmenter:
    def __init__(self, config: VadConfig, detector: VadDetector) -> None:
        self.config = config
        self.detector = detector
        self._prebuffer: deque[bytes] = deque(maxlen=config.prebuffer_frames)
        self._segment_frames: list[bytes] = []
        self._segment_started_at: datetime | None = None
        self._silence_frames = 0
        self._segment_index = 0
        self._in_speech = False

    @property
    def in_speech(self) -> bool:
        return self._in_speech

    def process_frame(self, frame: bytes, captured_at: datetime | None = None) -> list[dict]:
        captured_at = captured_at or utc_now()
        speech = self.detector.is_speech(frame, self.config.sample_rate)
        events: list[dict] = []

        if not self._in_speech:
            if speech:
                self._segment_index += 1
                self._in_speech = True
                self._silence_frames = 0
                self._segment_started_at = captured_at
                self._segment_frames = [*self._prebuffer, frame]
                events.append({
                    "type": "vad_speech_start",
                    "segment_index": self._segment_index,
                })
            else:
                self._prebuffer.append(frame)
            return events

        self._segment_frames.append(frame)
        if speech:
            self._silence_frames = 0
        else:
            self._silence_frames += 1

        if self._silence_frames >= self.config.hangover_frames:
            events.append(self._finish_segment(captured_at, reason="hangover"))

        return events

    def flush(self, captured_at: datetime | None = None) -> dict | None:
        if not self._in_speech:
            return None

        return self._finish_segment(captured_at or utc_now(), reason="stop_requested")

    def _finish_segment(self, ended_at: datetime, reason: str) -> dict:
        started_at = self._segment_started_at or ended_at
        segment = SpeechSegment(
            index=self._segment_index,
            frames=tuple(self._segment_frames),
            started_at=started_at,
            ended_at=ended_at,
            sample_rate=self.config.sample_rate,
            frame_ms=self.config.frame_ms,
            prebuffer_ms=self.config.prebuffer_ms,
            hangover_ms=self.config.hangover_ms,
        )
        trailing_silence = self._segment_frames[-self._silence_frames:] if self._silence_frames else []
        self._prebuffer = deque(trailing_silence, maxlen=self.config.prebuffer_frames)
        self._segment_frames = []
        self._segment_started_at = None
        self._silence_frames = 0
        self._in_speech = False

        return {
            "type": "vad_speech_end",
            "segment_index": segment.index,
            "duration_ms": segment.duration_ms,
            "reason": reason,
            "segment": segment,
        }


def build_segment_filename(segment: SpeechSegment) -> str:
    stamp = segment.started_at.astimezone(timezone.utc).strftime("%Y%m%dT%H%M%S")
    millis = int(segment.started_at.microsecond / 1000)
    return f"vad_segment_{stamp}_{millis:03d}Z_{segment.index:04d}.wav"


_RECORDING_SLUG_RE = re.compile(r"[^a-z0-9_-]+")


def slugify_recording_filename_part(value: str | None) -> str:
    normalized = str(value or "").strip().lower().replace("|", "-")
    normalized = re.sub(r"\s+", "_", normalized)
    normalized = _RECORDING_SLUG_RE.sub("", normalized)
    normalized = re.sub(r"_+", "_", normalized)
    normalized = re.sub(r"-+", "-", normalized)
    return normalized.strip("_-")


def build_contextual_segment_filename(segment: SpeechSegment, *, expected: str | None, notes: str | None) -> str:
    expected_slug = slugify_recording_filename_part(expected)
    if not expected_slug:
        return build_segment_filename(segment)

    notes_slug = slugify_recording_filename_part(notes)
    stamp = segment.started_at.astimezone(timezone.utc).strftime("%Y%m%dT%H%M%S")
    stem = f"{expected_slug}__{notes_slug}" if notes_slug else expected_slug
    return f"{stem}__{stamp}.wav"


def _unique_recording_path(recordings_dir: Path, filename: str) -> Path:
    path = recordings_dir / filename
    if not path.exists():
        return path

    stem = path.stem
    suffix = path.suffix
    index = 2
    while True:
        candidate = recordings_dir / f"{stem}__{index:03d}{suffix}"
        if not candidate.exists():
            return candidate
        index += 1


def save_segment_wav(
    segment: SpeechSegment,
    recordings_dir: Path,
    *,
    expected: str | None = None,
    notes: str | None = None,
) -> SavedSegment:
    recordings_dir.mkdir(parents=True, exist_ok=True)
    filename = build_contextual_segment_filename(segment, expected=expected, notes=notes)
    path = _unique_recording_path(recordings_dir, filename)
    filename = path.name

    with wave.open(str(path), "wb") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(segment.sample_rate)
        wav_file.writeframes(segment.pcm_bytes)

    return SavedSegment(
        filename=filename,
        path=path,
        duration_ms=segment.duration_ms,
        sample_rate=segment.sample_rate,
        prebuffer_ms=segment.prebuffer_ms,
        hangover_ms=segment.hangover_ms,
    )


def build_voice_note_filename(fragment: VoiceNoteFragment) -> str:
    stamp = fragment.started_at.astimezone(timezone.utc).strftime("%Y%m%dT%H%M%S")
    millis = int(fragment.started_at.microsecond / 1000)
    session_part = "".join(
        char for char in fragment.session_id[:12].lower()
        if char.isalnum() or char == "-"
    ) or "session"
    trial_part = f"trial_{fragment.trial_index:03d}" if fragment.trial_index else "trial_unknown"
    return f"voice_note_{session_part}_{trial_part}_{stamp}_{millis:03d}Z_{fragment.index:03d}.wav"


def save_voice_note_wav(fragment: VoiceNoteFragment, recordings_dir: Path) -> SavedVoiceNoteFragment:
    recordings_dir.mkdir(parents=True, exist_ok=True)
    filename = build_voice_note_filename(fragment)
    path = recordings_dir / filename

    with wave.open(str(path), "wb") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(fragment.sample_rate)
        wav_file.writeframes(fragment.pcm_bytes)

    return SavedVoiceNoteFragment(
        filename=filename,
        path=path,
        duration_ms=fragment.duration_ms,
        sample_rate=fragment.sample_rate,
        trial_index=fragment.trial_index,
        fragment_index=fragment.index,
    )
