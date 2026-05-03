from __future__ import annotations

import asyncio
import threading
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from .asr import AsrArbiter, AsrProviderError, AsrRegistry, LocalSpeechConfig
from .audio_capture import AudioCaptureConfig, SoundDeviceAudioCapture
from .corpus import CorpusError, delete_recording_segment, save_segment_to_corpus
from .protocol import normalize_command
from .vad_engine import (
    VadConfig,
    VoiceNoteFragment,
    create_vad_detector,
    save_segment_wav,
    save_voice_note_wav,
    utc_now,
    VadSegmenter,
)


PROJECT_ROOT = Path(__file__).resolve().parents[1]
RECORDINGS_DIR = Path(__file__).resolve().parent / "recordings"
DEFAULT_VAD_CONFIG = VadConfig()


def iso_timestamp() -> str:
    return utc_now().isoformat().replace("+00:00", "Z")


def parse_provider_names(value: Any) -> list[str] | None:
    if value is None:
        return None

    if isinstance(value, str):
        names = [name.strip().lower() for name in value.split(",")]
    elif isinstance(value, (list, tuple)):
        names = [str(name).strip().lower() for name in value]
    else:
        names = [str(value).strip().lower()]

    return [name for name in names if name] or None


@dataclass
class VadClient:
    websocket: WebSocket
    queue: asyncio.Queue[dict[str, Any]]
    sender_task: asyncio.Task


class ConnectionManager:
    def __init__(self) -> None:
        self._clients: dict[int, VadClient] = {}

    @property
    def count(self) -> int:
        return len(self._clients)

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue(maxsize=100)
        client_id = id(websocket)
        sender_task = asyncio.create_task(self._send_loop(websocket, queue))
        self._clients[client_id] = VadClient(websocket, queue, sender_task)

    async def disconnect(self, websocket: WebSocket) -> int:
        client = self._clients.pop(id(websocket), None)
        if client:
            client.sender_task.cancel()
            try:
                await client.sender_task
            except asyncio.CancelledError:
                pass
            except Exception:
                pass
        return self.count

    def broadcast_nowait(self, event: dict[str, Any]) -> None:
        for client in list(self._clients.values()):
            if client.queue.full():
                try:
                    client.queue.get_nowait()
                except asyncio.QueueEmpty:
                    pass

            try:
                client.queue.put_nowait(event)
            except asyncio.QueueFull:
                pass

    async def _send_loop(self, websocket: WebSocket, queue: asyncio.Queue[dict[str, Any]]) -> None:
        while True:
            event = await queue.get()
            await websocket.send_json(event)


