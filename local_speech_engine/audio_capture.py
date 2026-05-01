from __future__ import annotations

from dataclasses import dataclass
from queue import Empty, Full, Queue
from threading import Event
from typing import Optional


class AudioCaptureError(RuntimeError):
    """Raised when the local microphone cannot be opened or read."""


@dataclass(frozen=True)
class AudioCaptureConfig:
    sample_rate: int = 16000
    frame_ms: int = 20
    channels: int = 1
    queue_size: int = 100

    @property
    def frame_samples(self) -> int:
        return max(1, int(self.sample_rate * self.frame_ms / 1000))


class SoundDeviceAudioCapture:
    """Small wrapper around sounddevice RawInputStream for mono PCM frames."""

    def __init__(self, config: AudioCaptureConfig | None = None) -> None:
        self.config = config or AudioCaptureConfig()
        self._queue: Queue[bytes] = Queue(maxsize=self.config.queue_size)
        self._stream = None
        self._last_status = ""
        self.dropped_frames = 0

    @property
    def last_status(self) -> str:
        return self._last_status

    def start(self) -> None:
        if self._stream is not None:
            return

        try:
            import sounddevice as sd
        except Exception as error:  # pragma: no cover - depends on local install
            raise AudioCaptureError(
                "sounddevice is not installed. Install local_speech_engine/requirements.txt."
            ) from error

        def callback(indata, frames, time_info, status) -> None:  # noqa: ANN001
            if status:
                self._last_status = str(status)

            try:
                self._queue.put_nowait(bytes(indata))
            except Full:
                self.dropped_frames += 1

        try:
            self._stream = sd.RawInputStream(
                samplerate=self.config.sample_rate,
                blocksize=self.config.frame_samples,
                channels=self.config.channels,
                dtype="int16",
                callback=callback,
            )
            self._stream.start()
        except Exception as error:  # pragma: no cover - hardware dependent
            self._stream = None
            raise AudioCaptureError(f"Unable to open microphone: {error}") from error

    def read_frame(self, stop_event: Event, timeout_s: float = 0.1) -> Optional[bytes]:
        while not stop_event.is_set():
            try:
                return self._queue.get(timeout=timeout_s)
            except Empty:
                return None

        return None

    def stop(self) -> None:
        stream = self._stream
        self._stream = None
        if stream is None:
            return

        try:
            stream.stop()
        finally:
            stream.close()

