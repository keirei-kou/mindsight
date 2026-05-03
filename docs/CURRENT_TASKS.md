# Current Tasks

Current actionable work for the next implementation pass. Completed work belongs in `ARCHIVED_TASKS.md`; future ideas belong in `ROADMAP.md`.

## Start Here Next

Pick one item under **Immediate Next Tasks** (recommended first: Google Sheets upgrade UX) or continue **Voice Provider Architecture** local model verification against `#voice-asr-test`. Runtime Shared Voice Engine work stays roadmap-only until explicitly scoped; architecture documentation is archived under **2026-05-03 Shared Voice Engine Architecture Documentation** in `ARCHIVED_TASKS.md`.

## Tester Feedback Priority - Calibration UX And Voice Providers

Goal:

- Make the session mode state clearer and reduce cognitive load during active use.
- Rename training language to calibration because this flow tunes/equalizes color perception before actual test data collection.
- Add a voice provider abstraction so command parsing can compare browser recognition against local and future audio-buffer transcription providers.

Current boundary:

- Shipped and archived: local ASR diagnostics slice (`ARCHIVED_TASKS.md`, 2026-04-30 Local ASR Provider Diagnostics).
- Paused: active session UI/mode changes in TrainingRoom/CalibrationRoom, instruction wording changes, mode speech behavior, Kokoro prompt wiring, and broader calibration/test phase flow changes.

### 1. Calibration/Test UX

Status: paused until the session UX pass is resumed. Keep the current test/calibration phase behavior unchanged in the next safe commit.

- Rename "Training Room" and "Training Mode" to "Calibration" throughout the session experience.
- Improve the existing top-left Test/Calibration mode indicator instead of introducing a separate banner unless the current structure cannot support it.
- When Calibration is active, show `Calibration` with optional subtext `Responses not recorded`.
- When Test is active, show `Test` with optional subtext `Responses recorded`.
- Make the active mode visually obvious with larger text, clearer contrast, better spacing, active tab styling, and increased small text size where needed.

Keyboard controls:

- Keep `A` / `D` for cycling colors/options.
- Keep `Space` for confirm.
- Keep `Ctrl` for toggling Calibration/Test.
- Keep `Shift` for repeating current instructions.
- Remove or de-emphasize `Enter` when redundant.
- Remove or de-emphasize `S` if it only repeats the current color.
- Most users should only need `A` / `D` / `Space`, with `Ctrl` and `Shift` available when needed.

Spoken instructions:

- On entering Calibration, speak once: "Calibration. Use A or D to cycle through the colors. Responses are not recorded."
- On entering Test, speak once: "Test mode. Responses are recorded."
- Do not loop room or mode announcements.
- `Shift` replays the current mode instructions once.
- Add a simple option to disable spoken instructions if practical.
- Separate minimal room announcement from full spoken instructions where practical.
- Do not overbuild the settings UI.

Acceptance criteria:

- Session UI uses Calibration/Test terminology consistently.
- Existing top-left mode/tabs clearly communicate the active mode and whether responses are recorded.
- Keyboard help emphasizes `A`, `D`, and `Space`, with `Ctrl` and `Shift` secondary.
- Enter and S are no longer presented as primary controls when redundant.
- Mode-entry speech fires once per mode entry and does not loop.
- Shift repeats the current mode instructions once.
- Spoken instructions can be disabled with a simple control if practical within this pass.

### 2. Voice Provider Architecture

Status: provider infrastructure and diagnostics are implemented; remaining work is manual model-asset setup and head-to-head recognition testing.

- Create a shared voice provider interface so session logic does not care which recognition provider is active.
- Keep the current browser `SpeechRecognition` implementation as the first provider behind that interface.
- Preserve the existing speech command parser/matcher as the shared command interpretation layer.
- Prioritize open-source offline ASR comparison between Vosk Local and Sherpa ONNX Local for short command reliability.
- Keep Whisper API as a paid/cloud comparison provider, not the primary path.

Suggested provider interface:

