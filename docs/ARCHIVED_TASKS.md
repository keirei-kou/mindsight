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
