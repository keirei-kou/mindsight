# Local Voice ASR Model Assets

PsiLabs can test Browser Speech, Vosk Local, and Sherpa ONNX Local from the voice ASR diagnostic panel.

Open the panel in dev at:

```text
http://127.0.0.1:5173/#voice-asr-test
```

Set local ASR env values in `.env.local` when needed:

```text
VITE_ENABLE_LOCAL_ASR=true
VITE_VOSK_MODEL_URL=/models/vosk/model.tar.gz
VITE_SHERPA_ONNX_ASSET_BASE_URL=/models/sherpa-onnx/
VITE_LOCAL_VAD_WS_URL=ws://127.0.0.1:8765/v1/vad
VITE_LOCAL_VAD_HEALTH_URL=http://127.0.0.1:8765/health
```

Set Python sidecar ASR env values in the shell that runs `uvicorn` when needed:

```powershell
$env:LOCAL_SPEECH_VOSK_MODEL_PATH="local_speech_engine\models\vosk\vosk-model-small-en-us-0.15"
$env:LOCAL_SPEECH_SHERPA_MODEL_DIR="local_speech_engine\models\sherpa\sherpa-onnx-streaming-zipformer-en-20M-2023-02-17"
$env:LOCAL_SPEECH_ASR_PROVIDER_DEFAULT="vosk"
$env:LOCAL_SPEECH_ENABLE_VOSK="true"
$env:LOCAL_SPEECH_ENABLE_SHERPA="true"
$env:LOCAL_SPEECH_ASR_AUTO_TRANSCRIBE="false"
```

## Local VAD Sidecar

The local VAD sidecar is a Python prototype for microphone capture, speech boundary detection, WAV segment capture, and Python-side ASR experiments on saved WAV files.

Install the Python service from the repo root:

```powershell
py -m venv local_speech_engine\.venv
local_speech_engine\.venv\Scripts\python -m pip install -r local_speech_engine\requirements.txt
```

Run the service:

```powershell
local_speech_engine\.venv\Scripts\python -m uvicorn local_speech_engine.server:app --host 127.0.0.1 --port 8765
```

The service exposes:

- `GET http://127.0.0.1:8765/health`
- `WS ws://127.0.0.1:8765/v1/vad`

WebSocket commands:

```json
{ "command": "start_vad" }
{ "command": "stop_vad" }
{ "command": "list_asr_providers" }
{ "command": "load_asr_provider", "provider": "vosk" }
{ "command": "transcribe_latest_segment", "provider": "vosk" }
{ "command": "transcribe_segment", "provider": "vosk", "filename": "vad_segment_20260430T120000_000Z_0001.wav" }
{ "command": "save_segment_to_corpus", "filename": "vad_segment_20260430T120000_000Z_0001.wav", "expected": "red", "type": "command", "category": "colors", "notes": "quiet room" }
```

`start_listening` and `stop_listening` are still accepted for backward compatibility, but the current UI sends `start_vad` and `stop_vad`.

Events include `engine_started`, `engine_stopped`, `vad_speech_start`, `vad_speech_end`, `segment_saved`, and `error`. `segment_saved` includes the WAV filename, duration, sample rate, prebuffer, hangover, and timestamp.

ASR events include `asr_provider_status`, `asr_model_loading`, `asr_model_ready`, `asr_model_error`, `asr_transcript`, and `asr_transcript_error`.

Corpus events include `corpus_sample_saved` and `corpus_sample_error`.

Audio segments are saved under:

```text
local_speech_engine/recordings/
```

The engine tries WebRTC VAD first when the optional `webrtcvad` module is available. On Python 3.14, the requirements keep WebRTC VAD optional because current `webrtcvad-wheels` builds target earlier CPython versions; the energy VAD fallback remains supported.

## Python Sidecar Vosk

The Python sidecar uses the `vosk` Python package to transcribe saved WAV segments. It expects an extracted Vosk model directory.

Default sidecar model path:

```text
local_speech_engine/models/vosk/vosk-model-small-en-us-0.15
```

Env override:

```powershell
$env:LOCAL_SPEECH_VOSK_MODEL_PATH="C:\path\to\vosk-model-small-en-us-0.15"
```

The path must be a directory with extracted model files, including:

- `am/final.mdl`
- `conf/model.conf`
- `graph/HCLr.fst`
- `graph/Gr.fst`

Do not set `LOCAL_SPEECH_VOSK_MODEL_PATH` to `model.tar.gz`. If the path points to a `.tar.gz` archive, the sidecar returns a structured `model_path_is_archive` error explaining that Python Vosk requires an extracted model directory.

Install/update the Python dependencies:

```powershell
local_speech_engine\.venv\Scripts\python -m pip install -r local_speech_engine\requirements.txt
```

To test from the UI:

1. Run the Python sidecar.
2. Run the React dev server.
3. Open `http://127.0.0.1:5173/#voice-asr-test`.
4. Connect the `Local VAD Engine` panel.
5. Start VAD and create at least one saved WAV segment.
6. In `Local ASR`, choose `vosk`, click `Load Provider`, then click `Transcribe Latest WAV`.

