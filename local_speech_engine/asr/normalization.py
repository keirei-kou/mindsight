from __future__ import annotations

import re
import string
from dataclasses import dataclass
from typing import Iterable

from .vocabulary import COMMAND_ALIASES, DEFAULT_COMMAND_VOCABULARY


COMMAND_PROFILE = "command"
VOICE_NOTE_PROFILE = "voice_note"
_SUPPORTED_PROFILES = {COMMAND_PROFILE, VOICE_NOTE_PROFILE}
_PUNCTUATION_TRANSLATION = str.maketrans({char: " " for char in string.punctuation})
_WHITESPACE_RE = re.compile(r"\s+")


@dataclass(frozen=True)
class NormalizedText:
    raw_text: str
    profile: str
    normalized_text: str
    command: str | None
    similarity: float
    exact: bool
    candidates: tuple[str, ...]


def normalize_profile(value: str | None) -> str:
    profile = str(value or COMMAND_PROFILE).strip().lower()
    return profile if profile in _SUPPORTED_PROFILES else COMMAND_PROFILE


def normalize_plain_text(value: str | None) -> str:
    return _WHITESPACE_RE.sub(" ", str(value or "")).strip()


def normalize_command_text(value: str | None, aliases: dict[str, str] | None = None) -> str:
    normalized = str(value or "").lower().translate(_PUNCTUATION_TRANSLATION)
    normalized = _WHITESPACE_RE.sub(" ", normalized).strip()
    alias_map = COMMAND_ALIASES if aliases is None else aliases
    return alias_map.get(normalized, normalized)


def normalize_asr_text(
    value: str | None,
    *,
    profile: str = COMMAND_PROFILE,
    aliases: dict[str, str] | None = None,
) -> str:
    resolved_profile = normalize_profile(profile)
    if resolved_profile == VOICE_NOTE_PROFILE:
        return normalize_plain_text(value)
    return normalize_command_text(value, aliases=aliases)


def normalize_transcript_candidate(
    value: str | None,
    *,
    profile: str = COMMAND_PROFILE,
    vocabulary: Iterable[str] | None = None,
    aliases: dict[str, str] | None = None,
) -> NormalizedText:
    raw_text = str(value or "").strip()
    resolved_profile = normalize_profile(profile)

    if resolved_profile == VOICE_NOTE_PROFILE:
        normalized = normalize_plain_text(raw_text)
        return NormalizedText(
            raw_text=raw_text,
            profile=resolved_profile,
            normalized_text=normalized,
            command=None,
            similarity=1.0 if normalized else 0.0,
            exact=False,
            candidates=(normalized,) if normalized else (),
        )

    command_candidates = build_command_candidates(raw_text, aliases=aliases)
    normalized = command_candidates[0] if command_candidates else ""
    command, similarity, exact = match_command_candidate(
        command_candidates,
        vocabulary=DEFAULT_COMMAND_VOCABULARY if vocabulary is None else vocabulary,
    )
    return NormalizedText(
        raw_text=raw_text,
        profile=resolved_profile,
        normalized_text=command or normalized,
        command=command,
        similarity=similarity,
        exact=exact,
        candidates=tuple(command_candidates),
    )


def build_command_candidates(value: str | None, aliases: dict[str, str] | None = None) -> list[str]:
    normalized = normalize_command_text(value, aliases=aliases)
    if not normalized:
        return []

    tokens = normalized.split()
    candidates: list[str] = []

    def add(candidate: str) -> None:
        if candidate and candidate not in candidates:
            candidates.append(candidate)

    add(normalized)
    if tokens:
        add(tokens[0])
        add(tokens[-1])
        add(" ".join(token for index, token in enumerate(tokens) if index == 0 or token != tokens[index - 1]))

    for start in range(len(tokens)):
        for size in range(1, 4):
            end = start + size
            if end <= len(tokens):
                add(" ".join(tokens[start:end]))

    alias_map = COMMAND_ALIASES if aliases is None else aliases
    for candidate in list(candidates):
        add(alias_map.get(candidate, candidate))

    return candidates


def match_command_candidate(
    candidates: Iterable[str],
    *,
    vocabulary: Iterable[str] = DEFAULT_COMMAND_VOCABULARY,
) -> tuple[str | None, float, bool]:
    normalized_vocabulary = tuple(
        normalize_command_text(item)
        for item in vocabulary
        if normalize_command_text(item)
    )
    best_command: str | None = None
    best_similarity = 0.0
    best_exact = False

    for candidate in candidates:
        normalized_candidate = normalize_command_text(candidate)
        if not normalized_candidate:
            continue

        for command in normalized_vocabulary:
            if normalized_candidate == command:
                return command, 1.0, True

            score = similarity(normalized_candidate, command)
            if score > best_similarity:
                best_command = command
                best_similarity = score

    if best_similarity < 0.72:
        return None, best_similarity, False

    return best_command, best_similarity, False


def levenshtein(left: str, right: str) -> int:
    if left == right:
        return 0

    if not left:
        return len(right)

    if not right:
        return len(left)

    previous = list(range(len(right) + 1))
    for left_index, left_char in enumerate(left, start=1):
        current = [left_index]
        for right_index, right_char in enumerate(right, start=1):
            current.append(
                min(
                    previous[right_index] + 1,
                    current[right_index - 1] + 1,
                    previous[right_index - 1] + (0 if left_char == right_char else 1),
                )
            )
        previous = current

    return previous[-1]


def similarity(left: str, right: str) -> float:
    if not left or not right:
        return 0.0
    if left == right:
        return 1.0
    distance = levenshtein(left, right)
    return max(0.0, 1 - (distance / max(len(left), len(right))))
