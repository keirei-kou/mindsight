# Roadmap

Future product and architecture ideas from the handoff, separated from current implementation tasks.

## Infrastructure And Execution Model

PsiLabs should grow infrastructure in phases while preserving the current local-first architecture. The frontend remains Vite + React, Google Sheets and CSV remain the durable full archive, and Supabase remains a lightweight cloud summary layer for auth, permissions, session summaries, scoreboards, and other cloud UX where useful.

### Current Framework Checkpoint

Do not migrate PsiLabs to Next.js yet. Continue with Vite + React on Vercel until server-backed framework features become active requirements. Use Supabase for realtime/database needs, and keep app logic portable in `src/lib`, `src/hooks`, and `src/components`.

Use Vite while discovering the engine. Consider Next.js when PsiLabs becomes a platform.

Re-evaluate Next.js when one or more of these become central implementation targets:

- Public protocol library.
- User accounts/auth.
- Server-rendered pages.
- SEO/indexable content.
- API routes tightly coupled to the app.
- Community/social features.
- Multi-page documentation/product site.
- Hosted web app becomes a major primary surface.
- Backend API routes inside the app.
- Server-mediated shared room links.
- Server-side short link generation.
- Server-side secrets or protected RNG / QRNG provider credentials.
- Auth-heavy private dashboards or auth as a core user experience.
- Stripe subscriptions or webhook handling.
- AI, speech-to-text, audio, video, or OpenCV processing through external APIs.
- Public SEO-heavy protocol, result, research, or docs pages.
- Dynamic share/result pages that need server-rendered metadata.

### Phase 1 - Local-First Protocol Engine

- Vite + React frontend.
- Supabase is optional and stores session summaries only.
- IndexedDB stores in-progress solo sessions and completed trial records locally as trials finish.
- Google Sheets + CSV are the primary archive for full trial history.
- Row Level Security is the primary security layer for Supabase data.
- No backend server is required for core local usage.

### Phase 2 - Controlled Cloud Logic

- Introduce Supabase Edge Functions or serverless functions only where client-side execution is not appropriate.
- Use cloud functions for secure validation, aggregation jobs, and RNG providers.
- Keep RNG providers server-side only when they require protected credentials or security-sensitive logic.
- Cloud logic remains optional and must not block local usage.

### Phase 3 - Intelligence Layer

- Introduce AI-assisted processing such as speech-to-text, structured analysis, or review workflows.
- Use server-side execution for external API calls and protected logic.
- Keep vendor choices abstract until a concrete implementation is required.
- Preserve local-first capture and archive paths even when intelligence features are unavailable.

### Phase 4 - Unified App Layer (Optional)

- Introduce a framework like Next.js only if the app needs a unified frontend and server logic layer.
- Do not combine a Next.js migration with Shared Voice Engine discovery, VAD/ASR integration, or Tauri sidecar integration.
- Deploy the unified app layer on Vercel.
- Keep Supabase as the data layer rather than replacing it.
- Preserve compatibility with existing schema fields, Google Sheets archives, and CSV exports.

### Design Principles

- Local-first by default.
- Supabase is not the permanent archive.
- Backend logic is introduced only when required.
- Avoid premature infrastructure complexity.
- Preserve compatibility with the existing schema and Sheets archive.

### Local-First Architecture & Storage Mode Detection

PsiLabs should support both lightweight web users and heavier desktop instrumentation users through a shared app model with environment-aware storage behavior.

Storage mode detection:

- Detect whether the app is running in a browser or desktop shell, such as a Windows app exposing `window.__PSILABS_DESKTOP__`.
- Set a shared `storageMode` value of `web` or `desktop`.
- Use `storageMode` to select storage, sync, backup prompts, and feature availability across the app.

Web-only mode:

- Default storage: IndexedDB and browser storage for in-progress session recovery, local history, preferences, and offline queues.
- Completed solo trials are appended to IndexedDB immediately after trial finalization; React state remains the active UI layer.
- Recommended persistence: Google Sheets sync for user-owned backup and cross-device access.
- Optional future persistence: Supabase or cloud account sync for dashboards, scoreboards, and shared sessions.
- UX should encourage users to connect Google Sheets or export data when they want durable backup outside the browser.

