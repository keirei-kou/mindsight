from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Protocol


@dataclass
class AsrProviderError(Exception):
    provider: str
    code: str
    message: str
    setup_hint: str = ""
    details: dict[str, Any] = field(default_factory=dict)

    def __str__(self) -> str:
        return self.message

    def to_event_payload(self) -> dict[str, Any]:
        return {
            "provider": self.provider,
            "code": self.code,
            "message": self.message,
            "setup_hint": self.setup_hint,
            "details": self.details,
        }


@dataclass(frozen=True)
class ProviderStatus:
    name: str
    enabled: bool
    available: bool
    loaded: bool
    model_path: str
    message: str = ""
    setup_hint: str = ""
    details: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "enabled": self.enabled,
            "available": self.available,
            "loaded": self.loaded,
            "model_path": self.model_path,
            "message": self.message,
            "setup_hint": self.setup_hint,
            "details": self.details,
        }


@dataclass(frozen=True)
class AsrTranscript:
    provider: str
    filename: str
    text: str
    confidence: float | None = None
    duration_ms: int | None = None
    sample_rate: int | None = None
    details: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "provider": self.provider,
            "filename": self.filename,
            "text": self.text,
            "confidence": self.confidence,
            "duration_ms": self.duration_ms,
            "sample_rate": self.sample_rate,
            "details": self.details,
        }


class AsrProvider(Protocol):
    name: str

    def status(self) -> ProviderStatus:
        ...

    def is_available(self) -> bool:
        ...

    def load(self) -> ProviderStatus:
        ...

    def transcribe_wav(self, path: Path) -> AsrTranscript:
        ...

    def unload(self) -> None:
        ...

