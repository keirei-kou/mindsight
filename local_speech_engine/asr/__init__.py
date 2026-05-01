"""ASR provider layer for the local speech engine."""

from .arbitration_types import ArbitrationResult, AsrProviderRun, AudioSegmentRef, NormalizedCandidate, VadBoundary
from .arbitrator import AsrArbiter
from .base import AsrProviderError, AsrTranscript, ProviderStatus
from .config import LocalSpeechConfig
from .normalization import COMMAND_PROFILE, VOICE_NOTE_PROFILE, normalize_asr_text, normalize_transcript_candidate
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
    "LocalSpeechConfig",
    "NormalizedCandidate",
    "ProviderStatus",
    "VOICE_NOTE_PROFILE",
    "VadBoundary",
    "normalize_asr_text",
    "normalize_transcript_candidate",
]
