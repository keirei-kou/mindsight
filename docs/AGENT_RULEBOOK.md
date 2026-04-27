# Agent Rulebook

Stable instructions for AI agents working on PsiLabs.

## Work Style

- Move in small, reviewable steps.
- Inspect before editing when the scope is unclear.
- Avoid unrelated refactors and broad rewrites.
- Preserve existing user data, old CSVs, and old Google Sheets wherever possible.
- Preserve backward compatibility by adding fields, aliases, defaults, and backfillers before removing or replacing historical behavior.
- Keep changes focused on the requested behavior.
- Keep business logic out of UI components where practical.
- Keep analytics, math, deck-building, payload shaping, schema mapping, and storage integration in dedicated helper modules.
- Do schema completeness before final column reordering.
- Use `let` by default where a binding may need reassignment.

## Schema And Data Rules

- Use the schema registry for CSV and Google Sheets field names, aliases, defaults, required fields, optional fields, and backfillers.
- New Google Sheets and CSV exports should use deterministic order from the current schema header list.
- Existing Google Sheets should be appended by matching header names, not by assuming column position.
- Missing required fields should produce clear errors.
- Missing computable fields should be backfilled.
- Missing fields with safe defaults should receive defaults.
- Missing subjective or user-intent fields should stay blank.
- Unknown extra CSV columns should not break import.
- Unknown Google Sheet columns should block automatic migration when data could be silently discarded.
- Non-Mindsight protocol rows should block automatic migration so protocols are not mixed accidentally.

## Generic PsiLabs Naming

- Move Mindsight toward a generic PsiLabs protocol schema instead of a one-off Mindsight-only schema.
- Use generic names for the core experiment engine.
- Keep Mindsight-specific names only in UI labels, protocol config, trial data, response data, or score data.
- Prefer generic backbone concepts:
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
- Avoid future one-off models such as `mindsight_sessions`, `mindsight_trials`, `precog_sessions`, or `telepathy_sessions`.
- Use `response` instead of `guess` in the generic schema.
- Use `target` instead of `card` in the generic schema.
- Use `protocol` instead of `app_mode` for experiment design.
- Do not hardcode category-specific option counts.

## Mindsight-Specific Boundaries

These should not become universal top-level schema fields:

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

These concepts may live inside:

- `protocol.config`
- `trial.data`
- `response.data`
- `score.data`

## UI Wording

- Keep UI wording user friendly.
- The UI can still say "guess", "card", and "color" when that language helps users.
- Schema and storage should use generic terms like `response`, `target`, and `target_type`.
- Use labels such as `Balanced Deck` and `Independent Draws` in the UI.

## Permanent Design Decisions

- Keep axis name `guessPolicy`.
- Use `guessPolicy` values:
  - `repeatUntilCorrect`
  - `oneShot`
- Keep axis name `deckPolicy`.
- Use `deckPolicy` values:
  - `balancedDeck`
  - `independentDraws`
- Preserve existing fields and add new fields rather than replacing historical data.
- Hide repeat-only metrics for one-shot sessions.

## Security Rules

- QRNG/QREG provider API keys must be server-side only.
- Do not place QRNG/QREG provider keys in React/Vite frontend code, client env vars, or browser network requests.
- Frontend code should request random values from an internal endpoint only.
- Backend or server functions should store provider keys in secure environment secrets, call external providers, and return only random values/events to the frontend.
- Design RNG provider integration so providers can be swapped without frontend changes.
