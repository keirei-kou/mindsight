# Roadmap

Future product and architecture ideas from the handoff, separated from current implementation tasks.

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

## Multi-Run Sessions And In-Progress Protection

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
- IndexedDB: local offline history, larger session archives, audio/transcript drafts, cross-refresh persistence.
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
- IndexedDB should hold local unsaved/interrupted work and offline/retry queues.
- Supabase should hold only data needed for cloud UX.
- Full trial rows in Supabase should be temporary.
- Session summaries and scoreboard aggregates can persist longer than raw trial rows.
- Shared links/rooms should expire automatically, with a candidate TTL of 14 to 30 days.
- Before cloud trial rows are scrubbed, prompt the user to save/archive to Google Sheets, export CSV, export JSON backup, or delete intentionally.

Archive reminders:

- Serious users should be nudged to connect Google Sheets or export CSV before temporary data is purged.
- The app should clearly distinguish durable archive, local-only save, pending sync/archive, and temporary cloud copy.
- Future UI should include an "Unsaved / Needs Review" area for interrupted sessions, completed but unarchived sessions, pending Google Sheets writes, and sessions marked for exclusion/review.
- Suggested Google Sheets archive rotation threshold: remind around 75,000 trial rows and strongly recommend a new archive around 100,000 trial rows.

Suggested migration path:

1. Keep Google Sheets as optional user-owned export/history.
2. Add IndexedDB for local durable history once multi-run sessions need persistence.
3. Add database backend only when cross-device sync, public scoreboards, or real shared rooms become active requirements.

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
