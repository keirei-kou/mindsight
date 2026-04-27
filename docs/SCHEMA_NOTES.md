# Schema Notes

Focused notes for PsiLabs schema mappings, aliases, defaults, backfillers, column order, and unresolved schema decisions.

## Current Solo Sheet Fields

Current solo fields in the handoff:

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

Current implementation notes:

- New sheets initialize from `PSILABS_DOT_V1_HEADERS` in `src/schemaRegistry.js`.
- CSV/Google Sheets row output is built through `buildDotV1SoloTrialRows()` in `src/csv.js`.
- Existing recognized Mindsight v0/mixed sheets migrate to dot v1 before read/append.
- Google Sheets history rebuild reads dot v1 fields directly, with legacy fallback through the schema registry.

## Dot-Style Direction

Prefer flattened dot-style columns that act like object namespaces:

```text
session.id
protocol.type
target.value
response.guess_sequence
score.z
timing.trial_duration_ms
```

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
- `analysis.*`

## Recommended Field Mapping

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
guesses                     -> response.attempt_sequence
first_guess                 -> response.first_value
first_guess_correct         -> score.is_hit
correct_guess_index         -> response.correct_position
guess_count                 -> response.attempt_count
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
proximity                   -> score.proximity_score
pattern                     -> score.pattern
skipped                     -> trial.is_skipped
first_guess_accuracy        -> score.hit_rate
z_score                     -> score.z
p_value                     -> score.p_value
average_guess_position      -> score.average_response_position
guess_position_std_dev      -> score.response_position_std_dev
weighted_score              -> score.weighted_score
```

Prefer the stricter generic mapping when columns are actually renamed:

```text
guesses                     -> response.attempt_sequence
first_guess                 -> response.first_value
first_guess_correct         -> score.is_hit
correct_guess_index         -> response.correct_position
guess_count                 -> response.attempt_count
first_guess_accuracy        -> score.hit_rate
weighted_score              -> score.weighted_score
notes                       -> notes.trial
```

## Generic Core Fields

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
response.attempt_sequence
response.first_value
response.attempt_count
response.correct_position
response.submitted_at
response.data

score.id
score.scope
score.session_id
score.trial_id
score.participant_id
score.is_hit
score.hit_rate
score.weighted_score
score.z
score.p_value
score.data

notes.session
notes.trial

timing.trial_duration_ms
timing.response_latency_ms
```

## Current Mindsight Generic Values

```text
protocol.type = forced_choice_perception
protocol.phenomenon = mindsight
protocol.target_type = color | number | shape
protocol.response_mode = one_shot | repeat_until_correct
protocol.deck_policy = balanced_deck | independent_draws
rng.method = crypto_rng
```

Internal payloads may keep compatibility fields for now:

- `targetValue`
- `guesses`
- `firstGuess`
- `correctGuessIndex`
- `guessPolicy`
- `deckPolicy`

New generic fields should be added alongside them when useful:

- `protocolType`
- `phenomenon`
- `targetType`
- `responseMode`
- `protocolConfig`
- `trialData`
- `responseData`
- `scoreData`

## Added Or Planned Fields

Implemented or targeted dot-style fields include:

- `schema.version`
- `session.is_test`
- `rng.method`
- `rng.provider`
- `rng.seed`
- `score.chance_baseline`
- `score.expected_avg_response_position`
- `analysis.is_excluded`
- `analysis.exclusion_reason`
- `protocol.label`
- `protocol.tags`
- `protocol.notes`
- `notes.trial`
- `notes.voice_text`
- `notes.voice_source`
- `context.input_method`
- `archive.status`
- `archive.google_sheet_id`
- `archive.synced_at`

Future RNG provenance fields:

- `rng.source_url`
- `rng.device_id`
- `rng.sample_id`

## Defaults

Suggested safe defaults:

- `schema.version`: current schema version, initially `1.0`.
- `session.is_test`: `true` for saved test/result rows.
- `analysis.is_excluded`: `false`.
- `rng.method`: `crypto_rng` for normal solo generated decks.
- `rng.provider`: `browser_crypto` for current browser-generated randomness.
- `rng.seed`: `session.share_code` when the share code is the reproducibility seed.
- `context.input_method`: `mixed` when exact input mode is unknown.

Fields that should not be invented:

- `notes.trial`
- `notes.voice_text`
- `protocol.label`
- `protocol.tags`
- `protocol.notes`
- `analysis.exclusion_reason`
- `rng.source_url`
- `rng.device_id`
- `rng.sample_id`

## Backfillers

Examples of computable or backfillable fields:

- `score.p_value`
- `score.chance_baseline`
- `score.expected_avg_response_position`
- `timing.trial_started_at_estimated`
- `timing.trial_ended_at_estimated`
- `context.time_of_day`
- `context.time_of_day_is_estimated`

Historical timestamp backfill fields:

- `trial_started_at_estimated`
- `trial_ended_at_estimated`
- `time_of_day_is_estimated`

## Analytics Rules

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

Expected random sequential response position:

```text
(optionCount + 1) / 2
```

Weighted score per trial:

```text
(optionCount + 1 - correctGuessIndex) / optionCount
```

Mode-specific storage:

- `oneShot`: store/use `firstGuessAccuracy`, `zScore`, `pValue`, and per-option first-guess stats; leave repeat-only metrics blank.
- `repeatUntilCorrect`: store/use all metrics.

Primary cross-session metrics:

- `z_score`
- `p_value`

Secondary metrics:

- `average_guess_position`
- `guess_position_std_dev`
- `weighted_score`

## Desired Column Grouping

Do not reorder until schema completeness is settled. Once final fields are added, reorder headers and matching row values together.

Preferred logical order:

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
score.hit_rate

SECONDARY SESSION METRICS
score.weighted_score
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
response.first_value
score.is_hit
response.correct_position
response.attempt_count
response.attempt_sequence
trial.is_skipped
analysis.is_excluded
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
score.proximity_score
score.pattern

FUTURE RNG PROVENANCE
rng.source_url
rng.device_id
rng.sample_id
```

## Migration Workflow

1. Add new field to schema registry.
2. Decide whether the field is required or optional.
3. Add a default if safe.
4. Add a backfiller if computable from old data.
5. Add aliases if renaming old fields.
6. Update CSV export/import.
7. Update Google Sheets append/read behavior.
8. Add schema backfillers for computable fields.
9. Add tests or manual checks with old and new CSV/sheet shapes.

## Ambiguous Or Human-Review Items

- Final column order still needs user approval.
- `session.is_test` default should be confirmed for serious saved result rows.
- `context.input_method` may default to `mixed`, but exact input capture may be preferable later.
- Whether to preserve unknown CSV fields in a passthrough map is still open.
- Future UX should ask before physical Google Sheet migration and show progress.
- RNG provenance fields need concrete provider decisions before becoming meaningful.
