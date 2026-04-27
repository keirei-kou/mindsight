# Current Tasks

Current actionable work for the next implementation pass. Completed work belongs in `ARCHIVED_TASKS.md`; future ideas belong in `ROADMAP.md`.

## Project State

Solo-mode foundations are mostly in place:

- Canonical session/model helpers: `src/sessionModel.js`
- Deck generation: `src/deck.js`
- Analytics math: `src/analytics.js`
- Solo payload shaping: `src/soloSessionPayload.js`
- Solo schema mapping: `src/schemaRegistry.js`
- CSV row shape and dot-style exports: `src/csv.js`
- Google Sheets append/read behavior: `src/googleSheets.js`
- Historical Google Sheets rebuild/backfill behavior: `src/googleSheetHistory.js`

Recently completed work has been moved to `ARCHIVED_TASKS.md`.

## Immediate Next Tasks

Do these one at a time.

### 1. Google Sheets Upgrade UX

- Add explicit Google Sheets schema upgrade confirmation and progress UX.
- Show what will change before physical sheet migration.
- Make failures clear when required columns are missing, unknown columns exist, or non-Mindsight protocol rows are present.

Acceptance criteria:

- Users must confirm before a live Google Sheet is physically migrated.
- Progress or status is visible during upgrade.
- Migration-blocking errors name the reason and preserve existing sheet data.

### 2. Live Google Sheets Verification

- Manually verify append/read behavior against a live Google Sheet.
- Include new dot v1 sheets and recognized Mindsight v0/mixed sheets.
- Confirm history rebuild and backfill behavior.

Acceptance criteria:

- New sheet initializes with current dot v1 headers.
- Existing recognized v0/mixed sheet migrates or reads as expected.
- Append writes dot v1 rows.
- History load succeeds.
- Estimated timing and time-of-day fields backfill for historical rows.

### 3. Column Order Finalization

- Let the user finalize the final solo sheet column order.
- Reorder only after schema completeness is settled.
- Update the header list and matching row output together.

Acceptance criteria:

- `PSILABS_DOT_V1_HEADERS` or its future equivalent uses the approved order.
- Row values produced by the CSV/Google Sheets row builder align with the header order.
- Old CSV imports and old sheet reads still work through aliases/backfillers.

### 4. Manual Solo Mode Testing

Run manual testing across all solo mode combinations:

- `repeatUntilCorrect + balancedDeck`
- `repeatUntilCorrect + independentDraws`
- `oneShot + balancedDeck`
- `oneShot + independentDraws`

Acceptance criteria for each combination:

- Setup screen renders.
- Guess Policy appears.
- Deck Policy appears.
- Session starts.
- Results page loads.
- Mode badges are correct.
- Summary cards match mode.
- Z-score and p-value appear when valid.
- One-shot hides repeat-only metrics.
- Graph renders.
- CSV export succeeds.
- CSV import succeeds.
- Google Sheets append succeeds.
- Google Sheets history load succeeds.
- Historical rows backfill estimated trial timestamps and time-of-day.

### 5. Multi-Run And Exit Protection Foundation

- Add exit protection for in-progress solo test phase.
- Introduce a `savedRuns` session structure when ready.
- Support redo/new run appending under one broader session.

Acceptance criteria:

- In-progress data is protected before leaving the test phase.
- Multiple completed trial blocks can be represented under one session.
- Results/export logic can distinguish latest run from all saved runs.

## Files Most Likely To Change Next

- `src/csv.js`: schema headers, row values, CSV import/export.
- `src/soloSessionPayload.js`: defaults for new session/trial fields.
- `src/googleSheets.js`: optional/required header handling and upgrade UX integration.
- `src/googleSheetHistory.js`: historical/default reconstruction.
- `src/sessionModel.js`: canonical comments/constants if new enums are formalized.

## Manual Test Checklist

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
