# Mindsight Implementation Handoff

## Product North Star
This app is a protocol engine for testing unusual human claims.

Mindsight is the first supported protocol module, but the broader direction is PsiLabs: a flexible experiment engine for structured, repeatable protocols around anomalous perception, precognition, telepathy, REG/micro-PK, remote viewing, biofield/energy tracking, and future physical measurement protocols.

## Working Principle
- Move in small, reviewable steps.
- Do schema completeness before column reordering.
- Move Mindsight toward a generic PsiLabs protocol schema instead of a one-off Mindsight-only schema.
- Preserve old rows, old CSVs, and existing Google Sheets wherever possible.
- Existing Google Sheets should be appended by matching header names, not by assuming column position.
- New Google Sheets and CSV exports should use the deterministic order in `SOLO_TRIAL_HEADERS`.

## Current Status
Solo-mode foundations are mostly in place:
- Canonical session/model helpers live in [sessionModel.js](./sessionModel.js).
- Deck generation lives in [deck.js](./deck.js).
- Analytics math lives in [analytics.js](./analytics.js).
- Solo payload shaping lives in [soloSessionPayload.js](./soloSessionPayload.js).
- Solo schema mapping lives in [schemaRegistry.js](./schemaRegistry.js).
- Solo CSV/Google Sheets row shape is controlled by [csv.js](./csv.js), with dot-style exports from the schema registry.
- Google Sheets append/read behavior lives in [googleSheets.js](./googleSheets.js).
- Historical Google Sheets rebuild/backfill behavior lives in [googleSheetHistory.js](./googleSheetHistory.js).

Recent completed work:
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

## Current Solo Sheet Schema
Current `SOLO_TRIAL_HEADERS` fields:

```text
session_id
run_id
app_mode
share_code
started_at
ended_at
date
time
trial_started_at
trial_ended_at
trial_started_at_estimated
trial_ended_at_estimated
time_of_day_tag
time_of_day_is_estimated
notes
training_overlay_opens
training_overlay_ms
name
category
guess_policy
deck_policy
option_count
option_values
trial_count
card_index
target_value
guesses
first_guess
first_guess_correct
correct_guess_index
guess_count
time_to_first_ms
guess_intervals_ms
trial_duration_ms
score_percent
proximity
pattern
skipped
first_guess_accuracy
z_score
p_value
average_guess_position
guess_position_std_dev
weighted_score
```

## Desired Column Grouping
Do not reorder yet until schema completeness is settled. Once final fields are added, reorder `SOLO_TRIAL_HEADERS` and the matching row values in `buildSoloTrialRows()`.

Important schema direction:
- Prefer dot-style flattened columns that act like object namespaces.
- This keeps Google Sheets/CSV spreadsheet-friendly while making the data feel like part of a broader PsiLabs protocol engine.
- Example:
  - `session.id`
  - `protocol.type`
  - `target.value`
  - `response.guess_sequence`
  - `score.z`
  - `timing.trial_duration_ms`

Potential namespaces:
- `schema.*`
- `protocol.*`
- `session.*`
- `run.*`
- `participant.*`
- `rng.*`
- `target.*`
- `trial.*`
- `response.*`
- `score.*`
- `timing.*`
- `context.*`
- `notes.*`
- `archive.*`

Preferred logical grouping:

```text
SESSION ID / CONTEXT
session.id
run.id
schema.version
session.mode
session.share_code
participant.name
protocol.phenomenon
protocol.type
protocol.target_type
protocol.response_mode
protocol.deck_policy
rng.method
rng.provider
rng.seed
session.started_at
session.ended_at
session.date
session.time
session.is_test

PRIMARY SESSION METRICS
score.z
score.p_value
score.first_response_accuracy

SECONDARY SESSION METRICS
score.weighted
score.average_response_position
score.response_position_std_dev
score.chance_baseline
score.expected_avg_response_position

SESSION CONFIG
protocol.option_count
protocol.options
session.trial_count

TRIAL IDENTITY / OUTCOME
trial.index
target.value
response.first
score.first_response_correct
response.correct_position
response.count
response.sequence
trial.skipped
analysis.excluded
analysis.exclusion_reason

TRIAL TIMING
timing.trial_duration_ms
timing.time_to_first_ms
timing.response_intervals_ms
timing.trial_started_at
timing.trial_ended_at
timing.trial_started_at_estimated
timing.trial_ended_at_estimated
context.time_of_day
context.time_of_day_is_estimated

PROTOCOL / NOTES
protocol.label
protocol.tags
protocol.notes
notes.trial
notes.voice_text
notes.voice_source
context.input_method
context.training_overlay_opens
context.training_overlay_ms

LEGACY / CATEGORY-SPECIFIC SUPPORT
score.legacy_percent
score.proximity
score.pattern

FUTURE RNG PROVENANCE
rng.source_url
rng.device_id
rng.sample_id
```

## Schema Additions To Implement Next
Add these before final column ordering.

Before adding many more flat fields, consider doing the PsiLabs dot-column rename/refactor below. Since there is not much production data yet, this is the cleanest moment to move to the future-facing schema.

