from __future__ import annotations

import argparse
import hashlib
import json
import shutil
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from local_speech_engine.corpus import DEFAULT_CORPUS_DIR


LABELS_EXAMPLE_NAME = "labels.example.json"
LABEL_FILENAME_KEYS = ("file", "filename")


@dataclass(frozen=True)
class LabelEntry:
    labels_path: Path
    index: int
    shape: str
    key: str
    filename: str
    expected: str
    entry: dict[str, Any]


def utc_timestamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def label_files(corpus_dir: Path, *, include_examples: bool = False) -> list[Path]:
    paths = [corpus_dir / "labels.json"]
    paths.extend(sorted(corpus_dir.glob("labels.*.json")))
    seen: set[Path] = set()
    resolved: list[Path] = []
    for path in paths:
        if path in seen or not path.exists():
            continue
        seen.add(path)
        if not include_examples and path.name == LABELS_EXAMPLE_NAME:
            continue
        resolved.append(path)
    return resolved


def load_label_payload(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8") or "[]")


def write_label_payload(path: Path, payload: Any) -> None:
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")


def label_entries(path: Path, payload: Any) -> list[LabelEntry]:
    if isinstance(payload, list):
        return _entries_from_array(path, payload, "list")

    if isinstance(payload, dict):
        if isinstance(payload.get("files"), list):
            return _entries_from_array(path, payload["files"], "files")
        if isinstance(payload.get("samples"), list):
            return _entries_from_array(path, payload["samples"], "samples")

    return []


def _entries_from_array(path: Path, items: list[Any], shape: str) -> list[LabelEntry]:
    entries: list[LabelEntry] = []
    for index, item in enumerate(items):
        if not isinstance(item, dict):
            continue
        key = next((candidate for candidate in LABEL_FILENAME_KEYS if item.get(candidate)), "")
        filename = str(item.get(key) or "").strip() if key else ""
        entries.append(
            LabelEntry(
                labels_path=path,
                index=index,
                shape=shape,
                key=key,
                filename=filename,
                expected=str(item.get("expected") or "").strip(),
                entry=item,
            )
        )
    return entries


def wav_files(corpus_dir: Path) -> list[Path]:
    roots = [corpus_dir / "commands", corpus_dir / "voice_notes"]
    files: list[Path] = []
    for root in roots:
        if root.exists():
            files.extend(path for path in root.rglob("*.wav") if path.is_file())
    return sorted(files)


def canonical_entry(entry: dict[str, Any]) -> str:
    return json.dumps(entry, sort_keys=True, separators=(",", ":"), ensure_ascii=True)


def audit_corpus(corpus_dir: Path = DEFAULT_CORPUS_DIR, *, include_examples: bool = False) -> dict[str, Any]:
    corpus_dir = corpus_dir.resolve()
    labels_paths = label_files(corpus_dir, include_examples=include_examples)
    wav_paths = wav_files(corpus_dir)
    wav_relatives = {path.relative_to(corpus_dir).as_posix(): path for path in wav_paths}
    wavs_by_basename: dict[str, list[str]] = defaultdict(list)
    for relative in wav_relatives:
        wavs_by_basename[Path(relative).name].append(relative)

    invalid_label_files: list[dict[str, Any]] = []
    all_entries: list[LabelEntry] = []
    per_file: list[dict[str, Any]] = []
    for path in labels_paths:
        try:
            payload = load_label_payload(path)
        except Exception as error:
            invalid_label_files.append({"label_file": path.name, "error": str(error)})
            per_file.append({
                "label_file": path.name,
                "shape": "invalid",
                "entries": 0,
                "stale": 0,
                "repairable_path_drift": 0,
                "duplicate_refs_extra": 0,
                "exact_duplicate_entries_extra": 0,
            })
            continue

        entries = label_entries(path, payload)
        all_entries.extend(entries)
        names = [entry.filename for entry in entries if entry.filename]
        identical_counts = Counter(canonical_entry(entry.entry) for entry in entries)
        per_file.append({
            "label_file": path.name,
            "shape": _payload_shape(payload),
            "entries": len(entries),
            "stale": 0,
            "repairable_path_drift": 0,
            "duplicate_refs_extra": sum(count - 1 for count in Counter(names).values() if count > 1),
            "exact_duplicate_entries_extra": sum(count - 1 for count in identical_counts.values() if count > 1),
        })

    repairable_path_drift: list[dict[str, Any]] = []
    ambiguous_path_drift: list[dict[str, Any]] = []
    stale_labels: list[dict[str, Any]] = []
    blank_filename_labels: list[dict[str, Any]] = []
    effective_refs: list[str] = []

    per_file_by_name = {item["label_file"]: item for item in per_file}
    for entry in all_entries:
        if not entry.filename:
            blank_filename_labels.append(_entry_payload(entry))
            stale_labels.append(_entry_payload(entry))
            per_file_by_name[entry.labels_path.name]["stale"] += 1
            continue

        if entry.filename in wav_relatives:
            effective_refs.append(entry.filename)
            continue

        basename_matches = sorted(wavs_by_basename.get(Path(entry.filename).name, []))
        if len(basename_matches) == 1:
            resolved_filename = basename_matches[0]
            repairable_path_drift.append({
                **_entry_payload(entry),
                "current_file": entry.filename,
                "repaired_file": resolved_filename,
            })
            effective_refs.append(resolved_filename)
            per_file_by_name[entry.labels_path.name]["repairable_path_drift"] += 1
        elif len(basename_matches) > 1:
            ambiguous_path_drift.append({
                **_entry_payload(entry),
                "current_file": entry.filename,
                "candidates": basename_matches,
            })
            stale_labels.append(_entry_payload(entry))
            per_file_by_name[entry.labels_path.name]["stale"] += 1
        else:
            stale_labels.append(_entry_payload(entry))
            per_file_by_name[entry.labels_path.name]["stale"] += 1

    duplicate_ref_groups = _duplicate_ref_groups(all_entries)
    exact_duplicate_groups = _exact_duplicate_groups(all_entries)
    duplicate_wav_groups = _duplicate_wav_groups(corpus_dir, wav_paths)
    effective_ref_set = set(effective_refs)
    orphan_wavs = sorted(relative for relative in wav_relatives if relative not in effective_ref_set)
    old_vad_refs = [_entry_payload(entry) for entry in all_entries if "vad_segment" in entry.filename]

    return {
        "corpus_dir": str(corpus_dir),
        "summary": {
            "label_files": len(labels_paths),
            "invalid_label_files": len(invalid_label_files),
            "label_entries": len(all_entries),
            "wav_files": len(wav_paths),
            "stale_labels": len(stale_labels),
            "repairable_path_drift": len(repairable_path_drift),
            "ambiguous_path_drift": len(ambiguous_path_drift),
            "orphan_wavs": len(orphan_wavs),
            "duplicate_ref_groups": len(duplicate_ref_groups),
            "duplicate_refs_extra": sum(group["count"] - 1 for group in duplicate_ref_groups),
            "exact_duplicate_entry_groups": len(exact_duplicate_groups),
            "exact_duplicate_entries_extra": sum(group["count"] - 1 for group in exact_duplicate_groups),
            "duplicate_wav_hash_groups": len(duplicate_wav_groups),
            "duplicate_wav_hash_extra": sum(group["count"] - 1 for group in duplicate_wav_groups),
            "old_vad_segment_refs": len(old_vad_refs),
        },
        "per_file": per_file,
        "invalid_label_files": invalid_label_files,
        "stale_labels": stale_labels,
        "repairable_path_drift": repairable_path_drift,
        "ambiguous_path_drift": ambiguous_path_drift,
        "orphan_wavs": orphan_wavs,
        "duplicate_ref_groups": duplicate_ref_groups,
        "exact_duplicate_entry_groups": exact_duplicate_groups,
        "duplicate_wav_hash_groups": duplicate_wav_groups,
        "old_vad_segment_refs": old_vad_refs,
        "blank_filename_labels": blank_filename_labels,
    }


def apply_fixes(corpus_dir: Path = DEFAULT_CORPUS_DIR, *, include_examples: bool = False) -> dict[str, Any]:
    corpus_dir = corpus_dir.resolve()
    report = audit_corpus(corpus_dir, include_examples=include_examples)
    repairs_by_file: dict[str, dict[int, str]] = defaultdict(dict)
    stale_by_file: dict[str, set[int]] = defaultdict(set)
    duplicate_by_file: dict[str, set[int]] = defaultdict(set)
    for repair in report["repairable_path_drift"]:
        repairs_by_file[repair["label_file"]][int(repair["index"])] = repair["repaired_file"]
    for stale in report["stale_labels"]:
        stale_by_file[stale["label_file"]].add(int(stale["index"]))
    for group in report["exact_duplicate_entry_groups"]:
        for duplicate in group["entries"][1:]:
            duplicate_by_file[duplicate["label_file"]].add(int(duplicate["index"]))

    backups: list[dict[str, str]] = []
    changed_files: list[dict[str, Any]] = []
    timestamp = utc_timestamp()
    for path in label_files(corpus_dir, include_examples=include_examples):
        if path.name not in repairs_by_file and path.name not in stale_by_file and path.name not in duplicate_by_file:
            continue

        payload = load_label_payload(path)
        fixed_payload, changes = _fixed_payload(
            payload,
            repairs=repairs_by_file.get(path.name, {}),
            stale_indexes=stale_by_file.get(path.name, set()),
            duplicate_indexes=duplicate_by_file.get(path.name, set()),
        )
        if not changes:
            continue

        backup_path = path.with_name(f"{path.name}.bak.{timestamp}")
        shutil.copy2(path, backup_path)
        write_label_payload(path, fixed_payload)
        backups.append({"label_file": path.name, "backup": str(backup_path)})
        changed_files.append({"label_file": path.name, **changes})

    fixed_report = audit_corpus(corpus_dir, include_examples=include_examples)
    fixed_report["fix"] = {
        "applied": True,
        "backups": backups,
        "changed_files": changed_files,
    }
    return fixed_report


def _fixed_payload(
    payload: Any,
    *,
    repairs: dict[int, str],
    stale_indexes: set[int],
    duplicate_indexes: set[int],
) -> tuple[Any, dict[str, int]]:
    if isinstance(payload, list):
        fixed_items, changes = _fixed_items(
            payload,
            repairs=repairs,
            stale_indexes=stale_indexes,
            duplicate_indexes=duplicate_indexes,
        )
        return fixed_items, changes

    if isinstance(payload, dict):
        fixed_payload = dict(payload)
        if isinstance(payload.get("files"), list):
            fixed_items, changes = _fixed_items(
                payload["files"],
                repairs=repairs,
                stale_indexes=stale_indexes,
                duplicate_indexes=duplicate_indexes,
            )
            fixed_payload["files"] = fixed_items
            return fixed_payload, changes
        if isinstance(payload.get("samples"), list):
            fixed_items, changes = _fixed_items(
                payload["samples"],
                repairs=repairs,
                stale_indexes=stale_indexes,
                duplicate_indexes=duplicate_indexes,
            )
            fixed_payload["samples"] = fixed_items
            return fixed_payload, changes

    return payload, {}


def _fixed_items(
    items: list[Any],
    *,
    repairs: dict[int, str],
    stale_indexes: set[int],
    duplicate_indexes: set[int],
) -> tuple[list[Any], dict[str, int]]:
    fixed: list[Any] = []
    seen_entries: set[str] = set()
    repaired = 0
    removed_stale = 0
    removed_duplicates = 0

    for index, item in enumerate(items):
        if index in stale_indexes:
            removed_stale += 1
            continue
        if index in duplicate_indexes:
            removed_duplicates += 1
            continue

        next_item = dict(item) if isinstance(item, dict) else item
        if isinstance(next_item, dict) and index in repairs:
            key = next((candidate for candidate in LABEL_FILENAME_KEYS if next_item.get(candidate)), "")
            if key:
                next_item[key] = repairs[index]
                repaired += 1

        if isinstance(next_item, dict):
            canonical = canonical_entry(next_item)
            if canonical in seen_entries:
                removed_duplicates += 1
                continue
            seen_entries.add(canonical)

        fixed.append(next_item)

    changes = {
        "repaired_path_drift": repaired,
        "removed_stale_labels": removed_stale,
        "removed_exact_duplicate_entries": removed_duplicates,
    }
    return fixed, {key: value for key, value in changes.items() if value}


def _payload_shape(payload: Any) -> str:
    if isinstance(payload, list):
        return "list"
    if isinstance(payload, dict):
        if isinstance(payload.get("files"), list):
            return "dict:files"
        if isinstance(payload.get("samples"), list):
            return "dict:samples"
        return "dict"
    return type(payload).__name__


def _entry_payload(entry: LabelEntry) -> dict[str, Any]:
    return {
        "label_file": entry.labels_path.name,
        "index": entry.index,
        "shape": entry.shape,
        "file": entry.filename,
        "expected": entry.expected,
    }


def _duplicate_ref_groups(entries: list[LabelEntry]) -> list[dict[str, Any]]:
    grouped: dict[str, list[LabelEntry]] = defaultdict(list)
    for entry in entries:
        if entry.filename:
            grouped[entry.filename].append(entry)
    return [
        {
            "file": filename,
            "count": len(group),
            "entries": [_entry_payload(entry) for entry in group],
        }
        for filename, group in sorted(grouped.items())
        if len(group) > 1
    ]


def _exact_duplicate_groups(entries: list[LabelEntry]) -> list[dict[str, Any]]:
    grouped: dict[tuple[str, str], list[LabelEntry]] = defaultdict(list)
    for entry in entries:
        grouped[(entry.labels_path.name, canonical_entry(entry.entry))].append(entry)
    return [
        {
            "label_file": label_file,
            "count": len(group),
            "file": group[0].filename,
            "expected": group[0].expected,
            "entries": [_entry_payload(entry) for entry in group],
        }
        for (label_file, _), group in sorted(grouped.items())
        if len(group) > 1
    ]


def _duplicate_wav_groups(corpus_dir: Path, paths: list[Path]) -> list[dict[str, Any]]:
    grouped: dict[str, list[str]] = defaultdict(list)
    for path in paths:
        digest = hashlib.sha256()
        with path.open("rb") as wav_file:
            for chunk in iter(lambda: wav_file.read(1024 * 1024), b""):
                digest.update(chunk)
        grouped[digest.hexdigest()].append(path.relative_to(corpus_dir).as_posix())

    return [
        {"sha256": digest, "count": len(files), "files": sorted(files)}
        for digest, files in sorted(grouped.items())
        if len(files) > 1
    ]


def print_text_report(report: dict[str, Any], *, fixed: bool = False) -> None:
    summary = report["summary"]
    print(f"Corpus audit: {'FIX APPLIED' if fixed else 'DRY RUN'}")
    print(f"Corpus dir: {report['corpus_dir']}")
    print(
        "Summary: "
        f"{summary['label_files']} label files, "
        f"{summary['label_entries']} label entries, "
        f"{summary['wav_files']} WAVs"
    )
    print(
        "Issues: "
        f"{summary['repairable_path_drift']} repairable path drift, "
        f"{summary['stale_labels']} stale labels, "
        f"{summary['orphan_wavs']} orphan WAVs, "
        f"{summary['duplicate_refs_extra']} duplicate refs extra, "
        f"{summary['exact_duplicate_entries_extra']} exact duplicate entries extra, "
        f"{summary['duplicate_wav_hash_extra']} duplicate WAV hash extra, "
        f"{summary['old_vad_segment_refs']} old vad_segment refs"
    )

    if report.get("fix"):
        print("\nBackups:")
        for backup in report["fix"]["backups"]:
            print(f"  {backup['label_file']} -> {backup['backup']}")
        print("\nChanged label files:")
        for change in report["fix"]["changed_files"]:
            details = ", ".join(f"{key}={value}" for key, value in change.items() if key != "label_file")
            print(f"  {change['label_file']}: {details}")

    _print_table("Per label file", report["per_file"])
    _print_entries("Repairable path drift", report["repairable_path_drift"], keys=("label_file", "index", "current_file", "repaired_file", "expected"))
    _print_entries("Stale labels", report["stale_labels"], keys=("label_file", "index", "file", "expected"))
    _print_values("Orphan WAVs", report["orphan_wavs"])
    _print_entries("Duplicate label reference groups", report["duplicate_ref_groups"], keys=("file", "count"))
    _print_entries("Exact duplicate entry groups", report["exact_duplicate_entry_groups"], keys=("label_file", "file", "count", "expected"))
    _print_entries("Duplicate WAV content groups", report["duplicate_wav_hash_groups"], keys=("sha256", "count"))


def _print_table(title: str, rows: list[dict[str, Any]]) -> None:
    print(f"\n{title}: count={len(rows)}")
    for row in rows:
        print(
            f"  {row['label_file']} | {row['shape']} | entries={row['entries']} | "
            f"repairable={row['repairable_path_drift']} | stale={row['stale']} | "
            f"duplicate_refs_extra={row['duplicate_refs_extra']} | "
            f"exact_duplicates_extra={row['exact_duplicate_entries_extra']}"
        )


def _print_entries(title: str, rows: list[dict[str, Any]], *, keys: tuple[str, ...]) -> None:
    print(f"\n{title}: count={len(rows)}")
    for row in rows[:80]:
        print("  " + " | ".join(f"{key}={row.get(key, '')}" for key in keys))
    if len(rows) > 80:
        print(f"  ... {len(rows) - 80} more")


def _print_values(title: str, values: list[str]) -> None:
    print(f"\n{title}: count={len(values)}")
    for value in values[:80]:
        print(f"  {value}")
    if len(values) > 80:
        print(f"  ... {len(values) - 80} more")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Audit local speech corpus label/WAV integrity.")
    parser.add_argument("--corpus-dir", type=Path, default=DEFAULT_CORPUS_DIR, help="Corpus root directory.")
    parser.add_argument("--format", choices=("text", "json"), default="text", help="Report format.")
    parser.add_argument("--include-examples", action="store_true", help="Include labels.example.json in the audit.")
    parser.add_argument("--fix", action="store_true", help="Repair label path drift and remove stale/exact duplicate labels.")
    args = parser.parse_args(argv)

    report = apply_fixes(args.corpus_dir, include_examples=args.include_examples) if args.fix else audit_corpus(args.corpus_dir, include_examples=args.include_examples)
    if args.format == "json":
        print(json.dumps(report, indent=2, ensure_ascii=True))
    else:
        print_text_report(report, fixed=args.fix)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
