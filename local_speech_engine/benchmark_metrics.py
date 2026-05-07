from __future__ import annotations

from collections import defaultdict
from typing import Any, Iterable

from .corpus import (
    ROBUSTNESS_CONDITION_GROUP,
    SAFETY_CONDITION_GROUP,
    UNSPECIFIED_CONDITION_GROUP,
    USABILITY_CONDITION_GROUP,
)


CONDITION_GROUP_WEIGHTS: dict[str, float] = {
    USABILITY_CONDITION_GROUP: 0.7,
    ROBUSTNESS_CONDITION_GROUP: 0.15,
    SAFETY_CONDITION_GROUP: 0.15,
    UNSPECIFIED_CONDITION_GROUP: 0.0,
}


def ratio(count: int | float, total: int | float) -> float:
    return (count / total) if total else 0.0


def summarize_outcomes(
    rows: Iterable[dict[str, Any]],
    *,
    passed_key: str,
    raw_transcript_key: str,
    error_key: str,
) -> dict[str, Any]:
    materialized = list(rows)
    total = len(materialized)
    passed = sum(1 for row in materialized if row.get(passed_key))
    blank = sum(
        1
        for row in materialized
        if not row.get(error_key) and not str(row.get(raw_transcript_key) or "").strip()
    )
    errors = sum(1 for row in materialized if row.get(error_key))
    command_rows = [
        row
        for row in materialized
        if str(row.get("type") or row.get("mode") or "command").strip() == "command"
        and str(row.get("normalized_expected") or "").strip()
    ]
    command_matches = sum(1 for row in command_rows if row.get(passed_key))
    return {
        "total": total,
        "passed": passed,
        "accuracy": ratio(passed, total),
        "blank_transcript_count": blank,
        "blank_transcript_rate": ratio(blank, total),
        "provider_error_count": errors,
        "provider_error_rate": ratio(errors, total),
        "command_evaluation_count": len(command_rows),
        "command_match_count": command_matches,
        "command_match_rate": ratio(command_matches, len(command_rows)),
    }


def summarize_by_condition_group(
    rows: Iterable[dict[str, Any]],
    *,
    passed_key: str,
    raw_transcript_key: str,
    error_key: str,
) -> dict[str, dict[str, Any]]:
    buckets: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        group = str(row.get("condition_group") or UNSPECIFIED_CONDITION_GROUP)
        buckets[group].append(row)

    return {
        group: summarize_outcomes(
            group_rows,
            passed_key=passed_key,
            raw_transcript_key=raw_transcript_key,
            error_key=error_key,
        )
        for group, group_rows in sorted(buckets.items())
    }


def weighted_condition_score(
    condition_groups: dict[str, dict[str, Any]],
    *,
    weights: dict[str, float] | None = None,
) -> dict[str, Any]:
    base_weights = weights or CONDITION_GROUP_WEIGHTS
    present_weights = {
        group: float(base_weights.get(group, 0.0))
        for group, summary in condition_groups.items()
        if summary.get("total") and float(base_weights.get(group, 0.0)) > 0
    }
    total_weight = sum(present_weights.values())
    if total_weight <= 0:
        return {
            "score": None,
            "weights": base_weights,
            "applied_weights": {},
            "note": "No weighted condition groups were present.",
        }

    applied_weights = {group: weight / total_weight for group, weight in present_weights.items()}
    score = sum(
        float(condition_groups[group].get("accuracy") or 0.0) * weight
        for group, weight in applied_weights.items()
    )
    return {
        "score": score,
        "weights": base_weights,
        "applied_weights": applied_weights,
    }


def benchmark_score_summary(
    rows: Iterable[dict[str, Any]],
    *,
    passed_key: str,
    raw_transcript_key: str,
    error_key: str,
) -> dict[str, Any]:
    materialized = list(rows)
    condition_groups = summarize_by_condition_group(
        materialized,
        passed_key=passed_key,
        raw_transcript_key=raw_transcript_key,
        error_key=error_key,
    )
    return {
        "overall": summarize_outcomes(
            materialized,
            passed_key=passed_key,
            raw_transcript_key=raw_transcript_key,
            error_key=error_key,
        ),
        "condition_groups": condition_groups,
        "weighted": weighted_condition_score(condition_groups),
    }
