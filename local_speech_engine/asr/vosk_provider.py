from __future__ import annotations

import json
import wave
from pathlib import Path
from threading import Lock
from typing import Any

from .base import AsrProviderError, AsrTranscript, ProviderStatus


VOSK_REQUIRED_FILES = (
    Path("am") / "final.mdl",
    Path("conf") / "model.conf",
    Path("graph") / "HCLr.fst",
    Path("graph") / "Gr.fst",
)


def resolve_model_path(path: Path | None, project_root: Path) -> Path | None:
    if path is None:
        return None

    return path if path.is_absolute() else project_root / path


def validate_vosk_model_dir(path: Path | None, project_root: Path) -> tuple[Path, list[str]]:
    if path is None:
        raise AsrProviderError(
            provider="vosk",
            code="model_path_missing",
            message="LOCAL_SPEECH_VOSK_MODEL_PATH is not configured.",
            setup_hint="Set LOCAL_SPEECH_VOSK_MODEL_PATH to an extracted Vosk model directory.",
        )

    resolved = resolve_model_path(path, project_root)
    assert resolved is not None
    resolved = resolved.resolve()

    if resolved.suffixes[-2:] == [".tar", ".gz"] or resolved.name.endswith(".tar.gz"):
        raise AsrProviderError(
            provider="vosk",
            code="model_path_is_archive",
            message=(
                "Python Vosk cannot load model.tar.gz directly. It requires an extracted "
                "model directory with am/, conf/, and graph/ files."
            ),
            setup_hint="Extract the Vosk model and set LOCAL_SPEECH_VOSK_MODEL_PATH to the extracted folder.",
            details={"model_path": str(resolved)},
        )

    if not resolved.exists():
        raise AsrProviderError(
            provider="vosk",
            code="model_path_missing",
            message=f"Vosk model directory does not exist: {resolved}",
            setup_hint="Set LOCAL_SPEECH_VOSK_MODEL_PATH to an extracted Vosk model directory.",
            details={"model_path": str(resolved)},
        )

    if not resolved.is_dir():
        raise AsrProviderError(
            provider="vosk",
            code="model_path_not_directory",
            message=f"Vosk model path is not a directory: {resolved}",
            setup_hint="Python Vosk requires an extracted model directory, not a file.",
            details={"model_path": str(resolved)},
        )

    missing = [relative_path.as_posix() for relative_path in VOSK_REQUIRED_FILES if not (resolved / relative_path).exists()]
    if missing:
        raise AsrProviderError(
            provider="vosk",
            code="model_files_missing",
            message=(
                "Vosk model directory is missing required extracted model files. "
                "Python Vosk requires am/, conf/, and graph/ files."
            ),
            setup_hint=(
                "Extract a Vosk model such as vosk-model-small-en-us-0.15 and point "
                "LOCAL_SPEECH_VOSK_MODEL_PATH at the extracted folder."
            ),
            details={"model_path": str(resolved), "missing": missing},
        )

    return resolved, []


def get_package_error() -> AsrProviderError | None:
    try:
        import vosk  # noqa: F401
    except Exception as error:
        return AsrProviderError(
            provider="vosk",
            code="package_missing",
            message="The Python vosk package is not installed or could not be imported.",
            setup_hint="Run: local_speech_engine\\.venv\\Scripts\\python -m pip install -r local_speech_engine\\requirements.txt",
            details={"error": str(error)},
        )

    return None