## PsiLabs Generic Protocol Schema Direction
Mindsight should become the first supported protocol type inside a broader PsiLabs experiment engine.

Main rule:
- Use generic names for the core experiment engine.
- Keep Mindsight-specific names only in UI labels, `protocol.config`, `trial.data`, `response.data`, or `score.data`.
- The UI can still say "guess", "card", and "color"; the schema should say "response", "target", and "target_type".

Avoid future one-off tables/models like:
- `mindsight_sessions`
- `mindsight_trials`
- `precog_sessions`
- `telepathy_sessions`

Prefer generic backbone concepts:
- `protocols`
- `sessions`
- `trials`
- `targets`
- `responses`
- `scores`
- `rng_batches`
- `rng_events`
- `session_metadata`
- `trial_metadata`

Future protocols should be able to reuse the same backbone:
- precognition forced-choice
- REG / micro-PK binary line
- async telepathy
- remote viewing
- energy/biofield tracking
- telekinesis / macro-PK measurement

### Generic Core Fields

```text
session.id
session.mode
session.share_code
session.trial_count
session.started_at
session.ended_at

run.id
run.session_id
run.started_at
run.ended_at

participant.id
participant.name

protocol.id
protocol.phenomenon
protocol.type
protocol.target_type
protocol.response_mode
protocol.deck_policy
protocol.option_count
protocol.options
protocol.rng_method
protocol.config

trial.id
trial.session_id
trial.index
trial.target_id
trial.started_at
trial.ended_at
trial.data

target.id
target.type
target.value
target.metadata

response.id
response.trial_id
response.participant_id
response.sequence
response.first
response.count
response.correct_position
response.submitted_at
response.data

score.id
score.scope
score.session_id
score.trial_id
score.participant_id
score.first_response_correct
score.first_response_accuracy
score.weighted
score.z
score.p_value
score.data

notes.session
notes.trial

timing.trial_duration_ms
timing.response_latency_ms
```

### Naming Principles

Use `response` instead of `guess` in the generic schema.

Reason:
- Mindsight response = guess
- Precognition response = prediction
- REG response = intention direction
- Telepathy response = receiver impression
- Remote viewing response = free-text description
- Presentiment response = subjective/physiological state

Use `target` instead of `card` in the generic schema.

Reason:
- Mindsight target = color/card/symbol
- Precognition target = future selected value
- REG target = binary stream or intended direction
- Telepathy target = sender object/image/thought
- Remote viewing target = image/location/event

Use `protocol` instead of `app mode` for experiment design.

Reason:
- The app may eventually contain many modules.
- The schema should describe the experimental design, not the current UI page.

Current Mindsight should map to generic protocol concepts:

```text
protocol.type = forced_choice_perception
protocol.phenomenon = mindsight
protocol.target_type = color | number | shape
protocol.response_mode = one_shot | repeat_until_correct
protocol.deck_policy = balanced_deck | independent_draws
rng.method = crypto_rng
```

Use JSON internally for protocol-specific config/data when useful:

```json
{
  "options": ["red", "blue", "green", "yellow"],
  "mode": "repeat_until_correct",
  "reveal_policy": "after_correct",
  "audio_enabled": true,
  "display_route_enabled": true
}
```

For Google Sheets/CSV, prefer flattened dot-style columns over one large JSON blob where the fields are useful for filtering.

Recommended migration from current column names:

```text
session_id                  -> session.id
run_id                      -> run.id
app_mode                    -> session.mode
share_code                  -> session.share_code
started_at                  -> session.started_at
ended_at                    -> session.ended_at
date                        -> session.date
time                        -> session.time
name                        -> participant.name
category                    -> protocol.target_type
guess_policy                -> protocol.response_mode
deck_policy                 -> protocol.deck_policy
option_count                -> protocol.option_count
option_values               -> protocol.options
trial_count                 -> session.trial_count
card_index                  -> trial.index
target_value                -> target.value
guesses                     -> response.guess_sequence
first_guess                 -> response.first
first_guess_correct         -> score.first_guess_correct
correct_guess_index         -> response.correct_position
guess_count                 -> response.count
time_to_first_ms            -> timing.time_to_first_ms
guess_intervals_ms          -> timing.guess_intervals_ms
trial_duration_ms           -> timing.trial_duration_ms
trial_started_at            -> timing.trial_started_at
trial_ended_at              -> timing.trial_ended_at
trial_started_at_estimated  -> timing.trial_started_at_estimated
trial_ended_at_estimated    -> timing.trial_ended_at_estimated
time_of_day_tag             -> context.time_of_day
time_of_day_is_estimated    -> context.time_of_day_is_estimated
notes                       -> notes.trial
training_overlay_opens      -> context.training_overlay_opens
training_overlay_ms         -> context.training_overlay_ms
score_percent               -> score.legacy_percent
proximity                   -> score.proximity
pattern                     -> score.pattern
skipped                     -> trial.skipped
first_guess_accuracy        -> score.first_response_accuracy
z_score                     -> score.z
p_value                     -> score.p_value
average_guess_position      -> score.average_guess_position
guess_position_std_dev      -> score.guess_position_std_dev
weighted_score              -> score.weighted
```

