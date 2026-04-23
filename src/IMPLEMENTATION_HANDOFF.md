# Mindsight Refactor Handoff

## Status
- This file is a local backup of the current implementation plan and user requirements.
- It is intended to survive outside the chat session.
- Current work has focused on solo-mode foundations first, with minimal-disruption refactors.

## Current Progress
- Added canonical session/model definitions in [sessionModel.js](./sessionModel.js)
- Added centralized deck generation in [deck.js](./deck.js)
- Added centralized analytics math in [analytics.js](./analytics.js)
- Added solo payload shaping in [soloSessionPayload.js](./soloSessionPayload.js)
- Updated one-shot metric storage/export rules so only `firstGuessAccuracy` + `zScore` are computed/stored; `averageGuessPosition`, `guessPositionStdDev`, and `weightedScore` are left blank/null to avoid misleading artifacts
- Updated Google Sheets "Open Results" flow to load full history first (overview), with per-session drilldown and per-user export support
- Added Google Sheets overview rollup to show the 5 key metrics across all sessions for the selected user (not only per-session deep dive)
- Added Training Hotline overlay during test phase (Ctrl/voice toggle, guessing disabled) to avoid accidental resets and preserve blindfolded usability
- Updated Instructions page with a speaker-button popup listing voice commands/phrases (main instructions text stays focused on keys/buttons and behavior)
- Added interrupted-session recovery (localStorage snapshot) so exiting mid-test (back/refresh/close) stamps an `endedAt` and can be reopened from Setup
- Switched training hotline voice from `am_santa` to `bm_lewis` and generated Kokoro audio clips under `public/audio/bm_lewis`
- Updated the Kokoro clip generator to support “packs” (e.g. `--pack hotline`) so we can generate only the minimal set needed without waiting for the full 111 clips
- Fixed graph edge-case where per-trial weighted score could dip below 0% (clamp) causing the line to drop below the x-axis
- Updated [pages/Setup.jsx](./pages/Setup.jsx) to use:
  - `guessPolicy`
  - `deckPolicy`
  - `Balanced Deck`
  - `Independent Draws`
- Updated [pages/TrainingRoom.jsx](./pages/TrainingRoom.jsx) to:
  - emit normalized solo trials
  - compute session analytics
  - support `oneShot` runtime behavior
- Updated [pages/SoloResults.jsx](./pages/SoloResults.jsx) to:
  - consume `analytics`
  - show mode-aware metrics
  - use normalized trial data for graphing
- Updated [csv.js](./csv.js) so solo CSV import/export uses the new canonical trial/session shape

## Files Added So Far
- [sessionModel.js](./sessionModel.js)
- [deck.js](./deck.js)
- [analytics.js](./analytics.js)
- [soloSessionPayload.js](./soloSessionPayload.js)
- [sessionRecovery.js](./sessionRecovery.js)

## Assets Added So Far
- `public/audio/af_heart/prompts/test-resumed.wav`
- `public/audio/bm_lewis/**` (Kokoro clips for training/hotline voice)

## Files Changed So Far
- [pages/Setup.jsx](./pages/Setup.jsx)
- [pages/Instructions.jsx](./pages/Instructions.jsx)
- [pages/TrainingRoom.jsx](./pages/TrainingRoom.jsx)
- [pages/SoloResults.jsx](./pages/SoloResults.jsx)
- [App.jsx](./App.jsx)
- [csv.js](./csv.js)
- [utils.js](./utils.js)
- [googleSheetHistory.js](./googleSheetHistory.js)
- [googleSheets.js](./googleSheets.js)
- [speechMatcher.js](./speechMatcher.js)
- [index.css](./index.css)
- [scripts/generate-kokoro-clips.mjs](./scripts/generate-kokoro-clips.mjs)

## Recommended Immediate Next Step
Run manual testing before further changes.

Suggested manual test checklist:
1. Launch app and verify setup screen renders with:
   - Guess Policy
   - Deck Policy
   - Mode Summary
2. Run solo `repeatUntilCorrect + balancedDeck`
3. Run solo `repeatUntilCorrect + independentDraws`
4. Run solo `oneShot + balancedDeck`
5. Run solo `oneShot + independentDraws`
6. For each run, verify:
   - flow does not crash
   - results page loads
   - mode badges are correct
   - summary cards match mode
   - graph renders
   - export CSV succeeds
   - import of exported CSV succeeds
