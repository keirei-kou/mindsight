from __future__ import annotations

from pathlib import Path

from .base import AsrProviderError, AsrTranscript, ProviderStatus


KNOWN_SHERPA_MARKERS = (
    "tokens.txt",
    "encoder.onnx",
    "decoder.onnx",
    "joiner.onnx",
    "model.onnx",
)


class SherpaOnnxAsrProvider:
    name = "sherpa"

    def __init__(self, model_dir: Path | None, project_root: Path, enabled: bool = True) -> None:
        self.model_dir = model_dir
        self.project_root = project_root
        self.enabled = enabled

    def _resolved_model_dir(self) -> Path | None:
        if self.model_dir is None:
            return None
        return self.model_dir if self.model_dir.is_absolute() else self.project_root / self.model_dir

    def status(self) -> ProviderStatus:
        model_dir = self._resolved_model_dir()
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

        package_available = True
        package_error = ""
        try:
            import sherpa_onnx  # noqa: F401
        except Exception as error:
            package_available = False
            package_error = str(error)

        markers = []
        if model_dir and model_dir.exists() and model_dir.is_dir():
            markers = [marker for marker in KNOWN_SHERPA_MARKERS if (model_dir / marker).exists()]

        message = (
            "Sherpa ONNX scaffold is present, but no specific model layout has been configured."
            if package_available
            else "The sherpa-onnx Python package is not installed or could not be imported."
        )
        setup_hint = (
            "Choose a Sherpa ONNX model layout, place its files under LOCAL_SPEECH_SHERPA_MODEL_DIR, "
            "then wire this provider to that exact layout. No fake transcription is emitted."
            if package_available
            else (
                "Install sherpa-onnx only after selecting a model layout: pip install sherpa-onnx. "
                "No fake transcription is emitted."
            )
        )

        return ProviderStatus(
            name=self.name,
            enabled=True,
            available=False,
            loaded=False,
            model_path=model_path,
            message=message,
            setup_hint=setup_hint,
            details={
                "package_available": package_available,
                "package_error": package_error,
                "known_markers_found": markers,
                "model_dir_exists": bool(model_dir and model_dir.exists()),
            },
        )

    def is_available(self) -> bool:
        return False

    def load(self) -> ProviderStatus:
        status = self.status()
        raise AsrProviderError(
            provider=self.name,
            code="provider_scaffolded",
            message=status.message,
            setup_hint=status.setup_hint,
            details=status.details,
        )

    def transcribe_wav(self, path: Path) -> AsrTranscript:
        del path
        status = self.status()
        raise AsrProviderError(
            provider=self.name,
            code="provider_scaffolded",
            message="Sherpa ONNX transcription is scaffolded but not implemented for a selected model layout yet.",
            setup_hint=status.setup_hint,
            details=status.details,
        )

    def unload(self) -> None:
        return None