Alternative stricter generic mapping:

```text
guesses                     -> response.sequence
first_guess                 -> response.first
first_guess_correct         -> score.first_response_correct
correct_guess_index         -> response.correct_position
guess_count                 -> response.count
first_guess_accuracy        -> score.first_response_accuracy
weighted_score              -> score.weighted
notes                       -> notes.trial
```

Prefer the stricter generic mapping when we actually rename columns.

### Keep Mindsight-Specific Concepts Out Of Core Fields

Do not add these as universal top-level schema fields:
- `card_index`
- `target_color`
- `guess`
- `guesses`
- `first_guess`
- `guess_count`
- `correct_guess_index`
- `color`
- `shape`
- `number`
- `repeat_until_correct` as a field name
- `one_shot` as a field name
- `proximity_score` as universal unless generalized
- `display_route_enabled` as universal
- `audio_enabled` as universal
- `reveal_after_correct` as universal

These can exist inside:
- `protocol.config`
- `trial.data`
- `response.data`
- `score.data`

Example Mindsight `protocol.config`:

```json
{
  "phenomenon": "mindsight",
  "type": "forced_choice_perception",
  "target_type": "color",
  "response_mode": "repeat_until_correct",
  "deck_policy": "balanced_deck",
  "rng_method": "crypto_rng",
  "options": ["red", "blue", "green", "yellow"],
  "ui_labels": {
    "target": "card",
    "response": "guess"
  },
  "features": {
    "audio_enabled": true,
    "display_route_enabled": true,
    "reveal_policy": "after_correct"
  }
}
```

Example Mindsight `trial.data`:

```json
{
  "card_index": 12,
  "target_color": "red",
  "target_index": 0
}
```

Example Mindsight `response.data`:

```json
{
  "guess_sequence": ["blue", "green", "red"],
  "first_guess": "blue",
  "guess_count": 3
}
```

Example Mindsight `score.data`:

```json
{
  "proximity_score": 0.5,
  "average_guess_position": 2.4,
  "guess_position_std_dev": 1.1
}
```

New fields should follow this convention:

```text
schema.version
protocol.config_json
rng.method
rng.provider
rng.seed
rng.source_url
rng.device_id
rng.sample_id
score.chance_baseline
score.expected_avg_guess_position
analysis.excluded
analysis.exclusion_reason
protocol.label
protocol.tags
protocol.notes
notes.voice_text
notes.voice_source
context.input_method
archive.status
archive.google_sheet_id
archive.synced_at
```

Minimal implementation plan:
1. Create a schema registry that defines current dot-style field names and aliases from old flat names.
2. Add export helpers that map current internal Mindsight payloads into dot-style row objects.
3. Keep old CSV import aliases so early exports still import.
4. Update Google Sheets optional/required header logic to use the schema registry.
5. Rename internal data structures toward generic terms where safe.
6. Keep Mindsight-specific fields inside config/data objects.
7. Keep UI wording user-friendly.
8. Only then add new schema fields and finalize column ordering.
9. Later, add JSON backup/export that preserves full nested protocol/session/trial objects.

Internal app payloads can keep compatibility fields for now:
- `targetValue`
- `guesses`
- `firstGuess`
- `correctGuessIndex`
- `guessPolicy`
- `deckPolicy`

But new generic fields should be added alongside them:
- `protocolType`
- `phenomenon`
- `targetType`
- `responseMode`
- `protocolConfig`
- `trialData`
- `responseData`
- `scoreData`

### Core Metadata
- [ ] `schema.version`
  - Suggested initial value: `1.0`
  - Purpose: future migrations and compatibility.
- [ ] `session.is_test`
  - Suggested default: `true` for saved test results.
  - Purpose: separate serious test data from casual/practice data.

### RNG And Deck Provenance
Keep `protocol.deck_policy` and `rng.method` separate:
- `protocol.deck_policy` = how targets are distributed.
- `rng.method` = where randomness comes from.

Fields:
- [ ] `rng.method`
  - Near-term values: `crypto_rng`, `pseudo_rng`, `hardware_rng`, `manual_seed`
  - Future PsiLabs values: `quantum_rng_api`, `quantum_rng_local`
  - Current default for normal solo generated decks: `crypto_rng`
- [ ] `rng.provider`
  - Examples: `browser_crypto`, `ANU`, `IDQuantique`
  - Current default: `browser_crypto`
- [ ] `rng.seed`
  - Usually tied to `share_code` for seeded/shared sessions.

Future PsiLabs provenance fields:
- [ ] `rng.source_url`
  - Optional; useful for API RNG sources.
- [ ] `rng.device_id`
  - Optional; useful for local hardware RNG.
- [ ] `rng.sample_id`
  - Optional; provider batch/request/sample ID.

QRNG/QREG security requirement:
- Provider API keys must be server-side only.
- Do not place QRNG/QREG provider keys in React/Vite frontend code, client env vars, or browser network requests.
- Frontend should request random values from an internal endpoint only.

