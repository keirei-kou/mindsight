from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


@dataclass(frozen=True)
class VadBoundary:
    """Single-boundary metadata today; expandable for future boundary arbitration."""

    vad_provider: str = ""
    segment_index: int | None = None
    started_at: str | None = None
    ended_at: str | None = None
    prebuffer_ms: int | None = None
    hangover_ms: int | None = None
    boundary_candidate_id: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "vad_provider": self.vad_provider,
            "segment_index": self.segment_index,
            "started_at": self.started_at,
            "ended_at": self.ended_at,
            "prebuffer_ms": self.prebuffer_ms,
            "hangover_ms": self.hangover_ms,
            "boundary_candidate_id": self.boundary_candidate_id,
        }


@dataclass(frozen=True)
class AudioSegmentRef:
    source_type: str
    filename: str
    path: Path
    duration_ms: int | None = None
    sample_rate: int | None = None
    vad_boundary: VadBoundary | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "source_type": self.source_type,
            "filename": self.filename,
            "path": str(self.path),
            "duration_ms": self.duration_ms,
            "sample_rate": self.sample_rate,
            "vad_boundary": self.vad_boundary.to_dict() if self.vad_boundary else None,
        }


@dataclass(frozen=True)
class AsrProviderRun:
    provider: str
    filename: str
    raw_transcript: str = ""
    confidence: float | None = None
    latency_ms: float | None = None
    duration_ms: int | None = None
    sample_rate: int | None = None
    error: dict[str, Any] | None = None
    details: dict[str, Any] = field(default_factory=dict)

    @property
    def ok(self) -> bool:
        return self.error is None

    def to_dict(self) -> dict[str, Any]:
        return {
            "provider": self.provider,
            "filename": self.filename,
            "raw_transcript": self.raw_transcript,
            "confidence": self.confidence,
            "latency_ms": self.latency_ms,
            "duration_ms": self.duration_ms,
            "sample_rate": self.sample_rate,
            "ok": self.ok,
            "error": self.error,
            "details": self.details,
        }


@dataclass(frozen=True)
class NormalizedCandidate:
    provider: str
    raw_transcript: str
    normalized_text: str
    command: str | None = None
    similarity: float = 0.0
    exact: bool = False
    profile: str = "command"
    candidates: tuple[str, ...] = ()

    @property
    def arbitration_key(self) -> str:
        if self.profile == "command" and self.command:
            return self.command
        return self.normalized_text

    def to_dict(self) -> dict[str, Any]:
        return {
            "provider": self.provider,
            "raw_transcript": self.raw_transcript,
            "normalized_text": self.normalized_text,
            "command": self.command,
            "similarity": self.similarity,
            "exact": self.exact,
            "profile": self.profile,
            "candidates": list(self.candidates),
            "arbitration_key": self.arbitration_key,
        }


@dataclass(frozen=True)
class ArbitrationResult:
    mode: str
    filename: str
    final_text: str
    final_command: str | None
    decision_reason: str
    provider_runs: tuple[AsrProviderRun, ...]
    candidates: tuple[NormalizedCandidate, ...]
    selected_providers: tuple[str, ...]
    segment: AudioSegmentRef | None = None
    details: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "mode": self.mode,
            "filename": self.filename,
            "final_text": self.final_text,
            "final_command": self.final_command,
            "decision_reason": self.decision_reason,
            "provider_runs": [run.to_dict() for run in self.provider_runs],
            "candidates": [candidate.to_dict() for candidate in self.candidates],
            "selected_providers": list(self.selected_providers),
            "segment": self.segment.to_dict() if self.segment else None,
            "details": self.details,
        }
