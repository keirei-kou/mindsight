from __future__ import annotations

import json
import re
import shutil
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ENGINE_ROOT = Path(__file__).resolve().parent
DEFAULT_RECORDINGS_DIR = ENGINE_ROOT / "recordings"
DEFAULT_CORPUS_DIR = ENGINE_ROOT / "audio_corpus"
DEFAULT_LABELS_PATH = DEFAULT_CORPUS_DIR / "labels.json"

VALID_SAMPLE_TYPES = {"command", "voice_note"}
COMMAND_CATEGORIES = {"colors", "shapes", "numbers", "other"}
_SESSION_ID_RE = re.compile(r"[^a-z0-9_-]+")
_FILENAME_SLUG_RE = re.compile(r"[^a-z0-9_-]+")


@dataclass
class CorpusError(Exception):
    code: str
    message: str
    setup_hint: str = ""
    details: dict[str, Any] = field(default_factory=dict)

    def __str__(self) -> str:
        return self.message

    def to_event_payload(self) -> dict[str, Any]:
        return {
            "code": self.code,
            "message": self.message,
            "setup_hint": self.setup_hint,
            "details": self.details,
        }


@dataclass(frozen=True)
class CorpusSample:
    label_file: str
    session_id: str
    file: str
    path: Path
    expected: str
    sample_type: str
    mode: str
    category: str
    notes: str
    sample_id: str = ""
    index: int = 0

    def to_dict(self) -> dict[str, Any]:
        return {
            "label_file": self.label_file,
            "session_id": self.session_id,
            "file": self.file,
            "path": str(self.path),
            "expected": self.expected,
            "type": self.sample_type,
            "mode": self.mode,
            "category": self.category,
            "notes": self.notes,
            "id": self.sample_id,
            "index": self.index,
        }


@dataclass(frozen=True)
class CorpusSampleLoadResult:
    samples: tuple[CorpusSample, ...]
    label_files: tuple[str, ...]
    corpus_dir: Path
    all_label_files: bool

    def stats(self) -> dict[str, Any]:
        return {
            "corpus_dir": str(self.corpus_dir),
            "all_label_files": self.all_label_files,
            "label_files_loaded": len(self.label_files),
            "label_files": list(self.label_files),
            "total_samples_loaded": len(self.samples),
        }


def utc_timestamp() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def load_labels(labels_path: Path | None = None) -> list[dict[str, Any]]:
    path = labels_path or DEFAULT_LABELS_PATH
    if not path.exists():
        return []

    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as error:
        raise CorpusError(
            code="labels_json_invalid",
            message=f"Corpus labels file is not valid JSON: {path}",
            setup_hint="Fix labels.json or move it aside and save a new labeled sample.",
            details={"path": str(path), "error": str(error)},
        ) from error

    if isinstance(payload, list):
        return [item for item in payload if isinstance(item, dict)]

    if isinstance(payload, dict) and isinstance(payload.get("samples"), list):
        return [item for item in payload["samples"] if isinstance(item, dict)]

    raise CorpusError(
        code="labels_json_shape_invalid",
        message="Corpus labels must be a JSON array or an object with a samples array.",
        setup_hint="Use local_speech_engine/audio_corpus/labels.json for labeled WAV metadata.",
        details={"path": str(path)},
    )