```js
voiceProvider.start();
voiceProvider.stop();
voiceProvider.onResult(callback);
voiceProvider.onError(callback);
voiceProvider.isAvailable();
voiceProvider.cleanup();
voiceProvider.providerName;
```

Target commands:

- `red`
- `blue`
- `A`
- `D`
- `space`
- `submit`
- `calibration`
- `test`
- `results`

Dropdown providers:

- `Browser Speech`
- `Vosk Local`
- `Sherpa ONNX Local`
- `Whisper API`
- `Whisper Local`
- `Voice Off`

Provider goals:

- `browserSpeechProvider`: wraps Web Speech API / `SpeechRecognition` and preserves current behavior.
- `voskLocalProvider`: offline browser ASR through `vosk-browser`, optimized for short commands with grammar/constrained vocabulary.
- `sherpaOnnxLocalProvider`: offline browser/local ASR through the official sherpa-onnx WebAssembly ASR bundle, preferably streaming, optimized as the higher-quality local contender versus Vosk.
- `whisperApiProvider` later: Browser mic -> Web Audio API / MediaRecorder -> rolling pre-buffer -> captured audio clip -> `/api/transcribe` -> Whisper API -> transcript -> shared command parser.
- `whisperLocalProvider` later: local/desktop Whisper path, disabled or labeled coming soon until implemented.
- `voiceOffProvider`: disables voice recognition without affecting keyboard controls.
- Session components consume provider results through the shared interface instead of directly depending on browser recognition.
- Provider selection can remain simple at first; no elaborate settings screen is required.
- Do not include Picovoice/Rhino/Cheetah as target providers in the open-source-first plan.

Prebuffer requirements:

- Add a reusable rolling Web Audio prebuffer in `src/lib`.
- Use the same prebuffer system for Vosk Local, Sherpa ONNX Local, Whisper API, and Whisper Local where possible.
- Browser Speech remains a no-prebuffer baseline because Web Speech does not expose raw mic audio.

Testing/debug readout:

- Add or preserve lightweight debug visibility for selected provider, listening status, raw transcript, normalized command, latency ms, confidence if available, and provider errors.
- Keep debug plumbing out of a large `TrainingRoom.jsx` blob; provider-specific code belongs in `src/lib`.

Acceptance criteria:

- Session logic is decoupled from the concrete browser speech recognizer.
- Current voice commands still work through the browser provider when supported.
- Provider name/support/error state can be surfaced for debugging and selection.
- Vosk Local and Sherpa ONNX Local are selectable providers behind the shared interface; local model assets/configuration are required before they can recognize commands in a browser session.
- The architecture leaves a clear insertion point for rolling pre-buffer audio clips and API/local Whisper transcription.

Implemented checkpoint:

- See `ARCHIVED_TASKS.md` (2026-04-30 Local ASR Provider Diagnostics) for file list and scope boundary.

Next local ASR verification tasks:

- Place a Vosk model archive at `public/models/vosk/model.tar.gz` or set `VITE_VOSK_MODEL_URL`.
- Place Sherpa browser ASR assets under `public/models/sherpa-onnx/` or set `VITE_SHERPA_ONNX_ASSET_BASE_URL`.
- Use `#voice-asr-test` to compare Browser Speech, Vosk Local, and Sherpa ONNX Local on `red`, `blue`, `press A`, `press D`, `space`, `submit`, `calibration`, `test`, and `results`.
- Record model load failures, latency, raw transcripts, normalized command matches, and short-command accuracy.
- Keep this testing isolated from active session phase UX until the session UX pass is explicitly resumed.

### 3. Implementation Order

1. Provide local model assets and compare Vosk Local vs Sherpa ONNX Local for short command recognition.
2. Decide whether Vosk/Sherpa should stay dev-only, be env-gated, or ship as lazy-loaded production options.
3. Resume the Calibration/Test UX pass when the session UX workstream is reopened (after keeping ASR diagnostics commits separate from that pass).

## ASR Arbitration Layer

