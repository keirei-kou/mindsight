from __future__ import annotations

from typing import Any


COMMAND_ALIASES = {
    "start_vad": "start_vad",
    "start_listening": "start_vad",
    "stop_vad": "stop_vad",
    "stop_listening": "stop_vad",
    "start_voice_note_recording": "start_voice_note",
    "stop_voice_note_recording": "stop_voice_note",
    "delete_segment": "delete_recording_segment",
    "delete_recording": "delete_recording_segment",
}


def normalize_command(command: Any) -> str:
    normalized = str(command or "").strip()
    return COMMAND_ALIASES.get(normalized, normalized)
