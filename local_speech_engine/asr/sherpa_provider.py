from __future__ import annotations

import wave
from pathlib import Path
from threading import Lock
from typing import Any

from .base import AsrProviderError, AsrTranscript, ProviderStatus


SHERPA_TOKENS = ("tokens.txt",)
SHERPA_ENCODERS = (
    "encoder-epoch-99-avg-1.int8.onnx",
    "encoder-epoch-99-avg-1.onnx",
    "encoder.onnx",
)
SHERPA_DECODERS = (
    "decoder-epoch-99-avg-1.int8.onnx",
    "decoder-epoch-99-avg-1.onnx",
    "decoder.onnx",
)
SHERPA_JOINERS = (
    "joiner-epoch-99-avg-1.int8.onnx",
    "joiner-epoch-99-avg-1.onnx",
    "joiner.onnx",
)
STREAMING_TAIL_PADDING_SECONDS = 2.0
STREAMING_LEADING_PADDING_SECONDS = 0.5
SHORT_CLIP_RETRY_MAX_DURATION_MS = 2500
SHORT_CLIP_RETRY_MIN_AMPLITUDE = 0.01
RESULT_REPR_LIMIT = 500


def _first_existing(model_dir: Path, names: tuple[str, ...]) -> Path | None:
    for name in names:
        path = model_dir / name
        if path.exists() and path.is_file():
            return path
    return None


def _get_package_error() -> AsrProviderError | None:
    try:
        import sherpa_onnx  # pyright: ignore[reportMissingImports]  # noqa: F401
    except Exception as error:
        return AsrProviderError(
            provider="sherpa",
            code="package_missing",
            message="The sherpa-onnx Python package is not installed or could not be imported.",
            setup_hint="Install sherpa-onnx after selecting a model layout: pip install sherpa-onnx.",
            details={"error": str(error)},
        )

    return None