Current boundary: Phases 1-4 and Phase 3.5 of the ASR arbitration plan are complete and archived in `ARCHIVED_TASKS.md`. Phases 5 and 6 are the remaining work; keep Phase 5 lab-only and defer TrainingRoom integration to Phase 6.

Status per phase:

- Phase 1: complete.
- Phase 2: complete.
- Phase 3: complete.
- Phase 3.5: complete (Corpus Recording Workflow).
- Phase 4: complete.
- Phase 5: pending.
- Phase 6: pending.

What was implemented:

- Sidecar arbitration core (`local_speech_engine/asr/arbitration_types.py`, `arbitrator.py`, `normalization.py`, `vocabulary.py`) with sequential same-WAV arbitration over `vosk` + `sherpa`, decision ordering `agreement_count -> command_validity -> average_similarity -> average_confidence -> provider_priority`, and structured provider failures.
- Lab UI exposure in `#voice-asr-test`: `arbitrateSegment` / `arbitrateLatestSegment` in `src/lib/localVadClient.js`, mode + provider controls and per-provider breakdown table in `src/components/LocalVadPanel.jsx`, and `asr_arbitration_*` events from `local_speech_engine/server.py`.
- Audio corpus scaffolding under `local_speech_engine/audio_corpus/` with session-style and legacy `labels.json`, plus a benchmark harness at `local_speech_engine/scripts/benchmark_arbitration.py` writing CSV + JSON to `local_speech_engine/benchmark_results/`.
- Phase 3.5 corpus recording workflow in `#voice-asr-test`: pre-labeled recording context, per-segment save/delete/ignore actions, session-based corpus writing through `labels.<session_id>.json`, and a clearer lab UX flow from connect/start VAD to label, record, review, delete noise, and save good clips.
- Five pluggable policies in `local_speech_engine/asr/policies.py` (`hybrid_default`, `agreement_first`, `command_validity_first`, `confidence_weighted`, `provider_priority`), wired through `AsrArbiter` (`policy_name`, `policy_scores`) and the benchmark `--policies` flag. Default remains `hybrid_default`.

What remains:

### Phase 5 - Arbitration policy UI control

Status: not implemented. The sidecar already accepts `policy` over the WebSocket (`local_speech_engine/server.py` line 738), but the lab UI does not surface it.

Goal:

- Allow selecting an arbitration policy in `#voice-asr-test` and surface the resulting `policy_name` / `policy_scores`.

Scope:

- Extend `arbitrateSegment` and `arbitrateLatestSegment` in `src/lib/localVadClient.js` to forward a `policy` argument through the existing `arbitrate_segment` / `arbitrate_latest_segment` commands.
- Add a policy selector to the ASR Arbitration block in `src/components/LocalVadPanel.jsx` (alongside the current `Mode` selector) using `available_policy_names()` from the sidecar (`hybrid_default`, `agreement_first`, `command_validity_first`, `confidence_weighted`, `provider_priority`).
- Pass the selected policy from `runArbitration` into the client, both for latest-segment and selected-segment runs.
- Display the resolved `policy_name` and key `policy_scores` (for example winning key, score order, fallback metadata) in the arbitration result panel.

Constraints:

- Do not modify `TrainingRoom`.
- Keep this UI lab-only (`#voice-asr-test`).
- Do not add Whisper.
- Do not include Browser Speech in arbitration.
- Default policy remains `hybrid_default` when nothing is selected.

Acceptance criteria:

- The lab UI exposes all five policies returned by `available_policy_names()`.
- Selecting a policy and arbitrating a segment forwards the policy through the client and sidecar so `asr_arbitration_result.policy_name` matches the selection.
- `policy_name` and `policy_scores` are visible in the arbitration result panel for the selected segment.
- TrainingRoom session flow and keyboard controls are unchanged.

Verification:

- `npm run build`
- `python -m unittest discover local_speech_engine/tests`

### Phase 6 - TrainingRoom arbitration integration

