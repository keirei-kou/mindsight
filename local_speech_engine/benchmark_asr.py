from __future__ import annotations

import argparse
import csv
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

if __package__ in {None, ""}:
    sys.path.append(str(Path(__file__).resolve().parents[1]))

from local_speech_engine.asr import AsrProviderError, AsrRegistry, LocalSpeechConfig
from local_speech_engine.asr_normalization import normalize_asr_text
from local_speech_engine.corpus import DEFAULT_CORPUS_DIR, DEFAULT_LABELS_PATH, CorpusSample, load_corpus_samples


ENGINE_ROOT = Path(__file__).resolve().parent
PROJECT_ROOT = ENGINE_ROOT.parent
RECORDINGS_DIR = ENGINE_ROOT / "recordings"
DEFAULT_RESULTS_DIR = ENGINE_ROOT / "benchmark_results"

CSV_FIELDS = [
    "provider",
    "label_file",
    "session_id",
    "sample_id",
    "file",
    "path",
    "type",
    "mode",
    "category",
    "expected",
    "normalized_expected",
    "raw_transcript",
    "normalized_transcript",
    "confidence",
    "latency_ms",
    "passed",
    "wer",
    "error",
]


def report_timestamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def parse_provider_names(value: str | Iterable[str] | None) -> list[str]:
    if value is None:
        return ["vosk"]
    if isinstance(value, str):
        names = [name.strip().lower() for name in value.split(",")]
    else:
        names = [str(name).strip().lower() for name in value]
    return [name for name in names if name] or ["vosk"]


def _event_payload_from_error(error: Exception) -> dict[str, Any]:
    if isinstance(error, AsrProviderError):
        return error.to_event_payload()
    return {
        "provider": "unknown",
        "code": "unexpected_error",
        "message": str(error),
        "setup_hint": "Check the local speech engine console for details.",
        "details": {},
    }