Desktop mode:

- Default storage: a local user directory using SQLite, CSV, or both.
- Save all sessions locally first, with offline-first behavior as the baseline.
- Optional sync can upload session summaries to a cloud/web dashboard without making cloud storage the raw-data authority.
- UX should emphasize user ownership of raw data, local control, and clear file locations.

Sync strategy:

- Write locally first in all modes, especially desktop.
- Sync periodically or at the end of sessions instead of treating the cloud as the primary write path.
- Support sync tiers: local only, summary sync, full private sync later, and public stats sharing later.
- Keep failed sync recoverable through retry queues and clear "pending sync" states.

Architectural intent:

- Web app: access layer for lightweight use, dashboards, sharing, social flows, and cross-device review.
- Desktop app: instrumentation layer for Whisper, OpenCV, sensor workflows, raw data capture, and heavier local processing.
- Avoid forcing heavy processing, large video/audio data, or sensitive raw experimental artifacts through the browser when a desktop path is more appropriate.

Future extensions:

- Local Whisper processing in desktop mode only.
- OpenCV and sensor-based experiments.
- Multi-device sync between desktop and web.
- User-selectable data privacy levels for local-only, private sync, and public sharing workflows.

## Product North Star

PsiLabs is a flexible experiment engine for structured, repeatable protocols around unusual human claims.

Mindsight is the first supported protocol module. The broader direction includes anomalous perception, precognition, telepathy, REG/micro-PK, remote viewing, biofield/energy tracking, and future physical measurement protocols.

Future protocols should be able to reuse the same backbone:

- Precognition forced-choice
- REG / micro-PK binary line
- Async telepathy
- Remote viewing
- Energy/biofield tracking
- Telekinesis / macro-PK measurement

## Mindsight Session UX And Voice Roadmap

Tester feedback shows the active session experience needs clearer mode semantics and a more reliable voice-input architecture before expanding larger cloud features.

### Calibration And Test Mode Language

Training should be renamed to Calibration throughout the Mindsight session UI.

Intent:

- Calibration is used to tune/equalize color perception before actual testing.
- Calibration responses are not recorded as test data.
- Test responses are recorded.
- The UI should avoid casual-practice language that makes calibration feel like unstructured rehearsal.

Top-left mode display:

- Reuse and improve the existing top-left Test/Training tab or room indicator.
- Do not add a separate banner unless the existing mode area cannot carry the required information.
- Active Calibration display should read `Calibration`, with optional subtext `Responses not recorded`.
- Active Test display should read `Test`, with optional subtext `Responses recorded`.
- Increase mode text size, contrast, spacing, active-state styling, and small text size where needed.

Keyboard direction:

- Primary controls should be `A` / `D` to cycle and `Space` to confirm.
- Secondary controls should be `Ctrl` to toggle Calibration/Test and `Shift` to repeat current instructions.
- `Enter` should be removed or de-emphasized where it duplicates `Space`.
- `S` should be removed or de-emphasized if it only repeats the current color.

Spoken instruction direction:

- Entering Calibration should speak once: "Calibration. Use A or D to cycle through the colors. Responses are not recorded."
- Entering Test should speak once: "Test mode. Responses are recorded."
- Announcements must not loop.
- `Shift` should replay the current mode instructions once.
- A small spoken-instructions toggle is desirable if practical.
- Separate minimal room announcements from full spoken instructions where practical.

### Voice Provider Architecture

The current browser SpeechRecognition path can miss short leading words such as `red`, `blue`, `one`, `two`, and `six`. PsiLabs needs a provider abstraction so recognition paths can be swapped or compared without changing session command logic.

Diagnostics milestone shipped and archived (`docs/ARCHIVED_TASKS.md`, 2026-04-30 Local ASR Provider Diagnostics): shared selector, Vosk Local, Sherpa ONNX Local, prebuffer utilities, `#voice-asr-test`, and `docs/VOICE_ASR_LOCAL_MODELS.md`.

