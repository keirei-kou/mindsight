# Archived Tasks

Completed implementation milestones and documentation work. Keep this file factual and compact so `CURRENT_TASKS.md` can stay focused on active work.

## Workflow

- `ROADMAP.md`: future direction, product bets, and larger architecture paths.
- `CURRENT_TASKS.md`: active implementation tasks with acceptance criteria.
- `ARCHIVED_TASKS.md`: finished work moved out of current tasks after completion.

Best practice:

- Move tasks here when they are verified or intentionally closed.
- Include the completion date when known.
- Keep enough acceptance context to understand what shipped.
- Do not use this as a changelog for every tiny edit; reserve it for meaningful milestones.

## 2026-04-27 Documentation Reorganization

Completed:

- Split the old implementation handoff into focused docs.
- Created stable agent rules in `docs/AGENT_RULEBOOK.md`.
- Created active task tracking in `docs/CURRENT_TASKS.md`.
- Created schema notes in `docs/SCHEMA_NOTES.md`.
- Created future roadmap notes in `docs/ROADMAP.md`.
- Moved UI spacing and layout guidance from `src` into `docs/UI_SPACING_AND_LAYOUT.md`.
- Added `docs/README.md` as the documentation index.
- Removed the old implementation handoff after its active content was split.

## Solo Schema And Analytics Foundation

Completed before the docs split:

- Added `guessPolicy`: `repeatUntilCorrect`, `oneShot`.
- Added `deckPolicy`: `independentDraws`, `balancedDeck`.
- Generalized analytics by `optionCount`.
- Added z-score from first-guess accuracy against chance.
- Added one-tailed `pValue` derived from z-score.
- Added exact per-trial timestamps for new solo runs:
  - `trial_started_at`
  - `trial_ended_at`
- Added historical timestamp backfill for old rows:
  - `trial_started_at_estimated`
  - `trial_ended_at_estimated`
  - `time_of_day_is_estimated`
- Added `time_of_day_tag`.
- Added per-trial `notes`.
- Added training overlay usage fields:
  - `training_overlay_opens`
  - `training_overlay_ms`
- Added interrupted-session recovery snapshot.
- Added PsiLabs dot-style schema registry with legacy Mindsight aliases.
- CSV solo import accepts legacy v0 and dot v1 fields.
- CSV solo export writes dot v1 fields.
- Google Sheets read/append migrates recognized Mindsight v0/mixed sheets to dot v1 before use.
- Google Sheets history rebuild reads dot v1 fields directly, with legacy fallback through the registry.
- Schema backfillers fill computable timing and score fields during CSV export and Google Sheets migration.

Related files:

- `src/lib/sessionModel.js`
- `src/lib/deck.js`
- `src/lib/sessionAnalytics.js`
- `src/lib/soloSessionPayload.js`
- `src/lib/schemaRegistry.js`
- `src/lib/csv.js`
- `src/lib/googleSheets.js`
- `src/lib/googleSheetHistory.js`
- `src/lib/sessionRecovery.js`
- `src/lib/timeOfDay.js`

## 2026-04-27 Canonical Dot V1 Header Order And Append Safety

Completed:

- Approved the canonical solo dot v1 header order in `PSILABS_DOT_V1_FIELDS` / `PSILABS_DOT_V1_HEADERS`.
- Set `schema.version` first, then namespace-first groups for session, run, participant, protocol, rng, trial, target, response, score, timing, context, notes, and analysis.
- Kept all `score.*` fields together, with generic/statistical fields first and Mindsight/category-specific score fields last.
- CSV exports and new blank Google Sheets now inherit the approved canonical generated order.
- Row denormalization still maps canonical row objects into whichever target header list is supplied.
- Google Sheets append no longer forces existing sheets into canonical physical position before appending.
- Existing non-empty sheets append by the live header row, using schema aliases/canonical lookup, so manual column reordering does not corrupt future appends.

Reasoning:

- The sheet is a data contract for export, import, migration, research archive, and future multi-protocol use.
- Canonical generation should be deterministic, but existing user-owned sheets should not be physically rewritten during append.
- Physical migration/reorder belongs behind explicit upgrade UX so data is not silently cleared, rewritten, or reordered.

## 2026-04-29 Real-Time Local Session Persistence

Completed:

- Added IndexedDB as a local session persistence layer for solo training sessions.
- Created local `sessions` and `trials` storage, with sessions tracked as `in_progress` or `completed`.
- Saved each completed trial immediately after trial finalization, keyed by `session_id` and `trial_index` so duplicate writes overwrite safely.
- Kept React state and refs as the UI/runtime source during active sessions.
- Kept Google Sheets as the end-of-session user-owned archive/export path.
- Added a basic data-layer recovery helper for reading an in-progress session and its saved trials.
- Reduced data-loss risk from refreshes or crashes during sessions and laid groundwork for future desktop/local-first storage.