7. Only after solo is stable, continue with:
   - cleanup of old legacy display terms
   - group analytics migration
   - group CSV migration

## Implementation Checklist

### Core Foundations
- [x] Define canonical session metadata in `sessionModel.js`
- [x] Define canonical trial and analytics target shapes in `sessionModel.js`
- [x] Introduce `guessPolicy`
- [x] Introduce `deckPolicy`
- [x] Rename deck values to `balancedDeck` and `independentDraws`

### Setup Flow
- [x] Default setup to use the new mode vocabulary
- [x] Replace old generation wording with `Guess Policy` and `Deck Policy`
- [x] Add mode summary box to setup
- [x] Default setup to `Solo Training` temporarily for testing
- [x] Default solo name to `Keirei` temporarily for testing

### Deck Logic
- [x] Extract deck generation into `deck.js`
- [x] Move setup to use `deckPolicy` directly
- [x] Preserve secure randomness for deck generation

### Analytics Layer
- [x] Create `analytics.js`
- [x] Add `buildTrialRecord(...)`
- [x] Add `buildSessionAnalytics(...)`
- [x] Compute dynamic baselines from `optionCount`
- [x] Add per-option analytics support
- [x] Enforce one-shot metric storage rules (store only `firstGuessAccuracy` + `zScore`; leave position/std-dev/weighted blank/null)

### Solo Payload And Runtime
- [x] Create `soloSessionPayload.js`
- [x] Normalize solo run output into canonical session payload
- [x] Add `oneShot` runtime behavior in solo mode
- [x] Keep `repeatUntilCorrect` runtime behavior working
- [x] Add Training Hotline overlay in test phase (Ctrl/voice toggle, guessing disabled)
- [x] Add interrupted-session recovery snapshot for mid-test exits (back/refresh/close)

### Solo Results
- [x] Update `SoloResults` to consume `analytics`
- [x] Show mode-aware summary metrics
- [x] Update graph to use normalized trial data
- [x] Make graph mode-aware for `oneShot` vs `repeatUntilCorrect`
- [x] Add Google Sheets overview-first history view with per-session drilldown
- [x] Add per-user Google history export and composite session grouping (`name + session_id`)
- [x] Add Google Sheets overview rollup to show 5 key metrics for the selected user across all sessions

### Solo CSV
- [x] Update solo CSV export to use canonical trial/session fields
- [x] Update solo CSV import to rebuild trials and analytics
- [x] Keep old solo CSV import path temporarily during transition

### Audio / Voice Fixes
- [x] Restore Kokoro support for one-shot incorrect answer reveals
- [x] Add generated Kokoro clips for `Different. The answer was X.`
- [x] Add spoken command detection for `Training Room`
- [x] Add spoken command detection for `Begin Test`
- [x] Add spoken command detection for `Results`
- [x] Add Instructions "Voice" popup so spoken phrases are discoverable without cluttering the main instructions text
- [x] Add Kokoro clip generator “packs” (e.g. `--pack hotline`) to avoid always generating full sets

### UI Fixes During Testing
- [x] Fix cards-per-round input so backspace can clear the field
- [x] Keep the test footer height stable while guesses are added
- [x] Re-center the guess strip while preserving fixed footer height

### Still To Do
- [ ] Run full manual testing across solo mode combinations
- [ ] Clean up old legacy labels like `Acc` in remaining detailed views
- [ ] Decide whether to remove temporary compatibility fallback paths
- [ ] Migrate group analytics to the canonical trial/session model
- [ ] Migrate group CSV to the canonical trial/session model
- [ ] Add exit protection prompt for in-progress solo tests
- [ ] Add in-memory multi-run session saving
- [ ] Build a history graph system with date-based x-axis labels
- [ ] Add Keepa-style graph range presets and zoom interactions
- [ ] Design a vertical dot-matrix overlay mapped to each card timestamp

## Original User Spec