Current checkpoint:

- Browser Speech remains the baseline provider.
- Vosk Local is implemented through `vosk-browser` and lazy-loads its runtime when selected.
- Sherpa ONNX Local is implemented against the official browser WebAssembly ASR asset bundle.
- A standalone voice ASR diagnostic route exists at `#voice-asr-test`.
- Local model setup is documented in `docs/VOICE_ASR_LOCAL_MODELS.md`.
- These diagnostics are intentionally separable from the active TrainingRoom/CalibrationRoom UX changes.

Shared provider interface target:

```js
voiceProvider.start();
voiceProvider.stop();
voiceProvider.onResult(callback);
voiceProvider.onError(callback);
voiceProvider.isAvailable();
voiceProvider.cleanup();
voiceProvider.providerName;
```

Architecture direction:

- Session logic should consume a provider interface, not a concrete browser recognizer.
- Command interpretation should continue through the shared speech matcher/parser.
- Browser SpeechRecognition should become the first provider implementation.
- Provider support, errors, and active provider name should be easy to inspect.
- Open-source offline ASR should be tested before treating paid APIs as the default path.
- Do not target Picovoice/Rhino/Cheetah in the open-source-first provider plan.

Provider comparison targets:

- Browser Speech: existing Web Speech baseline, no raw-audio prebuffer.
- Vosk Local: offline browser ASR via `vosk-browser` WASM/WebWorker, optimized for short commands and constrained vocabulary.
- Sherpa ONNX Local: offline browser/local ASR using the official sherpa-onnx WebAssembly ASR bundle, preferably streaming, treated as the higher-quality open-source contender versus Vosk.
- Whisper API: paid/cloud comparison provider using captured audio clips and server-side credentials.
- Whisper Local: future desktop/local model provider, disabled or labeled coming soon until implemented.
- Voice Off: disables recognition while leaving keyboard controls intact.

Target command vocabulary:

- `red`
- `blue`
- `A`
- `D`
- `space`
- `submit`
- `calibration`
- `test`
- `results`

Shared prebuffer path:

```text
Browser mic
-> Web Audio API / MediaRecorder
-> rolling pre-buffer
-> captured audio clip
-> local ASR provider or /api/transcribe
-> transcript
-> shared command parser
```

Implementation notes:

- Start with an interface plus browser provider wrapper.
- Keep provider selection simple while making local providers visible for testing.
- Vosk Local expects a Vosk model archive at `public/models/vosk/model.tar.gz` or `VITE_VOSK_MODEL_URL`.
- Sherpa ONNX Local expects built WebAssembly ASR assets under `public/models/sherpa-onnx/` or `VITE_SHERPA_ONNX_ASSET_BASE_URL`.
- Add rolling pre-buffer capture before local/API transcription so direct one-word commands are not clipped at speech start.
- Use the same prebuffer utility for Vosk Local, Sherpa ONNX Local, Whisper API, and Whisper Local where possible.
- Add lightweight debug visibility for selected provider, listening status, raw transcript, normalized command, latency, confidence, and provider errors.
- Server-side Whisper API transcription requires an API route or function with protected credentials; this is one of the triggers for re-evaluating the app's server-backed architecture needs.
- Keep speech detection, scored test attempts, and automatic submission as separate layers. Detection alone should not imply that a response is scored or submitted.
- Future Test/Calibration voice UX should expose voice input mode options: Off, Hold to speak, Arm next attempt, and Continuous listening. Test mode should default to Hold to speak because false positives are costly; Calibration can tolerate Continuous listening more readily because it changes selection state rather than final test data.
- Future voice submission behavior should be separately configurable as Select only or Select + submit.

Open decisions:

- Whether local ASR providers should remain dev/test-only behind `VITE_ENABLE_LOCAL_ASR`.
- Whether Vosk's large lazy chunk is acceptable for production deployments.
- Whether Sherpa full ASR is worth its model/runtime footprint, or whether a Sherpa keyword-spotting path is a better long-term open-source local option.
- How, if at all, the diagnostic provider selector should later integrate into active session UX.