To test with raw WebSocket JSON:

```json
{ "command": "transcribe_latest_segment", "provider": "vosk" }
```

`LOCAL_SPEECH_ASR_AUTO_TRANSCRIBE=false` by default. Set it to `true` only when `LOCAL_SPEECH_ASR_PROVIDER_DEFAULT` points to a provider you want to run automatically after each `segment_saved` event.

## Vosk Local

This section is for the browser/WASM Vosk provider, not the Python sidecar.

Default model path:

```text
public/models/vosk/model.tar.gz
```

Env override:

```text
VITE_VOSK_MODEL_URL=/models/vosk/model.tar.gz
```

The Vosk provider uses `vosk-browser` and a constrained grammar for short command testing. The model archive should be a Vosk browser-compatible `.tar.gz` model archive.

`vosk-browser` expects a gzipped tar archive URL. It does not load an already-extracted model folder such as `/models/vosk/` in this project. The extracted folder can be used as the source for packaging, but `VITE_VOSK_MODEL_URL` should point at the archive:

```text
VITE_VOSK_MODEL_URL=/models/vosk/model.tar.gz
```

To package the current extracted folder on Windows PowerShell, build the archive outside the source folder first, then move it into place:

```powershell
tar -czf public/models/vosk-model.tmp.tar.gz --exclude=./model.tar.gz -C public/models/vosk .
Move-Item -Force public/models/vosk-model.tmp.tar.gz public/models/vosk/model.tar.gz
```

That command archives the contents of `public/models/vosk/` into `public/models/vosk/model.tar.gz`, so files like `conf/model.conf` and `am/final.mdl` are inside the archive at the paths Vosk expects.

## Python Sidecar Sherpa ONNX

The Python sidecar includes a functional Sherpa ONNX provider for extracted transducer model folders. It reports package/model-directory status, loads compatible Sherpa ONNX models, and transcribes saved WAV segments without emitting fake transcripts.

Default sidecar model path:

```text
local_speech_engine/models/sherpa/sherpa-onnx-streaming-zipformer-en-20M-2023-02-17
```

Env override:

```powershell
$env:LOCAL_SPEECH_SHERPA_MODEL_DIR="local_speech_engine\models\sherpa\sherpa-onnx-streaming-zipformer-en-20M-2023-02-17"
```

Install `sherpa-onnx` only after choosing a specific model layout:

```powershell
local_speech_engine\.venv\Scripts\python -m pip install sherpa-onnx
```

For the current streaming Zipformer model, the extracted model directory should contain:

- `tokens.txt`
- `encoder-epoch-99-avg-1.int8.onnx` or `encoder-epoch-99-avg-1.onnx`
- `decoder-epoch-99-avg-1.onnx`
- `joiner-epoch-99-avg-1.int8.onnx` or `joiner-epoch-99-avg-1.onnx`

The sidecar uses the streaming/online recognizer for model folders whose name contains `streaming`. It prepends a small leading silence pad and appends trailing silence for finalized short WAV segments to reduce streaming warmup and end-of-utterance issues.

## Saved-WAV Corpus

The ASR benchmark corpus stores labeled copies of VAD WAV segments without coupling filenames to any ASR model. Raw audio stays model-agnostic; provider, transcript, confidence, latency, and pass/fail results live in benchmark reports.

Corpus layout:

```text
local_speech_engine/audio_corpus/
  labels.json
  commands/
    colors/
    shapes/
    numbers/
    other/
  voice_notes/
```

Each label entry includes:

- `id`
- `file`
- `expected`
- `type`: `command` or `voice_note`
- `category`: `colors`, `shapes`, `numbers`, `trial_note`, or `other`
- `notes`
- `created_at`

From the UI:

1. Run the Python sidecar and React dev server.
2. Open `http://127.0.0.1:5173/#voice-asr-test`.
3. Connect the `Local VAD Engine` panel.
4. Record a short segment.
5. In `Benchmark / Corpus`, enter the expected word or phrase.
6. Choose type/category and press `Save Latest Segment`.

The original recording remains in `local_speech_engine/recordings/`. A labeled copy is written to `local_speech_engine/audio_corpus/...`, and `labels.json` is updated.

Raw WebSocket save example:

```json
{
  "command": "save_segment_to_corpus",
  "filename": "vad_segment_20260501T040409_888Z_0001.wav",
  "expected": "red",
  "type": "command",
  "category": "colors",
  "notes": "first command corpus pass"
}
```

Suggested first command corpus:

- `red`
- `blue`
- `green`
- `yellow`
- `purple`
- `orange`
- `one`
- `two`
- `three`
- `circle`
- `square`
- `triangle`
- `star`

## ASR Benchmark Runner

Run the benchmark from the repo root:

```powershell
local_speech_engine\.venv\Scripts\python -m local_speech_engine.benchmark_asr --providers vosk
```

The runner loads `local_speech_engine/audio_corpus/labels.json`, transcribes each labeled WAV with the selected provider, and writes reports to:

```text
local_speech_engine/benchmark_results/
```

Report formats:

- `asr_benchmark_<timestamp>.json`
- `asr_benchmark_<timestamp>.csv`

Each row includes provider, file, expected text, raw transcript, normalized transcript, confidence, latency, pass/fail, a `wer` placeholder, and error. Command samples use normalized exact match. Voice-note samples currently use the same normalized comparison; WER can be filled in later.

Normalization currently lowercases, removes basic punctuation, collapses whitespace, and applies command aliases:

- `read` -> `red`
- `bread` -> `red`
- `blew` -> `blue`
- `to` -> `two`
- `too` -> `two`
- `won` -> `one`

Browser Speech is live-only for benchmarking. It owns microphone capture, endpointing, buffering, and recognition inside the browser, so it cannot fairly replay saved WAV corpus files. Use Browser Speech as a live fallback comparison, not as part of the saved-WAV benchmark.

Future providers can use the same corpus:

- Vosk: functional when `LOCAL_SPEECH_VOSK_MODEL_PATH` points to an extracted model folder.
- Sherpa ONNX: functional when `LOCAL_SPEECH_SHERPA_MODEL_DIR` points to a compatible extracted transducer model folder.
- Whisper: can be added later as another provider consuming the same WAV files.

## Browser Sherpa ONNX Local

This section is for the browser/WASM Sherpa provider, not the Python sidecar.

Default asset base path:

```text
public/models/sherpa-onnx/
```

Env override:

```text
VITE_SHERPA_ONNX_ASSET_BASE_URL=/models/sherpa-onnx/
```

Expected files include the official browser WebAssembly ASR build outputs:

- `sherpa-onnx.js`
- `sherpa-onnx-wasm-asr-main.js`
- related `.wasm` files
- related `.data` and model files

The provider also checks the alternate helper/main names `sherpa-onnx-asr.js` and `sherpa-onnx-wasm-main-asr.js` because Sherpa example builds can vary by release.

## Manual Test Flow

1. Start the dev server.
2. Open `/#voice-asr-test`.
3. Select `Browser Speech`, `Vosk Local`, or `Sherpa ONNX Local`.
4. Press `Start listening`.
5. Speak test commands.
6. Watch raw transcript, normalized command, confidence, latency, status, and errors.
7. In the `Local VAD Engine` panel, connect to the Python sidecar and press `Start VAD`.
8. Say short words such as `red`, `blue`, and `one`.
9. Confirm `segment_saved` events appear and WAV files are created in `local_speech_engine/recordings/`.
10. Listen to the WAV files manually and confirm each word includes the first consonant.
11. In `Local ASR`, load `vosk` and transcribe the latest WAV.
12. In `Benchmark / Corpus`, save the latest segment with its expected label.
13. Run `local_speech_engine\.venv\Scripts\python -m local_speech_engine.benchmark_asr --providers vosk`.
14. Press `Stop listening` or `Stop VAD` before switching/resetting providers if you want a clean reset.

Target test commands:

- `red`
- `blue`
- `press A`
- `press D`
- `space`
- `submit`
- `calibration`
- `test`
- `results`

## Troubleshooting

- Missing Vosk model archive: confirm `public/models/vosk/model.tar.gz` exists or set `VITE_VOSK_MODEL_URL` to another `.tar.gz` archive URL. Do not point it at an extracted folder URL like `/models/vosk/`.
- Python Vosk `.tar.gz` error: set `LOCAL_SPEECH_VOSK_MODEL_PATH` to an extracted model folder, not `model.tar.gz`.
- Python Vosk missing files: confirm the folder contains `am/final.mdl`, `conf/model.conf`, `graph/HCLr.fst`, and `graph/Gr.fst`.
- Wrong Sherpa asset path: confirm `public/models/sherpa-onnx/` exists or set `VITE_SHERPA_ONNX_ASSET_BASE_URL`.
- Python Sherpa unavailable: confirm `sherpa-onnx` is installed and `LOCAL_SPEECH_SHERPA_MODEL_DIR` points to a compatible extracted transducer model folder.
- Mic/VAD works but ASR fails: check `asr_model_error` or `asr_transcript_error` in the Local VAD panel; VAD remains usable even when ASR providers fail.
- Windows path issues: quote paths with spaces and prefer absolute paths for `LOCAL_SPEECH_VOSK_MODEL_PATH` if relative paths behave unexpectedly.
- WASM MIME/path issues: serve through Vite or another HTTP server; do not open `index.html` directly from the filesystem.
- Mic permission denied: allow microphone access for the local dev origin and restart listening.
- Model load timeout: confirm model assets are reachable in the browser network panel and are not blocked by CORS or path mistakes.
- Provider unavailable: Browser Speech depends on browser support; local providers require Web Audio microphone access.
- Empty benchmark: save labeled corpus samples first, then rerun `python -m local_speech_engine.benchmark_asr --providers vosk`.
- Corpus label mismatch: confirm `labels.json` points at files under `local_speech_engine/audio_corpus/` and that the WAV copy exists.
- Vosk large chunk warning: expected. The `vosk-browser` runtime is lazy-loaded when the provider starts.