class SherpaOnnxAsrProvider:
    name = "sherpa"

    def __init__(self, model_dir: Path | None, project_root: Path, enabled: bool = True) -> None:
        self.model_dir = model_dir
        self.project_root = project_root
        self.enabled = enabled
        self._recognizer: Any | None = None
        self._short_clip_recognizer: Any | None = None
        self._loaded_model_dir: Path | None = None
        self._loaded_model_files: dict[str, Path | None] | None = None
        self._is_streaming: bool = False
        self._lock = Lock()

    def _resolve_model_dir(self) -> Path | None:
        if self.model_dir is None:
            return None
        return self.model_dir if self.model_dir.is_absolute() else self.project_root / self.model_dir

    def _resolve_model_files(self, model_dir: Path) -> tuple[dict[str, Path | None], list[str]]:
        files = {
            "tokens": _first_existing(model_dir, SHERPA_TOKENS),
            "encoder": _first_existing(model_dir, SHERPA_ENCODERS),
            "decoder": _first_existing(model_dir, SHERPA_DECODERS),
            "joiner": _first_existing(model_dir, SHERPA_JOINERS),
        }
        missing = [name for name, path in files.items() if path is None]
        return files, missing

    def status(self) -> ProviderStatus:
        model_dir = self._resolve_model_dir()
        model_path = str(model_dir or self.model_dir or "")

        if not self.enabled:
            return ProviderStatus(
                name=self.name,
                enabled=False,
                available=False,
                loaded=False,
                model_path=model_path,
                message="Sherpa ONNX provider is disabled.",
                setup_hint="Set LOCAL_SPEECH_ENABLE_SHERPA=true to enable it.",
            )

        package_error = _get_package_error()
        if package_error:
            return ProviderStatus(
                name=self.name,
                enabled=True,
                available=False,
                loaded=False,
                model_path=model_path,
                message=package_error.message,
                setup_hint=package_error.setup_hint,
                details=package_error.details | {"code": package_error.code},
            )

        if model_dir is None:
            return ProviderStatus(
                name=self.name,
                enabled=True,
                available=False,
                loaded=False,
                model_path=model_path,
                message="LOCAL_SPEECH_SHERPA_MODEL_DIR is not configured.",
                setup_hint="Set LOCAL_SPEECH_SHERPA_MODEL_DIR to an extracted Sherpa ONNX streaming or offline transducer model folder.",
                details={"code": "model_dir_missing"},
            )

        resolved_model_dir = model_dir.resolve()
        if not resolved_model_dir.exists() or not resolved_model_dir.is_dir():
            return ProviderStatus(
                name=self.name,
                enabled=True,
                available=False,
                loaded=False,
                model_path=str(resolved_model_dir),
                message=f"Sherpa ONNX model directory does not exist: {resolved_model_dir}",
                setup_hint="Download and extract a Sherpa ONNX streaming or offline transducer model, then point LOCAL_SPEECH_SHERPA_MODEL_DIR at that folder.",
                details={"code": "model_dir_missing", "model_dir": str(resolved_model_dir)},
            )

        files, missing = self._resolve_model_files(resolved_model_dir)
        details = {
            "model_dir": str(resolved_model_dir),
            "model_files": {name: str(path) for name, path in files.items() if path is not None},
        }
        if missing:
            return ProviderStatus(
                name=self.name,
                enabled=True,
                available=False,
                loaded=False,
                model_path=str(resolved_model_dir),
                message="Sherpa ONNX model directory is missing required transducer files.",
                setup_hint="Use an extracted Sherpa ONNX transducer model with tokens.txt plus encoder, decoder, and joiner ONNX files.",
                details=details | {"code": "model_files_missing", "missing": missing},
            )

        return ProviderStatus(
            name=self.name,
            enabled=True,
            available=True,
            loaded=self._recognizer is not None,
            model_path=str(resolved_model_dir),
            message="Sherpa ONNX model is ready." if self._recognizer is not None else "Sherpa ONNX provider is available.",
            details=details,
        )

    def is_available(self) -> bool:
        return self.status().available

    def load(self) -> ProviderStatus:
        with self._lock:
            if self._recognizer is not None:
                return self.status()

            if not self.enabled:
                raise AsrProviderError(
                    provider=self.name,
                    code="provider_disabled",
                    message="Sherpa ONNX provider is disabled.",
                    setup_hint="Set LOCAL_SPEECH_ENABLE_SHERPA=true to enable it.",
                )

            model_dir = self._resolve_model_dir()
            if model_dir is None:
                raise AsrProviderError(
                    provider=self.name,
                    code="model_dir_missing",
                    message="LOCAL_SPEECH_SHERPA_MODEL_DIR is not configured.",
                    setup_hint="Set LOCAL_SPEECH_SHERPA_MODEL_DIR to an extracted Sherpa ONNX streaming or offline transducer model folder.",
                )

            resolved_model_dir = model_dir.resolve()
            if not resolved_model_dir.exists() or not resolved_model_dir.is_dir():
                raise AsrProviderError(
                    provider=self.name,
                    code="model_dir_missing",
                    message=f"Sherpa ONNX model directory does not exist: {resolved_model_dir}",
                    setup_hint="Download and extract a Sherpa ONNX streaming or offline transducer model, then point LOCAL_SPEECH_SHERPA_MODEL_DIR at that folder.",
                    details={"model_dir": str(resolved_model_dir)},
                )

            files, missing = self._resolve_model_files(resolved_model_dir)
            if missing:
                raise AsrProviderError(
                    provider=self.name,
                    code="model_files_missing",
                    message="Sherpa ONNX model directory is missing required transducer files.",
                    setup_hint="Use an extracted Sherpa ONNX transducer model with tokens.txt plus encoder, decoder, and joiner ONNX files.",
                    details={"model_dir": str(resolved_model_dir), "missing": missing},
                )

            package_error = _get_package_error()
            if package_error:
                raise package_error

            is_streaming = "streaming" in resolved_model_dir.name.lower()

            try:
                import sherpa_onnx  # pyright: ignore[reportMissingImports]

                if is_streaming:
                    self._recognizer = sherpa_onnx.OnlineRecognizer.from_transducer(
                        encoder=str(files["encoder"]),
                        decoder=str(files["decoder"]),
                        joiner=str(files["joiner"]),
                        tokens=str(files["tokens"]),
                        num_threads=1,
                        sample_rate=16000,
                        feature_dim=80,
                        decoding_method="greedy_search",
                        enable_endpoint_detection=False,
                        debug=False,
                    )
                else:
                    self._recognizer = sherpa_onnx.OfflineRecognizer.from_transducer(
                        encoder=str(files["encoder"]),
                        decoder=str(files["decoder"]),
                        joiner=str(files["joiner"]),
                        tokens=str(files["tokens"]),
                        num_threads=1,
                        sample_rate=16000,
                        feature_dim=80,
                        decoding_method="greedy_search",
                        debug=False,
                    )
                self._is_streaming = is_streaming
                self._loaded_model_dir = resolved_model_dir
                self._loaded_model_files = files
            except Exception as error:
                raise AsrProviderError(
                    provider=self.name,
                    code="model_load_failed",
                    message=f"Unable to load Sherpa ONNX model: {error}",
                    setup_hint=(
                        "Confirm sherpa-onnx is installed and LOCAL_SPEECH_SHERPA_MODEL_DIR points to a compatible "
                        f"{'streaming' if is_streaming else 'offline'} transducer model."
                    ),
                    details={
                        "model_dir": str(resolved_model_dir),
                        "model_kind": "online" if is_streaming else "offline",
                        "error": str(error),
                    },
                ) from error

            return self.status()

    def transcribe_wav(self, path: Path) -> AsrTranscript:
        self.load()
        assert self._recognizer is not None

        try:
            import numpy as np  # pyright: ignore[reportMissingImports]

            with wave.open(str(path), "rb") as wav_file:
                channels = wav_file.getnchannels()
                sample_width = wav_file.getsampwidth()
                sample_rate = wav_file.getframerate()
                frame_count = wav_file.getnframes()
                duration_ms = int(round((frame_count / sample_rate) * 1000)) if sample_rate else None

                if channels != 1 or sample_width != 2:
                    raise AsrProviderError(
                        provider=self.name,
                        code="unsupported_wav_format",
                        message="Sherpa ONNX transcription expects mono 16-bit PCM WAV files.",
                        setup_hint="Use WAV files generated by the local VAD sidecar.",
                        details={"channels": channels, "sample_width": sample_width},
                    )

                pcm = wav_file.readframes(frame_count)

            samples = np.frombuffer(pcm, dtype=np.int16).astype(np.float32) / 32768.0
            max_abs_amplitude = float(np.max(np.abs(samples))) if samples.size else 0.0
            decode_iterations = 0
            raw_result: Any | None = None
            stream_result: Any | None = None

            if self._is_streaming:
                leading_paddings = np.zeros(int(STREAMING_LEADING_PADDING_SECONDS * sample_rate), dtype=np.float32)
                tail_paddings = np.zeros(int(STREAMING_TAIL_PADDING_SECONDS * sample_rate), dtype=np.float32)

                def decode_online(recognizer: Any) -> tuple[str, int, Any, Any]:
                    online_stream = recognizer.create_stream()
                    online_stream.accept_waveform(sample_rate, leading_paddings)
                    online_stream.accept_waveform(sample_rate, samples)
                    online_stream.accept_waveform(sample_rate, tail_paddings)
                    online_stream.input_finished()

                    iterations = 0
                    while recognizer.is_ready(online_stream):
                        recognizer.decode_stream(online_stream)
                        iterations += 1

                    result = recognizer.get_result(online_stream)
                    result_text = result.strip() if isinstance(result, str) else str(getattr(result, "text", "") or "").strip()
                    return result_text, iterations, result, getattr(online_stream, "result", None)

                text, decode_iterations, raw_result, stream_result = decode_online(self._recognizer)
                used_short_clip_retry = False
                should_retry_short_clip = (
                    not text
                    and duration_ms is not None
                    and duration_ms <= SHORT_CLIP_RETRY_MAX_DURATION_MS
                    and max_abs_amplitude >= SHORT_CLIP_RETRY_MIN_AMPLITUDE
                )
                if should_retry_short_clip:
                    import sherpa_onnx  # pyright: ignore[reportMissingImports]

                    if self._short_clip_recognizer is None:
                        files = self._loaded_model_files
                        if not files:
                            raise RuntimeError("Sherpa ONNX streaming model files were not retained after load.")

                        self._short_clip_recognizer = sherpa_onnx.OnlineRecognizer.from_transducer(
                            encoder=str(files["encoder"]),
                            decoder=str(files["decoder"]),
                            joiner=str(files["joiner"]),
                            tokens=str(files["tokens"]),
                            num_threads=1,
                            sample_rate=16000,
                            feature_dim=80,
                            decoding_method="modified_beam_search",
                            max_active_paths=4,
                            enable_endpoint_detection=False,
                            debug=False,
                        )

                    retry_text, retry_iterations, retry_result, retry_stream_result = decode_online(self._short_clip_recognizer)
                    if retry_text:
                        text = retry_text
                        decode_iterations = retry_iterations
                        raw_result = retry_result
                        stream_result = retry_stream_result
                        used_short_clip_retry = True
            else:
                stream = self._recognizer.create_stream()
                stream.accept_waveform(sample_rate, samples)
                self._recognizer.decode_streams([stream])
                decode_iterations = 1
                stream_result = getattr(stream, "result", None)
                text = str(getattr(stream.result, "text", "") or "").strip()
                used_short_clip_retry = False

            return AsrTranscript(
                provider=self.name,
                filename=path.name,
                text=text,
                confidence=None,
                duration_ms=duration_ms,
                sample_rate=sample_rate,
                details={
                    "model_path": str(self._loaded_model_dir or ""),
                    "model_kind": "online" if self._is_streaming else "offline",
                    "sample_count": int(samples.size),
                    "max_abs_amplitude": max_abs_amplitude,
                    "decode_iterations": decode_iterations,
                    "leading_padding_ms": int(STREAMING_LEADING_PADDING_SECONDS * 1000) if self._is_streaming else 0,
                    "tail_padding_ms": int(STREAMING_TAIL_PADDING_SECONDS * 1000) if self._is_streaming else 0,
                    "short_clip_retry_used": used_short_clip_retry,
                    "raw_result_type": type(raw_result).__name__ if raw_result is not None else "",
                    "raw_result_repr": repr(raw_result)[:RESULT_REPR_LIMIT] if raw_result is not None else "",
                    "stream_result_type": type(stream_result).__name__ if stream_result is not None else "",
                    "stream_result_repr": repr(stream_result)[:RESULT_REPR_LIMIT] if stream_result is not None else "",
                },
            )
        except AsrProviderError:
            raise
        except Exception as error:
            raise AsrProviderError(
                provider=self.name,
                code="transcription_failed",
                message=f"Sherpa ONNX transcription failed: {error}",
                setup_hint="Confirm the WAV is readable mono 16-bit PCM and the Sherpa model is loaded.",
                details={"path": str(path), "error": str(error)},
            ) from error

    def unload(self) -> None:
        with self._lock:
            self._recognizer = None
            self._short_clip_recognizer = None
            self._loaded_model_dir = None
            self._loaded_model_files = None
            self._is_streaming = False