### Voice Engine Lab Batch Roadmap

Future Voice Engine Lab UI upgrades are tracked in `local_speech_engine/docs/voice_engine_lab_ui_roadmap.md`. The intended order is corpus collection, Load All Providers, script-stable batch arbitration, then a Corpus Benchmark UI panel. TrainingRoom integration remains out of scope for this lab roadmap.

### Speech Calibration And Personal Command Lexicon

PsiLabs should add a local-first speech normalization layer so users can teach the app how their own speech maps to intended commands, participant names, and session actions. This belongs after the current ASR provider, arbitration, and corpus benchmarking foundations are stable. It is a roadmap item only; do not implement storage, UI, or command-routing changes until explicitly scoped.

MVP principle:

- Local calibration must work without login.
- Auth remains optional and should unlock sync or migration features later, not basic speech calibration.
- User-confirmed mappings are personal/local by default.
- The system should avoid global auto-promotion of aliases or participant names.
- Calibration should improve command interpretation without silently changing scored test behavior.

Roadmap items:

1. Personal local command lexicon: store user-reviewed transcript aliases that map phrases or ASR confusions to intended commands such as colors, shapes, numbers, navigation, and submission actions.
2. Session participant-name aliases: allow per-session or per-profile aliases for participant names, including common ASR variants, without adding those aliases to a global namespace automatically.
3. Calibration debug/chat popup for recent transcripts: provide a lightweight review surface that shows recent raw transcripts, normalized candidates, provider/arbitration context, and unresolved phrases.
4. Transcript assignment flow: let the user classify a transcript as a command, participant, action, or `NO_COMMAND`, with explicit review before the mapping affects future interpretation.
5. Guest mode local storage: persist speech profile data locally for users who are not logged in, using browser or desktop local storage appropriate to the current storage mode.
6. Export/import speech profile JSON: support portable backup and transfer of personal lexicon entries, participant aliases, review decisions, timestamps, and profile metadata.
7. Future account sync/private cloud storage: optional account-backed sync can store a private speech profile for cross-device use, but must not be required for calibration.
8. Guest-to-account migration flow: let a guest claim or merge their local speech profile into an account later, with conflict review instead of overwriting silently.
9. Future global candidate pool with safeguards: consider a reviewed, privacy-aware candidate pool only after local profiles are working; candidates should require review, frequency thresholds, and safeguards against rare, personal, or sensitive aliases.

Suggested profile shape, subject to later design:

```json
{
  "profileVersion": 1,
  "scope": "local",
  "commands": [],
  "participantAliases": [],
  "ignoredTranscripts": [],
  "reviewedAt": "ISO timestamp"
}
```

Non-goals for the MVP:

- Requiring a user account.
- Syncing speech profiles to cloud storage by default.
- Automatically promoting personal aliases into global command vocabulary.
- Treating unreviewed ASR guesses as durable command mappings.

### Shared Voice Engine

Architecture documentation for Phase 1 (layered engine, event direction, Tauri-first desktop, backpressure, Silero-first VAD, Next.js boundary) is complete in `docs/SHARED_VOICE_ENGINE.md`; see `docs/ARCHIVED_TASKS.md` (2026-05-03 Shared Voice Engine Architecture Documentation). Runtime implementation, sidecar packaging, and PsiLabs adapter work remain future phases.

PsiLabs should grow from the current browser/local-provider diagnostics toward a reusable Shared Voice Engine. The engine should be app-agnostic, Python-based, and responsible for audio capture, VAD, ASR adapters, normalization profiles, mode routing, and stable voice-event emission. PsiLabs consumes those events through an app-specific adapter.

Desktop direction:

- Tauri is the primary desktop wrapper and packaging path.
- Tauri should launch and supervise the Python voice engine as a sidecar process.
- Tauri IPC should pass endpoint details to React, but voice semantics should stay in the WebSocket/HTTP engine protocol.
- Electron is a fallback only if Tauri blocks a required capability.
- Do not create `src-tauri/` during the documentation-only architecture phase.

Platform direction:

