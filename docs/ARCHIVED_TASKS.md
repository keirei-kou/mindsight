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

- `src/sessionModel.js`
- `src/deck.js`
- `src/analytics.js`
- `src/soloSessionPayload.js`
- `src/schemaRegistry.js`
- `src/csv.js`
- `src/googleSheets.js`
- `src/googleSheetHistory.js`
- `src/sessionRecovery.js`
- `src/timeOfDay.js`
