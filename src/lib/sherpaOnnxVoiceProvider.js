import { DEFAULT_PREBUFFER_OPTIONS, createWebAudioPrebuffer } from "./audioPrebuffer.js";
import { createCallbackSet, getBaseUrl, getPerformanceNow, hasWebAudioInput, joinUrl } from "./voiceProviderUtils.js";

const TARGET_COMMANDS = [
  "red",
  "blue",
  "a",
  "d",
  "space",
  "submit",
  "calibration",
  "test",
  "results",
];

const DEFAULT_ASSET_PATH = "models/sherpa-onnx/";
const DEFAULT_ASR_HELPER_SCRIPT = "sherpa-onnx.js";
const ALTERNATE_ASR_HELPER_SCRIPT = "sherpa-onnx-asr.js";
const DEFAULT_MAIN_SCRIPT = "sherpa-onnx-wasm-asr-main.js";
const ALTERNATE_MAIN_SCRIPT = "sherpa-onnx-wasm-main-asr.js";

let runtimePromise = null;

function getSherpaAssetBaseUrl(options = {}) {
  return (
    options.assetBaseUrl ||
    import.meta.env.VITE_SHERPA_ONNX_ASSET_BASE_URL ||
    joinUrl(getBaseUrl(), DEFAULT_ASSET_PATH)
  );
}

function getSherpaMainScriptNames(options = {}) {
  return [
    options.mainScriptName || import.meta.env.VITE_SHERPA_ONNX_MAIN_SCRIPT || DEFAULT_MAIN_SCRIPT,
    ALTERNATE_MAIN_SCRIPT,
  ].filter((name, index, names) => name && names.indexOf(name) === index);
}

function getSherpaHelperScriptNames(options = {}) {
  return [
    options.asrHelperScriptName || import.meta.env.VITE_SHERPA_ONNX_HELPER_SCRIPT || DEFAULT_ASR_HELPER_SCRIPT,
    ALTERNATE_ASR_HELPER_SCRIPT,
  ].filter((name, index, names) => name && names.indexOf(name) === index);
}

function getSherpaConfig(options = {}) {
  if (options.config) {
    return options.config;
  }

  const rawConfig = import.meta.env.VITE_SHERPA_ONNX_CONFIG_JSON;
  if (!rawConfig) {
    return null;
  }

  try {
    return JSON.parse(rawConfig);
  } catch (error) {
    throw new Error(`Invalid VITE_SHERPA_ONNX_CONFIG_JSON: ${error.message}`);
  }
}

function loadClassicScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = false;
    script.onload = () => resolve();
    script.onerror = () => {
      script.remove();
      reject(new Error(`Could not load ${src}`));
    };
    document.head.appendChild(script);
  });
}

