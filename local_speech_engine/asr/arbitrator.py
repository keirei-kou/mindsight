from __future__ import annotations

import time
import wave
from collections import defaultdict
from pathlib import Path
from typing import Any, Iterable

from .arbitration_types import (
    ArbitrationResult,
    AsrProviderRun,
    AudioSegmentRef,
    NormalizedCandidate,
    VadBoundary,
)
from .base import AsrProviderError, AsrTranscript
from .normalization import COMMAND_PROFILE, normalize_profile, normalize_transcript_candidate
from .policies import HYBRID_DEFAULT_POLICY, ArbitrationPolicy, resolve_policy
from .vocabulary import DEFAULT_COMMAND_VOCABULARY


DEFAULT_PROVIDER_PRIORITY: tuple[str, ...] = ("vosk", "sherpa")


class AsrArbiter:
    def __init__(
        self,
        registry: Any,
        *,
        provider_priority: Iterable[str] = DEFAULT_PROVIDER_PRIORITY,
        command_vocabulary: Iterable[str] = DEFAULT_COMMAND_VOCABULARY,
    ) -> None:
        self.registry = registry
        self.provider_priority = tuple(str(provider).strip().lower() for provider in provider_priority if str(provider).strip())
        self.command_vocabulary = tuple(command_vocabulary)

    def arbitrate_segment(
        self,
        *,
        filename_or_path: str | None,
        provider_names: Iterable[str] | None = None,
        mode: str = COMMAND_PROFILE,
        policy: str | None = HYBRID_DEFAULT_POLICY,
        vad_boundary: VadBoundary | None = None,
    ) -> ArbitrationResult:
        path = self.registry.resolve_recording_path(filename_or_path)
        selected_providers = self._resolve_provider_names(provider_names)
        resolved_policy, policy_details = resolve_policy(policy)
        segment = build_audio_segment_ref(path, vad_boundary=vad_boundary)
        runs: list[AsrProviderRun] = []
        candidates: list[NormalizedCandidate] = []
        resolved_mode = normalize_profile(mode)

        for provider_name in selected_providers:
            run = self._run_provider(provider_name, path)
            runs.append(run)
            if not run.ok:
                continue

            normalized = normalize_transcript_candidate(
                run.raw_transcript,
                profile=resolved_mode,
                vocabulary=self.command_vocabulary,
            )
            if not normalized.normalized_text:
                continue

            candidates.append(
                NormalizedCandidate(
                    provider=run.provider,
                    raw_transcript=run.raw_transcript,
                    normalized_text=normalized.normalized_text,
                    command=normalized.command,
                    similarity=normalized.similarity,
                    exact=normalized.exact,
                    profile=normalized.profile,
                    candidates=normalized.candidates,
                )
            )

        final_text, final_command, decision_reason, policy_scores, details = self._choose(
            candidates,
            runs,
            resolved_mode,
            resolved_policy,
        )
        details.update(policy_details)
        return ArbitrationResult(
            mode=resolved_mode,
            filename=path.name,
            final_text=final_text,
            final_command=final_command,
            decision_reason=decision_reason,
            policy_name=resolved_policy.name,
            policy_scores=policy_scores,
            provider_runs=tuple(runs),
            candidates=tuple(candidates),
            selected_providers=tuple(selected_providers),
            segment=segment,
            details=details,
        )

    def arbitrate_latest(
        self,
        *,
        provider_names: Iterable[str] | None = None,
        mode: str = COMMAND_PROFILE,
        policy: str | None = HYBRID_DEFAULT_POLICY,
        vad_boundary: VadBoundary | None = None,
    ) -> ArbitrationResult:
        latest_path = self.registry.latest_recording_path()
        return self.arbitrate_segment(
            filename_or_path=str(latest_path),
            provider_names=provider_names,
            mode=mode,
            policy=policy,
            vad_boundary=vad_boundary,
        )

    def _resolve_provider_names(self, provider_names: Iterable[str] | None) -> list[str]:
        if provider_names is None:
            default_provider = getattr(self.registry, "default_provider_name", "")
            return [default_provider or self.provider_priority[0]]

        names = [str(name).strip().lower() for name in provider_names if str(name).strip()]
        return names or self._resolve_provider_names(None)

    def _run_provider(self, provider_name: str, path: Path) -> AsrProviderRun:
        started = time.perf_counter()
        try:
            provider = self.registry.get_provider(provider_name)
            transcript = provider.transcribe_wav(path)
            latency_ms = round((time.perf_counter() - started) * 1000, 2)
            return run_from_transcript(transcript, latency_ms=latency_ms)
        except Exception as error:
            latency_ms = round((time.perf_counter() - started) * 1000, 2)
            return run_from_error(provider_name, path.name, error, latency_ms=latency_ms)

    def _choose(
        self,
        candidates: list[NormalizedCandidate],
        runs: list[AsrProviderRun],
        mode: str,
        policy: ArbitrationPolicy,
    ) -> tuple[str, str | None, str, dict[str, Any], dict[str, Any]]:
        if not candidates:
            return (
                "",
                None,
                "no_result",
                {"policy": policy.name, "groups": {}},
                {"successful_provider_count": sum(1 for run in runs if run.ok)},
            )

        groups: dict[str, list[NormalizedCandidate]] = defaultdict(list)
        for candidate in candidates:
            groups[candidate.arbitration_key].append(candidate)

        run_by_provider = {run.provider: run for run in runs}
        scored_groups = [
            (self._score_group(group, run_by_provider, mode), key, group)
            for key, group in groups.items()
            if key
        ]
        scored_groups.sort(key=lambda item: self._policy_sort_key(item[0], policy), reverse=True)
        score, key, group = scored_groups[0]
        runner_up_score = scored_groups[1][0] if len(scored_groups) > 1 else None
        representative = sorted(
            group,
            key=lambda candidate: self._provider_priority_score(candidate.provider),
            reverse=True,
        )[0]

        final_command = representative.command if mode == COMMAND_PROFILE else None
        final_text = final_command or key
        decision_reason = self._decision_reason(group, representative, score, runner_up_score, policy)
        policy_scores = {
            "policy": policy.name,
            "score_order": list(policy.score_order),
            "winning_key": key,
            "winning_sort_key": list(self._policy_sort_key(score, policy)),
            "winning_metrics": score,
            "groups": {
                group_key: {
                    "metrics": group_score,
                    "sort_key": list(self._policy_sort_key(group_score, policy)),
                    "providers": [candidate.provider for candidate in group_candidates],
                }
                for group_score, group_key, group_candidates in scored_groups
            },
        }
        return final_text, final_command, decision_reason, policy_scores, {
            "winning_key": key,
            "winning_score": {
                "agreement_count": score["agreement_count"],
                "command_validity": score["command_validity"],
                "average_similarity": score["average_similarity"],
                "average_confidence": score["average_confidence"],
                "provider_priority": score["provider_priority"],
            },
            "provider_count": len(runs),
            "successful_provider_count": sum(1 for run in runs if run.ok),
        }

    def _score_group(
        self,
        group: list[NormalizedCandidate],
        run_by_provider: dict[str, AsrProviderRun],
        mode: str,
    ) -> dict[str, float]:
        agreement_count = float(len(group))
        command_validity = 0.0
        if mode == COMMAND_PROFILE:
            if any(candidate.exact and candidate.command for candidate in group):
                command_validity = 2.0
            elif any(candidate.command for candidate in group):
                command_validity = 1.0

        average_similarity = sum(candidate.similarity for candidate in group) / len(group)
        confidences = [
            run_by_provider[candidate.provider].confidence
            for candidate in group
            if candidate.provider in run_by_provider and run_by_provider[candidate.provider].confidence is not None
        ]
        average_confidence = (sum(confidences) / len(confidences)) if confidences else 0.0
        provider_priority = max(self._provider_priority_score(candidate.provider) for candidate in group)
        return {
            "agreement_count": agreement_count,
            "command_validity": command_validity,
            "average_similarity": average_similarity,
            "average_confidence": average_confidence,
            "provider_priority": provider_priority,
        }

    def _policy_sort_key(self, score: dict[str, float], policy: ArbitrationPolicy) -> tuple[float, ...]:
        return tuple(score.get(field, 0.0) for field in policy.score_order)

    def _provider_priority_score(self, provider_name: str) -> float:
        normalized = str(provider_name or "").strip().lower()
        try:
            index = self.provider_priority.index(normalized)
        except ValueError:
            index = len(self.provider_priority)
        return float(len(self.provider_priority) - index)

    def _decision_reason(
        self,
        group: list[NormalizedCandidate],
        representative: NormalizedCandidate,
        score: dict[str, float],
        runner_up_score: dict[str, float] | None,
        policy: ArbitrationPolicy,
    ) -> str:
        if len(group) > 1:
            return "agreement"
        if runner_up_score is not None:
            reason_by_field = {
                "agreement_count": "agreement",
                "command_validity": "vocabulary",
                "average_similarity": "vocabulary",
                "average_confidence": "confidence",
                "provider_priority": "provider_priority",
            }
            for field in policy.score_order:
                if score.get(field, 0.0) != runner_up_score.get(field, 0.0):
                    return reason_by_field.get(field, field)
        if representative.command:
            return "vocabulary"
        if score.get("average_confidence", 0.0) > 0:
            return "confidence"
        return "provider_priority"