```text
We need to extend the Mindsight Training App analytics and mode system.

Please inspect the existing codebase first and preserve all existing tracked fields and session/trial data that already exist. Do not remove current metrics. Add the new mode and analytics cleanly, with minimal disruption to current behavior.

IMPORTANT:
This system must NOT be hardcoded only for colors.
We currently have multiple categories, including:
- colors (example: 6 options)
- numbers (example: 6 options)
- shapes (example: 9 options)

In the future, more categories may be added, and existing categories may have different option counts.
All metric calculations must therefore be generalized to:
- the current category being trained/tested
- the number of possible options in that category
Do not hardcode assumptions like “6 colors” except where used as examples/comments. The implementation should derive option counts from the active category/config/data.

================================
MODE AXES
================================

We now have 2 independent mode dimensions:

1) guessPolicy
- "repeatUntilCorrect"
- "oneShot"

2) deckPolicy
- "independent"
- "balanced"

Meaning a session can be any combination of:
- oneShot + independent
- oneShot + balanced
- repeatUntilCorrect + independent
- repeatUntilCorrect + balanced

Definitions:

A) guessPolicy = "repeatUntilCorrect"
- user can keep guessing until the correct target is found
- app gives immediate feedback after each guess
- once correct, move to next card

B) guessPolicy = "oneShot"
- user gets exactly one guess per card
- after that single guess, reveal result and move to next card
- this is the rapid-fire test mode

C) deckPolicy = "independent"
- each card’s target is sampled independently from the active category’s option set
- duplicates and missing options are allowed within a session
- previous cards do not affect future card probabilities

D) deckPolicy = "balanced"
- session deck is prebuilt to contain equal counts of each option in the active category, then shuffled
- example:
  - 12 cards with 6 options => 2 of each, then shuffle
  - 18 cards with 9 options => 2 of each, then shuffle
- if total cards are not evenly divisible by the number of options, choose a sensible rule and document it in code comments
- preserve cryptographic randomness / secure randomness approach already used where possible

================================
GENERALIZATION REQUIREMENT
================================

All analytics must be dynamic based on the active category’s option count.

Examples:
- colors may have 6 options
- numbers may have 6 options
- shapes may have 9 options

Metric baselines and scoring must adapt automatically.

Let:
- optionCount = number of possible targets in the active category

Then:
- chance baseline for first guess = 1 / optionCount
- random sequential guessing baseline for averageGuessPosition = (optionCount + 1) / 2
- weighted score formula must also adapt to optionCount

Do NOT hardcode:
- 1/6
- 3.5
- 6-step score ladders

Those should all be derived from optionCount.

================================
ANALYTICS REQUIREMENTS
================================

We want to track these 5 metrics:

1) firstGuessAccuracy
Definition:
- percent of trials where the first guess was correct

2) zScore
Definition:
- z-score for first-guess accuracy against chance baseline p0 = 1 / optionCount

Formula:
z = (pHat - p0) / sqrt(p0 * (1 - p0) / n)

Where:
- pHat = firstGuessAccuracy as a proportion
- p0 = 1 / optionCount
- n = total number of trials included in the calculation

3) averageGuessPosition
Definition:
- average position at which the correct answer was found
Examples:
- correct on first guess => 1
- correct on third guess => 3

Chance baseline under random sequential guessing with no repeats:
- (optionCount + 1) / 2

4) guessPositionStdDev
Definition:
- standard deviation of correctGuessIndex across trials
This measures consistency/stability of guess position

5) weightedScore
Definition:
- for repeat-until-correct sessions only
- assign more value to earlier correct guesses
- must adapt to optionCount

Use this generalized formula:
weightedScorePerTrial = (optionCount + 1 - correctGuessIndex) / optionCount

Examples:
- if optionCount = 6:
  - guess 1 => 1.00
  - guess 2 => 0.83
  - guess 3 => 0.67
  - guess 4 => 0.50
  - guess 5 => 0.33
  - guess 6 => 0.17

- if optionCount = 9:
  - guess 1 => 1.00
  - guess 2 => 0.89
  - guess 3 => 0.78
  - ...
  - guess 9 => 0.11

Session weightedScore:
- average of weightedScorePerTrial across all trials

================================
IMPORTANT MODE-SPECIFIC RULES
================================

Do NOT treat all metrics as equally meaningful in all modes.

A) oneShot modes
- firstGuessAccuracy applies
- zScore applies
- per-option accuracy applies
- averageGuessPosition should be left blank/null (do not store misleading artifacts like 1.00)
- guessPositionStdDev should be left blank/null (do not store misleading artifacts like 0.00)
- weightedScore should be left blank/null (redundant in oneShot mode)

B) repeatUntilCorrect modes
- firstGuessAccuracy applies
- zScore applies, but it is based only on first guesses
- averageGuessPosition applies
- guessPositionStdDev applies
- weightedScore applies

C) independent deck mode
- this is the cleanest statistical mode
- zScore interpretation is strongest here

D) balanced deck mode
- still compute the same metrics
- but this mode is controlled exposure, not fully independent trial structure
- keep implementation simple; we do not need to label inferential caveats everywhere, but code/comments should reflect this distinction

================================
TRIAL DATA MODEL
================================

Please inspect the existing stored trial/session shape and extend it rather than replacing it.

Per trial, make sure we have enough data to derive all metrics. We likely need fields like:

- cardIndex
- categoryKey or categoryType
- optionCount
- targetValue
- guesses (array of guessed values in order)
- firstGuess
- firstGuessCorrect
- correctGuessIndex
- guessCount
- guessPolicy
- deckPolicy

If similar fields already exist, reuse them instead of duplicating.

Important:
There is already an existing metric/field where guessed values are tracked as a comma-separated list or equivalent. Preserve existing behavior, but also make sure the ordered guesses remain accessible for metric calculations.

================================
PER-OPTION ANALYTICS
================================

Also add / preserve per-option stats where reasonable.

At minimum for each option within the active category:
- appearances
- first-guess hits
- first-guess accuracy for that option

If easy within current architecture, also include:
- averageGuessPosition by target option for repeatUntilCorrect modes

This is to identify which specific options the user struggles with.

Examples:
- for colors: red, blue, green, etc.
- for numbers: 1, 2, 3, etc.
- for shapes: circle, square, triangle, etc.

This should be generic and not color-specific in naming or logic.

================================
BASELINE / INTERPRETATION NOTES
================================

All chance baselines must be dynamic.

Examples:
- if optionCount = 6:
  - first-guess chance = 16.67%
  - random sequential averageGuessPosition baseline = 3.5

- if optionCount = 9:
  - first-guess chance = 11.11%
  - random sequential averageGuessPosition baseline = 5.0

These do not necessarily need to be hardcoded into UI everywhere, but the analytics layer should be built around these assumptions dynamically.

================================
UI / UX REQUIREMENTS
================================

Add a new rapid-fire oneShot mode to the app.

Behavior:
- exactly one guess per card
- result is revealed immediately
- automatically move to next card after reveal / short response flow
- this should exist alongside the existing repeatUntilCorrect mode

Also support choosing deck policy:
- independent random
- balanced deck

Ideally the session setup UI should let the user choose:
- category
- guess policy: oneShot vs repeatUntilCorrect
- deck policy: independent vs balanced

Use existing patterns/components where possible.

Please make sure the category’s available option list is the source of truth for:
- target generation
- balanced deck construction
- optionCount
- metric baselines
- per-option analytics

================================
IMPLEMENTATION PREFERENCES
================================

- Keep diffs minimal
- Do not rewrite unrelated files
- Reuse current session/trial analytics structure if present
- Add helper functions rather than bloating components
- Preserve current behavior for existing modes unless required for consistency
- If the codebase already computes some of these metrics partially, extend/refactor carefully rather than duplicating logic
- Use generic naming like target/option/category rather than color-specific naming where possible, unless existing code structure strongly requires compatibility

================================
DELIVERABLE
================================

Please implement this end-to-end:
1. add the new oneShot rapid-fire mode
2. add deckPolicy support for balanced vs independent
3. ensure the system works generically across categories with different option counts
4. store enough trial data for the analytics
5. compute the 5 metrics correctly with mode-aware logic and category-aware optionCount logic
6. preserve existing tracked metrics and current data fields
7. surface the relevant metrics in the appropriate modes without showing meaningless ones in oneShot mode

After coding, give me a brief summary of:
- files changed
- new data fields added
- new helper functions added
- how each metric is computed generically
- how optionCount is derived
- which metrics are shown in oneShot vs repeatUntilCorrect,

Analyze this first and we'll start implementing things step by step, slowly, no big changes. Wait for my command to execute
```