Example frontend request:

```text
GET /api/rng?count=4096
```

Backend/server function responsibilities:
- Store QRNG/QREG provider key in secure environment secrets.
- Call external provider using the secret key.
- Return only random values/events to the frontend.
- Never expose provider key to the client.
- Support provider swapping without frontend changes.

Recommended backend behavior:
- Batch requests, e.g. 10k+ values at once when appropriate.
- Cache/pool random values server-side.
- Rate limit RNG endpoints.
- Log usage and provider errors.
- Track provider batch/sample IDs where available via `rng.sample_id`.

Goals:
- protect provider API keys
- prevent quota abuse
- lower costs
- improve reliability
- preserve future provider flexibility

### Analytics Baselines
These are already computed in analytics, but not exported as sheet columns yet:
- [ ] `score.chance_baseline`
  - Source: `analytics.firstGuessChanceBaseline`
- [ ] `score.expected_avg_response_position`
  - Source: `analytics.averageGuessPositionBaseline`

### Analysis Exclusion
- [ ] `analysis.excluded`
  - Suggested default: `false`
- [ ] `analysis.exclusion_reason`
  - Examples: `misclick`, `interrupted`, `audio_issue`, `test_run`

### Protocol And Notes
Session-level protocol fields, repeated into each trial row for filtering:
- [ ] `protocol.label`
  - Example: `Behind head`
- [ ] `protocol.tags`
  - Pipe-separated examples: `blindfolded|behind_head|seated`
- [ ] `protocol.notes`
  - Freeform session/run condition notes.

Per-trial notes:
- [x] `notes.trial`
  - Current corrected/manual canonical note.
- [ ] `notes.voice_text`
  - Raw dictated transcript. Do not assume STT is perfect.
- [ ] `notes.voice_source`
  - Examples: `browser_stt`, `whisper`, `typed`, `manual`

### Input Context
- [ ] `context.input_method`
  - Examples: `keyboard`, `mouse`, `voice`, `mixed`

## Metric Priority
Primary cross-session metrics:
- `z_score`
- `p_value`

Important context:
- `first_guess_accuracy`
  - Useful per session, but less reliable between sessions when option counts differ.

Secondary metrics:
- `average_guess_position`
- `guess_position_std_dev`
- `weighted_score`

Ancillary but important row data:
- `guesses`
- `correct_guess_index`
- `guess_count`
- `trial_duration_ms`
- `option_count`
- `option_values`
- timing fields

## Current Analytics Rules
All baselines derive from `optionCount`.

First-guess chance baseline:
```text
p0 = 1 / optionCount
```

Z-score:
```text
z = (pHat - p0) / sqrt(p0 * (1 - p0) / n)
```

P-value:
```text
p_value = one-tailed probability from z-score for above-chance first-guess accuracy
```

Expected random sequential guess position:
```text
(optionCount + 1) / 2
```

Weighted score per trial:
```text
(optionCount + 1 - correctGuessIndex) / optionCount
```

Mode-specific storage:
- `oneShot`
  - Store/use: `firstGuessAccuracy`, `zScore`, `pValue`, per-option first-guess stats.
  - Leave null/blank: `averageGuessPosition`, `guessPositionStdDev`, `weightedScore`.
- `repeatUntilCorrect`
  - Store/use all metrics.

## Google Sheets Compatibility Rules
Current implemented behavior:
- New sheet: initialize header row from `PSILABS_DOT_V1_HEADERS`.
- Existing recognized Mindsight v0/mixed sheet: migrate rows to dot v1 order before reading/appending.
- Append writes dot v1 rows.
- Missing required columns still produce a clear error.
- Unknown columns block automatic migration so data is not silently discarded.
- Non-Mindsight protocol rows block automatic migration so protocols are not mixed accidentally.

Important files:
- `PSILABS_DOT_V1_HEADERS`: [schemaRegistry.js](./schemaRegistry.js)
- legacy aliases and defaults: [schemaRegistry.js](./schemaRegistry.js)
- row output order: `buildDotV1SoloTrialRows()` in [csv.js](./csv.js)
- sheet migration/read/append: [googleSheets.js](./googleSheets.js)
- historical rebuild/backfill: [googleSheetHistory.js](./googleSheetHistory.js)

## Schema Versioning And Migration Policy
Goal:
- Let the schema evolve without breaking old CSVs, old Google Sheets, or old saved sessions.
- Make schema behavior explicit rather than relying on scattered fallback logic.

Recommended future constants/helpers:
- `CURRENT_SCHEMA_VERSION`
- `SCHEMA_FIELDS`
- `REQUIRED_FIELDS`
- `OPTIONAL_FIELDS`
- `DEFAULT_FIELD_VALUES`
- `FIELD_BACKFILLERS`
- `FIELD_ALIASES`

Rules for new CSVs / new Google Sheets:
- Use the latest deterministic field order from `PSILABS_DOT_V1_HEADERS` or its future schema equivalent.
- Include all current fields.
- Populate default values where appropriate.