async function loadFirstAvailableScript(baseUrl, scriptNames) {
  let lastError = null;

  for (const scriptName of scriptNames) {
    try {
      await loadClassicScript(joinUrl(baseUrl, scriptName));
      return scriptName;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error("Could not load Sherpa ONNX runtime script.");
}

function loadSherpaRuntime(options = {}, onStatus = () => {}) {
  if (typeof window !== "undefined" && window.Module && typeof window.createOnlineRecognizer === "function") {
    return Promise.resolve(window.Module);
  }

  if (runtimePromise) {
    return runtimePromise;
  }

  const assetBaseUrl = getSherpaAssetBaseUrl(options);
  const mainScriptNames = getSherpaMainScriptNames(options);
  const helperScriptNames = getSherpaHelperScriptNames(options);

  runtimePromise = new Promise((resolve, reject) => {
    const timeoutMs = options.runtimeTimeoutMs ?? 45000;
    let settled = false;

    const settle = (callback, value) => {
      if (settled) {
        return;
      }

      settled = true;
      window.clearTimeout(timeoutId);
      callback(value);
    };

    const timeoutId = window.setTimeout(() => {
      runtimePromise = null;
      settle(reject, new Error("Timed out while initializing Sherpa ONNX WebAssembly assets."));
    }, timeoutMs);

    window.Module = {
      locateFile(path) {
        return joinUrl(assetBaseUrl, path);
      },
      setStatus(status) {
        onStatus(status);
      },
      onRuntimeInitialized() {
        settle(resolve, window.Module);
      },
    };

    loadFirstAvailableScript(assetBaseUrl, helperScriptNames)
      .then(() => loadFirstAvailableScript(assetBaseUrl, mainScriptNames))
      .catch((error) => {
        runtimePromise = null;
        settle(reject, error);
      });
  });

  return runtimePromise;
}

function getResultText(result) {
  return String(result?.text ?? result ?? "").trim();
}

export function createSherpaOnnxLocalProvider(options = {}) {
  const resultCallbacks = createCallbackSet();
  const errorCallbacks = createCallbackSet();
  const stateCallbacks = createCallbackSet();
  const sampleRate = options.sampleRate ?? DEFAULT_PREBUFFER_OPTIONS.sampleRate;
  const assetBaseUrl = getSherpaAssetBaseUrl(options);

  let audioInput = null;
  let recognizer = null;
  let stream = null;
  let starting = false;
  let listening = false;
  let lastAudioAt = 0;
  let lastTranscript = "";

  const emitError = (error) => {
    const normalizedError = error instanceof Error ? error : new Error(String(error));
    stateCallbacks.emit("error");
    errorCallbacks.emit(normalizedError);
  };

  const emitTranscript = (transcript, rawResult = null) => {
    const cleanTranscript = String(transcript ?? "").trim();
    if (!cleanTranscript || cleanTranscript === lastTranscript) {
      return;
    }

    lastTranscript = cleanTranscript;
    const now = getPerformanceNow();
    resultCallbacks.emit({
      transcript: cleanTranscript,
      confidence: null,
      providerName: "sherpaOnnxLocal",
      raw: rawResult,
      latencyMs: lastAudioAt ? Math.max(0, Math.round(now - lastAudioAt)) : null,
    });
  };

  const decodeAudio = (samples) => {
    if (!recognizer || !stream) {
      return;
    }

    lastAudioAt = getPerformanceNow();
    stream.acceptWaveform(sampleRate, samples);

    while (recognizer.isReady(stream)) {
      recognizer.decode(stream);
    }

    const result = recognizer.getResult(stream);
    emitTranscript(getResultText(result), result);

    if (recognizer.isEndpoint(stream)) {
      recognizer.reset(stream);
      lastTranscript = "";
    }
  };

  const startAsync = async () => {
    if (listening || starting) {
      return;
    }

    starting = true;
    stateCallbacks.emit("loading");

    try {
      if (!hasWebAudioInput()) {
        throw new Error("Sherpa ONNX Local needs Web Audio microphone access in this browser.");
      }

      const config = getSherpaConfig(options);
      const module = await loadSherpaRuntime(options, (status) => {
        if (status) {
          stateCallbacks.emit(status);
        }
      });

      const createOnlineRecognizer = window.createOnlineRecognizer;
      if (typeof createOnlineRecognizer !== "function") {
        throw new Error("Sherpa ONNX runtime did not expose createOnlineRecognizer().");
      }

      recognizer = config ? createOnlineRecognizer(module, config) : createOnlineRecognizer(module);
      stream = recognizer.createStream();

      audioInput = createWebAudioPrebuffer({
        ...(options.prebuffer ?? DEFAULT_PREBUFFER_OPTIONS),
        sampleRate,
        onAudio(samples) {
          try {
            decodeAudio(samples);
          } catch (error) {
            emitError(error);
          }
        },
      });

      await audioInput.start();
      listening = true;
      stateCallbacks.emit("listening");
    } catch (error) {
      await stopAsync();
      emitError(error);
    } finally {
      starting = false;
    }
  };

  const stopAsync = async () => {
    listening = false;
    await audioInput?.stop?.();
    audioInput = null;

    try {
      stream?.inputFinished?.();
    } catch {
      // Ignore stream shutdown races.
    }

    try {
      stream?.free?.();
    } catch {
      // Ignore stream shutdown races.
    }

    stream = null;

    try {
      recognizer?.free?.();
    } catch {
      // Ignore runtime shutdown races.
    }

    recognizer = null;
    lastTranscript = "";
    stateCallbacks.emit("stopped");
  };

  return {
    providerName: "sherpaOnnxLocal",
    assetBaseUrl,
    targetCommands: TARGET_COMMANDS,
    isAvailable: hasWebAudioInput,
    isSupported: hasWebAudioInput,
    start() {
      void startAsync();
    },
    stop() {
      void stopAsync();
    },
    cleanup() {
      void stopAsync();
    },
    onResult(callback) {
      return resultCallbacks.add(callback);
    },
    onError(callback) {
      return errorCallbacks.add(callback);
    },
    onStateChange(callback) {
      return stateCallbacks.add(callback);
    },
  };
}
