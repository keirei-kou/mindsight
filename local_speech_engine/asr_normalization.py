from __future__ import annotations

from .asr.normalization import (
    COMMAND_PROFILE,
    VOICE_NOTE_PROFILE,
    NormalizedText,
    build_command_candidates,
    levenshtein,
    match_command_candidate,
    normalize_asr_text as _normalize_asr_text,
    normalize_command_text,
    normalize_plain_text,
    normalize_profile,
    normalize_transcript_candidate,
    similarity,
)
from .asr.vocabulary import COMMAND_ALIASES, DEFAULT_COMMAND_VOCABULARY


def normalize_asr_text(
    value: str | None,
    aliases: dict[str, str] | None = None,
    profile: str = COMMAND_PROFILE,
) -> str:
    """Backward-compatible ASR normalization entry point."""
    return _normalize_asr_text(value, profile=profile, aliases=aliases)


__all__ = [
    "COMMAND_ALIASES",
    "COMMAND_PROFILE",
    "DEFAULT_COMMAND_VOCABULARY",
    "NormalizedText",
    "VOICE_NOTE_PROFILE",
    "build_command_candidates",
    "levenshtein",
    "match_command_candidate",
    "normalize_asr_text",
    "normalize_command_text",
    "normalize_plain_text",
    "normalize_profile",
    "normalize_transcript_candidate",
    "similarity",
]