## Additional Maintainability Rules

```text
================================
CODE QUALITY / MAINTAINABILITY REQUIREMENTS
================================

This implementation must prioritize maintainability, readability, and clean structure over cleverness or compactness.

General rules:
- Prefer clear, explicit code over dense or overly clever code
- It is acceptable for code to be slightly longer if that makes it easier to read and maintain
- Avoid “mumbo-jumbo” logic, compressed expressions, or deeply nested inline conditionals
- Avoid writing code that is technically shorter but harder to understand
- Favor straightforward control flow and descriptive names

Structure:
- Reuse existing helpers where appropriate
- If logic is shared across categories, modes, or metric calculations, extract it into helper functions
- Do not duplicate the same calculation in multiple components/files
- Keep business logic out of UI components when possible
- Move analytics/math/deck-building logic into dedicated utility/helper functions
- Components should mainly coordinate state, rendering, and user flow
- Metric formulas should live in one clear analytics layer or helper module
- Deck construction logic should live in one clear helper/module
- Mode interpretation logic should not be scattered across multiple files if it can be centralized cleanly

Naming:
- Use descriptive, generic names like:
  - category
  - optionCount
  - targetValue
  - guesses
  - correctGuessIndex
  - guessPolicy
  - deckPolicy
- Avoid color-specific naming unless required for backward compatibility with existing code
- Avoid vague names like data, item, temp, val, obj unless context makes them truly obvious

Functions:
- Keep functions focused on one responsibility
- Prefer small-to-medium functions with obvious inputs/outputs
- If a function is doing multiple conceptually different things, split it
- If the same logic appears more than once, extract it
- Add small helper functions when they improve clarity
- Do not create unnecessary abstraction layers just for the sake of abstraction

Conditionals / control flow:
- Prefer readable if/else blocks over compressed ternaries when logic is non-trivial
- Avoid long chains of nested conditionals if they can be simplified
- Use guard clauses where that improves readability
- Keep mode-specific behavior easy to trace

Comments:
- Add concise comments only where the reasoning is not obvious
- Good places for comments:
  - why one-shot and repeat modes differ in metric display
  - how balanced deck construction works
  - why metrics depend on optionCount
  - why some metrics are hidden in oneShot mode
- Do not add noisy comments that just restate obvious code

Refactoring expectations:
- If existing code is clunky in the areas being touched, refactor carefully only as needed to support the new feature cleanly
- Do not perform broad unrelated rewrites
- Improve touched code where it materially helps readability and maintainability
- Preserve existing behavior unless a change is required for correctness/consistency

Avoid:
- giant components
- duplicated metric formulas
- duplicated mode checks in many places
- hardcoded option counts
- hardcoded category-specific branches when generic logic is possible
- compact but confusing array chains if a clearer step-by-step approach would be easier to maintain
- magic numbers without explanation or derivation

Preferred outcome:
- a future developer should be able to open the relevant files and quickly understand:
  1. how targets are generated
  2. how oneShot vs repeatUntilCorrect differs
  3. how balanced vs independent differs
  4. how each metric is calculated
  5. where to add a new category or change option counts later

When finished, please also briefly report:
- any duplicated logic you removed
- any helper functions you introduced for clarity
- any places where you intentionally chose clearer code over shorter code
```