Related files:

- `src/lib/localSessionStore.js`
- `src/pages/TrainingRoom.jsx`

## 2026-04-30 Local ASR Provider Diagnostics

Completed:

- Added a shared voice provider selector for recognition providers without adding new session-phase behavior.
- Preserved Browser Speech as the baseline provider.
- Added Vosk Local through `vosk-browser`, with short-command grammar support and lazy runtime loading.
- Added Sherpa ONNX Local through the official browser WebAssembly ASR asset bundle path.
- Added reusable Web Audio microphone/prebuffer support for local ASR providers.
- Added a standalone voice ASR diagnostic page at `#voice-asr-test`.
- Added model asset setup documentation for Vosk and Sherpa ONNX.
- Added `.env.example` entries for local ASR testing.
- Documented troubleshooting for missing model assets, wrong Sherpa paths, WASM path/MIME issues, mic permission failures, load timeouts, provider unavailability, and expected Vosk chunk-size warnings.

Safe commit boundary:

- This milestone is infrastructure and diagnostics only.
- It should not include TrainingRoom/CalibrationRoom UX, phase-flow, spoken mode-instruction, Kokoro prompt wiring, or broader session terminology changes.

Related files:

- `.env.example`
- `docs/VOICE_ASR_LOCAL_MODELS.md`
- `src/lib/audioPrebuffer.js`
- `src/lib/voiceProviderUtils.js`
- `src/lib/voiceProviders.js`
- `src/lib/voskVoiceProvider.js`
- `src/lib/sherpaOnnxVoiceProvider.js`
- `src/pages/VoiceAsrTest.jsx`
- `package.json`
- `package-lock.json`

## 2026-05-03 Shared Voice Engine Architecture Documentation

Completed (documentation-only milestone):

- Established `docs/SHARED_VOICE_ENGINE.md` as the layered architecture source of truth: Tauri-first desktop shell, Python sidecar supervision model, platform strategy, WebSocket/HTTP protocol sketch, session lifecycle authority, streaming/backpressure expectations, audio abstraction, Silero-first VAD direction, mode profiles, sidecar startup contract, risks, explicit non-goals, and Next.js as a future-only refactor boundary.
- Kept runtime implementation out of scope: no `src-tauri/`, no Python engine implementation, no Silero/Vosk/Sherpa adapters in this milestone.
- Documentation map updated via `docs/README.md` entry for Shared Voice Engine.

Related files:

- `docs/SHARED_VOICE_ENGINE.md`
- `docs/README.md`
- `docs/ROADMAP.md`

## 2026-05-03 Supabase Session Summary First Pass

Completed:

- Declared `@supabase/supabase-js` in `package.json`.
- Added `src/lib/supabase.js` exporting `supabase`, `isSupabaseConfigured`, and `getSupabaseClient()`, disabling gracefully without `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`.
- Added `src/cloud/sessionSummaryCloud.js` to build and optionally save lightweight solo session summaries (safe no-op when Supabase is unconfigured).
- Documented phase 1 schema in `docs/SUPABASE_SCHEMA.md`.
- Added `supabase/migrations/001_initial_cloud_summary.sql` with private-by-default summary tables and RLS.
- Left Google Sheets as the durable full trial archive; no full trial rows in Supabase.

Related files:

- `package.json`
- `src/lib/supabase.js`
- `src/cloud/sessionSummaryCloud.js`
- `docs/SUPABASE_SCHEMA.md`
- `supabase/migrations/001_initial_cloud_summary.sql`

## 2026-05-03 Local Data Contract Verification Harness

Completed:

- Added `npm run verify:data-contract` (`scripts/verify-data-contract.mjs`) for repeatable CSV/Sheets contract checks without manual QA each time.
- Coverage includes canonical CSV headers, solo CSV round-trip parsing, history CSV row counts, reusable sheet schema inspection statuses, blank-sheet append initialization, manually reordered append headers, non-mutating reordered/legacy history reads, blank header failures, and unknown header failures.

Related files:

- `scripts/verify-data-contract.mjs`
- `package.json`

## 2026-05-03 ASR Arbitration Layer Phases 1-4

Completed the first four phases of the ASR arbitration plan. Phase 3.5 (Corpus Recording Workflow) is archived separately below. Phases 5 (lab UI policy selector) and 6 (TrainingRoom arbitration integration) remain active in `CURRENT_TASKS.md` under "ASR Arbitration Layer".