Rules for existing Google Sheets:
- Read the header row first.
- Analyze headers through the schema registry.
- Migrate recognized Mindsight v0/mixed sheets to dot v1 before read/append during the early v0 -> v1 phase.
- If required fields are missing, show a clear error explaining which columns are missing.
- If unknown fields or non-Mindsight protocol rows are present, block migration with a clear error.
- Future UX should ask before physical sheet migration and show progress.

Rules for old CSV imports:
- Missing computable fields should be backfilled.
- Missing fields with safe defaults should get defaults.
- Missing subjective/user-intent fields should stay blank.
- Unknown extra columns should not break import.
- Future improvement: preserve unknown extra fields in a passthrough map if useful.

Examples of computable/backfillable fields:
- `score.p_value`
- `score.chance_baseline`
- `score.expected_avg_response_position`
- `timing.trial_started_at_estimated`
- `timing.trial_ended_at_estimated`
- `context.time_of_day`
- `context.time_of_day_is_estimated`

Examples of safe default fields:
- `schema.version`
- `session.is_test`
- `analysis.excluded`
- `rng.method`
- `rng.provider`
- `rng.seed` when `session.share_code` is the reproducibility seed

Examples of fields that should not be invented:
- `notes.trial`
- `notes.voice_text`
- `protocol.label`
- `protocol.tags`
- `protocol.notes`
- `analysis.exclusion_reason`
- `rng.source_url`
- `rng.device_id`
- `rng.sample_id`

Suggested defaults:
- `schema.version`: current schema version, initially `1.0`
- `session.is_test`: `true` for saved test/result rows
- `analysis.excluded`: `false`
- `rng.method`: `crypto_rng` for normal solo generated decks
- `rng.provider`: `browser_crypto` for current browser-generated randomness
- `context.input_method`: `mixed` when exact input mode is unknown

Future migration workflow:
1. Add new field to schema registry.
2. Decide whether field is required or optional.
3. Add default if safe.
4. Add backfiller if computable from old data.
5. Add aliases if renaming old fields.
6. Update CSV export/import.
7. Update Google Sheets append/read behavior.
8. Add tests or manual checks with old and new CSV/sheet shapes.

## Recommended Immediate Next Steps
Do these one at a time:

- [x] Create a schema registry for dot-style PsiLabs fields:
   - field order
   - required fields
   - optional fields
   - defaults
   - temporary aliases from old flat Mindsight names
- [x] Add a row mapper that exports current Mindsight payloads into generic dot-style rows.
- [x] Update CSV export/import to use the schema registry and row mapper.
- [x] Update Google Sheets append/read header handling to use the schema registry.
- [x] Add the most important new dot-style fields with conservative defaults:
   - `schema.version`
   - `session.is_test`
   - `rng.method`
   - `rng.provider`
   - `rng.seed`
   - `score.chance_baseline`
   - `score.expected_avg_response_position`
   - `analysis.excluded`
   - `analysis.exclusion_reason`
   - `context.input_method`
- [x] Add protocol/voice-note fields without building full voice note UX yet:
   - `protocol.label`
   - `protocol.tags`
   - `protocol.notes`
   - `notes.voice_text`
   - `notes.voice_source`
- [ ] Add explicit Google Sheets schema upgrade confirmation/progress UX.
- [x] Verify CSV export/import with local smoke tests.
- [ ] Verify Google Sheets append/read behavior manually against a live sheet.
- [ ] Let user finalize column order.
- [ ] Run manual solo testing across:
   - `repeatUntilCorrect + balancedDeck`
   - `repeatUntilCorrect + independentDraws`
   - `oneShot + balancedDeck`
   - `oneShot + independentDraws`

## Manual Test Checklist
For each solo mode combination:
- [ ] Setup screen renders.
- [ ] Guess Policy appears.
- [ ] Deck Policy appears.
- [ ] Session starts.
- [ ] Results page loads.
- [ ] Mode badges are correct.
- [ ] Summary cards match mode.
- [ ] Z-score and p-value appear when valid.
- [ ] One-shot hides repeat-only metrics.
- [ ] Graph renders.
- [ ] CSV export succeeds.
- [ ] CSV import succeeds.
- [ ] Google Sheets append succeeds.
- [ ] Google Sheets history load succeeds.
- [ ] Historical rows backfill estimated trial timestamps/time-of-day.

## Files Added So Far
- [sessionModel.js](./sessionModel.js)
- [deck.js](./deck.js)
- [analytics.js](./analytics.js)
- [soloSessionPayload.js](./soloSessionPayload.js)
- [sessionRecovery.js](./sessionRecovery.js)
- [timeOfDay.js](./timeOfDay.js)
- [UI Spacing and Layout Rules for Codex - Cursor.md](./UI%20Spacing%20and%20Layout%20Rules%20for%20Codex%20-%20Cursor.md)

## Files Most Likely To Change Next
- [csv.js](./csv.js)
  - schema headers, row values, CSV import/export.
- [soloSessionPayload.js](./soloSessionPayload.js)
  - defaults for new session/trial fields.
- [googleSheets.js](./googleSheets.js)
  - optional/required header handling.
