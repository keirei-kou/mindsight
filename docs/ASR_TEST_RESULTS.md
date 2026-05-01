# ASR Test Results

Use this log to compare Browser Speech, Vosk Local, and Sherpa ONNX Local on short PsiLabs commands.

Diagnostic route:

```text
http://127.0.0.1:5173/#voice-asr-test
```

## Manual Test Checklist

1. Confirm local ASR env flag is enabled.
2. Confirm diagnostic route opens: `http://127.0.0.1:5173/#voice-asr-test`.
3. Confirm provider loads.
4. Confirm mic permission works.
5. Speak each command 5 times per provider.
6. Record failures and weird transcripts.

## Target Commands

- `red`
- `blue`
- `press A`
- `press D`
- `space`
- `submit`
- `calibration`
- `test`
- `results`

## Results Table

| Provider | Command spoken | Raw transcript | Normalized command | Success/fail | Latency ms | Notes |
|---|---|---|---|---|---:|---|
| Browser Speech | red |  |  |  |  |  |
| Browser Speech | blue |  |  |  |  |  |
| Browser Speech | press A |  |  |  |  |  |
| Browser Speech | press D |  |  |  |  |  |
| Browser Speech | space |  |  |  |  |  |
| Browser Speech | submit |  |  |  |  |  |
| Browser Speech | calibration |  |  |  |  |  |
| Browser Speech | test |  |  |  |  |  |
| Browser Speech | results |  |  |  |  |  |
| Vosk Local | red |  |  |  |  |  |
| Vosk Local | blue |  |  |  |  |  |
| Vosk Local | press A |  |  |  |  |  |
| Vosk Local | press D |  |  |  |  |  |
| Vosk Local | space |  |  |  |  |  |
| Vosk Local | submit |  |  |  |  |  |
| Vosk Local | calibration |  |  |  |  |  |
| Vosk Local | test |  |  |  |  |  |
| Vosk Local | results |  |  |  |  |  |
| Sherpa ONNX Local | red |  |  |  |  |  |
| Sherpa ONNX Local | blue |  |  |  |  |  |
| Sherpa ONNX Local | press A |  |  |  |  |  |
| Sherpa ONNX Local | press D |  |  |  |  |  |
| Sherpa ONNX Local | space |  |  |  |  |  |
| Sherpa ONNX Local | submit |  |  |  |  |  |
| Sherpa ONNX Local | calibration |  |  |  |  |  |
| Sherpa ONNX Local | test |  |  |  |  |  |
| Sherpa ONNX Local | results |  |  |  |  |  |