def run_from_transcript(transcript: AsrTranscript, *, latency_ms: float | None) -> AsrProviderRun:
    return AsrProviderRun(
        provider=transcript.provider,
        filename=transcript.filename,
        raw_transcript=transcript.text,
        confidence=transcript.confidence,
        latency_ms=latency_ms,
        duration_ms=transcript.duration_ms,
        sample_rate=transcript.sample_rate,
        details=transcript.details,
    )


def run_from_error(
    provider_name: str,
    filename: str,
    error: Exception,
    *,
    latency_ms: float | None,
) -> AsrProviderRun:
    if isinstance(error, AsrProviderError):
        payload = error.to_event_payload()
    else:
        payload = {
            "provider": provider_name,
            "code": "unexpected_error",
            "message": str(error),
            "setup_hint": "Check the local speech engine console for details.",
            "details": {},
        }

    return AsrProviderRun(
        provider=str(payload.get("provider") or provider_name),
        filename=filename,
        latency_ms=latency_ms,
        error={
            "code": payload.get("code", "unexpected_error"),
            "message": payload.get("message", str(error)),
            "setup_hint": payload.get("setup_hint", ""),
            "details": payload.get("details", {}),
        },
    )


def build_audio_segment_ref(path: Path, *, vad_boundary: VadBoundary | None = None) -> AudioSegmentRef:
    duration_ms: int | None = None
    sample_rate: int | None = None
    try:
        with wave.open(str(path), "rb") as wav_file:
            sample_rate = wav_file.getframerate()
            frame_count = wav_file.getnframes()
            duration_ms = int(round((frame_count / sample_rate) * 1000)) if sample_rate else None
    except Exception:
        duration_ms = None
        sample_rate = None

    return AudioSegmentRef(
        source_type="vad_segment",
        filename=path.name,
        path=path,
        duration_ms=duration_ms,
        sample_rate=sample_rate,
        vad_boundary=vad_boundary,
    )