- Desktop: Tauri plus local Python sidecar.
- Web: browser fallback/testing or connection to an already-running local engine.
- Mobile: future shell via Tauri mobile, Capacitor, native bridge, or remote/local network service.
- The engine core must not depend on Tauri, React, browser APIs, mobile shell APIs, or PsiLabs.

VAD and ASR direction:

- Silero is the preferred VAD adapter for the first real engine path, preferably through an ONNX runtime path if that simplifies packaging.
- WebRTC VAD, energy-threshold VAD, and mock VAD remain fallback/testing options.
- Vosk and Sherpa should become Python-side ASR adapters behind the shared engine interface when the engine runtime begins.

Event and lifecycle direction:

- WebSocket is the primary streaming event channel.
- HTTP is secondary for health, control, config, and metadata.
- The Python engine is authoritative for voice `sessionId`, `turnId`, `sequence`, and event timestamps.
- The engine must support bounded buffers, latest-only clients, full-stream diagnostic clients, reconnect snapshots, and slow-client backpressure.

Roadmap phases:

1. Architecture + event schema.
2. VAD + ASR integration, with Silero prioritized.
3. PsiLabs integration, browser + local hybrid.
4. Tauri desktop integration, primary packaging path.
5. Mobile shell integration, Tauri mobile / Capacitor / native bridge.
6. Extended modes and adapters.

See `docs/SHARED_VOICE_ENGINE.md` for the detailed architecture, sidecar startup contract, mode profile shape, mobile-readiness constraints, risks, and explicit non-goals.

## Multi-Run Sessions And In-Progress Protection

Goal:

- Protect in-progress solo test data before leaving test phase.
- Allow multiple completed trial blocks under one broader session.

Current checkpoint:

- IndexedDB now provides a local sidecar persistence layer for solo sessions, with sessions marked `in_progress` or `completed`.
- Completed trials are saved immediately after finalization by `session_id` and `trial_index`, reducing data loss from refreshes or crashes.
- Google Sheets remains the end-of-session export/archive path rather than the real-time write path.

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

Recommended order:

1. Add exit protection prompt for solo test phase.
2. Add `savedRuns` in-memory session structure.
3. Allow redo/new run to append to `savedRuns`.
4. Update results/export logic to support latest run vs all saved runs.
5. Later connect saved runs to Google Sheets append flow.

## History Graph System

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

- Drag-to-zoom.
- Double-click reset.
- Compact date x-axis labels.
- Avoid wasting empty time space.

Habit tracking ideas:

- Current session vs previous session comparison.
- Last 100 / 500 / 1000 cards vs previous equivalent window.
- Calendar heatmap showing practice days, volume, and streaks.
- Current streak and longest streak.
- Cards practiced in last 7 / 30 / 90 days.
- Protocol-aware comparisons once `protocol.label` and `protocol.tags` exist.

Implementation notes:

- Do not store streaks directly in the sheet/database.
- Compute streaks and rolling windows from saved trial/session history so filters can change the answer.
- Useful filters include `session.is_test`, `analysis.is_excluded`, `protocol.label`, `protocol.tags`, `protocol.response_mode`, `protocol.deck_policy`, and `context.input_method`.

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

## Shared Sessions, Links, And Storage

Open questions:

- Should shared session codes remain local/deck-reconstruction codes, or become real cloud-linked sessions?
- Should shortened bitlink-style links point to encoded session config, Google Sheets-backed history, or database-backed sessions?
- Should shared sessions require Google Sheets, or should Google Sheets remain optional export/history storage?

Near-term recommendation:

- Keep shared session links independent from Google Sheets.
- A shared code/link should recreate session setup/deck without requiring Google auth.
- If Google Sheets is connected, it can save results, but should not be required to join or run a shared session.

Potential storage layers:

- Local memory: active run/session only.
- `localStorage`: small recovery snapshots and preferences.
- IndexedDB: local real-time trial persistence, offline history, larger session archives, audio/transcript drafts, cross-refresh persistence.
- Google Sheets: user-owned export/history table, good for transparency and analysis.
- Supabase or similar database: cross-device sync, scoreboards, shared sessions, auth, permissions, and multi-client workflows.