class VoskAsrProvider:
    name = "vosk"

    def __init__(self, model_path: Path | None, project_root: Path, enabled: bool = True) -> None:
        self.enabled = enabled
        self.model_path = model_path
        self.project_root = project_root
        self._model = None
        self._resolved_model_path: Path | None = None
        self._lock = Lock()
        self._last_error: AsrProviderError | None = None

    def status(self) -> ProviderStatus:
        if not self.enabled:
            return ProviderStatus(
                name=self.name,
                enabled=False,
                available=False,
                loaded=False,
                model_path=str(self.model_path or ""),
                message="Vosk provider is disabled.",
                setup_hint="Set LOCAL_SPEECH_ENABLE_VOSK=true to enable it.",
            )

        try:
            resolved_path, _ = validate_vosk_model_dir(self.model_path, self.project_root)
        except AsrProviderError as error:
            return ProviderStatus(
                name=self.name,
                enabled=True,
                available=False,
                loaded=False,
                model_path=str(self.model_path or ""),
                message=error.message,
                setup_hint=error.setup_hint,
                details=error.details | {"code": error.code},
            )

        package_error = get_package_error()
        if package_error:
            return ProviderStatus(
                name=self.name,
                enabled=True,
                available=False,
                loaded=False,
                model_path=str(resolved_path),
                message=package_error.message,
                setup_hint=package_error.setup_hint,
                details=package_error.details | {"code": package_error.code},
            )

        return ProviderStatus(
            name=self.name,
            enabled=True,
            available=True,
            loaded=self._model is not None,
            model_path=str(resolved_path),
            message="Vosk model is ready." if self._model is not None else "Vosk provider is available.",
        )

    def is_available(self) -> bool:
        return self.status().available

    def load(self) -> ProviderStatus:
        with self._lock:
            if not self.enabled:
                raise AsrProviderError(
                    provider=self.name,
                    code="provider_disabled",
                    message="Vosk provider is disabled.",
                    setup_hint="Set LOCAL_SPEECH_ENABLE_VOSK=true to enable it.",
                )

            if self._model is not None:
                return self.status()

            resolved_path, _ = validate_vosk_model_dir(self.model_path, self.project_root)
            package_error = get_package_error()
            if package_error:
                self._last_error = package_error
                raise package_error

            try:
                import vosk

                vosk.SetLogLevel(-1)
                self._model = vosk.Model(str(resolved_path))
                self._resolved_model_path = resolved_path
            except AsrProviderError:
                raise
            except Exception as error:
                provider_error = AsrProviderError(
                    provider=self.name,
                    code="model_load_failed",
                    message=f"Unable to load Vosk model: {error}",
                    setup_hint="Confirm LOCAL_SPEECH_VOSK_MODEL_PATH points to a complete extracted Vosk model folder.",
                    details={"model_path": str(resolved_path), "error": str(error)},
                )
                self._last_error = provider_error
                raise provider_error from error

            return self.status()

    def transcribe_wav(self, path: Path) -> AsrTranscript:
        self.load()
        assert self._model is not None

        try:
            import vosk

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
                        message="Vosk transcription expects mono 16-bit PCM WAV files.",
                        setup_hint="Use WAV files generated by the local VAD sidecar.",
                        details={"channels": channels, "sample_width": sample_width},
                    )

                recognizer = vosk.KaldiRecognizer(self._model, sample_rate)
                recognizer.SetWords(True)
                while True:
                    data = wav_file.readframes(4000)
                    if not data:
                        break
                    recognizer.AcceptWaveform(data)

                result = _parse_vosk_json(recognizer.FinalResult())
                text = str(result.get("text") or "").strip()
                confidence = _get_average_confidence(result)

                return AsrTranscript(
                    provider=self.name,
                    filename=path.name,
                    text=text,
                    confidence=confidence,
                    duration_ms=duration_ms,
                    sample_rate=sample_rate,
                    details={"raw": result},
                )
        except AsrProviderError:
            raise
        except Exception as error:
            raise AsrProviderError(
                provider=self.name,
                code="transcription_failed",
                message=f"Vosk transcription failed: {error}",
                setup_hint="Confirm the WAV is readable mono 16-bit PCM and the Vosk model is loaded.",
                details={"path": str(path), "error": str(error)},
            ) from error

    def unload(self) -> None:
        with self._lock:
            self._model = None
            self._resolved_model_path = None


def _parse_vosk_json(value: str) -> dict[str, Any]:
    try:
        payload = json.loads(value or "{}")
    except json.JSONDecodeError:
        return {"text": "", "raw": value}

    return payload if isinstance(payload, dict) else {"text": "", "raw": payload}


def _get_average_confidence(result: dict[str, Any]) -> float | None:
    words = result.get("result")
    if not isinstance(words, list) or not words:
        return None

    confidences = [word.get("conf") for word in words if isinstance(word, dict) and isinstance(word.get("conf"), (int, float))]
    if not confidences:
        return None

    return sum(confidences) / len(confidences)
