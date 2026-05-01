from __future__ import annotations

from dataclasses import dataclass
from typing import Any


HYBRID_DEFAULT_POLICY = "hybrid_default"
AGREEMENT_FIRST_POLICY = "agreement_first"
COMMAND_VALIDITY_FIRST_POLICY = "command_validity_first"
CONFIDENCE_WEIGHTED_POLICY = "confidence_weighted"
PROVIDER_PRIORITY_POLICY = "provider_priority"


@dataclass(frozen=True)
class ArbitrationPolicy:
    name: str
    score_order: tuple[str, ...]


POLICIES: dict[str, ArbitrationPolicy] = {
    HYBRID_DEFAULT_POLICY: ArbitrationPolicy(
        name=HYBRID_DEFAULT_POLICY,
        score_order=(
            "agreement_count",
            "command_validity",
            "average_similarity",
            "average_confidence",
            "provider_priority",
        ),
    ),
    AGREEMENT_FIRST_POLICY: ArbitrationPolicy(
        name=AGREEMENT_FIRST_POLICY,
        score_order=(
            "agreement_count",
            "average_confidence",
            "provider_priority",
            "command_validity",
            "average_similarity",
        ),
    ),
    COMMAND_VALIDITY_FIRST_POLICY: ArbitrationPolicy(
        name=COMMAND_VALIDITY_FIRST_POLICY,
        score_order=(
            "command_validity",
            "average_similarity",
            "agreement_count",
            "average_confidence",
            "provider_priority",
        ),
    ),
    CONFIDENCE_WEIGHTED_POLICY: ArbitrationPolicy(
        name=CONFIDENCE_WEIGHTED_POLICY,
        score_order=(
            "average_confidence",
            "agreement_count",
            "command_validity",
            "average_similarity",
            "provider_priority",
        ),
    ),
    PROVIDER_PRIORITY_POLICY: ArbitrationPolicy(
        name=PROVIDER_PRIORITY_POLICY,
        score_order=(
            "provider_priority",
            "command_validity",
            "average_similarity",
            "agreement_count",
            "average_confidence",
        ),
    ),
}


def normalize_policy_name(value: str | None) -> str:
    normalized = str(value or HYBRID_DEFAULT_POLICY).strip().lower()
    return normalized if normalized in POLICIES else HYBRID_DEFAULT_POLICY


def resolve_policy(value: str | None) -> tuple[ArbitrationPolicy, dict[str, Any]]:
    requested = str(value or HYBRID_DEFAULT_POLICY).strip().lower()
    normalized = normalize_policy_name(requested)
    details: dict[str, Any] = {"requested_policy": requested or HYBRID_DEFAULT_POLICY}
    if requested and requested != normalized:
        details["policy_fallback"] = True
        details["fallback_reason"] = f"Unknown arbitration policy: {requested}"
    return POLICIES[normalized], details


def available_policy_names() -> tuple[str, ...]:
    return tuple(POLICIES)