Future database-backed features:

- Cross-device sync.
- Phone-hosted target state while computer records responses.
- Cross-device camera capture for experimental rigs.
- Public or private scoreboard.
- Shared session rooms.
- Durable user accounts.
- Session ownership/permissions.
- Real-time updates between devices.
- Server-side short links.

Auth direction:

- Prefer passwordless accounts.
- Do not require an account for basic local-first use.
- Avoid building or storing passwords unless a future requirement clearly demands it.
- Support Google sign-in, email magic link / OTP, anonymous/local profiles that can be claimed later, and passkeys later if the app grows.
- Accounts should unlock cloud features, not block the core app.
- Keep auth provider assumptions swappable where practical.

Storage and retention principles:

- Supabase/database should be a mediator and recent-summary layer, not the permanent trial archive.
- Google Sheets should remain the durable long-term archive for full trial-level data.
- IndexedDB should hold local in-progress/completed session records, unsaved/interrupted work, and offline/retry queues.
- Supabase should hold only data needed for cloud UX.
- Full trial rows in Supabase should be temporary.
- Session summaries and scoreboard aggregates can persist longer than raw trial rows.
- Shared links/rooms should expire automatically, with a candidate TTL of 7-14 days unless links were used recently.
- Before cloud trial rows are scrubbed, prompt the user to save/archive to Google Sheets, export CSV, export JSON backup, or delete intentionally.

Archive reminders:

- Serious users should be nudged to connect Google Sheets or export CSV before temporary data is purged.
- The app should clearly distinguish durable archive, local-only save, pending sync/archive, and temporary cloud copy.
- Future UI should include an "Unsaved / Needs Review" area for interrupted sessions, completed but unarchived sessions, pending Google Sheets writes, and sessions marked for exclusion/review.
- Suggested Google Sheets archive rotation threshold: remind around 75,000 trial rows and strongly recommend a new archive around 100,000 trial rows.
- Consider creating separate trial archive spreadsheets while preserving the last X months or Y trials in the active history view for recent long-term analysis.

Suggested migration path:

1. Keep Google Sheets as optional user-owned export/history.
2. Done: add IndexedDB for real-time local session/trial persistence.
3. Add database backend only when cross-device sync, public scoreboards, or real shared rooms become active requirements.

## Shared Session Extensions

These are deferred extensions for shared sessions after the MVP realtime room wrapper exists. They should not be part of the initial shared-session implementation.

Analysis and comparison ideas:

- Public scoreboard or recent group sessions view.
- Median z-score, baseline comparison, or other shared-session aggregate views.
- Solo vs shared performance comparison.
- Participant profiles and cumulative participant stats.
- Import validation and profile correction systems for reconciling participant identity across CSV, Sheets, and cloud summaries.
- Double-blind modes or protocol variants.

Privacy and account ideas:

- Privacy settings for public, anonymous, private, or unlisted shared-session summaries.
- Participant profile claiming or correction flows.
- Long-term Supabase summary storage for shared-session summaries only, not full durable trial archives.
- Data retention policies for operational/shared-session cloud data, such as retaining only the last 1000 shared sessions or pruning expired rooms.

Infrastructure ideas:

- Next.js, Vercel, or another unified app layer only if shared sessions later need server-rendered pages, server-mediated room links, protected server logic, or a unified frontend/server deployment.
- Supabase should remain the data layer for shared-session summaries and realtime coordination unless a future requirement proves otherwise.
- CSV and Google Sheets remain the durable archive for participant-level trial data.

Advanced UI ideas:

- Dragging participant tiles or advanced room-layout controls.
- Zoom-like participant layouts for large shared sessions.
- Rich observer/presenter views beyond the basic leader dashboard.

## Leader Swatch / Participant State Perception

This is a deferred shared-session extension and is not part of the Shared Session MVP.

Design principle:

- Treat leader swatch perception as another protocol/run type, not a separate data universe.
- Reuse the existing dot-v1 schema skeleton as much as possible.
- Do not create a separate `leader_observation` namespace unless there is no cleaner generic mapping.
- Generic fields should remain reusable for any participant or protocol where they make sense.

