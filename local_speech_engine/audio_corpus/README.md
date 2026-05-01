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
    "file": "commands/colors/vad_segment_20260501T040409_888Z_0001.wav",
    "expected": "red",
    "type": "command",
    "category": "colors",
    "notes": "quiet room"
  }
]
```

## Add A First Command Session

1. Record short VAD segments in `#voice-asr-test`.
2. Copy the chosen WAV files from `local_speech_engine/recordings/` into a command folder, for example `commands/colors/`.
3. Add entries to `labels.json` using either the object format above or the existing list format.
4. Run the arbitration benchmark from the repo root.
