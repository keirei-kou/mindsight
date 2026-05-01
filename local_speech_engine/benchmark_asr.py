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
from local_speech_engine.corpus import DEFAULT_CORPUS_DIR, DEFAULT_LABELS_PATH, load_labels


ENGINE_ROOT = Path(__file__).resolve().parent
PROJECT_ROOT = ENGINE_ROOT.parent
RECORDINGS_DIR = ENGINE_ROOT / "recordings"
DEFAULT_RESULTS_DIR = ENGINE_ROOT / "benchmark_results"

CSV_FIELDS = [
    "provider",
    "sample_id",
    "file",
    "type",
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
    write_reports: bool = True,
) -> dict[str, Any]:
    labels = load_labels(labels_path)
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

        for label in labels:
            row = _run_sample(provider, label, corpus_dir)
            rows.append(row)

    total_passed = sum(1 for row in rows if row["passed"])
    latencies = [row["latency_ms"] for row in rows if isinstance(row.get("latency_ms"), (int, float))]
    report = {
        "timestamp": timestamp,
        "providers": provider_reports,
        "total_samples": len(labels),
        "total_evaluations": len(rows),
        "total_passed": total_passed,
        "accuracy": (total_passed / len(rows)) if rows else 0.0,
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


def _run_sample(provider: Any, label: dict[str, Any], corpus_dir: Path) -> dict[str, Any]:
    expected = str(label.get("expected") or "")
    normalized_expected = normalize_asr_text(expected)
    sample_path = corpus_dir / str(label.get("file") or "")
    started = time.perf_counter()
    row = {
        "provider": provider.name,
        "sample_id": label.get("id", ""),
        "file": label.get("file", ""),
        "type": label.get("type", ""),
        "category": label.get("category", ""),
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
        transcript = provider.transcribe_wav(sample_path)
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


def _write_csv(path: Path, rows: list[dict[str, Any]]) -> None:
    with path.open("w", newline="", encoding="utf-8") as csv_file:
        writer = csv.DictWriter(csv_file, fieldnames=CSV_FIELDS)
        writer.writeheader()
        for row in rows:
            writer.writerow({field: row.get(field, "") for field in CSV_FIELDS})


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Benchmark local ASR providers against labeled WAV corpus samples.")
    parser.add_argument("--providers", default="vosk", help="Comma-separated provider names. Default: vosk")
    parser.add_argument("--labels", type=Path, default=DEFAULT_LABELS_PATH, help="Path to labels.json.")
    parser.add_argument("--corpus-dir", type=Path, default=DEFAULT_CORPUS_DIR, help="Audio corpus root directory.")
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_RESULTS_DIR, help="Directory for JSON/CSV reports.")
    args = parser.parse_args(argv)

    report = run_benchmark(
        provider_names=args.providers,
        labels_path=args.labels,
        corpus_dir=args.corpus_dir,
        output_dir=args.output_dir,
        write_reports=True,
    )
    print(
        "ASR benchmark complete: "
        f"{report['total_passed']}/{report['total_evaluations']} passed "
        f"across {report['total_samples']} samples."
    )
    print(f"JSON: {report['json_path']}")
    print(f"CSV: {report['csv_path']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