Status: not implemented. `src/pages/TrainingRoom.jsx` only consumes `asr_transcript` / `asr_transcript_error` events today and never references `asr_arbitration_result`.

Goal:

- Use arbitration as the real command input in TrainingRoom while keeping existing UX intact.

Scope:

- Replace command-input usage of `asr_transcript` events with `asr_arbitration_result` in `src/pages/TrainingRoom.jsx`, sourcing the recognized command from `final_command` (with `final_text` as fallback) emitted by the local VAD sidecar.
- Define fallback behavior: ignore arbitration results that produce no valid command, with optional retry behavior; keep existing `asr_transcript`-driven voice-note handling untouched if not relevant to command input.
- Maintain a clean UX with no major redesign and no confusing intermediate states.
- Optionally log `decision_reason` and provider disagreement information (e.g. through the existing voice debug console) without leaking arbitration internals into the main session UI.

Constraints:

- Do not break the existing solo session flow.
- Keep keyboard controls (`A`, `D`, `Space`, `Ctrl`, `Shift`) unaffected.
- No major UI redesign.
- Do not include Browser Speech in arbitration; arbitration uses only sidecar providers.

Acceptance criteria:

- TrainingRoom commands are detected through `asr_arbitration_result` rather than raw `asr_transcript` events.
- Invalid or empty arbitration results are ignored without breaking the trial loop; optional retry path documented and reachable.
- No regression in solo gameplay: trial advance, repeat-until-correct, oneShot, and keyboard controls behave as before.
- Debug surfaces (e.g. voice debug console) can show `decision_reason` and provider disagreement when present.

Verification:

- Manual TrainingRoom test against the local VAD sidecar with `vosk` + `sherpa` providers.
- `python -m unittest discover local_speech_engine/tests` to confirm no sidecar regressions.

## Optional Cloud Layer Follow-Up

Continue optional cloud wiring without changing Google Sheets or CSV archive behavior.

Completed milestone:

- Supabase session-summary first pass is archived (`ARCHIVED_TASKS.md`, 2026-05-03 Supabase Session Summary First Pass).

Next implementation target:

- Decide where, if anywhere, to call `saveSessionSummary()` in the UI flow.
- If wired, keep it optional and status-only. Do not block CSV export, Google Sheets append, or local-only sessions.
- Consider adding a tiny cloud status line only after the existing Google Sheets save path remains unchanged.

## Data Contract / Sheets Safety

Double-check import, export, and append paths before larger roadmap work.

Completed milestone:

- Automated harness: `npm run verify:data-contract` (`ARCHIVED_TASKS.md`, 2026-05-03 Local Data Contract Verification Harness).

Invariant reminders:

- CSV solo export uses the canonical dot v1 header order from `PSILABS_DOT_V1_HEADERS`.
- New Google Sheets exports use the same canonical dot v1 header order.
- Existing non-empty Google Sheets append by matching the live header row, so manually reordered columns should not corrupt future appends.
- CSV solo import accepts legacy v0 and dot v1 fields through the schema registry.
- Google Sheets history rebuild reads dot v1 fields with legacy fallback/backfill.

Next implementation target:

- Add the visible `Standardize Sheet Layout` confirmation/progress UX using `getTrialsSheetSchemaStatus()` and `standardizeTrialsSheetLayout()`.
- Show whether the sheet is already preferred dot v1 order, reordered but safe, legacy but safe, upgradeable, or blocked by missing required columns, unknown columns, blank header cells, duplicate field columns, or non-Mindsight protocol rows.

Important caution:

- History loading is now non-mutating: `readTrialsSheetRows()` reads recognized live headers and value rows without calling the physical migration path. Physical rewrite should stay behind explicit user confirmation.

## Google Sheets Schema Direction

Core principle:

- Separate logical schema compatibility from physical sheet layout.
- Normal read/append behavior cares whether the sheet is readable and append-safe by recognized headers, not whether the physical columns are in canonical dot-v1 order.

Default behavior:

