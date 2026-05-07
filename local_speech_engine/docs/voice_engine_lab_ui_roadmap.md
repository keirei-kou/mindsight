# Voice Engine Lab UI Roadmap

This document captures future Voice Engine Lab UI upgrades for local ASR provider loading, batch arbitration, corpus-scale benchmarking, and local speech calibration review. It is a planning document only. Do not implement these UI upgrades until corpus collection and script-based benchmarking are stable.

## Current Lab Capabilities

Voice Engine Lab currently supports:

- Loading local ASR providers such as Vosk and Sherpa.
- Recording WAV segments through the local VAD sidecar.
- Labeling captured segments with expected text, type, category, session ID, and notes.
- Running arbitration on a selected or latest segment.
- Saving labeled clips into `local_speech_engine/audio_corpus`.

The lab is intentionally separate from TrainingRoom. It is the diagnostic and corpus-building surface for local voice work.

## Current Pain Points

- Providers must be loaded individually.
- Arbitration is mostly scoped to one selected or latest audio segment.
- Corpus-scale provider comparison currently belongs in scripts and benchmark outputs, not the UI.
- There is no UI panel yet for running batch arbitration across all saved WAVs.
- There is no local review surface yet for teaching PsiLabs that a recurring transcript means a specific command, participant name, action, or `NO_COMMAND`.

## UI Upgrade A: Load All Providers

Add a Voice Engine Lab button:

```text
Load all available providers
```

Expected behavior:

- Attempts to load every available configured provider.
- Loads Vosk.
- Loads Sherpa.
- Later loads Whisper when a local faster-whisper provider exists.
- Shows individual status per provider.
- Keeps the existing provider status messages and setup hints visible.
- One provider failure does not fail the whole operation.
- A failed provider should show its own error while successfully loaded providers remain usable.
- Existing individual load buttons can remain for debugging and targeted retries.

Implementation notes:

- This should be a UI convenience layer over existing provider load commands.
- It should not require provider architecture refactors.
- It should not change arbitration behavior.
- It should not require TrainingRoom integration.

## UI Upgrade B: Batch Arbitration / Corpus Benchmark Panel

Add a future panel named one of:

- `Corpus Benchmark`
- `Batch Arbitration`

Expected controls:

- Corpus selector:
  - all corpus samples
  - session labels file
  - category
  - type
- Provider selector:
  - Vosk
  - Sherpa
  - later Whisper
- Arbitration policy selector.
- Run all matching WAVs.
- Export results as JSON.
- Export results as CSV.
- Show progress.
- Show provider failures without aborting the whole batch.
- Show enough failure context to identify setup errors, blank transcripts, and model-specific problems.

Expected metrics:

- Total clips.
- Provider transcript rate.
- Provider blank rate.
- Normalized match rate.
- Accuracy against expected label.
- Latency per provider.
- Failures grouped by `notes` tags.
- Policy decision rate.
- Policy accuracy.
- Disagreement cases.

Disagreement cases should be easy to inspect because they are the most useful samples for arbitration tuning. The panel should make it clear when Vosk, Sherpa, or a future Whisper provider disagree, when one provider is blank, and when arbitration selects a result that does not match the expected label.

## UI Upgrade C: Speech Calibration Review

Add a future calibration/debug popup for recent transcripts. This should be a local-first review surface where users can assign ASR output to intended command semantics without needing an account.

Expected controls:

- Recent transcript list with raw transcript, normalized candidate, provider, confidence, latency, and arbitration decision context when available.
- Assign transcript to command.
- Assign transcript to participant name or participant alias for the current session/profile.
- Assign transcript to an action such as submit, open calibration, go to test, or results.
- Mark transcript as `NO_COMMAND` so similar noise or incidental speech can be ignored.
- Edit or delete reviewed mappings.
- Export speech profile JSON.
- Import speech profile JSON with conflict review.

Storage direction:

- Guest mode uses local storage only.
- Local calibration must work without login.
- Auth remains optional for MVP.
- Future account sync or private cloud storage may copy a reviewed speech profile across devices.
- Guest-to-account migration should merge a local profile into an account only after user review.

Safeguards:

- User assignment is required before a transcript becomes a durable mapping.
- Participant-name aliases remain scoped to the session or personal profile unless explicitly exported/imported.
- Do not globally auto-promote aliases from personal profiles.
- A future global candidate pool may exist only with review, frequency thresholds, privacy filtering, and safeguards against rare or sensitive aliases.

## Recommended Implementation Order

1. Finish initial corpus collection.
2. Add `Load all available providers` as the smallest Voice Engine Lab quality-of-life improvement.
3. Ensure batch arbitration works reliably as a script first, building on `local_speech_engine/scripts/benchmark_arbitration.py`.
4. Stabilize benchmark JSON/CSV output before designing the UI result table.
5. Add the Corpus Benchmark / Batch Arbitration UI panel after script behavior and result schema are stable.
6. Add the Speech Calibration Review popup after transcript/arbitration result shapes are stable enough to review consistently.
7. Later add Whisper/faster-whisper as a third provider and include it in batch evaluation.

## Constraints

- Do not implement this before corpus basics are stable.
- Do not build the batch UI before batch script behavior is stable.
- Do not refactor provider architecture unnecessarily.
- Do not touch TrainingRoom.
- Do not add Whisper as part of this UI roadmap task.
- Keep this lab-focused until the arbitration path has enough corpus evidence.
- Do not require auth for local speech calibration.
- Do not auto-promote personal aliases into global command vocabulary.

## Related Documents

- `local_speech_engine/docs/asr_strategy.md`
- `local_speech_engine/docs/corpus_schema_future.md`
- `docs/CURRENT_TASKS.md`
- `docs/ROADMAP.md`