Normal shared participant trial:

```text
protocol.type = forced_choice_perception
target.value = actual trial target
response.first_value = participant guess
score.is_hit = participant guessed target correctly
```

Leader participant-state perception trial:

```text
protocol.type = participant_state_perception
protocol.target_type = participant_swatch | participant_guess | participant_completion_state
participant.role = leader
target.value = actual participant swatch/state
response.first_value = leader's perceived swatch/state
score.is_hit = leader perceived participant state correctly
```

Minimal possible additions:

- `context.observed_participant_id`
- `context.observed_participant_name`
- `context.display_mode`

Optional later additions:

- `context.swatch_size`
- `context.tile_layout`

Analytics:

- Reuse `score.hit_rate`.
- Reuse `score.z`.
- Reuse `score.p_value`.
- Reuse `score.weighted_score`.
- Reuse `score.average_response_position`.

Future results UI may show separate sections:

- Participant target accuracy.
- Leader swatch/state perception accuracy.

## Telekinesis / Macro-PK Protocols

This is a later PsiLabs protocol family, after database-backed storage and cross-device sync exist.

Possible experiment types:

- Psi wheel rotation detection.
- Torsion rig movement detection.
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
- Calibration workflow for camera angle, scale reference, rig geometry, frame rate, baseline/no-participant drift, and environmental controls.

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

- Angular displacement
- Angular velocity
- Angular acceleration
- Deflection distance
- Oscillation amplitude
- Drift-corrected movement
- Inferred torque/force estimate
- Inferred power estimate
- Tracking confidence/quality score

Caution:

- Force/power estimates should be clearly marked as derived from calibration assumptions.
- Distinguish raw tracked movement from inferred physical quantities.
- Strong environmental metadata is required before comparing users or sessions.

## Precognition Suite

Precognition should be treated as a major PsiLabs module, not a single mini-game.

Goal:

- Build a reusable future-target experiment engine with multiple protocols using shared infrastructure.
- Build one future-target engine with many masks, not isolated mini-apps.

Shared engine pieces:

- Generic protocol schema
- Generic trial engine
- Target generation engine
- Timing / reveal engine
- Scoring engine
- Analytics engine

Example protocol config:

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
response.attempt_sequence
response.confidence
response.latency_ms
response.submitted_at

score.is_hit
score.hit_rate
score.z
score.p_value
score.weighted_score
score.timing_error_ms
```

Phase 1 priority experiments:

- Future Color Guess: user responds before future RNG reveal.
- Binary Future Guess: fast binary prediction such as `1/0`, `left/right`, or `up/down`.
- Time Window Sensing: event occurs in one of several future windows.

Phase 2 experiments:

- Presentiment Lite: subjective state response before future target reveal.
- Continuous REG / Micro-PK Line: continuous binary stream with influence, predict, or mixed modes.
- Delayed Feedback Precognition: response now, reveal later.

Phase 3 advanced experiments:

- Future Peak Detection.
- Associative Remote Viewing Lite.
- Session Timing Intuition.

Shared UI requirements:

- Choose protocol, target count, reveal speed, RNG method, notes, and tags.
- Support distraction-free session screens and countdowns where needed.
- Add optional confidence slider and optional voice input later.
- Show results by hit rate, z-score, rolling charts, time of day, tags, and protocol comparison.

RNG methods:

- `crypto_rng`
- `pseudo_rng`
- `qrng_api`
- `hardware_rng`

Analytics priority:

- Session stats
- Lifetime stats
- Last 100 trials
- Confidence correlation
- Time-of-day heatmap
- Tag correlation
- Protocol comparison

Recommended build order:

1. Future Color Guess
2. Binary Guess
3. Time Window Sensing
4. Presentiment Lite
5. REG Line
6. Delayed Reveal

Naming:

- Umbrella: `Precognition Suite`
- Sub-modes:
  - Future Guess
  - Time Window
  - Presentiment
  - REG Stream
  - Delayed Reveal
  - Peak Detection