- [googleSheetHistory.js](./googleSheetHistory.js)
  - historical/default reconstruction.
- [sessionModel.js](./sessionModel.js)
  - canonical comments/constants if new enums are formalized.

## Broader Roadmap

### In-Progress Protection And Multi-Run Sessions
Goal:
- Protect in-progress solo test data before leaving test phase.
- Allow multiple completed trial blocks under one broader session.

Planned model:
- Session:
  - `participantName`
  - `category`
  - `activeOptions`
  - `guessPolicy`
  - `deckPolicy`
  - `savedRuns`
- Run:
  - `runIndex`
  - `startedAt`
  - `endedAt`
  - `slots`
  - `results`
  - `trials`
  - `analytics`

Implementation order:
1. Add exit protection prompt for solo test phase.
2. Add `savedRuns` in-memory session structure.
3. Allow redo/new run to append to `savedRuns`.
4. Update results/export logic to support latest run vs all saved runs.
5. Later connect saved runs to Google Sheets append flow.

### History Graph System
Goal:
- Build a real history chart across saved sessions/runs, not only within one session.
- Add habit-tracking views that make practice consistency visible.

Desired controls:
- `1D`
- `1W`
- `1M`
- `3M`
- `6M`
- `1Y`
- `All`

Desired interactions:
- drag-to-zoom
- double-click reset
- compact date x-axis labels
- avoid wasting empty time space

Habit tracking ideas:
- Current session vs previous session comparison.
- Last 100 cards vs previous 100 cards.
- Last 500 cards vs previous 500 cards.
- Last 1000 cards vs previous 1000 cards.
- Calendar heatmap showing practice days, volume, and streaks.
- Current streak and longest streak.
- Cards practiced in last 7 / 30 / 90 days.
- Protocol-aware comparisons, once `protocol.label` and `protocol.tags` exist.

Implementation note:
- Do not store streaks directly in the sheet/database.
- Compute streaks and rolling windows from saved trial/session history so filters can change the answer.
- Useful filters include `session.is_test`, `analysis.excluded`, `protocol.label`, `protocol.tags`, `protocol.response_mode`, `protocol.deck_policy`, and `context.input_method`.

Vertical dot-matrix overlay idea:
- Each card timestamp gets a target-colored vertical column.
- Guesses stack vertically within that column.
- Final guess sits in the target column.

Recommended order:
1. Normalize saved session timestamps.
2. Build reusable history graph data helpers.
3. Build rolling-window comparison helpers.
4. Add current-vs-previous session summary.
5. Add range presets and date-axis formatting.
6. Add calendar heatmap/streak view.
7. Add drag-to-zoom and double-click reset.
8. Prototype vertical per-card dot-matrix overlay.
9. Reuse graph system for solo and group participant views.

### Shared Sessions, Links, And Storage Direction
Current shared sessions use a share/session code concept. Future work should decide how far this should go.

Open questions:
- Should shared session codes remain local/deck-reconstruction codes, or become real cloud-linked sessions?
- Should shortened bitlink-style links point to encoded session config, Google Sheets-backed history, or database-backed sessions?
- Should shared sessions require Google Sheets, or should Google Sheets remain optional export/history storage?

Near-term recommendation:
- Keep shared session links independent from Google Sheets.
- A shared code/link should be able to recreate session setup/deck without requiring Google auth.
- If Google Sheets is connected, it can save results, but it should not be required just to join or run a shared session.

Potential storage layers:
- Local memory: active run/session only.
- `localStorage`: small recovery snapshots and preferences.
- IndexedDB: local offline history, larger session archives, audio/transcript drafts, cross-refresh persistence.
- Google Sheets: user-owned export/history table, good for transparency and analysis.
- Supabase or similar database: cross-device sync, public/private scoreboards, real shared sessions, auth, permissions, and multi-client workflows.

Future database-backed features:
- Cross-device sync, e.g. phone collects/hosts target state while computer records guesses.
- Cross-device camera capture, e.g. phone records an experimental rig while desktop controls/records the session.
- Public or private scoreboard.
- Shared session rooms.
- Durable user accounts.
- Session ownership/permissions.
- Real-time updates between devices.
- Server-side short links.

Auth direction:
- Prefer passwordless accounts.
- Do not require an account for basic local-first use.
- Avoid building/storing passwords unless a future requirement clearly demands it.
- Recommended account options:
  - Google sign-in, especially for Google Sheets archive users.
  - Email magic link / OTP for cloud sync, shared rooms, and scoreboard identity.
  - Anonymous/local profile that can be claimed or linked later.
  - Passkeys later if the app becomes a larger multi-user platform.
- Accounts should unlock specific cloud features, not block the core app:
  - cross-device sync
  - shared session rooms
  - public/private scoreboard identity
  - cloud recovery
  - Google Sheets archive connection
- For open-source friendliness, keep auth provider assumptions swappable where practical.

