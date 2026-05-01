"""ASR provider layer for the local speech engine."""

from .arbitration_types import ArbitrationResult, AsrProviderRun, AudioSegmentRef, NormalizedCandidate, VadBoundary
from .arbitrator import AsrArbiter
from .base import AsrProviderError, AsrTranscript, ProviderStatus
from .config import LocalSpeechConfig
from .normalization import COMMAND_PROFILE, VOICE_NOTE_PROFILE, normalize_asr_text, normalize_transcript_candidate
from .policies import (
    AGREEMENT_FIRST_POLICY,
    COMMAND_VALIDITY_FIRST_POLICY,
    CONFIDENCE_WEIGHTED_POLICY,
    HYBRID_DEFAULT_POLICY,
    PROVIDER_PRIORITY_POLICY,
    available_policy_names,
)
from .registry import AsrRegistry

__all__ = [
    "ArbitrationResult",
    "AsrArbiter",
    "AsrProviderError",
    "AsrProviderRun",
    "AsrRegistry",
    "AsrTranscript",
    "AudioSegmentRef",
    "COMMAND_PROFILE",
    "AGREEMENT_FIRST_POLICY",
    "COMMAND_VALIDITY_FIRST_POLICY",
    "CONFIDENCE_WEIGHTED_POLICY",
    "HYBRID_DEFAULT_POLICY",
    "LocalSpeechConfig",
    "NormalizedCandidate",
    "PROVIDER_PRIORITY_POLICY",
    "ProviderStatus",
    "VOICE_NOTE_PROFILE",
    "VadBoundary",
    "available_policy_names",
    "normalize_asr_text",
    "normalize_transcript_candidate",
]
