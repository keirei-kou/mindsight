from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


def parse_bool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default

    return value.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class LocalSpeechConfig:
    project_root: Path
    recordings_dir: Path
    vosk_model_path: Path | None
    sherpa_model_dir: Path | None
    default_provider: str
    enable_vosk: bool
    enable_sherpa: bool
    auto_transcribe: bool

    @classmethod
    def from_env(cls, project_root: Path, recordings_dir: Path) -> "LocalSpeechConfig":
        def optional_path(env_name: str, fallback: Path) -> Path | None:
            raw = os.environ.get(env_name)
            if raw is None or raw.strip() == "":
                return fallback
            return Path(raw.strip()).expanduser()

        default_provider = os.environ.get("LOCAL_SPEECH_ASR_PROVIDER_DEFAULT", "").strip().lower()

        return cls(
            project_root=project_root,
            recordings_dir=recordings_dir,
            vosk_model_path=optional_path(
                "LOCAL_SPEECH_VOSK_MODEL_PATH",
                project_root / "local_speech_engine" / "models" / "vosk" / "vosk-model-small-en-us-0.15",
            ),
            sherpa_model_dir=optional_path(
                "LOCAL_SPEECH_SHERPA_MODEL_DIR",
                project_root / "local_speech_engine" / "models" / "sherpa" / "sherpa-onnx-streaming-zipformer-en-20M-2023-02-17",
            ),
            default_provider=default_provider,
            enable_vosk=parse_bool(os.environ.get("LOCAL_SPEECH_ENABLE_VOSK"), True),
            enable_sherpa=parse_bool(os.environ.get("LOCAL_SPEECH_ENABLE_SHERPA"), True),
            auto_transcribe=parse_bool(os.environ.get("LOCAL_SPEECH_ASR_AUTO_TRANSCRIBE"), False),
        )

