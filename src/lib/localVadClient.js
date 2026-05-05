const DEFAULT_LOCAL_VAD_WS_URL = "ws://127.0.0.1:8765/v1/vad";
const DEFAULT_LOCAL_VAD_HEALTH_URL = "http://127.0.0.1:8765/health";

export function getLocalVadUrls() {
  return {
    wsUrl: import.meta.env.VITE_LOCAL_VAD_WS_URL || DEFAULT_LOCAL_VAD_WS_URL,
    healthUrl: import.meta.env.VITE_LOCAL_VAD_HEALTH_URL || DEFAULT_LOCAL_VAD_HEALTH_URL,
  };
}

export async function fetchLocalVadHealth(healthUrl) {
  const response = await fetch(healthUrl, { cache: "no-store" });
  const text = await response.text();
  let payload = {};

  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { detail: text };
  }

  if (!response.ok) {
    const detail = payload?.detail || `${response.status} ${response.statusText}`.trim();
    throw new Error(`Local VAD health check failed: ${detail}`);
  }

  return payload;
}

export function createLocalVadClient({
  wsUrl,
  onOpen = () => {},
  onClose = () => {},
  onError = () => {},
  onEvent = () => {},
} = {}) {
  let socket = null;
  let closingByRequest = false;

  const getSocket = () => socket;

  const sendCommand = (command, payload = {}) => {
    const activeSocket = getSocket();
    if (!activeSocket || activeSocket.readyState !== WebSocket.OPEN) {
      throw new Error("Local VAD WebSocket is not connected.");
    }

    activeSocket.send(JSON.stringify({ command, ...payload }));
  };

  return {
    connect() {
      if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
        return;
      }

      closingByRequest = false;
      socket = new WebSocket(wsUrl || DEFAULT_LOCAL_VAD_WS_URL);
      socket.addEventListener("open", onOpen);
      socket.addEventListener("message", (message) => {
        try {
          onEvent(JSON.parse(message.data));
        } catch {
          onError(new Error("Local VAD emitted a non-JSON event."));
        }
      });
      socket.addEventListener("error", () => {
        onError(new Error("Unable to connect to the local VAD engine."));
      });
      socket.addEventListener("close", (event) => {
        const wasRequested = closingByRequest;
        socket = null;
        onClose(event, { wasRequested });
      });
    },
    disconnect() {
      closingByRequest = true;
      if (socket) {
        socket.close(1000, "Client disconnected");
        socket = null;
      }
    },
    startListening({ expected, type, category, notes, sessionId } = {}) {
      sendCommand("start_vad", {
        expected,
        type,
        category,
        notes,
        session_id: sessionId,
      });
    },
    stopListening() {
      sendCommand("stop_vad");
    },
    updateRecordingContext({ expected, type, category, notes, sessionId } = {}) {
      sendCommand("update_recording_context", {
        expected,
        type,
        category,
        notes,
        session_id: sessionId,
      });
    },
    startVoiceNote({ sessionId, trialIndex } = {}) {
      sendCommand("start_voice_note", { session_id: sessionId, trial_index: trialIndex });
    },
    stopVoiceNote() {
      sendCommand("stop_voice_note");
    },
    listAsrProviders() {
      sendCommand("list_asr_providers");
    },
    loadAsrProvider(provider) {
      sendCommand("load_asr_provider", { provider });
    },
    transcribeSegment({ provider, filename, path } = {}) {
      sendCommand("transcribe_segment", { provider, filename, path });
    },
    transcribeLatestSegment(provider) {
      sendCommand("transcribe_latest_segment", { provider });
    },
    arbitrateSegment({ providers, provider, filename, path, mode } = {}) {
      sendCommand("arbitrate_segment", { providers, provider, filename, path, mode });
    },
    arbitrateLatestSegment({ providers, provider, mode } = {}) {
      sendCommand("arbitrate_latest_segment", { providers, provider, mode });
    },
    deleteRecordingSegment(filename) {
      sendCommand("delete_recording_segment", { filename });
    },
    saveSegmentToCorpus({ sourceFilename, expected, type, category, notes, sessionId } = {}) {
      sendCommand("save_segment_to_corpus", {
        source_filename: sourceFilename,
        expected,
        type,
        category,
        notes,
        session_id: sessionId,
      });
    },
    isConnected() {
      return socket?.readyState === WebSocket.OPEN;
    },
  };
}
