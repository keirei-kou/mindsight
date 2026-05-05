# Corpus Schema Future

This note documents the current local speech corpus label schema and a planned future upgrade path. It is a design note only. Do not implement this schema change during the current corpus collection phase.

## Current Schema

Current corpus labels are stored in:

- `local_speech_engine/audio_corpus/labels.json`
- optionally `local_speech_engine/audio_corpus/labels.<session_id>.json`

The current `labels.json` structure is an array of sample label objects:

```json
[
  {
    "id": "sample_20260505T190137782730Z_e47b8c68",
    "file": "commands/colors/vad_segment_20260505T190121_357Z_0001.wav",
    "expected": "red",
    "type": "command",
    "category": "colors",
    "notes": "single_word|quiet",
    "created_at": "2026-05-05T19:01:37.782730Z"
  }
]
```

Current fields:

- `id`: Unique local sample identifier.
- `file`: Corpus-relative WAV path.
- `expected`: Ground-truth expected transcript or command label.
- `type`: Sample type, usually `command` or `voice_note`.
- `category`: Logical category such as `colors`, `numbers`, `shapes`, `other`, or `trial_note`.
- `notes`: Free-form top-level string, for example `single_word|quiet`.
- `created_at`: UTC timestamp when the label row was created.

Session label files use a similar, session-oriented shape:

```json
{
  "session_id": "colors_red_2026-05-03",
  "mode": "command",
  "auto_label_by_order": false,
  "files": [
    {
      "filename": "commands/colors/vad_segment_20260505T190121_357Z_0001.wav",
      "expected": "red",
      "notes": "single_word|quiet",
      "category": "colors"
    }
  ]
}
```

## Current Design Boundary

The current system intentionally separates:

- Corpus labels: ground-truth sample metadata stored in `labels.json`.
- Benchmark outputs: model performance data written by benchmark scripts.
- UI state: transient ASR provider outputs and arbitration results shown in Voice Engine Lab.

Important limitation: `labels.json` does not currently store ASR outputs such as Vosk or Sherpa raw text, normalized text, confidence, latency, provider diagnostics, or arbitration decisions. Those values exist in UI state, local events, or benchmark result files.

This separation keeps corpus labels stable and model-agnostic while ASR providers and arbitration policies are still changing.

## Future Schema

Future corpus entries may include optional ASR and arbitration snapshots, once the corpus is large enough and the benchmark pipeline is stable.

Proposed future shape:

```json
{
  "id": "sample_20260505T190137782730Z_e47b8c68",
  "file": "commands/colors/vad_segment_20260505T190121_357Z_0001.wav",
  "expected": "red",
  "type": "command",
  "category": "colors",
  "notes": "single_word|quiet",
  "created_at": "2026-05-05T19:01:37.782730Z",
  "asr": {
    "vosk": {
      "raw": "read",
      "normalized": "red",
      "confidence": 0.92,
      "latency_ms": 811
    },
    "sherpa": {
      "raw": "'S SELECT RED",
      "normalized": "red",
      "confidence": null,
      "latency_ms": 120
    }
  },
  "arbitration": {
    "final_text": "red",
    "final_command": "red",
    "decision": "agreement",
    "mode": "command"
  }
}
```

Future fields:

- `asr`: Optional provider result snapshots keyed by provider name.
- `asr.<provider>.raw`: Raw transcript emitted by the provider.
- `asr.<provider>.normalized`: Normalized text or command used for scoring.
- `asr.<provider>.confidence`: Provider confidence when available.
- `asr.<provider>.latency_ms`: Provider runtime in milliseconds.
- `arbitration`: Optional final arbitration result snapshot.
- `arbitration.final_text`: Final text selected by arbitration.
- `arbitration.final_command`: Final normalized command, if command mode applies.
- `arbitration.decision`: Arbitration decision reason or policy outcome.
- `arbitration.mode`: Arbitration mode, such as `command` or `subtitle`.

## TODO

Phase: Post-corpus collection / arbitration tuning

Implement this only after:

- The corpus has sufficient size, for example 100+ labeled samples.
- Vosk vs Sherpa benchmark scripts are stable.
- Arbitration policy definitions are stable enough to compare over time.
- The team decides whether provider outputs belong in labels, sidecar metadata, or benchmark result artifacts.

Do not implement this schema upgrade now. Continue using `labels.json` as ground truth and benchmark outputs as model performance records.