def run_benchmark(
    *,
    provider_names: str | Iterable[str] | None = None,
    registry: AsrRegistry | Any | None = None,
    labels_path: Path = DEFAULT_LABELS_PATH,
    corpus_dir: Path = DEFAULT_CORPUS_DIR,
    output_dir: Path = DEFAULT_RESULTS_DIR,
    all_label_files: bool = False,
    write_reports: bool = True,
) -> dict[str, Any]:
    corpus = load_corpus_samples(
        corpus_dir=corpus_dir,
        labels_path=labels_path,
        all_label_files=all_label_files,
    )
    samples = list(corpus.samples)
    selected_providers = parse_provider_names(provider_names)
    active_registry = registry or AsrRegistry(
        LocalSpeechConfig.from_env(PROJECT_ROOT, RECORDINGS_DIR)
    )
    timestamp = report_timestamp()
    provider_reports: list[dict[str, Any]] = []
    rows: list[dict[str, Any]] = []

    for provider_name in selected_providers:
        try:
            provider = active_registry.get_provider(provider_name)
            status = provider.status()
            if not status.available:
                provider_reports.append(
                    {
                        "name": provider_name,
                        "available": False,
                        "loaded": False,
                        "skipped": True,
                        "message": status.message,
                        "setup_hint": status.setup_hint,
                        "details": status.details,
                    }
                )
                continue

            load_started = time.perf_counter()
            loaded_status = provider.load()
            provider_reports.append(
                {
                    "name": provider_name,
                    "available": True,
                    "loaded": loaded_status.loaded,
                    "skipped": False,
                    "load_latency_ms": round((time.perf_counter() - load_started) * 1000, 2),
                    "message": loaded_status.message,
                    "model_path": loaded_status.model_path,
                }
            )
        except Exception as error:
            payload = _event_payload_from_error(error)
            provider_reports.append(
                {
                    "name": provider_name,
                    "available": False,
                    "loaded": False,
                    "skipped": True,
                    "message": payload["message"],
                    "setup_hint": payload.get("setup_hint", ""),
                    "details": payload.get("details", {}),
                    "code": payload.get("code", "unexpected_error"),
                }
            )
            continue

        for sample in samples:
            row = _run_sample(provider, sample)
            rows.append(row)

    total_passed = sum(1 for row in rows if row["passed"])
    latencies = [row["latency_ms"] for row in rows if isinstance(row.get("latency_ms"), (int, float))]
    evaluation_stats = _evaluation_stats(rows)
    report = {
        "timestamp": timestamp,
        "corpus": corpus.stats(),
        "providers": provider_reports,
        "total_samples": len(samples),
        "label_files_loaded": len(corpus.label_files),
        "label_files": list(corpus.label_files),
        "total_evaluations": len(rows),
        "total_passed": total_passed,
        "accuracy": (total_passed / len(rows)) if rows else 0.0,
        "blank_transcript_count": evaluation_stats["blank_transcript_count"],
        "blank_transcript_rate": evaluation_stats["blank_transcript_rate"],
        "provider_error_count": evaluation_stats["provider_error_count"],
        "provider_error_rate": evaluation_stats["provider_error_rate"],
        "command_match_count": evaluation_stats["command_match_count"],
        "command_match_rate": evaluation_stats["command_match_rate"],
        "evaluation_stats": evaluation_stats,
        "per_category_accuracy": _per_category_accuracy(rows),
        "average_latency_ms": (sum(latencies) / len(latencies)) if latencies else None,
        "rows": rows,
    }

    if write_reports:
        output_dir.mkdir(parents=True, exist_ok=True)
        json_path = output_dir / f"asr_benchmark_{timestamp}.json"
        csv_path = output_dir / f"asr_benchmark_{timestamp}.csv"
        report["json_path"] = str(json_path)
        report["csv_path"] = str(csv_path)
        json_path.write_text(json.dumps(report, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")
        _write_csv(csv_path, rows)

    return report


def _run_sample(provider: Any, sample: CorpusSample) -> dict[str, Any]:
    expected = sample.expected
    normalized_expected = normalize_asr_text(expected)
    started = time.perf_counter()
    row = {
        "provider": provider.name,
        "label_file": sample.label_file,
        "session_id": sample.session_id,
        "sample_id": sample.sample_id,
        "file": sample.file,
        "path": str(sample.path),
        "type": sample.sample_type,
        "mode": sample.mode,
        "category": sample.category,
        "expected": expected,
        "normalized_expected": normalized_expected,
        "raw_transcript": "",
        "normalized_transcript": "",
        "confidence": None,
        "latency_ms": None,
        "passed": False,
        "wer": None,
        "error": "",
    }

    try:
        transcript = provider.transcribe_wav(sample.path)
        latency_ms = round((time.perf_counter() - started) * 1000, 2)
        normalized_transcript = normalize_asr_text(transcript.text)
        row.update(
            {
                "raw_transcript": transcript.text,
                "normalized_transcript": normalized_transcript,
                "confidence": transcript.confidence,
                "latency_ms": latency_ms,
                "passed": normalized_transcript == normalized_expected,
            }
        )
    except Exception as error:
        row.update(
            {
                "latency_ms": round((time.perf_counter() - started) * 1000, 2),
                "error": str(error),
                "passed": False,
            }
        )

    return row


def _evaluation_stats(rows: list[dict[str, Any]]) -> dict[str, Any]:
    total = len(rows)
    blank_count = sum(1 for row in rows if not row.get("error") and not str(row.get("raw_transcript") or "").strip())
    error_count = sum(1 for row in rows if row.get("error"))
    command_rows = [
        row for row in rows
        if str(row.get("type") or row.get("mode") or "command").strip() == "command"
        and str(row.get("normalized_expected") or "").strip()
    ]
    command_match_count = sum(1 for row in command_rows if row.get("passed"))
    return {
        "total_evaluations": total,
        "blank_transcript_count": blank_count,
        "blank_transcript_rate": _ratio(blank_count, total),
        "provider_error_count": error_count,
        "provider_error_rate": _ratio(error_count, total),
        "command_evaluation_count": len(command_rows),
        "command_match_count": command_match_count,
        "command_match_rate": _ratio(command_match_count, len(command_rows)),
    }


def _per_category_accuracy(rows: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    stats: dict[str, dict[str, Any]] = {}
    for row in rows:
        category = str(row.get("category") or "other")
        bucket = stats.setdefault(category, {"total": 0, "passed": 0, "accuracy": 0.0})
        bucket["total"] += 1
        if row.get("passed"):
            bucket["passed"] += 1

    for bucket in stats.values():
        bucket["accuracy"] = (bucket["passed"] / bucket["total"]) if bucket["total"] else 0.0

    return stats


def _ratio(count: int, total: int) -> float:
    return (count / total) if total else 0.0


def _write_csv(path: Path, rows: list[dict[str, Any]]) -> None:
    with path.open("w", newline="", encoding="utf-8") as csv_file:
        writer = csv.DictWriter(csv_file, fieldnames=CSV_FIELDS)
        writer.writeheader()
        for row in rows:
            writer.writerow({field: row.get(field, "") for field in CSV_FIELDS})


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Benchmark local ASR providers against labeled WAV corpus samples.")
    parser.add_argument("--providers", default="vosk", help="Comma-separated provider names. Default: vosk")
    parser.add_argument("--labels", "--labels-file", dest="labels", type=Path, default=DEFAULT_LABELS_PATH, help="Path to a single labels JSON file.")
    parser.add_argument("--all-label-files", action="store_true", help="Benchmark every valid labels*.json file in the corpus directory.")
    parser.add_argument("--corpus-dir", type=Path, default=DEFAULT_CORPUS_DIR, help="Audio corpus root directory.")
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_RESULTS_DIR, help="Directory for JSON/CSV reports.")
    args = parser.parse_args(argv)

    report = run_benchmark(
        provider_names=args.providers,
        labels_path=args.labels,
        corpus_dir=args.corpus_dir,
        output_dir=args.output_dir,
        all_label_files=args.all_label_files,
        write_reports=True,
    )
    print(
        "ASR benchmark complete: "
        f"{report['total_passed']}/{report['total_evaluations']} passed "
        f"across {report['total_samples']} samples from {report['label_files_loaded']} label files."
    )
    print(f"JSON: {report['json_path']}")
    print(f"CSV: {report['csv_path']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