- Read existing sheets without mutation.
- Recognize legacy Mindsight headers through aliases in the schema registry.
- Normalize and backfill in memory only.
- Append rows by matching the live header row names.
- Do not physically reorder columns during read/history/append.
- Do not prompt merely because columns are manually reordered.

Policy:

- Reordered canonical columns are user customization and remain append-safe.
- Prompt only for explicit optional actions such as `Standardize Sheet Layout`.
- Standardization may physically reorder/normalize the sheet into canonical PsiLabs dot-v1 column order while preserving recognized data.
- Block when safety is uncertain: blank header cells within the used header range, unknown headers, missing required recognized columns, duplicate recognized field columns, or non-Mindsight protocol rows during a Mindsight-only physical migration.

Recent UI clarification:

- Solo current run: `Download This Session`
- Solo selected Google history user: `Download Selected User History`
- Group all participants: `Download All Users Data`
- Group participant: `Download {participant.name}`

Future UI follow-up:

- Once all-users-across-Google-history export exists for solo history, add a separate `Download All Users History` button so it is distinct from selected-user and this-session exports.

## Project State

Solo-mode foundations are mostly in place:

- Canonical session/model helpers: `src/lib/sessionModel.js`
- Deck generation: `src/lib/deck.js`
- Analytics math: `src/lib/sessionAnalytics.js`
- Solo payload shaping: `src/lib/soloSessionPayload.js`
- Solo schema mapping: `src/lib/schemaRegistry.js`
- CSV row shape and dot-style exports: `src/lib/csv.js`
- Google Sheets append/read behavior: `src/lib/googleSheets.js`
- Historical Google Sheets rebuild/backfill behavior: `src/lib/googleSheetHistory.js`
- Local real-time session persistence: `src/lib/localSessionStore.js`
- Local data-contract verification: `scripts/verify-data-contract.mjs`

Recently completed work lives in `ARCHIVED_TASKS.md` (including 2026-04-30 local ASR diagnostics, 2026-05-03 Shared Voice Engine architecture documentation, Supabase session-summary first pass, and local data-contract verification harness).

## Shared Session MVP

Goal:

- Build the minimal realtime shared-session layer without duplicating solo-mode protocol logic.
- Treat Shared Session as Solo Engine + Realtime Room Wrapper.
- Keep the app local-first: solo sessions and local shared-code sessions must still work without Supabase.

Current repository shape:

- Solo training flows through `Setup`, `TrainingRoom`, `SoloResults`, and `buildSoloSessionPayload()`.
- Shared training currently uses `sharedSessionPayload` and deterministic deck restoration through a legacy share code.
- Group tracker has participant rows and per-participant analytics, but its CSV shape is separate from dot-v1.
- Supabase is currently optional through `src/lib/supabase.js` and is not required for local use.

Data separation:

- Supabase stores temporary operational state for realtime coordination only: room/session status, participant presence, current trial index, trial targets, and submitted responses.
- CSV and Google Sheets remain the durable archive and must use participant-centric dot-v1-compatible rows.
- Do not leak Supabase operational fields into CSV unless the field is analytically meaningful.
- Do not compute or store group-averaged scores for the MVP.

Reuse requirements:

- Reuse `sessionModel` for session modes, policies, IDs, and metadata.
- Reuse `sessionAnalytics` for trial records and participant analytics.
- Reuse `soloSessionPayload` as the target shape for each participant's shared-session results.
- Reuse `csv` and `schemaRegistry` so participant exports follow dot-v1 behavior.
- Reuse existing deck/session setup behavior where possible; do not create a second protocol engine.

MVP data model direction:

- Leader is also a participant with `participant.role = leader`.
- Participants join live rooms by `session.room_code`.
- Reproducible trial/deck setup uses `session.deck_code`.
- Treat existing `session.share_code` as a legacy deck/replay code for backward compatibility; do not overload it as the live room join code.
- Shared session state advances by `session.current_trial_index`.
- Session lifecycle uses `session.status`, such as lobby, active, completed, or expired.
- Temporary room records include `session.expires_at`.
- Participant presence can use `participant.color`, `participant.joined_at`, and `participant.last_seen_at`.
- Responses include `response.participant_id` and `response.submitted_at`.
- Most MVP operational fields remain Supabase-only and are not exported to CSV.