class LocalVadService:
    def __init__(
        self,
        manager: ConnectionManager,
        config: VadConfig | None = None,
        asr_registry: AsrRegistry | None = None,
    ) -> None:
        self.manager = manager
        self.config = config or DEFAULT_VAD_CONFIG
        self.recordings_dir = RECORDINGS_DIR
        self.asr_registry = asr_registry or AsrRegistry(
            LocalSpeechConfig.from_env(PROJECT_ROOT, self.recordings_dir)
        )
        self.asr_arbiter = AsrArbiter(self.asr_registry)
        self._lock = threading.Lock()
        self._event_lock = threading.Lock()
        self._loop: asyncio.AbstractEventLoop | None = None
        self._worker: threading.Thread | None = None
        self._stop_event: threading.Event | None = None
        self._running = False
        self._sequence = 0
        self._session_id = ""
        self._voice_note_lock = threading.Lock()
        self._voice_note_context: dict[str, Any] | None = None
        self._voice_note_counter = 0
        self._voice_note_direct_worker: threading.Thread | None = None
        self._voice_note_direct_stop_event: threading.Event | None = None

    @property
    def running(self) -> bool:
        with self._lock:
            return self._running

    def health_payload(self) -> dict[str, Any]:
        return {
            "ok": True,
            "running": self.running,
            "sample_rate": self.config.sample_rate,
            "frame_ms": self.config.frame_ms,
            "prebuffer_ms": self.config.prebuffer_ms,
            "hangover_ms": self.config.hangover_ms,
            "recordings_dir": str(self.recordings_dir),
            "asr_auto_transcribe": self.asr_registry.auto_transcribe_enabled,
            "asr_default_provider": self.asr_registry.default_provider_name,
            "asr_providers": [status.to_dict() for status in self.asr_registry.list_statuses()],
        }

    async def start_listening(self) -> None:
        loop = asyncio.get_running_loop()
        with self._lock:
            self._loop = loop
            if self._running:
                self._emit("error", message="Local VAD engine is already listening.")
                return

            self._running = True
            self._session_id = str(uuid.uuid4())
            self._stop_event = threading.Event()
            self._worker = threading.Thread(
                target=self._run_worker,
                args=(self._stop_event, self._session_id),
                name="psilabs-local-vad",
                daemon=True,
            )
            self._worker.start()

    async def stop_listening(self, reason: str = "stop_command") -> None:
        del reason
        with self._lock:
            stop_event = self._stop_event
            if not self._running or stop_event is None:
                return
            stop_event.set()

    def _run_worker(self, stop_event: threading.Event, session_id: str) -> None:
        capture = SoundDeviceAudioCapture(
            AudioCaptureConfig(
                sample_rate=self.config.sample_rate,
                frame_ms=self.config.frame_ms,
                channels=1,
            )
        )
        detector, fallback_reason = create_vad_detector(self.config)
        segmenter = VadSegmenter(self.config, detector)

        try:
            capture.start()
            self._emit(
                "engine_started",
                session_id=session_id,
                sample_rate=self.config.sample_rate,
                frame_ms=self.config.frame_ms,
                prebuffer_ms=self.config.prebuffer_ms,
                hangover_ms=self.config.hangover_ms,
                vad_engine=detector.name,
                vad_fallback_reason=fallback_reason,
            )

            while not stop_event.is_set():
                frame = capture.read_frame(stop_event)
                if frame is None:
                    continue

                if len(frame) != self.config.frame_bytes:
                    self._emit(
                        "error",
                        session_id=session_id,
                        message=(
                            f"Unexpected audio frame size: {len(frame)} bytes "
                            f"(expected {self.config.frame_bytes})."
                        ),
                    )
                    continue

                if self._capture_voice_note_frame(frame):
                    continue

                for vad_event in segmenter.process_frame(frame):
                    self._handle_vad_event(vad_event, session_id)

            flushed_event = segmenter.flush()
            if flushed_event:
                self._handle_vad_event(flushed_event, session_id)
        except Exception as error:
            self._emit("error", session_id=session_id, message=str(error))
        finally:
            try:
                capture.stop()
            except Exception as error:
                self._emit("error", session_id=session_id, message=f"Audio stop failed: {error}")

            with self._lock:
                if self._session_id == session_id:
                    self._running = False
                    self._stop_event = None
                    self._worker = None

            self._emit("engine_stopped", session_id=session_id)

    def _handle_vad_event(self, vad_event: dict[str, Any], session_id: str) -> None:
        event_type = vad_event.get("type")
        if event_type == "vad_speech_start":
            self._emit(
                "vad_speech_start",
                session_id=session_id,
                segment_index=vad_event.get("segment_index"),
            )
            return

        if event_type == "vad_speech_end":
            segment = vad_event.get("segment")
            self._emit(
                "vad_speech_end",
                session_id=session_id,
                segment_index=vad_event.get("segment_index"),
                duration_ms=vad_event.get("duration_ms"),
                reason=vad_event.get("reason"),
            )
            if segment is None:
                return

            saved = save_segment_wav(segment, self.recordings_dir)
            self.asr_registry.remember_segment(saved.path)
            self._emit(
                "segment_saved",
                session_id=session_id,
                filename=saved.filename,
                duration_ms=saved.duration_ms,
                sample_rate=saved.sample_rate,
                prebuffer_ms=saved.prebuffer_ms,
                hangover_ms=saved.hangover_ms,
            )
            if self.asr_registry.auto_transcribe_enabled:
                self._schedule_auto_transcribe(saved.filename, session_id)

    async def start_voice_note_recording(
        self,
        *,
        session_id: str | None = None,
        trial_index: int | None = None,
    ) -> None:
        resolved_session_id = session_id or self._session_id or str(uuid.uuid4())
        context = self._begin_voice_note_context(
            session_id=resolved_session_id,
            trial_index=trial_index,
        )
        if context is None:
            self._emit("voice_note_error", message="Voice note recording is already active.")
            return

        self._emit(
            "voice_note_recording_started",
            session_id=resolved_session_id,
            trial_index=trial_index,
            fragment_index=context["fragment_index"],
            sample_rate=self.config.sample_rate,
        )

        if self.running:
            return

        stop_event = threading.Event()
        worker = threading.Thread(
            target=self._run_voice_note_direct_worker,
            args=(stop_event, resolved_session_id),
            name="psilabs-voice-note",
            daemon=True,
        )
        with self._voice_note_lock:
            self._voice_note_direct_stop_event = stop_event
            self._voice_note_direct_worker = worker
        worker.start()

    async def stop_voice_note_recording(self) -> None:
        with self._voice_note_lock:
            stop_event = self._voice_note_direct_stop_event
            worker = self._voice_note_direct_worker

        if stop_event is not None:
            stop_event.set()
            if worker is not None and worker.is_alive():
                await asyncio.to_thread(worker.join, 2)

        self._finish_voice_note_context(reason="key_released")

    def _begin_voice_note_context(
        self,
        *,
        session_id: str,
        trial_index: int | None,
    ) -> dict[str, Any] | None:
        with self._voice_note_lock:
            direct_worker_active = (
                self._voice_note_direct_worker is not None
                and self._voice_note_direct_worker.is_alive()
            )
            if self._voice_note_context is not None or direct_worker_active:
                return None

            self._voice_note_counter += 1
            context = {
                "session_id": session_id,
                "trial_index": trial_index,
                "fragment_index": self._voice_note_counter,
                "started_at": utc_now(),
                "frames": [],
            }
            self._voice_note_context = context
            return context

    def _capture_voice_note_frame(self, frame: bytes) -> bool:
        with self._voice_note_lock:
            context = self._voice_note_context
            if context is None:
                return False

            context["frames"].append(frame)
            return True

    def _run_voice_note_direct_worker(self, stop_event: threading.Event, session_id: str) -> None:
        capture = SoundDeviceAudioCapture(
            AudioCaptureConfig(
                sample_rate=self.config.sample_rate,
                frame_ms=self.config.frame_ms,
                channels=1,
            )
        )

        try:
            capture.start()
            while not stop_event.is_set():
                frame = capture.read_frame(stop_event)
                if frame is None:
                    continue

                if len(frame) != self.config.frame_bytes:
                    self._emit(
                        "voice_note_error",
                        session_id=session_id,
                        message=(
                            f"Unexpected voice note frame size: {len(frame)} bytes "
                            f"(expected {self.config.frame_bytes})."
                        ),
                    )
                    continue

                self._capture_voice_note_frame(frame)
        except Exception as error:
            self._emit("voice_note_error", session_id=session_id, message=str(error))
        finally:
            try:
                capture.stop()
            except Exception as error:
                self._emit("voice_note_error", session_id=session_id, message=f"Audio stop failed: {error}")

            with self._voice_note_lock:
                if self._voice_note_direct_stop_event is stop_event:
                    self._voice_note_direct_stop_event = None
                    self._voice_note_direct_worker = None

    def _finish_voice_note_context(self, reason: str) -> None:
        with self._voice_note_lock:
            context = self._voice_note_context
            self._voice_note_context = None

        if context is None:
            return

        frames = tuple(context["frames"])
        session_id = context["session_id"]
        trial_index = context["trial_index"]
        fragment_index = context["fragment_index"]
        if not frames:
            self._emit(
                "voice_note_fragment_discarded",
                session_id=session_id,
                trial_index=trial_index,
                fragment_index=fragment_index,
                reason="empty_recording",
            )
            return

        fragment = VoiceNoteFragment(
            index=fragment_index,
            frames=frames,
            started_at=context["started_at"],
            ended_at=utc_now(),
            sample_rate=self.config.sample_rate,
            frame_ms=self.config.frame_ms,
            session_id=session_id,
            trial_index=trial_index,
        )
        saved = save_voice_note_wav(fragment, self.recordings_dir)
        self._emit(
            "voice_note_fragment_saved",
            session_id=session_id,
            trial_index=trial_index,
            fragment_index=saved.fragment_index,
            filename=saved.filename,
            duration_ms=saved.duration_ms,
            sample_rate=saved.sample_rate,
            reason=reason,
        )
        self._schedule_auto_transcribe(saved.filename, session_id, reason="voice_note")

    async def list_asr_providers(self) -> None:
        self._emit_asr_provider_status()

    async def load_asr_provider(self, provider_name: str | None = None) -> None:
        provider_name = provider_name or self.asr_registry.default_provider_name
        self._emit("asr_model_loading", provider=provider_name)
        try:
            status = await asyncio.to_thread(self.asr_registry.load_provider, provider_name)
            self._emit("asr_model_ready", provider=status.name, status=status.to_dict())
        except AsrProviderError as error:
            self._emit("asr_model_error", **error.to_event_payload())
        except Exception as error:
            self._emit(
                "asr_model_error",
                provider=provider_name,
                code="unexpected_error",
                message=str(error),
                setup_hint="Check the local speech engine console for details.",
                details={},
            )
        finally:
            self._emit_asr_provider_status()

    async def transcribe_segment(
        self,
        provider_name: str | None = None,
        filename_or_path: str | None = None,
    ) -> None:
        provider_name = provider_name or self.asr_registry.default_provider_name
        resolved_filename = ""
        try:
            resolved_filename = self.asr_registry.resolve_recording_path(filename_or_path).name
            status = self.asr_registry.provider_status(provider_name)
            if not status.loaded:
                self._emit("asr_model_loading", provider=provider_name)
            transcript = await asyncio.to_thread(
                self.asr_registry.transcribe_segment,
                provider_name,
                filename_or_path,
            )
            self._emit("asr_transcript", **transcript.to_dict())
        except AsrProviderError as error:
            self._emit("asr_transcript_error", filename=resolved_filename or Path(filename_or_path or "").name, **error.to_event_payload())
        except Exception as error:
            self._emit(
                "asr_transcript_error",
                provider=provider_name,
                filename=resolved_filename or Path(filename_or_path or "").name,
                code="unexpected_error",
                message=str(error),
                setup_hint="Check the local speech engine console for details.",
                details={"filename_or_path": filename_or_path or ""},
            )
        finally:
            self._emit_asr_provider_status()

    async def transcribe_latest_segment(self, provider_name: str | None = None) -> None:
        provider_name = provider_name or self.asr_registry.default_provider_name
        resolved_filename = ""
        try:
            resolved_filename = self.asr_registry.latest_recording_path().name
            status = self.asr_registry.provider_status(provider_name)
            if not status.loaded:
                self._emit("asr_model_loading", provider=provider_name)
            transcript = await asyncio.to_thread(self.asr_registry.transcribe_latest, provider_name)
            self._emit("asr_transcript", **transcript.to_dict())
        except AsrProviderError as error:
            self._emit("asr_transcript_error", filename=resolved_filename, **error.to_event_payload())
        except Exception as error:
            self._emit(
                "asr_transcript_error",
                provider=provider_name,
                filename=resolved_filename,
                code="unexpected_error",
                message=str(error),
                setup_hint="Check the local speech engine console for details.",
                details={},
            )
        finally:
            self._emit_asr_provider_status()

    async def arbitrate_segment(
        self,
        *,
        provider_names: list[str] | None = None,
        filename_or_path: str | None = None,
        mode: str | None = None,
        policy: str | None = None,
    ) -> None:
        resolved_filename = Path(filename_or_path or "").name
        selected_providers = provider_names or [self.asr_registry.default_provider_name]
        self._emit(
            "asr_arbitration_started",
            filename=resolved_filename,
            providers=selected_providers,
            mode=mode or "command",
            policy=policy or "hybrid_default",
        )
        try:
            result = await asyncio.to_thread(
                self.asr_arbiter.arbitrate_segment,
                filename_or_path=filename_or_path,
                provider_names=selected_providers,
                mode=mode or "command",
                policy=policy or "hybrid_default",
            )
            for provider_run in result.provider_runs:
                provider_payload = provider_run.to_dict()
                provider_payload["mode"] = result.mode
                provider_payload["policy"] = result.policy_name
                self._emit("asr_provider_result", **provider_payload)
            self._emit("asr_arbitration_result", **result.to_dict())
        except AsrProviderError as error:
            self._emit(
                "asr_arbitration_error",
                filename=resolved_filename,
                providers=selected_providers,
                mode=mode or "command",
                policy=policy or "hybrid_default",
                **error.to_event_payload(),
            )
        except Exception as error:
            self._emit(
                "asr_arbitration_error",
                provider="arbiter",
                filename=resolved_filename,
                providers=selected_providers,
                mode=mode or "command",
                policy=policy or "hybrid_default",
                code="unexpected_error",
                message=str(error),
                setup_hint="Check the local speech engine console for details.",
                details={},
            )
        finally:
            self._emit_asr_provider_status()

    async def arbitrate_latest_segment(
        self,
        *,
        provider_names: list[str] | None = None,
        mode: str | None = None,
        policy: str | None = None,
    ) -> None:
        resolved_filename = ""
        try:
            resolved_filename = self.asr_registry.latest_recording_path().name
        except Exception:
            pass
        await self.arbitrate_segment(
            provider_names=provider_names,
            filename_or_path=resolved_filename,
            mode=mode,
            policy=policy,
        )

    async def save_segment_to_corpus(
        self,
        *,
        source_filename: str | None,
        expected: str | None,
        sample_type: str | None,
        category: str | None,
        notes: str | None = "",
        session_id: str | None = None,
    ) -> None:
        try:
            sample = await asyncio.to_thread(
                save_segment_to_corpus,
                source_filename=source_filename,
                expected=expected,
                sample_type=sample_type,
                category=category,
                notes=notes,
                session_id=session_id,
                recordings_dir=self.recordings_dir,
            )
            self._emit("corpus_sample_saved", sample=sample)
        except CorpusError as error:
            self._emit("corpus_sample_error", **error.to_event_payload())
        except Exception as error:
            self._emit(
                "corpus_sample_error",
                code="unexpected_error",
                message=str(error),
                setup_hint="Check the local speech engine console for details.",
                details={},
            )

    async def delete_recording_segment(self, filename: str | None) -> None:
        resolved_filename = Path(filename or "").name
        try:
            deleted = await asyncio.to_thread(
                delete_recording_segment,
                filename,
                recordings_dir=self.recordings_dir,
            )
            latest_path = self.asr_registry.latest_segment_path
            if latest_path is not None and Path(deleted["path"]).resolve() == latest_path.resolve():
                self.asr_registry.latest_segment_path = None
            self._emit("recording_segment_deleted", **deleted)
        except CorpusError as error:
            self._emit(
                "recording_segment_error",
                filename=resolved_filename,
                **error.to_event_payload(),
            )
        except Exception as error:
            self._emit(
                "recording_segment_error",
                filename=resolved_filename,
                code="unexpected_error",
                message=str(error),
                setup_hint="Check the local speech engine console for details.",
                details={},
            )

    def _emit_asr_provider_status(self) -> None:
        self._emit(
            "asr_provider_status",
            providers=[status.to_dict() for status in self.asr_registry.list_statuses()],
            default_provider=self.asr_registry.default_provider_name,
            auto_transcribe=self.asr_registry.auto_transcribe_enabled,
        )

    def _schedule_auto_transcribe(self, filename: str, session_id: str, reason: str = "auto_transcribe") -> None:
        loop = self._loop
        if loop is None or not loop.is_running():
            return

        async def run_auto_transcribe() -> None:
            self._emit(
                "asr_model_loading",
                provider=self.asr_registry.default_provider_name,
                session_id=session_id,
                filename=filename,
                reason=reason,
            )
            await self.transcribe_segment(
                provider_name=self.asr_registry.default_provider_name,
                filename_or_path=filename,
            )

        loop.call_soon_threadsafe(lambda: asyncio.create_task(run_auto_transcribe()))

    def _next_sequence(self) -> int:
        with self._event_lock:
            self._sequence += 1
            return self._sequence

    def _emit(self, event_type: str, **payload: Any) -> None:
        event = {
            "type": event_type,
            "sequence": self._next_sequence(),
            "timestamp": iso_timestamp(),
            **payload,
        }

        loop = self._loop
        if loop is None or not loop.is_running():
            return

        loop.call_soon_threadsafe(self.manager.broadcast_nowait, event)