Storage/retention principle:
- Supabase/database should be treated as a mediator and recent-summary layer, not the permanent trial archive.
- Google Sheets should remain the durable long-term archive for full trial-level data.
- IndexedDB should hold local unsaved/interrupted work and offline/retry queues.
- Supabase should hold only the data needed for cloud UX:
  - accounts/profiles
  - active shared rooms
  - recent unsynced session/trial fragments
  - session summaries
  - public/private scoreboard rows
  - short-link routing records

Supabase retention ideas:
- Full trial rows should be temporary only:
  - keep while unsynced
  - keep while needed for cross-device coordination
  - purge after successful Google Sheets archive or after a short TTL
- Session summaries can be kept longer because they are tiny.
- Public scoreboard should store aggregate/session summary data only, not thousands of raw trial rows per user.
- Shared links/rooms should expire and be purged automatically.
  - Candidate TTL: 14 days to 30 days.
  - Prefer earlier expiration unless a real user workflow requires longer.
- Supabase should be routinely scrubbed of temporary/raw trial data.
- Scrub jobs should never remove data that is still marked as pending archive/sync unless the user has clearly abandoned it past a defined retention window.
- Before cloud trial rows are scrubbed, the app should prompt the user to:
  - save/archive to Google Sheets
  - export CSV
  - export JSON backup
  - delete intentionally
- Public scoreboard data should be stored separately from raw trial data and should use minimal aggregate rows only.
- Scoreboard rows can persist longer than raw trial rows because they are small and not a full experimental archive.

Archive/reminder requirements:
- Serious users and power users should be nudged to connect Google Sheets or export CSV before local/cloud temporary data is purged.
- The app should clearly distinguish:
  - saved to durable archive
  - saved locally only
  - pending sync/archive
  - temporary cloud copy that will expire
- Before deleting temporary trial-level data, show clear save/export reminders where possible.
- Future UI should include an "Unsaved / Needs Review" area for:
  - interrupted sessions
  - completed but unarchived sessions
  - pending Google Sheets writes
  - sessions marked for exclusion/review
- Suggested Google Sheets archive rotation threshold:
  - remind around 75,000 trial rows
  - strongly recommend new archive around 100,000 trial rows
  - theoretical limit is higher, but performance and usability are better below this range

Suggested migration path:
1. Keep Google Sheets as optional user-owned export/history.
2. Add IndexedDB for local durable history once multi-run sessions need persistence.
3. Add database backend only when cross-device sync, public scoreboards, or real shared rooms become active requirements.

### Future Telekinesis / Macro-PK Measurement Protocols
This is a later PsiLabs protocol family, after Supabase/database and cross-device sync exist.

Possible experiment types:
- Psi wheel rotation detection.
- Torsion rig movement detection, e.g. straw or lightweight arm suspended by thread/string.
- Electroscope movement/deflection tracking.
- Other camera-measurable macro-PK or environmental interaction setups.

Hardware/context assumptions:
- Requires external physical apparatus.
- Should include controlled-environment metadata, especially airtight/air-controlled container status.
- May use a phone camera mounted at the side/top of a clear container or hanging off a table edge.
- Desktop may serve as the main control/results device while phone acts as camera sensor.

Computer vision needs:
- Phone camera integration.
- OpenCV or similar tracking pipeline.
- Object/marker tracking for angular displacement, rotation rate, oscillation, or deflection.
- Calibration workflow:
  - camera angle
  - scale reference
  - rig geometry
  - frame rate
  - baseline/no-participant drift
  - environmental controls

Potential generic schema fit:
- `protocol.type`: `macro_pk_motion_tracking`
- `protocol.phenomenon`: `telekinesis`
- `target.type`: `physical_rig`
- `response.data`: intention direction / effort interval / participant state
- `trial.data`: rig configuration and calibration references
- `score.data`: measured rotation, displacement, inferred force/power estimates
- `timing.*`: trial windows and event intervals
- `context.*`: environmental controls, container status, camera/device metadata

Possible measured outputs:
- angular displacement
- angular velocity
- angular acceleration
- deflection distance
- oscillation amplitude
- drift-corrected movement
- inferred torque/force estimate
- inferred power estimate
- confidence/quality score for tracking

Important caution:
- Force/power estimates should be clearly marked as derived from calibration assumptions.
- The app should distinguish raw tracked movement from inferred physical quantities.
- Strong environmental metadata is required before comparing users or sessions.

### Future Precognition Suite
Precognition should be treated as a major PsiLabs module, not a single mini-game.

Unlike Mindsight, which is primarily hidden-target perception, Precognition contains multiple experiment families centered around:
- future target access
- future timing access
- anticipatory state sensing
- intention vs randomness interaction
- delayed feedback effects
- intuitive session timing

Goal:
- Build a reusable future-target experiment engine that supports multiple protocols with shared infrastructure.
- Build one future-target engine with many masks, not isolated mini-apps.

Shared engine pieces:
- generic protocol schema
- generic trial engine
- target generation engine
- timing / reveal engine
- scoring engine
- analytics engine

Use dot-style schema paths in this project, even if outside notes use underscore naming.

Example generic Precognition protocol config:

```json
{
  "phenomenon": "precognition",
  "type": "future_target_access",
  "target_type": "binary",
  "response_mode": "forced_choice",
  "rng_method": "crypto_rng",
  "reveal_delay_ms": 0,
  "time_window_ms": null,
  "score_method": "hit_rate"
}
```