## Naming Decisions Reached During Chat
- Keep the axis name `deckPolicy`
- Use clearer code values:
  - `balancedDeck`
  - `independentDraws`
- Use UI labels:
  - `Balanced Deck`
  - `Independent Draws`
- Keep the axis name `guessPolicy`
- Use values:
  - `repeatUntilCorrect`
  - `oneShot`

## Important Style Direction Reached During Chat
- Avoid cramming business logic into components
- Prefer one file having one clear purpose
- Pull payload shaping, analytics, and deck logic out of UI components
- Components should remain focused on user flow and rendering

## Future Design Plan: Save Current Results And Multi-Run Sessions

### Goal
Support two related workflows:

1. Protect in-progress solo test data before leaving the test phase
2. Allow multiple completed trial blocks to be saved in memory under one broader session

### Problem To Solve
Current behavior treats one completed solo run as one isolated result payload.

That means:
- if the user leaves mid-test, completed cards can be lost
- if the user finishes 10 cards and wants to immediately run another 10 cards, there is no clean in-memory structure for preserving both runs together

### Recommended Concepts

#### Session
A broader container for one participant and one configuration context.

Suggested fields:
- `participantName`
- `category`
- `activeOptions`
- `guessPolicy`
- `deckPolicy`
- `savedRuns`

