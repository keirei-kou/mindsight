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

const DEFAULT_MODEL_PATH = "models/vosk/model.tar.gz";
const DEFAULT_GRAMMAR = JSON.stringify([...TARGET_COMMANDS, "[unk]"]);

function getVoskModelUrl(options = {}) {
  return (
    options.modelUrl ||
    import.meta.env.VITE_VOSK_MODEL_URL ||
    joinUrl(getBaseUrl(), DEFAULT_MODEL_PATH)
  );
}

function isExtractedFolderModelUrl(modelUrl) {
  return String(modelUrl || "").endsWith("/");
}

function toRecognizerText(message) {
  const result = message?.result ?? {};
  return String(result.text ?? result.partial ?? "").trim();
}

function getRecognizerConfidence(message) {
  const result = message?.result ?? {};
  if (typeof result.confidence === "number") {
    return result.confidence;
  }

  if (Array.isArray(result.result) && result.result.length > 0) {
    const total = result.result.reduce((sum, word) => sum + (word.conf ?? 0), 0);
    return total / result.result.length;
  }

  return null;
}

function getErrorMessage(error, fallback = "Vosk provider error.") {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "string" && error) {
    return error;
  }

  return fallback;
}

function createVoskError(error, details = {}) {
  const normalizedError = error instanceof Error
    ? error
    : new Error(getErrorMessage(error));

  Object.assign(normalizedError, details);
  return normalizedError;
}

function loadModelWithDiagnostics(vosk, modelUrl, logLevel) {
  const ModelCtor = vosk.Model ?? vosk.default?.Model;
  const createModel = vosk.createModel ?? vosk.default?.createModel;

  if (typeof ModelCtor === "function") {
    return new Promise((resolve, reject) => {
      let loadedModel = null;
      let settled = false;

      const finish = (callback, value) => {
        if (settled) {
          return;
        }

        settled = true;
        callback(value);
      };

      try {
        loadedModel = new ModelCtor(modelUrl, logLevel);
        loadedModel.on("load", (message) => {
          if (message?.result) {
            finish(resolve, loadedModel);
            return;
          }

          finish(reject, createVoskError(
            `Vosk model load failed for ${modelUrl}. vosk-browser returned load result false.`,
            { action: "model load failure", modelUrl, fetchUrl: modelUrl }
          ));
        });
        loadedModel.on("error", (message) => {
          finish(reject, createVoskError(
            `Vosk model load failed for ${modelUrl}: ${message?.error || "worker error"}`,
            { action: "model load failure", modelUrl, fetchUrl: modelUrl }
          ));
        });
      } catch (error) {
        finish(reject, createVoskError(error, {
          action: "model load failure",
          modelUrl,
          fetchUrl: modelUrl,
        }));
      }
    });
  }

  if (typeof createModel === "function") {
    return createModel(modelUrl, logLevel).catch((error) => {
      throw createVoskError(
        `Vosk model load failed for ${modelUrl}: ${getErrorMessage(error, "createModel rejected without details")}`,
        { action: "model load failure", modelUrl, fetchUrl: modelUrl }
      );
    });
  }

  return Promise.reject(createVoskError(
    "vosk-browser did not expose Model or createModel().",
    { action: "model load failure", modelUrl, fetchUrl: modelUrl }
  ));
}