Core dot-style fields:

```text
session.id
participant.id
protocol.id
session.started_at
session.ended_at
notes.session

trial.id
trial.session_id
trial.index
trial.started_at
timing.response_deadline_at
timing.reveal_at
trial.completed_at

target.value
target.generated_at
target.source
target.metadata

response.value
response.sequence
response.confidence
response.latency_ms
response.submitted_at

score.correct
score.hit_rate
score.z
score.p_value
score.weighted
score.timing_error_ms
```

Phase 1 priority experiments:

1. Future Color Guess
   - User responds before future RNG reveal.
   - Initial targets: red, blue, green, yellow.
   - Config:

```json
{
  "target_type": "color",
  "response_mode": "forced_choice",
  "option_count": 4
}
```

   - Metrics:
     - hit rate
     - z-score
     - p-value
     - confidence correlation
     - streaks

2. Binary Future Guess
   - User predicts next binary result, e.g. `1/0`, `left/right`, `up/down`.
   - Designed for fast trial volume.
   - Metrics:
     - hit rate
     - rolling deviation
     - cumulative score line

3. Time Window Sensing
   - Event occurs in one of several future windows.
   - User responds with the future interval they sense.
   - Example: `0-10s`, `10-20s`, `20-30s`, `30-40s`.
   - Metrics:
     - exact hit rate
     - near-hit rate
     - timing distribution

Phase 2 experiments:

4. Presentiment Lite
   - User rates subjective state before future target reveal.
   - Flow:
     - baseline period
     - subjective state response
     - target reveal
   - Example `response.data`:

```json
{
  "activation": 1,
  "certainty": 6,
  "gut_feeling": "strong"
}
```

   - Target types:
     - calm image
     - intense image
     - positive / negative
     - neutral / salient
   - Metric:
     - subjective rating vs target correlation

5. Continuous REG / Micro-PK Line
   - Continuous binary stream creates a running line.
   - User attempts to bias upward/downward or predict trend.
   - Modes:
     - influence
     - predict
     - mixed
   - Metrics:
     - cumulative deviation
     - segment performance
     - trend reversal moments

6. Delayed Feedback Precognition
   - User responds now, reveal happens later.
   - Example delays:
     - 10 minutes
     - 1 hour
     - tomorrow
   - Metric:
     - immediate vs delayed feedback performance

Phase 3 advanced experiments:

7. Future Peak Detection
   - Hidden spike occurs at random future moment in next N seconds.
   - User marks when they sense it.
   - Metrics:
     - absolute timing error
     - clustering vs chance

8. Associative Remote Viewing Lite
   - Two future outcomes tied to two feedback images.
   - User describes future feedback image before outcome is known.
   - Example:
     - market up = beach
     - market down = mountain

9. Session Timing Intuition
   - User starts sessions when they "feel right."
   - Track whether self-selected timing improves scores.

Shared UI requirements:
- choose protocol
- target count
- reveal speed
- RNG method
- notes
- tags such as sleep, meditation, mood
- distraction-free session screen
- countdowns where needed
- optional confidence slider
- optional voice input later
- results by hit rate, z-score, rolling charts, time of day, tags, and protocol comparison

RNG methods:
- `crypto_rng`
- `pseudo_rng`
- `qrng_api`
- `hardware_rng`

Analytics priority:
- session stats
- lifetime stats
- last 100 trials
- confidence correlation
- time-of-day heatmap
- tag correlation
- protocol comparison

Recommended build order:
1. Future Color Guess
2. Binary Guess
3. Time Window Sensing
4. Presentiment Lite
5. REG Line
6. Delayed Reveal

Product strategy:
- Precognition likely has high replayability because it supports quick daily sessions, streaks, many variants, and a strong curiosity loop.
- Treat this as a flagship expansion module.

Naming:
- Umbrella: `Precognition Suite`
- Sub-modes:
  - Future Guess
  - Time Window
  - Presentiment
  - REG Stream
  - Delayed Reveal
  - Peak Detection

## Permanent Design Decisions
- Keep axis name `guessPolicy`.
- Use values:
  - `repeatUntilCorrect`
  - `oneShot`
- Keep axis name `deckPolicy`.
- Use values:
  - `balancedDeck`
  - `independentDraws`
- UI labels:
  - `Balanced Deck`
  - `Independent Draws`
- Do not hardcode category-specific option counts.
- Keep business logic out of UI components where practical.
- Keep analytics/math/deck-building in dedicated helper modules.
- Preserve existing fields and add new fields rather than replacing historical data.

## Original Implementation Requirements Summary
- Generalize analytics across categories and option counts.
- Add one-shot mode.
- Add balanced vs independent deck policy.
- Preserve existing tracked data.
- Compute first-guess accuracy, z-score, average guess position, guess position standard deviation, and weighted score.
- Add p-value alongside z-score.
- Hide repeat-only metrics for one-shot sessions.
- Keep code maintainable and avoid large unrelated rewrites.
