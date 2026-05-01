import { isSpeechRecognitionSupported, startContinuousListening } from "./speechRecognition.js";
import { DEFAULT_PREBUFFER_OPTIONS, createWebAudioPrebuffer } from "./audioPrebuffer.js";
import { createSherpaOnnxLocalProvider } from "./sherpaOnnxVoiceProvider.js";
import { createVoskLocalProvider } from "./voskVoiceProvider.js";
import { createCallbackSet } from "./voiceProviderUtils.js";

export const VOICE_TARGET_COMMANDS = [
  "red",
  "blue",
  "A",
  "D",
  "space",
  "submit",
  "calibration",
  "test",
  "results",
];

export const PREBUFFERED_PROVIDER_IDS = new Set([
  "voskLocal",
  "sherpaOnnxLocal",
  "whisperApi",
  "localWhisper",
]);

export const VOICE_PROVIDER_OPTIONS = [
  {
    id: "browserSpeech",
    label: "Browser Speech",
    shortLabel: "Browser",
    description: "Built-in Web Speech API. No pre-buffer access.",
  },
  {
    id: "voskLocal",
    label: "Vosk Local",
    shortLabel: "Vosk",
    description: "Offline Vosk WASM/WebWorker ASR with constrained command vocabulary.",
  },
  {
    id: "sherpaOnnxLocal",
    label: "Sherpa ONNX Local",
    shortLabel: "Sherpa",
    description: "Offline Sherpa ONNX WebAssembly streaming ASR for short commands.",
  },
  {
    id: "whisperApi",
    label: "Whisper API",
    shortLabel: "Whisper API",
    description: "Planned cloud comparison provider using captured audio clips.",
  },
  {
    id: "localWhisper",
    label: "Whisper Local",
    shortLabel: "Whisper Local",
    description: "Future desktop/local model path.",
  },
  {
    id: "off",
    label: "Voice Off",
    shortLabel: "Off",
    description: "Disable voice recognition.",
  },
];

export function createBrowserSpeechProvider(options = {}) {
  const resultCallbacks = createCallbackSet();
  const errorCallbacks = createCallbackSet();
  const stateCallbacks = createCallbackSet();
  const lifecycleCallbacks = createCallbackSet();
  let listener = null;

  return {
    providerName: "browserSpeech",
    isAvailable: isSpeechRecognitionSupported,
    isSupported: isSpeechRecognitionSupported,
    start() {
      if (listener || !isSpeechRecognitionSupported()) {
        return;
      }

      listener = startContinuousListening({
        lang: options.lang,
        onResult: (result) => resultCallbacks.emit(result),
        onError: (error) => errorCallbacks.emit(error),
        onStateChange: (state) => stateCallbacks.emit(state),
        onLifecycle: (event) => lifecycleCallbacks.emit(event),
      });
    },
    stop() {
      listener?.stop?.();
      listener = null;
      stateCallbacks.emit("stopped");
    },
    cleanup() {
      this.stop();
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

function createUnavailableProvider(providerName, message, options = {}) {
  const errorCallbacks = createCallbackSet();
  const stateCallbacks = createCallbackSet();
  const prebuffer = PREBUFFERED_PROVIDER_IDS.has(providerName)
    ? createWebAudioPrebuffer(options.prebuffer ?? DEFAULT_PREBUFFER_OPTIONS)
    : null;

  return {
    providerName,
    targetCommands: VOICE_TARGET_COMMANDS,
    prebuffer,
    isAvailable() {
      return false;
    },
    isSupported() {
      return false;
    },
    start() {
      stateCallbacks.emit("unsupported");
      errorCallbacks.emit(new Error(message));
    },
    stop() {},
    cleanup() {},
    onResult() {
      return () => {};
    },
    onError(callback) {
      return errorCallbacks.add(callback);
    },
    onStateChange(callback) {
      return stateCallbacks.add(callback);
    },
  };
}

function createOffProvider() {
  const stateCallbacks = createCallbackSet();

  return {
    providerName: "off",
    isAvailable() {
      return true;
    },
    isSupported() {
      return true;
    },
    start() {
      stateCallbacks.emit("off");
    },
    stop() {
      stateCallbacks.emit("off");
    },
    cleanup() {},
    onResult() {
      return () => {};
    },
    onError() {
      return () => {};
    },
    onStateChange(callback) {
      return stateCallbacks.add(callback);
    },
  };
}

export function createWhisperApiProvider(options = {}) {
  return createUnavailableProvider(
    "whisperApi",
    "Whisper API is planned as a cloud comparison provider but is not implemented yet.",
    options
  );
}

export function createLocalWhisperProvider(options = {}) {
  return createUnavailableProvider(
    "localWhisper",
    "Whisper Local is planned for desktop/local recognition but is not implemented yet.",
    options
  );
}

function normalizeProviderId(providerId) {
  if (providerId === "openAiTranscription") {
    return "whisperApi";
  }
  if (providerId === "whisperLocal") {
    return "localWhisper";
  }
  return providerId;
}

export function createVoiceProvider(providerId, options = {}) {
  switch (normalizeProviderId(providerId)) {
    case "browserSpeech":
      return createBrowserSpeechProvider(options);
    case "voskLocal":
      return createVoskLocalProvider(options);
    case "sherpaOnnxLocal":
      return createSherpaOnnxLocalProvider(options);
    case "whisperApi":
      return createWhisperApiProvider(options);
    case "localWhisper":
      return createLocalWhisperProvider(options);
    case "off":
      return createOffProvider(options);
    default:
      return createBrowserSpeechProvider(options);
  }
}