Deck code vs room code:

- `deck_code` answers: "What trial sequence/config are we using?"
- `room_code` answers: "Which live room are we joining?"
- A live room may be created from a `deck_code`.
- A `deck_code` can exist without a live room.
- A `room_code` should usually expire with the shared session.
- A `deck_code` may remain reusable for replay or reproducibility.

Example shared-session flow:

1. App creates or reuses a `deck_code` for the trial sequence/config.
2. App creates a new temporary Supabase shared session row.
3. App generates a `room_code` for joining that live room.
4. Participants join using `room_code`.
5. All clients sync through the shared session row.
6. After completion, participant CSV exports are generated from temporary response data.
7. Temporary room data can expire or be deleted.
8. `deck_code` may remain available if replay/reproducibility is desired.

Implementation phases:

1. Plan the shared room contracts.
2. Add Supabase schema for temporary shared rooms.
3. Add create/join/lobby UI.
4. Add realtime participant and trial synchronization.
5. Add participant response submission.
6. Add basic leader dashboard.
7. Build per-participant results.
8. Add per-participant CSV export through dot-v1-compatible solo payloads.

### 1. Shared Session Creation Flow

- Add a leader flow that creates a Supabase-backed room from the existing setup/deck configuration.
- Create or reuse a `session.deck_code` for the reproducible trial sequence/config.
- Generate a separate `session.room_code` for joining the live room.
- Store only temporary room setup data needed for realtime coordination.
- Make clear in UI that Supabase is required only for realtime shared sessions, not solo/local usage.

Acceptance criteria:

- A leader can create a shared room from the existing setup screen.
- The generated room includes the same category, active options, guess policy, deck policy, and deck order used by the solo engine.
- The leader is inserted as a participant.
- The room exposes a `room_code` for live joining and preserves `deck_code` separately for replay/reproducibility.
- If Supabase is not configured, local solo/shared-code behavior still works.

### 2. Join Via Room Code

- Add a join path that looks up a temporary shared room by `session.room_code`.
- Create a participant record for the joining user.
- Restore the protocol setup and deck from the room instead of recomputing it client-side.

Acceptance criteria:

- A participant can enter a `room_code` and join the correct live room.
- Unknown, expired, or completed rooms show clear errors.
- Joining does not require Google Sheets.
- `deck_code` is not accepted as a live room join code unless a future UX explicitly creates a new room from it.

### 3. Lobby System

- Add a lobby before the first trial starts.
- Show session setup, participant name, participant role, and readiness/presence status.
- Let the leader start the session.

Acceptance criteria:

- Leader and participants see the same lobby membership.
- The leader can start the session.
- Non-leaders cannot start or advance the session.

### 4. Realtime Participant List

- Subscribe to participant changes for the active room.
- Update joined/left/last-seen state without refreshing.
- Keep participant metadata minimal and temporary.

Acceptance criteria:

- Participant list updates in realtime for leader and participants.
- Leader is visibly included as a participant.
- Disconnected participants can be shown without corrupting submitted responses.

### 5. Trial Synchronization

- Drive all clients from `session.current_trial_index`.
- Leader advances the shared session; participants follow the current index.
- Trial targets come from the room deck and are consistent for every participant.

Acceptance criteria:

- Every participant sees the same trial index.
- Participants cannot submit against a different trial index than the room's current one.
- The app can recover current index and submitted responses after refresh while the room exists.

### 6. Response Submission

- Allow every participant, including the leader, to submit guesses for each trial.
- Store responses temporarily in Supabase with participant ID, trial index, guess sequence, timing, and submitted timestamp.
- Preserve guess-policy behavior from the solo engine.

Acceptance criteria:

- One participant's response does not overwrite another participant's response.
- Repeat-until-correct and one-shot modes follow existing solo behavior.
- Responses remain scoped to the shared room and can be deleted with the room.

### 7. Basic Leader Dashboard

- Show leader controls for session status, current trial, participant completion, and advance/end actions.
- Keep dashboard metrics operational only for facilitation.
- Keep deferred shared-session extensions out of the MVP.

Acceptance criteria:

- Leader can see who has submitted for the current trial.
- Leader can advance only when the current trial is ready or intentionally ended.
- Leader can end the session and move everyone to results.

### 8. Per-Participant Results

- Derive a solo-compatible dataset for each participant from the shared room's trials and responses.
- Use existing analytics helpers for participant-level summary cards and charts.
- Do not compute or store group-averaged scores.

Acceptance criteria:

- Each participant sees their own results.
- Leader can inspect participant completion state, but the durable export remains participant-centric.
- Results preserve `session.mode = shared` and shared session identity where analytically useful.

### 9. CSV Export Per Participant

- Build exports through `buildSoloSessionPayload()` or a shared wrapper that returns the same shape.
- Export dot-v1-compatible rows through the existing CSV/schema registry path.
- Keep operational room fields out of CSV unless mapped to existing analytical fields such as `session.deck_code`, `session.mode`, `participant.name`, `trial.index`, `response.attempt_sequence`, and `response.submitted_at`.
- Treat `session.room_code` as operational and temporary by default; include it in durable exports only if later analysis proves it useful.

Acceptance criteria:

- Each participant can download their own CSV.
- CSV headers match the dot-v1 solo export system.
- Google Sheets append remains compatible with dot-v1.
- No group rollup columns or temporary Supabase room-management fields appear in participant CSV.

### 10. Supabase Temporary Sync

- Add temporary shared-session tables or equivalent records for rooms, participants, trials, and responses.
- Use RLS as the primary security layer.
- Keep shared-session rows deletable after completion or expiration.
- Do not treat Supabase as the permanent archive.

Acceptance criteria:

- Supabase stores only realtime coordination data needed for the active shared session.
- RLS prevents arbitrary writes across rooms.
- Room data can expire or be deleted without affecting CSV/Sheets archives.
- Local solo usage remains fully functional without Supabase.

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
- Include new dot v1 sheets, manually reordered dot v1 sheets, and recognized Mindsight v0/mixed sheets.
- Confirm history rebuild and backfill behavior.

Acceptance criteria:

- New sheet initializes with the approved canonical dot v1 header order.
- Existing recognized v0/mixed sheet reads as expected.
- Append writes by matching the live header row, not by assuming physical column position.
- Manual column reordering in Google Sheets does not corrupt future appends.
- History load succeeds.
- Estimated timing and time-of-day fields backfill for historical rows.

### 3. Manual Solo Mode Testing

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
- Google Sheets append succeeds against canonical-order and manually reordered sheets.
- Google Sheets history load succeeds.
- Historical rows backfill estimated trial timestamps and time-of-day.

### 4. Multi-Run And Exit Protection Foundation

- Build on the IndexedDB real-time trial persistence layer for richer recovery/exit protection.
- Add exit protection for in-progress solo test phase.
- Introduce a `savedRuns` session structure when ready.
- Support redo/new run appending under one broader session.

Acceptance criteria:

- In-progress data is protected before leaving the test phase, using local persisted trial data where possible.
- Multiple completed trial blocks can be represented under one session.
- Results/export logic can distinguish latest run from all saved runs.

## Files Most Likely To Change Next

- `src/lib/csv.js`: schema headers, row values, CSV import/export.
- `src/lib/soloSessionPayload.js`: defaults for new session/trial fields.
- `src/lib/googleSheets.js`: optional/required header handling and upgrade UX integration.
- `src/lib/googleSheetHistory.js`: historical/default reconstruction.
- `src/lib/sessionModel.js`: canonical comments/constants if new enums are formalized.

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