def write_labels(labels: list[dict[str, Any]], labels_path: Path | None = None) -> None:
    path = labels_path or DEFAULT_LABELS_PATH
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(labels, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")


def is_corpus_label_file(path: Path) -> bool:
    name = path.name
    lowered = name.lower()
    if not lowered.startswith("labels") or not lowered.endswith(".json"):
        return False
    if lowered == "labels.example.json":
        return False
    if ".bak." in lowered or lowered.endswith(".bak"):
        return False
    if lowered.endswith(".tmp.json") or lowered.endswith(".temp.json"):
        return False
    if lowered.startswith("~") or lowered.endswith("~"):
        return False
    return True


def corpus_label_files(corpus_dir: Path = DEFAULT_CORPUS_DIR) -> list[Path]:
    root = corpus_dir.resolve()
    paths = [root / "labels.json"]
    paths.extend(sorted(root.glob("labels.*.json"), key=lambda path: path.name))

    seen: set[Path] = set()
    label_paths: list[Path] = []
    for path in paths:
        resolved = path.resolve()
        if resolved in seen or not resolved.exists() or not resolved.is_file():
            continue
        seen.add(resolved)
        if is_corpus_label_file(resolved):
            label_paths.append(resolved)
    return label_paths


def load_corpus_samples(
    *,
    corpus_dir: Path = DEFAULT_CORPUS_DIR,
    labels_path: Path | None = DEFAULT_LABELS_PATH,
    all_label_files: bool = False,
) -> CorpusSampleLoadResult:
    root = corpus_dir.resolve()
    label_paths = corpus_label_files(root) if all_label_files else _single_label_file(labels_path, root)
    samples: list[CorpusSample] = []

    for label_path in label_paths:
        payload = _load_label_payload(label_path)
        samples.extend(_samples_from_label_payload(payload, label_path=label_path, corpus_dir=root))

    return CorpusSampleLoadResult(
        samples=tuple(samples),
        label_files=tuple(path.name for path in label_paths),
        corpus_dir=root,
        all_label_files=all_label_files,
    )


def _single_label_file(labels_path: Path | None, corpus_dir: Path) -> list[Path]:
    path = labels_path or corpus_dir / "labels.json"
    if not path.is_absolute():
        path = corpus_dir / path
    resolved = path.resolve()
    if not resolved.exists():
        return []
    if not resolved.is_relative_to(corpus_dir.resolve()):
        raise CorpusError(
            code="label_file_outside_corpus",
            message="Corpus label files must be inside local_speech_engine/audio_corpus.",
            setup_hint="Pass a labels JSON filename or path inside the corpus directory.",
            details={"path": str(resolved), "corpus_dir": str(corpus_dir)},
        )
    if not is_corpus_label_file(resolved):
        return []
    return [resolved]


def _samples_from_label_payload(payload: Any, *, label_path: Path, corpus_dir: Path) -> list[CorpusSample]:
    if isinstance(payload, list):
        return _samples_from_entries(
            payload,
            label_path=label_path,
            corpus_dir=corpus_dir,
            session_id="legacy_labels",
            default_mode="command",
            default_type="command",
        )

    if isinstance(payload, dict):
        session_id = str(payload.get("session_id") or "").strip()
        default_mode = str(payload.get("mode") or payload.get("type") or "command").strip()
        if isinstance(payload.get("files"), list):
            return _samples_from_entries(
                payload["files"],
                label_path=label_path,
                corpus_dir=corpus_dir,
                session_id=session_id or label_path.stem.removeprefix("labels.").strip() or "session_labels",
                default_mode=default_mode,
                default_type=default_mode,
                planned_sequence=payload.get("planned_sequence"),
                auto_label_by_order=bool(payload.get("auto_label_by_order")),
            )
        if isinstance(payload.get("samples"), list):
            return _samples_from_entries(
                payload["samples"],
                label_path=label_path,
                corpus_dir=corpus_dir,
                session_id=session_id or "legacy_labels",
                default_mode=default_mode,
                default_type=default_mode,
            )

    raise CorpusError(
        code="labels_json_shape_invalid",
        message="Corpus labels must be a JSON array, an object with files[], or an object with samples[].",
        setup_hint="Use local_speech_engine/audio_corpus label formats accepted by the benchmark loader.",
        details={"path": str(label_path)},
    )


def _samples_from_entries(
    entries: list[Any],
    *,
    label_path: Path,
    corpus_dir: Path,
    session_id: str,
    default_mode: str,
    default_type: str,
    planned_sequence: Any = None,
    auto_label_by_order: bool = False,
) -> list[CorpusSample]:
    planned = [str(item).strip() for item in planned_sequence or []]
    samples: list[CorpusSample] = []
    for index, entry in enumerate(entries):
        if not isinstance(entry, dict):
            continue
        filename = str(entry.get("file") or entry.get("filename") or "").strip()
        if not filename:
            continue
        expected = str(entry.get("expected") or "").strip()
        if not expected and auto_label_by_order and index < len(planned):
            expected = planned[index]

        sample_type = str(entry.get("type") or entry.get("sample_type") or default_type or "command").strip()
        mode = str(entry.get("mode") or sample_type or default_mode or "command").strip()
        if mode == "voice_note":
            sample_type = "voice_note"
        elif sample_type not in VALID_SAMPLE_TYPES:
            sample_type = "command"
        category = str(entry.get("category") or normalize_category(sample_type, None)).strip()
        sample_path = _resolve_corpus_sample_path(filename, corpus_dir)
        samples.append(
            CorpusSample(
                label_file=label_path.name,
                session_id=str(entry.get("session_id") or session_id or "").strip(),
                file=filename,
                path=sample_path,
                expected=expected,
                sample_type=sample_type,
                mode=mode or sample_type,
                category=category,
                notes=str(entry.get("notes") or "").strip(),
                sample_id=str(entry.get("id") or "").strip(),
                index=len(samples) + 1,
            )
        )
    return samples


def _resolve_corpus_sample_path(filename: str, corpus_dir: Path) -> Path:
    candidate = Path(filename)
    if not candidate.is_absolute():
        candidate = corpus_dir / candidate
    return candidate.resolve()


def slugify_session_id(value: str | None) -> str:
    normalized = str(value or "").strip().lower()
    normalized = _SESSION_ID_RE.sub("_", normalized).strip("_")
    return normalized or "session"


def slugify_corpus_filename_part(value: str | None) -> str:
    normalized = str(value or "").strip().lower().replace("|", "-")
    normalized = re.sub(r"\s+", "_", normalized)
    normalized = _FILENAME_SLUG_RE.sub("", normalized)
    normalized = re.sub(r"_+", "_", normalized)
    normalized = re.sub(r"-+", "-", normalized)
    return normalized.strip("_-")


def corpus_destination_path(destination_dir: Path, expected: str, notes: str | None, source_filename: str | None = None) -> Path:
    source_name = Path(str(source_filename or "")).name
    if source_name and not source_name.startswith("vad_segment_"):
        candidate = destination_dir / source_name
        if not candidate.exists():
            return candidate

    expected_slug = slugify_corpus_filename_part(expected) or "sample"
    notes_slug = slugify_corpus_filename_part(notes)
    stem_prefix = f"{expected_slug}__{notes_slug}" if notes_slug else expected_slug

    index = 1
    while True:
        candidate = destination_dir / f"{stem_prefix}__{index:03d}.wav"
        if not candidate.exists():
            return candidate
        index += 1


def _session_labels_path(corpus_dir: Path, session_id: str) -> Path:
    return corpus_dir / f"labels.{slugify_session_id(session_id)}.json"


def _load_session_labels(path: Path, *, session_id: str, mode: str) -> dict[str, Any]:
    if not path.exists():
        return {
            "session_id": session_id,
            "mode": mode,
            "auto_label_by_order": False,
            "files": [],
        }

    try:
        payload = json.loads(path.read_text(encoding="utf-8") or "{}")
    except json.JSONDecodeError as error:
        raise CorpusError(
            code="session_labels_json_invalid",
            message=f"Session corpus labels file is not valid JSON: {path}",
            setup_hint="Fix the session labels file or move it aside and save again.",
            details={"path": str(path), "error": str(error)},
        ) from error

    if not isinstance(payload, dict):
        raise CorpusError(
            code="session_labels_json_shape_invalid",
            message="Session corpus labels must be a JSON object.",
            setup_hint="Use the labels.<session_id>.json session object shape.",
            details={"path": str(path)},
        )

    files = payload.get("files")
    if not isinstance(files, list):
        files = []

    return {
        "session_id": str(payload.get("session_id") or session_id),
        "mode": normalize_sample_type(payload.get("mode") or mode),
        "auto_label_by_order": bool(payload.get("auto_label_by_order", False)),
        "files": [item for item in files if isinstance(item, dict)],
    }


def _write_session_labels(payload: dict[str, Any], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")


def resolve_recording_wav(source_filename: str | None, recordings_dir: Path = DEFAULT_RECORDINGS_DIR) -> Path:
    if not source_filename or not str(source_filename).strip():
        raise CorpusError(
            code="source_missing",
            message="No source WAV filename was provided.",
            setup_hint="Create a VAD segment first, then save the latest segment to the corpus.",
        )

    candidate = Path(str(source_filename).strip())
    if not candidate.is_absolute():
        candidate = recordings_dir / candidate

    resolved = candidate.resolve()
    recordings_root = recordings_dir.resolve()
    if not resolved.is_relative_to(recordings_root):
        raise CorpusError(
            code="source_outside_recordings",
            message="Corpus samples can only be copied from local_speech_engine/recordings.",
            setup_hint="Pass a saved VAD segment filename from the Local VAD panel.",
            details={"path": str(resolved), "recordings_dir": str(recordings_root)},
        )

    if not resolved.exists() or not resolved.is_file():
        raise CorpusError(
            code="source_not_found",
            message=f"Source WAV segment was not found: {resolved.name}",
            setup_hint="Create a VAD recording first, then save the saved segment as a labeled sample.",
            details={"path": str(resolved)},
        )

    if resolved.suffix.lower() != ".wav":
        raise CorpusError(
            code="source_not_wav",
            message="Only .wav VAD segments can be saved to the ASR corpus.",
            setup_hint="Use a WAV file generated by the local VAD sidecar.",
            details={"path": str(resolved)},
        )

    return resolved


def delete_recording_segment(
    filename: str | None,
    *,
    recordings_dir: Path = DEFAULT_RECORDINGS_DIR,
) -> dict[str, Any]:
    resolved = resolve_recording_wav(filename, recordings_dir)
    resolved.unlink()
    return {
        "filename": resolved.name,
        "deleted": True,
        "path": str(resolved),
    }


def resolve_corpus_wav(filename: str | None, corpus_dir: Path = DEFAULT_CORPUS_DIR) -> Path:
    if not filename or not str(filename).strip():
        raise CorpusError(
            code="corpus_sample_missing",
            message="No corpus WAV filename was provided.",
            setup_hint="Pass a saved corpus sample path relative to local_speech_engine/audio_corpus.",
        )

    candidate = Path(str(filename).strip())
    if not candidate.is_absolute():
        candidate = corpus_dir / candidate

    resolved = candidate.resolve()
    corpus_root = corpus_dir.resolve()
    if not resolved.is_relative_to(corpus_root):
        raise CorpusError(
            code="corpus_sample_outside_corpus",
            message="Corpus samples can only be deleted from local_speech_engine/audio_corpus.",
            setup_hint="Pass a corpus-relative WAV path from the saved sample metadata.",
            details={"path": str(resolved), "corpus_dir": str(corpus_root)},
        )

    if not resolved.exists() or not resolved.is_file():
        raise CorpusError(
            code="corpus_sample_not_found",
            message=f"Corpus WAV sample was not found: {resolved.name}",
            setup_hint="Run the corpus audit to find stale labels before deleting samples.",
            details={"path": str(resolved)},
        )

    if resolved.suffix.lower() != ".wav":
        raise CorpusError(
            code="corpus_sample_not_wav",
            message="Only .wav corpus samples can be deleted through the corpus delete command.",
            setup_hint="Pass a corpus-relative WAV path.",
            details={"path": str(resolved)},
        )

    return resolved


def _load_label_payload(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8") or "[]")
    except json.JSONDecodeError as error:
        raise CorpusError(
            code="labels_json_invalid",
            message=f"Corpus labels file is not valid JSON: {path}",
            setup_hint="Fix the labels file before deleting corpus samples.",
            details={"path": str(path), "error": str(error)},
        ) from error


def _write_label_payload(payload: Any, path: Path) -> None:
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")


def _candidate_label_paths(
    *,
    corpus_dir: Path,
    labels_path: Path | None,
    label_file: str | None,
    session_id: str | None,
) -> list[Path]:
    if label_file and str(label_file).strip():
        candidate = Path(str(label_file).strip())
        if not candidate.is_absolute():
            candidate = corpus_dir / candidate.name
        resolved = candidate.resolve()
        corpus_root = corpus_dir.resolve()
        if not resolved.is_relative_to(corpus_root):
            raise CorpusError(
                code="label_file_outside_corpus",
                message="Corpus label files must be inside local_speech_engine/audio_corpus.",
                setup_hint="Pass a labels JSON filename, not an arbitrary path.",
                details={"path": str(resolved), "corpus_dir": str(corpus_root)},
            )
        return [resolved]

    if session_id and str(session_id).strip():
        return [_session_labels_path(corpus_dir, str(session_id).strip())]

    if labels_path is not None:
        return [labels_path]

    paths = [corpus_dir / "labels.json"]
    paths.extend(sorted(path for path in corpus_dir.glob("labels.*.json") if path.name != "labels.example.json"))
    seen: set[Path] = set()
    existing: list[Path] = []
    for path in paths:
        if path in seen or not path.exists():
            continue
        seen.add(path)
        existing.append(path)
    return existing


def _remove_label_entry(payload: Any, relative_file: str) -> tuple[Any, int]:
    if isinstance(payload, list):
        next_items = [
            item for item in payload
            if not (isinstance(item, dict) and str(item.get("file") or item.get("filename") or "").strip() == relative_file)
        ]
        return next_items, len(payload) - len(next_items)

    if isinstance(payload, dict):
        for key in ("files", "samples"):
            if isinstance(payload.get(key), list):
                next_payload = dict(payload)
                current_items = payload[key]
                next_items = [
                    item for item in current_items
                    if not (isinstance(item, dict) and str(item.get("filename") or item.get("file") or "").strip() == relative_file)
                ]
                next_payload[key] = next_items
                return next_payload, len(current_items) - len(next_items)

    return payload, 0


def delete_corpus_sample(
    filename: str | None,
    *,
    corpus_dir: Path = DEFAULT_CORPUS_DIR,
    labels_path: Path | None = None,
    label_file: str | None = None,
    session_id: str | None = None,
) -> dict[str, Any]:
    resolved = resolve_corpus_wav(filename, corpus_dir)
    relative_file = resolved.relative_to(corpus_dir.resolve()).as_posix()
    candidates = _candidate_label_paths(
        corpus_dir=corpus_dir,
        labels_path=labels_path,
        label_file=label_file,
        session_id=session_id,
    )

    changed: list[dict[str, Any]] = []
    for path in candidates:
        if not path.exists():
            continue
        payload = _load_label_payload(path)
        next_payload, removed = _remove_label_entry(payload, relative_file)
        if removed:
            _write_label_payload(next_payload, path)
            changed.append({"label_file": path.name, "removed_entries": removed})

    if not changed:
        raise CorpusError(
            code="corpus_label_not_found",
            message=f"No corpus label entry was found for: {relative_file}",
            setup_hint="Run the corpus audit to reconcile labels before deleting the sample.",
            details={"file": relative_file, "label_files_checked": [path.name for path in candidates]},
        )

    resolved.unlink()
    return {
        "filename": resolved.name,
        "file": relative_file,
        "deleted": True,
        "path": str(resolved),
        "label_file": changed[0]["label_file"],
        "label_files": changed,
    }


def normalize_sample_type(value: str | None) -> str:
    sample_type = str(value or "command").strip().lower()
    if sample_type not in VALID_SAMPLE_TYPES:
        raise CorpusError(
            code="sample_type_invalid",
            message=f"Unsupported corpus sample type: {sample_type}",
            setup_hint="Use type 'command' or 'voice_note'.",
            details={"sample_type": sample_type},
        )
    return sample_type


def normalize_category(sample_type: str, value: str | None) -> str:
    category = str(value or ("other" if sample_type == "command" else "trial_note")).strip().lower()
    category = category.replace(" ", "_")
    if sample_type == "command" and category not in COMMAND_CATEGORIES:
        return "other"
    if not category:
        return "other" if sample_type == "command" else "trial_note"
    return category


def sample_folder(sample_type: str, category: str) -> Path:
    if sample_type == "command":
        return Path("commands") / category
    return Path("voice_notes")


def save_segment_to_corpus(
    *,
    source_filename: str | None,
    expected: str | None,
    sample_type: str | None = "command",
    category: str | None = "other",
    notes: str | None = "",
    session_id: str | None = None,
    recordings_dir: Path = DEFAULT_RECORDINGS_DIR,
    corpus_dir: Path = DEFAULT_CORPUS_DIR,
    labels_path: Path | None = None,
) -> dict[str, Any]:
    expected_text = str(expected or "").strip()
    if not expected_text:
        raise CorpusError(
            code="expected_missing",
            message="Expected transcript text is required for a corpus sample.",
            setup_hint="Enter the word or phrase the WAV should contain.",
        )

    source_path = resolve_recording_wav(source_filename, recordings_dir)
    normalized_type = normalize_sample_type(sample_type)
    normalized_category = normalize_category(normalized_type, category)
    destination_dir = corpus_dir / sample_folder(normalized_type, normalized_category)
    destination_dir.mkdir(parents=True, exist_ok=True)
    destination_path = corpus_destination_path(destination_dir, expected_text, notes, source_path.name)
    shutil.copy2(source_path, destination_path)

    resolved_labels_path = labels_path or corpus_dir / "labels.json"
    relative_file = destination_path.relative_to(corpus_dir).as_posix()
    normalized_session_id = str(session_id or "").strip()

    if normalized_session_id:
        session_labels_path = _session_labels_path(corpus_dir, normalized_session_id)
        payload = _load_session_labels(
            session_labels_path,
            session_id=normalized_session_id,
            mode=normalized_type,
        )
        files = payload["files"]
        existing_file = next(
            (file_entry for file_entry in files if file_entry.get("filename") == relative_file),
            None,
        )
        file_entry = {
            "filename": relative_file,
            "expected": expected_text,
            "notes": str(notes or "").strip(),
        }
        if normalized_type != payload.get("mode"):
            file_entry["mode"] = normalized_type
        if normalized_category:
            file_entry["category"] = normalized_category

        if existing_file:
            existing_file.update(file_entry)
            sample = existing_file
        else:
            files.append(file_entry)
            sample = file_entry

        payload["session_id"] = normalized_session_id
        payload["mode"] = normalize_sample_type(payload.get("mode") or normalized_type)
        payload["auto_label_by_order"] = bool(payload.get("auto_label_by_order", False))
        payload["files"] = sorted(files, key=lambda item: str(item.get("filename") or ""))
        _write_session_labels(payload, session_labels_path)
        sample_payload = dict(sample)
        sample_payload["label_file"] = session_labels_path.name
        sample_payload["source_filename"] = source_path.name
        return sample_payload

    labels = load_labels(resolved_labels_path)
    existing = next((label for label in labels if label.get("file") == relative_file), None)

    if existing:
        existing.update(
            {
                "file": relative_file,
                "expected": expected_text,
                "type": normalized_type,
                "category": normalized_category,
                "notes": str(notes or "").strip(),
            }
        )
        sample = existing
    else:
        sample = {
            "id": f"sample_{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')}_{uuid.uuid4().hex[:8]}",
            "file": relative_file,
            "expected": expected_text,
            "type": normalized_type,
            "category": normalized_category,
            "notes": str(notes or "").strip(),
            "created_at": utc_timestamp(),
        }
        labels.append(sample)

    seen_ids: set[str] = set()
    for label in labels:
        label_id = str(label.get("id") or "")
        if not label_id or label_id in seen_ids:
            label["id"] = f"sample_{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')}_{uuid.uuid4().hex[:8]}"
        seen_ids.add(str(label["id"]))

    labels.sort(key=lambda label: str(label.get("created_at") or ""))
    write_labels(labels, resolved_labels_path)
    sample_payload = dict(sample)
    sample_payload["label_file"] = resolved_labels_path.name
    sample_payload["source_filename"] = source_path.name
    return sample_payload
