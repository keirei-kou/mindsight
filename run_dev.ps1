Set-Location -LiteralPath $PSScriptRoot

Write-Host "Starting Voice Engine..." -ForegroundColor Cyan

$venvPython = Join-Path $PSScriptRoot 'local_speech_engine\.venv\Scripts\python.exe'
$voiceCmd = "Set-Location -LiteralPath '$PSScriptRoot'; " +
  "`$env:LOCAL_SPEECH_VOSK_MODEL_PATH='local_speech_engine\models\vosk\vosk-model-small-en-us-0.15'; " +
  "`$env:LOCAL_SPEECH_SHERPA_MODEL_DIR='local_speech_engine\models\sherpa\sherpa-onnx-streaming-zipformer-en-20M-2023-02-17'; " +
  "`$env:LOCAL_SPEECH_ENABLE_VOSK='true'; " +
  "`$env:LOCAL_SPEECH_ENABLE_SHERPA='true'; " +
  "& '$venvPython' -m uvicorn local_speech_engine.server:app --host 127.0.0.1 --port 8765 --reload"
Start-Process powershell -ArgumentList @('-NoExit', '-NoProfile', '-Command', $voiceCmd)

Start-Sleep -Seconds 2

Write-Host "Starting Frontend..." -ForegroundColor Green

$frontendCmd = "Set-Location -LiteralPath '$PSScriptRoot'; npm run dev"
Start-Process powershell -ArgumentList @('-NoExit', '-NoProfile', '-Command', $frontendCmd)

Start-Sleep -Seconds 1

Start-Process 'http://127.0.0.1:5173/#voice-asr-test'

Write-Host 'All services started!' -ForegroundColor Yellow