manager = ConnectionManager()
service = LocalVadService(manager)
app = FastAPI(title="PsiLabs Local Speech Engine", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5173",
        "http://localhost:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict[str, Any]:
    return service.health_payload()


@app.websocket("/v1/vad")
async def vad_websocket(websocket: WebSocket) -> None:
    await manager.connect(websocket)
    service._loop = asyncio.get_running_loop()

    try:
        while True:
            try:
                payload = await websocket.receive_json()
            except ValueError:
                service._emit("error", message="WebSocket commands must be JSON objects.")
                continue

            command = normalize_command(payload.get("command") or payload.get("type") or payload.get("action"))
            if command == "start_vad":
                await service.start_listening()
            elif command == "stop_vad":
                await service.stop_listening()
            elif command == "list_asr_providers":
                await service.list_asr_providers()
            elif command == "load_asr_provider":
                await service.load_asr_provider(payload.get("provider"))
            elif command == "transcribe_segment":
                await service.transcribe_segment(
                    provider_name=payload.get("provider"),
                    filename_or_path=payload.get("filename") or payload.get("path"),
                )
            elif command == "transcribe_latest_segment":
                await service.transcribe_latest_segment(payload.get("provider"))
            elif command == "arbitrate_segment":
                await service.arbitrate_segment(
                    provider_names=parse_provider_names(payload.get("providers") or payload.get("provider")),
                    filename_or_path=payload.get("filename") or payload.get("path"),
                    mode=payload.get("mode"),
                    policy=payload.get("policy"),
                )
            elif command == "arbitrate_latest_segment":
                await service.arbitrate_latest_segment(
                    provider_names=parse_provider_names(payload.get("providers") or payload.get("provider")),
                    mode=payload.get("mode"),
                    policy=payload.get("policy"),
                )
            elif command == "start_voice_note":
                trial_index = payload.get("trial_index")
                try:
                    trial_index = int(trial_index) if trial_index is not None else None
                except (TypeError, ValueError):
                    trial_index = None
                await service.start_voice_note_recording(
                    session_id=payload.get("session_id"),
                    trial_index=trial_index,
                )
            elif command == "stop_voice_note":
                await service.stop_voice_note_recording()
            elif command == "save_segment_to_corpus":
                await service.save_segment_to_corpus(
                    source_filename=payload.get("source_filename") or payload.get("filename") or payload.get("source"),
                    expected=payload.get("expected"),
                    sample_type=payload.get("sample_type") or payload.get("type"),
                    category=payload.get("category"),
                    notes=payload.get("notes"),
                    session_id=payload.get("session_id"),
                )
            elif command == "delete_recording_segment":
                await service.delete_recording_segment(
                    payload.get("filename") or payload.get("source_filename") or payload.get("path")
                )
            else:
                service._emit("error", message=f"Unknown local VAD command: {command}")
    except WebSocketDisconnect:
        pass
    finally:
        remaining = await manager.disconnect(websocket)
        if remaining == 0:
            await service.stop_listening(reason="last_client_disconnected")