export function createVoskLocalProvider(options = {}) {
  const resultCallbacks = createCallbackSet();
  const errorCallbacks = createCallbackSet();
  const stateCallbacks = createCallbackSet();
  const lifecycleCallbacks = createCallbackSet();
  const sampleRate = options.sampleRate ?? DEFAULT_PREBUFFER_OPTIONS.sampleRate;
  const modelUrl = getVoskModelUrl(options);
  const grammar = options.grammar ?? DEFAULT_GRAMMAR;

  let audioInput = null;
  let model = null;
  let recognizer = null;
  let starting = false;
  let listening = false;
  let lastAudioAt = 0;

  const emitLifecycle = (event) => {
    lifecycleCallbacks.emit({
      providerName: "voskLocal",
      timestamp: new Date().toISOString(),
      modelUrl,
      fetchUrl: modelUrl,
      ...event,
    });
  };

  const emitError = (error, details = {}) => {
    const normalizedError = createVoskError(error, {
      modelUrl,
      fetchUrl: modelUrl,
      ...details,
    });
    stateCallbacks.emit("error");
    errorCallbacks.emit(normalizedError);
  };

  const emitResult = (message) => {
    const transcript = toRecognizerText(message);
    if (!transcript) {
      return;
    }

    const now = getPerformanceNow();
    resultCallbacks.emit({
      transcript,
      confidence: getRecognizerConfidence(message),
      providerName: "voskLocal",
      raw: message,
      latencyMs: lastAudioAt ? Math.max(0, Math.round(now - lastAudioAt)) : null,
    });
  };

  const startAsync = async () => {
    if (listening || starting) {
      return;
    }

    starting = true;
    stateCallbacks.emit("loading");
    emitLifecycle({
      eventType: "lifecycle",
      action: "provider started",
      message: "Vosk Local provider start requested.",
      providerLoadStatus: "loading",
      listeningStatus: "starting",
    });
    emitLifecycle({
      eventType: "lifecycle",
      action: "model load start",
      message: `Loading Vosk model from ${modelUrl}.`,
      reason: `fetch URL: ${modelUrl}`,
      providerLoadStatus: "loading",
      listeningStatus: "starting",
    });

    try {
      if (isExtractedFolderModelUrl(modelUrl)) {
        throw createVoskError(
          `Vosk Local is configured with an extracted folder URL (${modelUrl}), but vosk-browser requires a gzipped tar archive URL such as /models/vosk/model.tar.gz.`,
          { action: "model load failure", modelUrl, fetchUrl: modelUrl }
        );
      }

      if (!hasWebAudioInput()) {
        throw createVoskError(
          "Vosk Local needs Web Audio microphone access in this browser.",
          { action: "provider error", modelUrl, fetchUrl: modelUrl }
        );
      }

      const vosk = await import("vosk-browser");
      model = await loadModelWithDiagnostics(vosk, modelUrl, options.logLevel ?? -1);
      emitLifecycle({
        eventType: "lifecycle",
        action: "model load success",
        message: `Vosk model loaded from ${modelUrl}.`,
        providerLoadStatus: "loaded",
        listeningStatus: "starting",
      });

      recognizer = new model.KaldiRecognizer(sampleRate, grammar);
      recognizer.setWords(Boolean(options.words));
      recognizer.on("result", emitResult);
      recognizer.on("error", (message) => emitError(
        message?.error || "Vosk recognizer error.",
        { action: "provider error" }
      ));

      audioInput = createWebAudioPrebuffer({
        ...(options.prebuffer ?? DEFAULT_PREBUFFER_OPTIONS),
        sampleRate,
        onAudio(samples) {
          if (!recognizer) {
            return;
          }

          try {
            lastAudioAt = getPerformanceNow();
            recognizer.acceptWaveformFloat(samples, sampleRate);
          } catch (error) {
            emitError(error, { action: "provider error" });
          }
        },
      });

      await audioInput.start();
      listening = true;
      stateCallbacks.emit("listening");
      emitLifecycle({
        eventType: "lifecycle",
        action: "listening started",
        message: "Vosk Local listening started.",
        providerLoadStatus: "loaded",
        listeningStatus: "listening",
      });
    } catch (error) {
      await stopAsync();
      const action = error?.action || "model load failure";
      emitLifecycle({
        eventType: "lifecycle",
        action,
        message: getErrorMessage(error, "Vosk model load failed."),
        reason: `fetch URL: ${error?.fetchUrl || modelUrl}`,
        providerLoadStatus: "error",
        listeningStatus: "error",
      });
      emitError(error, { action, modelUrl, fetchUrl: error?.fetchUrl || modelUrl });
    } finally {
      starting = false;
    }
  };

  const stopAsync = async () => {
    const hadActiveProvider = Boolean(audioInput || recognizer || model || listening || starting);
    listening = false;
    await audioInput?.stop?.();
    audioInput = null;

    try {
      recognizer?.retrieveFinalResult?.();
    } catch {
      // Ignore final-result races while tearing down the worker.
    }

    try {
      recognizer?.remove?.();
    } catch {
      // Ignore worker teardown races.
    }

    recognizer = null;

    try {
      model?.terminate?.();
    } catch {
      // Ignore worker teardown races.
    }

    model = null;
    stateCallbacks.emit("stopped");
    if (hadActiveProvider) {
      emitLifecycle({
        eventType: "lifecycle",
        action: "provider stopped",
        message: "Vosk Local provider stopped and cleaned up.",
        providerLoadStatus: "stopped",
        listeningStatus: "stopped",
      });
    }
  };

  return {
    providerName: "voskLocal",
    modelUrl,
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
    onLifecycle(callback) {
      return lifecycleCallbacks.add(callback);
    },
  };
}