### Phase 1 - ASR arbitration core

Completed:

- Added arbitration data contracts in `local_speech_engine/asr/arbitration_types.py`: `VadBoundary`, `AudioSegmentRef`, `AsrProviderRun`, `NormalizedCandidate`, and `ArbitrationResult` with `to_dict()` payloads.
- Added `command` and `voice_note` normalization profiles plus `normalize_transcript_candidate` in `local_speech_engine/asr/normalization.py`, with command-mode candidate generation, similarity matching, and Levenshtein scoring.
- Added shared command vocabulary and alias mapping in `local_speech_engine/asr/vocabulary.py` (`DEFAULT_COMMAND_VOCABULARY`, `COMMAND_ALIASES`).
- Implemented sequential same-WAV arbitration in `local_speech_engine/asr/arbitrator.py` (`AsrArbiter`, `arbitrate_segment`, `arbitrate_latest`) with the required decision ordering: `agreement_count` -> `command_validity` -> `average_similarity` -> `average_confidence` -> `provider_priority`.
- Preserved provider failures as structured `AsrProviderRun.error` payloads (`code`, `message`, `setup_hint`, `details`) instead of aborting arbitration.
- Emitted `asr_arbitration_started`, `asr_provider_result`, `asr_arbitration_result`, and `asr_arbitration_error` events from the sidecar via `LocalVadService.arbitrate_segment` / `arbitrate_latest_segment` in `local_speech_engine/server.py`.
- Did not modify `TrainingRoom`. Kept `transcribe_segment` and `asr_transcript` paths in `local_speech_engine/asr/registry.py` and `local_speech_engine/server.py` intact. Did not include Browser Speech in same-WAV arbitration; only `vosk` and `sherpa` sidecar providers are registered.

Tests: `local_speech_engine/tests/test_asr_arbitration.py`, `local_speech_engine/tests/test_asr_normalization.py`.

### Phase 2 - ASR arbitration lab UI exposure

Completed:

- Added `arbitrateSegment` and `arbitrateLatestSegment` methods to `src/lib/localVadClient.js` that send `arbitrate_segment` / `arbitrate_latest_segment` over the local VAD WebSocket.
- Handled the new arbitration events (`asr_arbitration_started`, `asr_provider_result`, `asr_arbitration_result`, `asr_arbitration_error`) in `src/components/LocalVadPanel.jsx`, including per-segment arbitration state and provider-run aggregation.
- Added lab UI controls in the ASR Arbitration block of `LocalVadPanel.jsx`: provider checkboxes (defaulting to `vosk` + `sherpa`), a `command` / `voice_note` mode selector, and `Arbitrate latest segment` / `Arbitrate selected segment` buttons.
- Displayed final result tiles (final text, final command, decision reason, mode) plus a per-provider breakdown table (raw transcript, normalized text, command, confidence, latency, error) for the selected segment.
- Did not modify `TrainingRoom`. Kept the existing single-provider transcription UI and re-run controls. Did not include Browser Speech in same-WAV arbitration.

Verification: `npm run build`, `python -m unittest discover local_speech_engine/tests`.

### Phase 3 - ASR arbitration corpus + benchmark harness

Completed:

- Added the audio corpus structure under `local_speech_engine/audio_corpus/` with `commands/{colors,numbers,shapes,other}/` and `voice_notes/`, including `.gitkeep` placeholders.
- Added `labels.json` (active labels) and `labels.example.json` documenting the session-style shape (`session_id`, `mode`, `planned_sequence`, `auto_label_by_order`, `files`); the legacy list shape produced by the lab corpus UI is still accepted via `local_speech_engine/corpus.py`.
- Implemented the benchmark harness in `local_speech_engine/scripts/benchmark_arbitration.py`: loads samples through `load_arbitration_samples`, runs `AsrArbiter` over a sandboxed `CorpusBenchmarkRegistry`, compares final arbitration output against the expected labels, and writes timestamped CSV + JSON reports to `local_speech_engine/benchmark_results/`.
- Scoped scoring to command mode while still scaffolding voice-note rows. No frontend changes. Did not modify `TrainingRoom`.

Tests: `local_speech_engine/tests/test_benchmark_arbitration.py`, `local_speech_engine/tests/test_corpus.py`.

### Phase 4 - Pluggable arbitration policies

Completed:

- Added all five arbitration policies in `local_speech_engine/asr/policies.py`: `hybrid_default`, `agreement_first`, `command_validity_first`, `confidence_weighted`, and `provider_priority`, each with an explicit `score_order` tuple.
- Wired policy selection through `AsrArbiter.arbitrate_segment(..., policy=...)` and `arbitrate_latest(..., policy=...)`. Unknown policy names fall back to the default with `policy_fallback` / `requested_policy` metadata via `resolve_policy`.
- Populated `ArbitrationResult.policy_name` and `ArbitrationResult.policy_scores` (winning key, sort key, per-group metrics and providers) so callers can compare policies on the same WAV.
- Updated the benchmark harness to compare policies: added a `--policies` CLI flag, recorded `policy_name` per row, and added a `by_policy` summary in the JSON report.
- Default arbitration policy remains `hybrid_default`. No frontend changes (correct per the Phase 4 scope). Did not modify `TrainingRoom`.

Tests added in `local_speech_engine/tests/test_asr_arbitration.py` (`test_confidence_weighted_can_beat_agreement_when_explicitly_selected`, `test_provider_priority_policy_can_override_agreement`, `test_invalid_policy_falls_back_to_default_with_metadata`) and `local_speech_engine/tests/test_benchmark_arbitration.py` (`test_benchmark_runs_arbitration_and_writes_reports` cross-policy assertions, `test_parse_policy_names_dedupes_and_safely_falls_back_unknown_values`).

### Constraints honored across Phases 1-4

- `TrainingRoom` was not modified by any of these phases.
- Browser Speech is not part of same-WAV arbitration; only `vosk` and `sherpa` sidecar providers participate.
- Existing `transcribe_segment` and `asr_transcript` event paths are preserved alongside the new arbitration paths.
- Default arbitration policy remains `hybrid_default`.

### Verification

- `python -m unittest discover local_speech_engine/tests` (Phases 1, 3, 4).
- `npm run build` (Phase 2).

### Related files

- `local_speech_engine/asr/__init__.py`
- `local_speech_engine/asr/arbitration_types.py`
- `local_speech_engine/asr/arbitrator.py`
- `local_speech_engine/asr/normalization.py`
- `local_speech_engine/asr/policies.py`
- `local_speech_engine/asr/registry.py`
- `local_speech_engine/asr/vocabulary.py`
- `local_speech_engine/asr_normalization.py`
- `local_speech_engine/audio_corpus/labels.example.json`
- `local_speech_engine/audio_corpus/labels.json`
- `local_speech_engine/audio_corpus/README.md`
- `local_speech_engine/corpus.py`
- `local_speech_engine/scripts/benchmark_arbitration.py`
- `local_speech_engine/server.py`
- `local_speech_engine/tests/test_asr_arbitration.py`
- `local_speech_engine/tests/test_asr_normalization.py`
- `local_speech_engine/tests/test_benchmark_arbitration.py`
- `local_speech_engine/tests/test_corpus.py`
- `src/components/LocalVadPanel.jsx`
- `src/lib/localVadClient.js`

## 2026-05-03 ASR Arbitration Layer Phase 3.5 Corpus Recording Workflow

Completed:

- Added a pre-labeled recording workflow in `#voice-asr-test` through the `Recording Context` card in `src/components/LocalVadPanel.jsx`, covering `session_id`, expected label, type, category, and notes before VAD capture.
- Captured VAD segments now snapshot the current recording context so each segment carries its intended corpus label before review.
- Added per-segment corpus actions in the Captured Segments table: `Save`, `Ignore`, and `Delete`.
- Added safe segment deletion through the local sidecar (`delete_recording_segment`) with path containment checks that only allow deleting WAV files inside `local_speech_engine/recordings/`.
- Added session-based corpus writing: when a session id is supplied, saved clips write/upsert to `local_speech_engine/audio_corpus/labels.<session_id>.json` using the session-style labels object; without a session id, the existing legacy `labels.json` list writer remains unchanged.
- Reorganized the lab UX flow so corpus work proceeds as: connect/start VAD, choose expected label/category/session, record segments, review/delete noise, save good clips, then run arbitration/benchmark later.
- Removed the old standalone `Label Selected Segment` block to avoid duplicate save paths; retroactive label correction is available under Advanced / Debug.

New commands/events:

- WebSocket command: `delete_recording_segment` (aliases: `delete_segment`, `delete_recording`).
- Events: `recording_segment_deleted`, `recording_segment_error`.
- Existing event retained: `corpus_sample_saved`.

Verification:

- `python -m unittest discover local_speech_engine/tests`
- `npm run build`

Related files:

- `local_speech_engine/corpus.py`
- `local_speech_engine/protocol.py`
- `local_speech_engine/server.py`
- `local_speech_engine/tests/test_corpus.py`
- `local_speech_engine/tests/test_server_commands.py`
- `src/components/LocalVadPanel.jsx`
- `src/lib/localVadClient.js`