#### Run
One completed block of trials under the same session settings.

Suggested fields:
- `runIndex`
- `startedAt`
- `endedAt`
- `slots`
- `results`
- `trials`
- `analytics`

### In-Progress Exit Protection
If the user is in test phase and has already completed at least one card, then leaving the test flow should trigger a prompt such as:

- `Do you want to save current results?`

Suggested actions:
- `Continue Test`
- `Finish And Save`
- `Discard`

Notes:
- `Finish And Save` should finalize the current partial run from the cards completed so far
- `Discard` should explicitly clear in-progress state
- this should apply before leaving to training room or setup when data would otherwise be lost

### Multi-Run In-Memory Saving
Allow one participant/session to hold multiple completed runs in memory before leaving setup or reloading the app.

Suggested behavior:
1. User completes a run
2. App stores the run in `savedRuns`
3. User can choose to:
   - view results
   - start another run with the same settings
4. If another run is started, it appends a new run to `savedRuns`

### Why This Helps
- supports repeated blocks like 10 cards, then another 10 cards
- avoids losing useful training history during one sitting
- prepares the app for future Google Sheets append behavior
- makes later session-history graphs more natural

### Persistence Strategy
Short term:
- save in memory only

Long term:
- append completed runs to Google Sheets
- optionally mirror to CSV exports

### Recommended Implementation Order
1. Add exit protection prompt for solo test phase
2. Add `savedRuns` in-memory session structure
3. Allow redo/new run to append to `savedRuns`
4. Update results/export logic to support latest run vs all saved runs
5. Later connect saved runs to Google Sheets append flow

## Future Graph / History Design

### Goal
Build a real history chart system for solo and group analytics that works across saved sessions rather than only within one session.

### Desired Time Controls
Add Keepa-style range controls such as:
- `1D`
- `1W`
- `1M`
- `3M`
- `6M`
- `1Y`
- `All`

### Desired X-Axis Labeling
Use compact date labels similar to:
- `1/29`
- `1/30`
- `1/31`

Adapt label density by zoom level so the axis remains readable.

### Desired Interactions
- allow drag-to-zoom with left mouse down, drag, and release
- allow double-click to zoom back out toward a wider range or `All`
- support a clear `All (# of days)` style reset view

### Important Constraint
The graph should avoid wasting large amounts of empty time space.

Notes from chat:
- most practice sessions are likely shorter than one hour
- a one-day view with many empty hours is not desirable
- the chart should try to fit actual card data more tightly when appropriate

This likely means the chart system will need:
- true session timestamps
- history-aware time bucketing
- logic for reducing empty-span emphasis when the visible window is much larger than the actual data density

### Vertical Dot-Matrix Overlay Idea
Add a per-card overlay above the time-based chart:
- each target card gets an opaque target-colored vertical column aligned to its x-axis timestamp
- the width of that colored column can adapt to the zoom level
- the guess sequence for that card should be displayed vertically from top to bottom
- the bottom-most dot should be the final guess
- the final guess should visually sit in the same target-colored column that belongs to that card

Example intent:
- target was `Red`
- chart shows an opaque red vertical column at that card's time position
- guesses stack vertically within that column
- bottom-most dot is the final correct red guess

### Recommended Prerequisites
Before building this graph system, make sure we have:
- consistent `startedAt` / `endedAt` timestamps for saved runs
- history data across multiple runs or sessions
- clear chart data builders separate from UI components

### Recommended Implementation Order
1. Normalize saved session timestamps
2. Build reusable history graph data helpers
3. Add range presets and date-axis formatting
4. Add drag-to-zoom and double-click reset
5. Prototype the vertical per-card dot-matrix overlay
6. Reuse the same graph system for solo and group participant views
