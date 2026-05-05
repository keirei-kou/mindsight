# ASR Model Strategy

This note documents the planned local ASR stack and model roles for Voice Engine Lab and the local speech engine. It is a roadmap/design note only. Do not implement Whisper, NeMo, Picovoice, or provider refactors as part of this document.

## Current Stack (Phase 1-5)

### Vosk

Role:

- Short command recognition.
- Low-latency local ASR.
- Robust fallback for clipped or isolated command words.

Current use:

- Command-mode recognition.
- Provider in the arbitration layer.
- Strong baseline for short labels such as colors, numbers, and shapes.

### Sherpa (Streaming Zipformer)

Role:

- Real-time streaming ASR.
- Phrase-level recognition.
- Second independent local ASR provider for arbitration.

Current use:

- Streaming local provider using Sherpa ONNX.
- Useful on longer phrases.
- Less reliable for very short isolated commands, especially when utterance beginnings are clipped.

## Planned Additions (Phase 6+)

### Whisper (via faster-whisper / CTranslate2)

Role:

- High-accuracy transcription.
- Subtitle mode.
- Slower but more context-aware ASR pass.

Use:

- Post-processing pass.
- Arbitration tie-breaker.
- High-accuracy transcript generation after a clip has already been captured.

Notes:

- Not used for real-time command triggering.
- Runs locally on desktop, for example through Tauri, when hardware allows.
- Optional cloud fallback can be considered later, but is not required for the local MVP.

### Optional: NVIDIA NeMo

Role:

- High-performance GPU ASR.
- Potential domain adaptation and custom model research.

Constraints:

- GPU-dependent.
- Heavier setup and runtime requirements.
- Not required for MVP.

Use case:

- Advanced users with strong hardware.
- Research or custom training phase.
- Possible future domain-specific ASR experiments.

### Optional: Picovoice (Porcupine / Leopard)

Role:

- Deterministic keyword spotting and wake-word detection.
- Fast command trigger support for critical phrases.

Use case:

- Instant command triggers.
- Wake-word detection.
- Fallback for critical commands where deterministic behavior matters.

Notes:

- Not required initially because the current approach uses general ASR plus normalization and arbitration.

## Architecture Model

Intended flow:

```text
Audio
  |
  v
Vosk (fast, short)
Sherpa (streaming)
Whisper (accurate, slower)
  |
  v
Arbitration Layer
  |
  v
Normalization / Intent Mapping
  |
  v
Command or Subtitle Output
```

## Design Principles

- Do not rely on a single ASR model.
- Treat models as independent witnesses.
- Arbitration resolves disagreement.
- Normalize to intent, not raw text.
- Keep command mode and subtitle mode separate.
- Command mode should prioritize low latency and deterministic output.
- Subtitle mode should prioritize accuracy and context awareness.
- Preserve local-first operation where practical.

## Phasing

### Phase 5

- Corpus collection.
- Vosk vs Sherpa benchmarking.
- Identify clipping, latency, and short-command failure modes.

### Phase 6

- Arbitration policy definition.
- Compare provider agreement, vocabulary validity, confidence, latency, and fallback behavior.
- Stabilize benchmark reports before adding more providers.

### Phase 7

- Integrate faster-whisper through CTranslate2.
- Use Whisper for post-processing and subtitle-quality transcription.
- Keep Whisper out of the real-time command trigger path unless later benchmarks justify it.

### Phase 8

- Normalization learning layer.
- Pattern accumulation from corpus and benchmark outputs.
- Improve intent mapping from repeated ASR confusions.

### Phase 9

- Optional advanced models.
- Evaluate NVIDIA NeMo for GPU-heavy workflows.
- Evaluate Picovoice for deterministic wake-word or critical-command paths.

## Constraints

- Do not implement Whisper yet.
- Do not refactor providers yet.
- Do not add NeMo or Picovoice dependencies yet.
- Continue current corpus collection and Vosk/Sherpa benchmarking first.
- Keep provider outputs, arbitration policy work, and corpus labels separate until the schema upgrade is explicitly approved.
