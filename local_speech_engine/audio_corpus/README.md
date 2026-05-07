# Local Speech Arbitration Corpus

This folder stores WAV samples for repeatable sidecar ASR and arbitration tests.

## Layout

```text
local_speech_engine/audio_corpus/
  labels.json
  labels.example.json
  commands/
    colors/
    numbers/
    shapes/
    other/
  voice_notes/
```

`commands/` is for short command utterances such as `red`, `blue`, `yellow`, and `green`.
`voice_notes/` is reserved for longer dictation or note fragments. The Phase 3 benchmark scaffolds voice-note rows but scores command mode first.

## Session Labels Format

The arbitration benchmark accepts this richer object shape:

```json
{
  "session_id": "session_20260501_red_blue_green",
  "mode": "command",
  "planned_sequence": ["red", "blue", "green", "yellow"],
  "auto_label_by_order": true,
  "files": [
    {
      "filename": "commands/colors/red_001.wav",
      "expected": "red",
      "notes": "quiet room"
    }
  ]
}
```

When `auto_label_by_order` is `true`, `expected` may be omitted from a file entry and the benchmark will use the matching entry from `planned_sequence`.

The older list-style `labels.json` created by the lab corpus UI is still accepted:

```json
[
  {
    "file": "commands/colors/red__single_word-quiet__001.wav",
    "expected": "red",
    "type": "command",
    "category": "colors",
    "notes": "single_word|quiet"
  }
]
```

## Corpus Filenames

Older raw recordings may stay in `local_speech_engine/recordings/` with their VAD-generated names, for example:

```text
vad_segment_20260501T040409_888Z_0001.wav
```

New recordings created from Voice Engine Lab use the current labeling context when an expected label is available:

```text
local_speech_engine/recordings/red__single_word-clean__20260505T190137.wav
```

When a human-readable recording is saved into the corpus, the copied WAV keeps the same filename under the selected corpus folder:

```text
local_speech_engine/audio_corpus/commands/colors/red__single_word-clean__20260505T190137.wav
```

When an older `vad_segment_...wav` recording is saved into the corpus, the copied WAV gets a human-readable corpus filename:

```text
<expected>__<notes_slug>__<index>.wav
```

Examples:

```text
commands/colors/red__single_word-quiet__001.wav
commands/colors/red__single_word-quiet__002.wav
commands/colors/blue__quiet_room__001.wav
commands/colors/red__single_word-clean__20260505T190137.wav
```

Filename rules:

- `expected` is lowercased and sanitized for filenames.
- If `expected` is missing for a new recording, the sidecar falls back to the older `vad_segment_...wav` naming pattern.
- `notes` is preserved unchanged in `labels.json`.
- The notes filename slug lowercases text, replaces `|` with `-`, replaces spaces with `_`, and removes unsafe filename characters.
- The numeric suffix increments to keep corpus WAV filenames unique.
- `labels.json` remains the source of truth. Benchmark scripts read the stored `file` or `filename` path and still accept older entries that reference `vad_segment_...wav`.

## Add A First Command Session

1. Record short VAD segments in `#voice-asr-test`.
2. Save the chosen clips from the Voice Engine Lab corpus controls, or copy WAV files manually into a command folder if building a fixture by hand.
3. Add entries to `labels.json` using either the session object format above or the list format if editing manually.
4. Run the arbitration benchmark from the repo root.
