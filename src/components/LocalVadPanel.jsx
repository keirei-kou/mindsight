import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createLocalVadClient, fetchLocalVadHealth, getLocalVadUrls } from "../lib/localVadClient.js";

const MAX_EVENTS = 80;
const MAX_SEGMENTS = 20;
const LAB = {
  background: "#F7F6F2",
  surface: "#FFFFFF",
  surfaceMuted: "#FBFAF7",
  border: "#E6E2D9",
  text: "#1F1F1F",
  subtext: "#6B6B6B",
  primary: "#2F5D50",
  primarySoft: "#E7F0EC",
  success: "#3A7D44",
  error: "#A94442",
  warning: "#C58B2B",
};
const COMMAND_ALIASES = {
  read: "red",
  bread: "red",
  blew: "blue",
  to: "two",
  too: "two",
  won: "one",
};
const COMMAND_VOCABULARY = [
  "red",
  "blue",
  "yellow",
  "green",
  "orange",
  "purple",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "circle",
  "oval",
  "square",
  "rectangle",
  "triangle",
  "diamond",
  "star",
  "wavy",
  "cross",
  "calibration",
  "test",
  "results",
  "space",
  "submit",
];

function formatClockTime(timestamp) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return timestamp || "unknown";
  }

  const pad = (value) => String(value).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function formatValue(value) {
  if (value == null || value === "") {
    return "none";
  }

  return String(value);
}

function formatConfidence(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "none";
  }

  return String(Math.round(value * 100) / 100);
}

function formatLatency(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "none";
  }

  return `${Math.round(value)}ms`;
}

function getBasename(value) {
  return String(value || "").split(/[\\/]/).pop();
}

function normalizeAsrText(value) {
  const normalized = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return COMMAND_ALIASES[normalized] || normalized;
}

function getResultMeta(expected, normalizedTranscript, status) {
  if (!expected) {
    return { label: "", color: LAB.subtext };
  }

  if (status === "transcribing") {
    return { label: "pending", color: LAB.warning };
  }

  if (!normalizedTranscript) {
    return { label: "pending", color: LAB.warning };
  }

  return normalizedTranscript === expected
    ? { label: "pass", color: LAB.success }
    : { label: "fail", color: LAB.error };
}

function getSaveEligibility(segment) {
  const empty = {
    allowed: false,
    normalizedText: "",
    providerTexts: {},
  };

  if (!segment) {
    return empty;
  }

  const providerTexts = {};
  const addProviderText = (provider, rawValue, normalizedValue, commandValue) => {
    const name = provider || "unknown";
    const rawText = String(rawValue || "").trim();
    const normalizedText = normalizeAsrText(normalizedValue || rawText);
    const commandText = normalizeAsrText(commandValue);
    const usableText = commandText || normalizedText;

    providerTexts[name] = {
      raw: rawText,
      normalized: normalizedText,
      command: commandText,
      usable: usableText,
    };

    return usableText;
  };

  const usableTexts = [];
  const asrEntries = Object.values(segment.asr || {});
  asrEntries.forEach((entry) => {
    const usableText = addProviderText(entry?.provider, entry?.text, entry?.normalized_text, entry?.command);
    if (usableText) {
      usableTexts.push(usableText);
    }
  });

  const arbitration = segment.arbitration || {};
  const result = arbitration.result || {};
  const providerRuns = [
    ...(Array.isArray(arbitration.providerRuns) ? arbitration.providerRuns : []),
    ...(Array.isArray(result.provider_runs) ? result.provider_runs : []),
  ];
  providerRuns.forEach((run) => {
    const usableText = addProviderText(run?.provider, run?.raw_transcript || run?.text, run?.normalized_text, run?.command);
    if (usableText) {
      usableTexts.push(usableText);
    }
  });

  const candidates = Array.isArray(result.candidates) ? result.candidates : [];
  candidates.forEach((candidate) => {
    const usableText = addProviderText(candidate?.provider, candidate?.raw_transcript || candidate?.text, candidate?.normalized_text, candidate?.command);
    if (usableText) {
      usableTexts.push(usableText);
    }
  });

  const finalText = normalizeAsrText(result.final_command || result.final_text);
  if (finalText) {
    usableTexts.unshift(finalText);
  }

  return {
    allowed: usableTexts.length > 0,
    normalizedText: usableTexts[0] || "",
    providerTexts,
  };
}

function getConfidenceColor(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return LAB.subtext;
  }

  if (value >= 0.75) return LAB.success;
  if (value >= 0.35) return LAB.warning;
  return LAB.error;
}

function getStatusColor(status) {
  if (status === "connected" || status === "listening" || status === "active" || status === "speech" || status === "ready" || status === "loaded" || status === "saved") return LAB.success;
  if (status === "checking" || status === "connecting" || status === "starting" || status === "stopping" || status === "loading" || status === "transcribing" || status === "arbitrating" || status === "saving" || status === "deleting" || status === "pending" || status === "needs_review") return LAB.warning;
  if (status === "error") return LAB.error;
  return LAB.subtext;
}

function StatusPill({ label, value }) {
  const color = getStatusColor(value);

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "7px", minHeight: "30px", color: LAB.text, fontSize: "0.8rem" }}>
      <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: color, boxShadow: `0 0 0 3px ${color}22` }} />
      <span style={{ color: LAB.subtext }}>{label}</span>
      <strong style={{ color }}>{value}</strong>
    </span>
  );
}

function summarizeEvent(event) {
  if (event.type === "engine_started") {
    return `engine started / ${formatValue(event.vad_engine)} / ${event.sample_rate}Hz`;
  }

  if (event.type === "segment_saved") {
    return `segment saved / ${event.filename} / ${event.duration_ms}ms`;
  }

  if (event.type === "vad_speech_end") {
    return `speech ended / ${event.duration_ms}ms`;
  }

  if (event.type === "error") {
    return event.message || "error";
  }

  if (event.type === "asr_transcript") {
    return `${formatValue(event.provider)} / "${formatValue(event.text)}" / ${formatValue(event.filename)}`;
  }

  if (event.type === "asr_arbitration_started") {
    return `${formatValue(event.mode)} / ${formatValue(event.filename)} / ${Array.isArray(event.providers) ? event.providers.join(", ") : "providers pending"}`;
  }

  if (event.type === "asr_provider_result") {
    return `${formatValue(event.provider)} / "${formatValue(event.raw_transcript)}" / ${formatValue(event.filename)}`;
  }

  if (event.type === "asr_arbitration_result") {
    return `${formatValue(event.mode)} / ${formatValue(event.final_text)} / ${formatValue(event.decision_reason)}`;
  }

  if (event.type === "asr_arbitration_error") {
    return `${formatValue(event.provider)} / ${event.message || "Arbitration error"}`;
  }

  if (event.type === "asr_transcript_error" || event.type === "asr_model_error") {
    return `${formatValue(event.provider)} / ${event.message || "ASR error"}`;
  }

  if (event.type === "asr_model_ready") {
    return `${formatValue(event.provider)} model ready`;
  }

  if (event.type === "corpus_sample_saved") {
    return `corpus sample saved / ${formatValue(event.sample?.file)}`;
  }

  if (event.type === "corpus_sample_error") {
    return event.message || "corpus sample error";
  }

  if (event.type === "recording_segment_deleted") {
    return `recording segment deleted / ${formatValue(event.filename)}`;
  }

  if (event.type === "recording_segment_error") {
    return event.message || "recording segment error";
  }

  return event.type || "event";
}

export function LocalVadPanel() {
  const { wsUrl, healthUrl } = useMemo(() => getLocalVadUrls(), []);
  const clientRef = useRef(null);
  const selectedAsrProviderRef = useRef("vosk");
  const autoTranscribeRef = useRef(false);
  const autoTranscribeTouchedRef = useRef(false);
  const arbitrationProvidersTouchedRef = useRef(false);
  const asrProvidersRef = useRef([]);
  const autoProcessedSegmentsRef = useRef(new Set());
  const corpusFormRef = useRef({
    sessionId: "",
    expected: "",
    type: "command",
    category: "colors",
    notes: "",
  });
  const [connectionStatus, setConnectionStatus] = useState("disconnected");
  const [engineStatus, setEngineStatus] = useState("stopped");
  const [speechStatus, setSpeechStatus] = useState("idle");
  const [errorText, setErrorText] = useState("");
  const [health, setHealth] = useState(null);
  const [events, setEvents] = useState([]);
  const [segments, setSegments] = useState([]);
  const [asrProviders, setAsrProviders] = useState([]);
  const [selectedAsrProvider, setSelectedAsrProvider] = useState("vosk");
  const [asrStatus, setAsrStatus] = useState("idle");
  const [asrErrorText, setAsrErrorText] = useState("");
  const [arbitrationMode, setArbitrationMode] = useState("command");
  const [selectedArbitrationProviders, setSelectedArbitrationProviders] = useState([]);
  const [arbitrationStatus, setArbitrationStatus] = useState("idle");
  const [arbitrationErrorText, setArbitrationErrorText] = useState("");
  const [autoTranscribe, setAutoTranscribe] = useState(false);
  const [autoTranscribeMessage, setAutoTranscribeMessage] = useState("");
  const [selectedDebugFilename, setSelectedDebugFilename] = useState("");
  const [corpusForm, setCorpusForm] = useState({
    sessionId: "",
    expected: "",
    type: "command",
    category: "colors",
    notes: "",
  });
  const [corpusStatus, setCorpusStatus] = useState("idle");
  const [corpusMessage, setCorpusMessage] = useState("");

  const setSegmentAsrState = useCallback((filename, provider, nextState) => {
    setSegments((currentSegments) => currentSegments.map((segment) => {
      if (segment.filename !== filename) {
        return segment;
      }

      return {
        ...segment,
        asr: {
          ...(segment.asr || {}),
          [provider]: {
            ...(segment.asr?.[provider] || {}),
            provider,
            ...nextState,
          },
        },
      };
    }));
  }, []);

  const setSegmentArbitrationState = useCallback((filename, nextState) => {
    setSegments((currentSegments) => currentSegments.map((segment) => {
      if (segment.filename !== filename) {
        return segment;
      }

      return {
        ...segment,
        arbitration: {
          ...(segment.arbitration || {}),
          ...nextState,
        },
      };
    }));
  }, []);

  const appendSegmentArbitrationRun = useCallback((filename, providerRun) => {
    setSegments((currentSegments) => currentSegments.map((segment) => {
      if (segment.filename !== filename) {
        return segment;
      }

      const currentRuns = segment.arbitration?.providerRuns || [];
      return {
        ...segment,
        arbitration: {
          ...(segment.arbitration || {}),
          status: segment.arbitration?.status || "arbitrating",
          providerRuns: currentRuns
            .filter((run) => run.provider !== providerRun.provider)
            .concat(providerRun),
        },
      };
    }));
  }, []);

  const setSegmentLabelState = useCallback((filename, nextState) => {
    setSegments((currentSegments) => currentSegments.map((segment) => (
      segment.filename === filename
        ? { ...segment, ...nextState }
        : segment
    )));
  }, []);

  const maybeAutoTranscribeSegment = useCallback((segment) => {
    const provider = selectedAsrProviderRef.current;
    const providerStatus = asrProvidersRef.current.find((candidate) => candidate.name === provider);

    if (!autoTranscribeRef.current) {
      return;
    }

    if (!providerStatus?.loaded) {
      setAutoTranscribeMessage("Load provider to enable auto-transcription.");
      return;
    }

    const processedKey = `${segment.filename}::${provider}`;
    if (autoProcessedSegmentsRef.current.has(processedKey)) {
      return;
    }

    autoProcessedSegmentsRef.current.add(processedKey);
    setAutoTranscribeMessage("");
    setSegmentAsrState(segment.filename, provider, { status: "transcribing" });
    clientRef.current?.transcribeSegment({ provider, filename: segment.filename });
  }, [setSegmentAsrState]);

  const appendEvent = useCallback((event) => {
    setEvents((currentEvents) => [...currentEvents, event].slice(-MAX_EVENTS));

    if (event.type === "engine_started") {
      setEngineStatus("listening");
      setSpeechStatus("idle");
      setErrorText(event.vad_fallback_reason || "");
    } else if (event.type === "engine_stopped") {
      setEngineStatus("stopped");
      setSpeechStatus("idle");
    } else if (event.type === "vad_active" || event.type === "vad_speech_start") {
      setSpeechStatus("active");
    } else if (event.type === "vad_speech_end") {
      setSpeechStatus("idle");
    } else if (event.type === "segment_saved") {
      const labelSnapshot = corpusFormRef.current;
      const segment = {
        ...event,
        asr: {},
        arbitration: null,
        expected: labelSnapshot.expected.trim(),
        sampleType: labelSnapshot.type,
        category: labelSnapshot.category,
        notes: labelSnapshot.notes.trim(),
        sessionId: labelSnapshot.sessionId.trim(),
        corpusStatus: labelSnapshot.expected.trim() ? "pending" : "needs_review",
        corpusError: "",
      };
      setSelectedDebugFilename(segment.filename);
      setSegments((currentSegments) => [segment, ...currentSegments].slice(0, MAX_SEGMENTS));
      maybeAutoTranscribeSegment(segment);
    } else if (event.type === "error") {
      setErrorText(event.message || "Local VAD error.");
      setEngineStatus("error");
    } else if (event.type === "asr_provider_status") {
      const providers = Array.isArray(event.providers) ? event.providers : [];
      setAsrProviders(providers);
      if (event.default_provider) {
        setSelectedAsrProvider((currentProvider) => currentProvider || event.default_provider);
      }
      if (!autoTranscribeTouchedRef.current) {
        const providerName = selectedAsrProviderRef.current || event.default_provider || "vosk";
        const providerStatus = providers.find((provider) => provider.name === providerName);
        const shouldAutoTranscribe = Boolean(providerStatus?.loaded);
        setAutoTranscribe(shouldAutoTranscribe);
        if (shouldAutoTranscribe) {
          setAutoTranscribeMessage("");
        }
      }
      if (!arbitrationProvidersTouchedRef.current) {
        setSelectedArbitrationProviders(providers
          .filter((provider) => provider.loaded)
          .map((provider) => provider.name));
      }
    } else if (event.type === "asr_model_loading") {
      setAsrStatus("loading");
      setAsrErrorText("");
    } else if (event.type === "asr_model_ready") {
      setAsrStatus("ready");
      setAsrErrorText("");
      if (event.provider === selectedAsrProviderRef.current && autoTranscribeRef.current) {
        setAutoTranscribeMessage("");
      }
    } else if (event.type === "asr_model_error" || event.type === "asr_transcript_error") {
      setAsrStatus("error");
      setAsrErrorText([event.message, event.setup_hint].filter(Boolean).join(" "));
      if (event.filename && event.provider) {
        setSegmentAsrState(event.filename, event.provider, {
          status: "error",
          error: [event.message, event.setup_hint].filter(Boolean).join(" "),
        });
      }
    } else if (event.type === "asr_transcript") {
      setAsrStatus("ready");
      setAsrErrorText("");
      setSegmentAsrState(event.filename, event.provider, {
        status: "ready",
        text: event.text || "",
        confidence: event.confidence,
        duration_ms: event.duration_ms,
        sample_rate: event.sample_rate,
      });
    } else if (event.type === "asr_arbitration_started") {
      setArbitrationStatus("arbitrating");
      setArbitrationErrorText("");
      if (event.filename) {
        setSegmentArbitrationState(event.filename, {
          status: "arbitrating",
          mode: event.mode || arbitrationMode,
          providers: Array.isArray(event.providers) ? event.providers : selectedArbitrationProviders,
          providerRuns: [],
          result: null,
          error: "",
        });
      }
    } else if (event.type === "asr_provider_result") {
      if (event.filename) {
        appendSegmentArbitrationRun(event.filename, event);
      }
    } else if (event.type === "asr_arbitration_result") {
      setArbitrationStatus("ready");
      setArbitrationErrorText("");
      if (event.filename) {
        setSegmentArbitrationState(event.filename, {
          status: "ready",
          mode: event.mode || arbitrationMode,
          providers: Array.isArray(event.selected_providers) ? event.selected_providers : selectedArbitrationProviders,
          providerRuns: Array.isArray(event.provider_runs) ? event.provider_runs : [],
          result: event,
          error: "",
        });
      }
    } else if (event.type === "asr_arbitration_error") {
      setArbitrationStatus("error");
      setArbitrationErrorText([event.message, event.setup_hint].filter(Boolean).join(" "));
      if (event.filename) {
        setSegmentArbitrationState(event.filename, {
          status: "error",
          mode: event.mode || arbitrationMode,
          providers: Array.isArray(event.providers) ? event.providers : selectedArbitrationProviders,
          error: [event.message, event.setup_hint].filter(Boolean).join(" "),
        });
      }
    } else if (event.type === "corpus_sample_saved") {
      setCorpusStatus("ready");
      const sampleFile = event.sample?.file || event.sample?.filename || "";
      setCorpusMessage(`Saved ${sampleFile || "labeled sample"}.`);
      const savedFilename = getBasename(sampleFile);
      if (savedFilename) {
        setSegmentLabelState(savedFilename, {
          expected: event.sample?.expected || "",
          sampleType: event.sample?.type || event.sample?.mode || "command",
          category: event.sample?.category || "other",
          notes: event.sample?.notes || "",
          corpusSaved: true,
          corpusStatus: "saved",
          corpusError: "",
        });
      }
    } else if (event.type === "corpus_sample_error") {
      setCorpusStatus("error");
      setCorpusMessage([event.message, event.setup_hint].filter(Boolean).join(" "));
      if (event.filename) {
        setSegmentLabelState(event.filename, {
          corpusStatus: "needs_review",
          corpusError: [event.message, event.setup_hint].filter(Boolean).join(" "),
        });
      }
    } else if (event.type === "recording_segment_deleted") {
      setCorpusStatus("ready");
      setCorpusMessage(`Deleted ${event.filename}.`);
      setSegments((currentSegments) => currentSegments.filter((segment) => segment.filename !== event.filename));
      setSelectedDebugFilename((currentFilename) => (currentFilename === event.filename ? "" : currentFilename));
    } else if (event.type === "recording_segment_error") {
      setCorpusStatus("error");
      setCorpusMessage([event.message, event.setup_hint].filter(Boolean).join(" "));
      if (event.filename) {
        setSegmentLabelState(event.filename, {
          corpusStatus: "needs_review",
          corpusError: [event.message, event.setup_hint].filter(Boolean).join(" "),
        });
      }
    }
  }, [appendSegmentArbitrationRun, arbitrationMode, maybeAutoTranscribeSegment, selectedArbitrationProviders, setSegmentArbitrationState, setSegmentAsrState, setSegmentLabelState]);

  const connect = async () => {
    if (connectionStatus === "connected" || connectionStatus === "connecting" || connectionStatus === "checking") {
      return;
    }

    setErrorText("");
    setConnectionStatus("checking");
    try {
      const healthPayload = await fetchLocalVadHealth(healthUrl);
      setHealth(healthPayload);
    } catch (error) {
      setConnectionStatus("error");
      setErrorText(error instanceof Error ? error.message : "Local VAD service is not running.");
      return;
    }

    setConnectionStatus("connecting");
    const client = createLocalVadClient({
      wsUrl,
      onOpen: () => {
        setConnectionStatus("connected");
        setErrorText("");
        client.listAsrProviders();
      },
      onClose: (event, { wasRequested }) => {
        setConnectionStatus("disconnected");
        setEngineStatus("stopped");
        setSpeechStatus("idle");
        if (!wasRequested && event.code !== 1000) {
          setErrorText(`Local VAD connection closed (${event.code || "unknown"}).`);
        }
      },
      onError: (error) => {
        setConnectionStatus("error");
        setErrorText(error instanceof Error ? error.message : "Local VAD connection error.");
      },
      onEvent: appendEvent,
    });

    clientRef.current = client;
    client.connect();
  };

  const disconnect = () => {
    try {
      if (engineStatus === "listening" || engineStatus === "starting") {
        clientRef.current?.stopListening();
      }
    } catch {
      // The socket may already be closing; the backend also stops on last disconnect.
    }

    clientRef.current?.disconnect();
    clientRef.current = null;
    setConnectionStatus("disconnected");
    setEngineStatus("stopped");
    setSpeechStatus("idle");
  };

  const startListening = () => {
    if (!clientRef.current || engineStatus === "starting" || engineStatus === "listening") {
      return;
    }

    try {
      setErrorText("");
      setEngineStatus("starting");
      clientRef.current?.startListening();
    } catch (error) {
      setEngineStatus("error");
      setErrorText(error instanceof Error ? error.message : "Unable to start local VAD.");
    }
  };

  const stopListening = () => {
    if (!clientRef.current || engineStatus === "stopping" || engineStatus === "stopped") {
      return;
    }

    try {
      setEngineStatus("stopping");
      clientRef.current?.stopListening();
    } catch (error) {
      setEngineStatus("error");
      setErrorText(error instanceof Error ? error.message : "Unable to stop local VAD.");
    }
  };

  const loadAsrProvider = (provider) => {
    try {
      setAsrStatus("loading");
      setAsrErrorText("");
      clientRef.current?.loadAsrProvider(provider);
    } catch (error) {
      setAsrStatus("error");
      setAsrErrorText(error instanceof Error ? error.message : "Unable to load ASR provider.");
    }
  };

  const rerunSegmentTranscription = (filename) => {
    try {
      const targetFilename = filename || latestSegment?.filename || "";
      if (!targetFilename) {
        setAsrStatus("error");
        setAsrErrorText("Create a saved VAD segment before re-running transcription.");
        return;
      }

      setAsrStatus("transcribing");
      setAsrErrorText("");
      setSegmentAsrState(targetFilename, selectedAsrProvider, { status: "transcribing", error: "" });
      clientRef.current?.transcribeSegment({ provider: selectedAsrProvider, filename: targetFilename });
    } catch (error) {
      setAsrStatus("error");
      setAsrErrorText(error instanceof Error ? error.message : "Unable to re-run transcription.");
    }
  };

  const toggleArbitrationProvider = (providerName) => {
    arbitrationProvidersTouchedRef.current = true;
    setSelectedArbitrationProviders((currentProviders) => {
      if (currentProviders.includes(providerName)) {
        return currentProviders.filter((provider) => provider !== providerName);
      }
      return [...currentProviders, providerName];
    });
  };

  const runArbitration = (filename, useLatest = false) => {
    try {
      const providers = selectedArbitrationProviders;
      const targetFilename = filename || latestSegment?.filename || "";
      if (!useLatest && !targetFilename) {
        setArbitrationStatus("error");
        setArbitrationErrorText("Create a saved VAD segment before running arbitration.");
        return;
      }

      if (!providers.length) {
        setArbitrationStatus("error");
        setArbitrationErrorText("Load and select at least one sidecar ASR provider before running arbitration.");
        return;
      }

      setArbitrationStatus("arbitrating");
      setArbitrationErrorText("");
      if (targetFilename) {
        setSegmentArbitrationState(targetFilename, {
          status: "arbitrating",
          mode: arbitrationMode,
          providers,
          providerRuns: [],
          result: null,
          error: "",
        });
      }

      if (useLatest) {
        clientRef.current?.arbitrateLatestSegment({ providers, mode: arbitrationMode });
      } else {
        clientRef.current?.arbitrateSegment({ providers, filename: targetFilename, mode: arbitrationMode });
      }
    } catch (error) {
      setArbitrationStatus("error");
      setArbitrationErrorText(error instanceof Error ? error.message : "Unable to run arbitration.");
    }
  };

  const saveSegmentToCorpus = (segment) => {
    if (!segment) {
      setCorpusStatus("error");
      setCorpusMessage("Select or create a saved VAD segment first.");
      return;
    }

    const saveEligibility = getSaveEligibility(segment);
    const expected = String(segment.expected || saveEligibility.normalizedText || "").trim();
    if (import.meta.env.DEV) {
      console.debug("voice-engine-corpus-save", {
        filename: segment.filename,
        vosk_text: saveEligibility.providerTexts.vosk?.raw || "",
        sherpa_text: saveEligibility.providerTexts.sherpa?.raw || "",
        normalized_text: saveEligibility.normalizedText,
        save_allowed: saveEligibility.allowed,
      });
    }

    if (!expected) {
      setCorpusStatus("error");
      setCorpusMessage("Enter expected text before saving a labeled sample.");
      setSegmentLabelState(segment.filename, {
        corpusStatus: "needs_review",
        corpusError: "Expected label is required before saving.",
      });
      return;
    }

    if (!saveEligibility.allowed) {
      setCorpusStatus("error");
      setCorpusMessage("Run ASR first. At least one provider needs a transcript before saving to the corpus.");
      setSegmentLabelState(segment.filename, {
        corpusStatus: "needs_review",
        corpusError: "At least one provider transcript is required before saving.",
      });
      return;
    }

    try {
      setCorpusStatus("saving");
      setCorpusMessage("");
      setSegmentLabelState(segment.filename, {
        expected,
        corpusStatus: "saving",
        corpusError: "",
      });
      clientRef.current?.saveSegmentToCorpus({
        sourceFilename: segment.filename,
        expected,
        type: segment.sampleType || "command",
        category: segment.category || "other",
        notes: segment.notes || "",
        sessionId: segment.sessionId || "",
      });
    } catch (error) {
      setCorpusStatus("error");
      setCorpusMessage(error instanceof Error ? error.message : "Unable to save segment to corpus.");
      setSegmentLabelState(segment.filename, {
        corpusStatus: "needs_review",
        corpusError: error instanceof Error ? error.message : "Unable to save segment to corpus.",
      });
    }
  };

  const deleteRecordingSegment = (segment) => {
    if (!segment) {
      return;
    }

    if (!window.confirm(`Delete ${segment.filename}? This removes the WAV from local_speech_engine/recordings.`)) {
      return;
    }

    try {
      setCorpusStatus("saving");
      setCorpusMessage(`Deleting ${segment.filename}...`);
      setSegmentLabelState(segment.filename, {
        corpusStatus: "deleting",
        corpusError: "",
      });
      clientRef.current?.deleteRecordingSegment(segment.filename);
    } catch (error) {
      setCorpusStatus("error");
      setCorpusMessage(error instanceof Error ? error.message : "Unable to delete segment.");
      setSegmentLabelState(segment.filename, {
        corpusStatus: "needs_review",
        corpusError: error instanceof Error ? error.message : "Unable to delete segment.",
      });
    }
  };

  const toggleIgnoreSegment = (segment) => {
    if (!segment) {
      return;
    }

    const isIgnored = segment.corpusStatus === "ignored";
    setSegmentLabelState(segment.filename, {
      corpusStatus: isIgnored ? (segment.expected ? "pending" : "needs_review") : "ignored",
      corpusError: "",
    });
  };

  const applySelectedSegmentLabel = () => {
    if (!selectedSegment) {
      setCorpusStatus("error");
      setCorpusMessage("Select or create a saved VAD segment first.");
      return;
    }

    setSegmentLabelState(selectedSegment.filename, {
      sessionId: corpusForm.sessionId.trim(),
      expected: corpusForm.expected.trim(),
      sampleType: corpusForm.type,
      category: corpusForm.category,
      notes: corpusForm.notes.trim(),
      corpusStatus: corpusForm.expected.trim() ? "pending" : "needs_review",
      corpusError: "",
    });
    setCorpusStatus("ready");
    setCorpusMessage(`Updated label snapshot for ${selectedSegment.filename}.`);
  };

  useEffect(() => () => {
    clientRef.current?.disconnect();
  }, []);

  useEffect(() => {
    selectedAsrProviderRef.current = selectedAsrProvider;
  }, [selectedAsrProvider]);

  useEffect(() => {
    autoTranscribeRef.current = autoTranscribe;
  }, [autoTranscribe]);

  useEffect(() => {
    asrProvidersRef.current = asrProviders;
  }, [asrProviders]);

  useEffect(() => {
    corpusFormRef.current = corpusForm;
  }, [corpusForm]);

  const isConnected = connectionStatus === "connected";
  const isConnecting = connectionStatus === "checking" || connectionStatus === "connecting";
  const isListening = engineStatus === "listening" || engineStatus === "starting";
  const isStopping = engineStatus === "stopping";
  const isVadToggleDisabled = !isConnected || engineStatus === "starting" || isStopping;
  const latestSegment = segments[0] || null;
  const selectedSegment = segments.find((segment) => segment.filename === selectedDebugFilename) || latestSegment;
  const selectedSegmentFilename = selectedSegment?.filename || "";
  const selectedProviderStatus = asrProviders.find((provider) => provider.name === selectedAsrProvider);
  const isSelectedProviderLoaded = Boolean(selectedProviderStatus?.loaded);
  const arbitrationProviderOptions = asrProviders.length ? asrProviders : [{ name: "vosk" }, { name: "sherpa" }];
  const debugSegmentFilename = segments.some((segment) => segment.filename === selectedDebugFilename)
    ? selectedDebugFilename
    : latestSegment?.filename || "";
  const isDebugLatestSegment = Boolean(latestSegment && debugSegmentFilename === latestSegment.filename);
  const corpusCategoryOptions = corpusForm.type === "command"
    ? ["colors", "numbers", "shapes", "other"]
    : ["trial_note", "other"];
  const transcriptRows = useMemo(() => segments.map((segment, index) => {
    const providerTranscript = segment.asr?.[selectedAsrProvider];
    const status = providerTranscript?.status || "pending";
    const confidence = providerTranscript?.confidence;
    const text = providerTranscript?.text || "";
    const rawTranscript = status === "error" ? providerTranscript?.error || "Transcript error" : text;
    const normalizedTranscript = normalizeAsrText(text);
    const saveEligibility = getSaveEligibility(segment);
    const expectedRaw = segment.expected || saveEligibility.normalizedText || "";
    const expected = normalizeAsrText(expectedRaw);
    const result = getResultMeta(expected, normalizedTranscript, status);

    return {
      key: `${segment.sequence}-${segment.filename}-${selectedAsrProvider}`,
      index: index + 1,
      filename: segment.filename,
      duration: `${segment.duration_ms}ms`,
      provider: providerTranscript?.provider || selectedAsrProvider,
      rawTranscript: status === "transcribing" ? "Transcribing..." : rawTranscript || "No transcript yet",
      normalizedTranscript,
      confidence,
      expectedRaw,
      expected,
      sampleType: segment.sampleType || "command",
      category: segment.category || "other",
      notes: segment.notes || "",
      sessionId: segment.sessionId || "",
      corpusStatus: segment.corpusStatus || (segment.corpusSaved ? "saved" : segment.expected ? "pending" : "needs_review"),
      corpusError: segment.corpusError || "",
      result,
      status,
      error: providerTranscript?.error || "",
      hasSaveableProviderText: saveEligibility.allowed,
      selected: selectedSegmentFilename === segment.filename,
      segment,
    };
  }), [segments, selectedAsrProvider, selectedSegmentFilename]);
  const selectedArbitration = selectedSegment?.arbitration || null;
  const selectedArbitrationResult = selectedArbitration?.result || null;
  const arbitrationRows = useMemo(() => {
    const runs = selectedArbitrationResult?.provider_runs || selectedArbitration?.providerRuns || [];
    const candidates = selectedArbitrationResult?.candidates || [];

    return runs.map((run) => {
      const candidate = candidates.find((item) => item.provider === run.provider) || {};
      const errorText = run.error
        ? [run.error.message, run.error.setup_hint].filter(Boolean).join(" ")
        : "";

      return {
        key: `${selectedSegmentFilename}-${run.provider}`,
        provider: run.provider,
        rawTranscript: run.raw_transcript || "",
        normalizedText: candidate.normalized_text || "",
        command: candidate.command || "",
        confidence: run.confidence,
        latencyMs: run.latency_ms,
        error: errorText,
      };
    });
  }, [selectedArbitration, selectedArbitrationResult, selectedSegmentFilename]);
  const autoTranscribeLabel = autoTranscribe ? "ON" : "OFF";
  const autoTranscribeColor = autoTranscribe ? LAB.success : LAB.subtext;
  const capturedHeaderCellStyle = {
    padding: "8px",
    borderBottom: `1px solid ${LAB.border}`,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };
  const capturedCellStyle = {
    padding: "8px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };
  const recordingContextFieldStyle = {
    display: "grid",
    gridTemplateRows: "20px 38px",
    gap: "6px",
    alignItems: "start",
    minWidth: 0,
    color: LAB.text,
    fontSize: "0.78rem",
    fontWeight: 700,
  };
  const recordingContextLabelTextStyle = {
    display: "block",
    height: "20px",
    lineHeight: "20px",
    overflow: "hidden",
    textAlign: "center",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };
  const recordingContextControlStyle = {
    boxSizing: "border-box",
    width: "100%",
    height: "38px",
    minHeight: "38px",
    background: LAB.surface,
    border: `1px solid ${LAB.border}`,
    color: LAB.text,
    borderRadius: "6px",
    padding: "7px 9px",
    font: "inherit",
  };

  const toggleVad = () => {
    if (isVadToggleDisabled) {
      return;
    }

    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  return (
    <section style={{ background: LAB.surface, border: `1px solid ${LAB.border}`, borderRadius: "8px", padding: "16px", display: "grid", gap: "14px", color: LAB.text, boxShadow: "0 14px 34px rgba(47, 93, 80, 0.08)" }}>
      <header style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
        <div style={{ display: "grid", gap: "4px", minWidth: 0 }}>
          <h2 style={{ margin: 0, color: LAB.text, fontSize: "1.08rem", fontWeight: 850 }}>Local VAD Engine</h2>
          <span style={{ color: LAB.subtext, fontSize: "0.78rem", overflowWrap: "anywhere" }}>VAD to saved WAV segment to ASR transcript to evaluation to corpus</span>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
          <button
            type="button"
            onClick={connect}
            disabled={isConnected || isConnecting}
            style={{ minHeight: "38px", background: isConnected ? LAB.success : LAB.primary, color: "#ffffff", border: `1px solid ${isConnected ? LAB.success : LAB.primary}`, borderRadius: "6px", padding: "8px 12px", font: "inherit", fontWeight: 800, cursor: isConnected || isConnecting ? "not-allowed" : "pointer", opacity: isConnected || isConnecting ? 0.78 : 1 }}
          >
            {isConnecting ? "Connecting..." : isConnected ? "Connected" : "Connect"}
          </button>
          <button
            type="button"
            onClick={disconnect}
            disabled={!isConnected && !isConnecting}
            style={{ minHeight: "38px", background: LAB.surfaceMuted, color: LAB.text, border: `1px solid ${LAB.border}`, borderRadius: "6px", padding: "8px 12px", font: "inherit", fontWeight: 750, cursor: !isConnected && !isConnecting ? "not-allowed" : "pointer", opacity: !isConnected && !isConnecting ? 0.65 : 1 }}
          >
            Disconnect
          </button>
        </div>
      </header>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 16px", alignItems: "center", padding: "10px", background: LAB.surfaceMuted, border: `1px solid ${LAB.border}`, borderRadius: "8px" }}>
        <StatusPill label="socket" value={connectionStatus} />
        <StatusPill label="engine" value={engineStatus} />
        <StatusPill label="vad" value={speechStatus} />
        {health && <span style={{ color: LAB.subtext, fontSize: "0.78rem" }}>{health.sample_rate}Hz / {health.prebuffer_ms}ms prebuffer / {health.hangover_ms}ms hangover</span>}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
        <button
          type="button"
          onClick={toggleVad}
          disabled={isVadToggleDisabled}
          style={{ minHeight: "40px", minWidth: "150px", background: isListening ? LAB.error : LAB.primary, color: "#ffffff", border: "1px solid " + (isListening ? LAB.error : LAB.primary), borderRadius: "6px", padding: "9px 14px", font: "inherit", fontWeight: 850, cursor: isVadToggleDisabled ? "not-allowed" : "pointer", opacity: isVadToggleDisabled ? 0.72 : 1 }}
        >
          {isListening ? "Stop VAD" : isStopping ? "Stopping..." : "Start VAD"}
        </button>
      </div>

      <section style={{ display: "grid", gap: "10px", background: LAB.surfaceMuted, border: `1px solid ${LAB.border}`, borderRadius: "8px", padding: "12px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
          <div style={{ display: "grid", gap: "3px" }}>
            <h3 style={{ margin: 0, color: LAB.text, fontSize: "0.94rem", fontWeight: 800 }}>Recording Context</h3>
            <span style={{ color: LAB.subtext, fontSize: "0.76rem" }}>Choose the label before recording. New captured segments snapshot these values for corpus review.</span>
          </div>
          <StatusPill label="corpus" value={corpusStatus} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: "10px", alignItems: "start" }}>
          <label style={recordingContextFieldStyle}>
            <span style={recordingContextLabelTextStyle}>Session ID</span>
            <input
              value={corpusForm.sessionId}
              onChange={(event) => setCorpusForm((current) => ({ ...current, sessionId: event.target.value }))}
              placeholder="colors_red_2026-05-03"
              style={recordingContextControlStyle}
            />
          </label>
          <label style={recordingContextFieldStyle}>
            <span style={recordingContextLabelTextStyle}>Expected label</span>
            <input
              value={corpusForm.expected}
              onChange={(event) => setCorpusForm((current) => ({ ...current, expected: event.target.value }))}
              placeholder="red"
              list="local-vad-command-vocabulary"
              style={recordingContextControlStyle}
            />
            <datalist id="local-vad-command-vocabulary">
              {COMMAND_VOCABULARY.map((command) => (
                <option key={command} value={command} />
              ))}
            </datalist>
          </label>
          <label style={recordingContextFieldStyle}>
            <span style={recordingContextLabelTextStyle}>Type</span>
            <select
              value={corpusForm.type}
              onChange={(event) => {
                const nextType = event.target.value;
                setCorpusForm((current) => ({
                  ...current,
                  type: nextType,
                  category: nextType === "command" ? "colors" : "trial_note",
                }));
              }}
              style={recordingContextControlStyle}
            >
              <option value="command">command</option>
              <option value="voice_note">voice_note</option>
            </select>
          </label>
          <label style={recordingContextFieldStyle}>
            <span style={recordingContextLabelTextStyle}>Category</span>
            <select
              value={corpusForm.category}
              onChange={(event) => setCorpusForm((current) => ({ ...current, category: event.target.value }))}
              style={recordingContextControlStyle}
            >
              {corpusCategoryOptions.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </label>
          <label style={recordingContextFieldStyle}>
            <span style={recordingContextLabelTextStyle}>Notes</span>
            <input
              value={corpusForm.notes}
              onChange={(event) => setCorpusForm((current) => ({ ...current, notes: event.target.value }))}
              placeholder="optional"
              style={recordingContextControlStyle}
            />
          </label>
        </div>
        <div style={{ color: corpusStatus === "error" ? LAB.error : corpusStatus === "ready" ? LAB.success : LAB.subtext, fontSize: "0.78rem", lineHeight: 1.45, overflowWrap: "anywhere" }}>
          {corpusMessage || "Workflow: connect, choose label/category/session, record segments, delete noise, then save clean clips from the captured segment table."}
        </div>
      </section>

      <section style={{ display: "grid", gap: "10px", background: LAB.surfaceMuted, border: `1px solid ${LAB.border}`, borderRadius: "8px", padding: "12px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
          <h3 style={{ margin: 0, color: LAB.text, fontSize: "0.94rem", fontWeight: 800 }}>Transcription</h3>
          <StatusPill label="asr" value={asrStatus} />
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "end", gap: "8px 12px" }}>
          <label style={{ display: "grid", gap: "6px", color: LAB.text, fontSize: "0.78rem", fontWeight: 700 }}>
            Provider
            <select
              value={selectedAsrProvider}
              onChange={(event) => {
                const nextProvider = event.target.value;
                selectedAsrProviderRef.current = nextProvider;
                setSelectedAsrProvider(nextProvider);
                if (!autoTranscribeTouchedRef.current) {
                  const providerStatus = asrProvidersRef.current.find((provider) => provider.name === nextProvider);
                  setAutoTranscribe(Boolean(providerStatus?.loaded));
                }
              }}
              disabled={!isConnected}
              style={{ minWidth: "160px", minHeight: "36px", background: LAB.surface, border: `1px solid ${LAB.border}`, color: LAB.text, borderRadius: "6px", padding: "7px 9px", font: "inherit" }}
            >
              {(asrProviders.length ? asrProviders : [{ name: "vosk" }, { name: "sherpa" }]).map((provider) => (
                <option key={provider.name} value={provider.name}>{provider.name}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => loadAsrProvider(selectedAsrProvider)}
            disabled={!isConnected || asrStatus === "loading"}
            style={{ minHeight: "36px", background: LAB.primary, color: "#ffffff", border: `1px solid ${LAB.primary}`, borderRadius: "6px", padding: "8px 11px", font: "inherit", fontWeight: 750, cursor: !isConnected || asrStatus === "loading" ? "not-allowed" : "pointer", opacity: !isConnected || asrStatus === "loading" ? 0.7 : 1 }}
          >
            Load Provider
          </button>
          <label style={{ display: "inline-flex", alignItems: "center", gap: "8px", color: LAB.text, fontSize: "0.8rem", lineHeight: 1.4, minHeight: "36px" }}>
            <input
              type="checkbox"
              checked={autoTranscribe}
              onChange={(event) => {
                autoTranscribeTouchedRef.current = true;
                const nextValue = event.target.checked;
                setAutoTranscribe(nextValue);
                if (nextValue && !isSelectedProviderLoaded) {
                  setAutoTranscribeMessage("Load provider to enable auto-transcription.");
                } else {
                  setAutoTranscribeMessage("");
                }
              }}
              disabled={!isConnected}
              style={{ accentColor: LAB.primary }}
            />
            Auto-transcribe saved segments
          </label>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "7px", color: LAB.text, fontSize: "0.78rem", minHeight: "36px" }}>
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: autoTranscribeColor, boxShadow: `0 0 0 3px ${autoTranscribeColor}22` }} />
            Auto-transcribe: <strong style={{ color: autoTranscribeColor }}>{autoTranscribeLabel}</strong>
          </span>
        </div>
        {autoTranscribeMessage && (
          <div style={{ color: LAB.warning, fontSize: "0.78rem", lineHeight: 1.45, overflowWrap: "anywhere" }}>{autoTranscribeMessage}</div>
        )}
        {asrErrorText && (
          <div style={{ color: LAB.error, fontSize: "0.78rem", lineHeight: 1.45, overflowWrap: "anywhere" }}>{asrErrorText}</div>
        )}
        <section style={{ display: "grid", gap: "10px", background: LAB.surface, border: `1px solid ${LAB.border}`, borderRadius: "7px", padding: "10px" }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
            <h4 style={{ margin: 0, color: LAB.text, fontSize: "0.88rem", fontWeight: 800 }}>ASR Arbitration</h4>
            <StatusPill label="arbiter" value={arbitrationStatus} />
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "end", gap: "10px 14px" }}>
            <label style={{ display: "grid", gap: "6px", color: LAB.text, fontSize: "0.78rem", fontWeight: 700 }}>
              Mode
              <select
                value={arbitrationMode}
                onChange={(event) => setArbitrationMode(event.target.value)}
                disabled={!isConnected}
                style={{ minWidth: "150px", minHeight: "36px", background: LAB.surfaceMuted, border: `1px solid ${LAB.border}`, color: LAB.text, borderRadius: "6px", padding: "7px 9px", font: "inherit" }}
              >
                <option value="command">command</option>
                <option value="voice_note">voice_note</option>
              </select>
            </label>
            <div style={{ display: "grid", gap: "6px", minWidth: "220px" }}>
              <span style={{ color: LAB.text, fontSize: "0.78rem", fontWeight: 700 }}>Providers</span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {arbitrationProviderOptions.map((provider) => {
                  const checked = selectedArbitrationProviders.includes(provider.name);
                  const providerLoaded = Boolean(provider.loaded);
                  const providerAvailable = provider.available !== false;
                  const providerStatusLabel = providerLoaded
                    ? "loaded"
                    : providerAvailable
                      ? "not loaded"
                      : "unavailable";
                  const providerStatusColor = providerLoaded
                    ? LAB.success
                    : providerAvailable
                      ? LAB.warning
                      : LAB.subtext;
                  return (
                    <label key={provider.name} title={provider.message || provider.setup_hint || providerStatusLabel} style={{ display: "inline-flex", alignItems: "center", gap: "6px", minHeight: "30px", color: providerAvailable ? LAB.text : LAB.subtext, fontSize: "0.78rem" }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleArbitrationProvider(provider.name)}
                        disabled={!isConnected}
                        style={{ accentColor: LAB.primary }}
                      />
                      <span>{provider.name}</span>
                      <span style={{ color: providerStatusColor, border: `1px solid ${providerStatusColor}55`, background: providerLoaded ? `${LAB.success}12` : LAB.surfaceMuted, borderRadius: "999px", padding: "1px 6px", fontSize: "0.68rem", lineHeight: 1.35 }}>
                        {providerStatusLabel}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
            <button
              type="button"
              onClick={() => runArbitration(latestSegment?.filename, true)}
              disabled={!isConnected || !latestSegment || arbitrationStatus === "arbitrating"}
              style={{ minHeight: "36px", background: LAB.primary, color: "#ffffff", border: `1px solid ${LAB.primary}`, borderRadius: "6px", padding: "8px 11px", font: "inherit", fontWeight: 750, cursor: !isConnected || !latestSegment || arbitrationStatus === "arbitrating" ? "not-allowed" : "pointer", opacity: !isConnected || !latestSegment || arbitrationStatus === "arbitrating" ? 0.7 : 1 }}
            >
              Arbitrate latest segment
            </button>
            <button
              type="button"
              onClick={() => runArbitration(selectedSegmentFilename, false)}
              disabled={!isConnected || !selectedSegmentFilename || arbitrationStatus === "arbitrating"}
              style={{ minHeight: "36px", background: LAB.surfaceMuted, color: LAB.text, border: `1px solid ${LAB.border}`, borderRadius: "6px", padding: "8px 11px", font: "inherit", fontWeight: 750, cursor: !isConnected || !selectedSegmentFilename || arbitrationStatus === "arbitrating" ? "not-allowed" : "pointer", opacity: !isConnected || !selectedSegmentFilename || arbitrationStatus === "arbitrating" ? 0.7 : 1 }}
            >
              Arbitrate selected segment
            </button>
          </div>
          {arbitrationErrorText && (
            <div style={{ color: LAB.error, fontSize: "0.78rem", lineHeight: 1.45, overflowWrap: "anywhere" }}>{arbitrationErrorText}</div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "8px" }}>
            <div style={{ display: "grid", gap: "3px", padding: "8px", background: LAB.surfaceMuted, border: `1px solid ${LAB.border}`, borderRadius: "6px", minWidth: 0 }}>
              <span style={{ color: LAB.subtext, fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>Final text</span>
              <strong style={{ color: selectedArbitrationResult?.final_text ? LAB.text : LAB.subtext, fontSize: "0.86rem", overflowWrap: "anywhere" }}>{selectedArbitrationResult?.final_text || "none"}</strong>
            </div>
            <div style={{ display: "grid", gap: "3px", padding: "8px", background: LAB.surfaceMuted, border: `1px solid ${LAB.border}`, borderRadius: "6px", minWidth: 0 }}>
              <span style={{ color: LAB.subtext, fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>Final command</span>
              <strong style={{ color: selectedArbitrationResult?.final_command ? LAB.primary : LAB.subtext, fontSize: "0.86rem", overflowWrap: "anywhere" }}>{selectedArbitrationResult?.final_command || "none"}</strong>
            </div>
            <div style={{ display: "grid", gap: "3px", padding: "8px", background: LAB.surfaceMuted, border: `1px solid ${LAB.border}`, borderRadius: "6px", minWidth: 0 }}>
              <span style={{ color: LAB.subtext, fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>Decision</span>
              <strong style={{ color: selectedArbitrationResult?.decision_reason ? LAB.text : LAB.subtext, fontSize: "0.86rem", overflowWrap: "anywhere" }}>{selectedArbitrationResult?.decision_reason || "none"}</strong>
            </div>
            <div style={{ display: "grid", gap: "3px", padding: "8px", background: LAB.surfaceMuted, border: `1px solid ${LAB.border}`, borderRadius: "6px", minWidth: 0 }}>
              <span style={{ color: LAB.subtext, fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>Mode</span>
              <strong style={{ color: selectedArbitrationResult?.mode ? LAB.text : LAB.subtext, fontSize: "0.86rem", overflowWrap: "anywhere" }}>{selectedArbitrationResult?.mode || selectedArbitration?.mode || arbitrationMode}</strong>
            </div>
          </div>
          <div style={{ maxHeight: "260px", overflowY: "auto", overflowX: "hidden", border: `1px solid ${LAB.border}`, borderRadius: "7px", background: LAB.surface }}>
            <table style={{ width: "100%", tableLayout: "fixed", borderCollapse: "collapse", color: LAB.text, fontSize: "0.74rem" }}>
              <thead>
                <tr style={{ background: LAB.primarySoft, color: LAB.text, textAlign: "left" }}>
                  <th style={{ padding: "8px", borderBottom: `1px solid ${LAB.border}`, width: "13%" }}>Provider</th>
                  <th style={{ padding: "8px", borderBottom: `1px solid ${LAB.border}`, width: "24%" }}>Raw</th>
                  <th style={{ padding: "8px", borderBottom: `1px solid ${LAB.border}`, width: "18%" }}>Normalized</th>
                  <th style={{ padding: "8px", borderBottom: `1px solid ${LAB.border}`, width: "13%" }}>Command</th>
                  <th style={{ padding: "8px", borderBottom: `1px solid ${LAB.border}`, width: "80px" }}>Conf.</th>
                  <th style={{ padding: "8px", borderBottom: `1px solid ${LAB.border}`, width: "82px" }}>Latency</th>
                  <th style={{ padding: "8px", borderBottom: `1px solid ${LAB.border}` }}>Error</th>
                </tr>
              </thead>
              <tbody>
                {arbitrationRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: "12px", color: LAB.subtext }}>
                      Run arbitration on a captured segment to compare sidecar providers on the same WAV.
                    </td>
                  </tr>
                ) : arbitrationRows.map((row) => (
                  <tr key={row.key} style={{ borderBottom: `1px solid ${LAB.border}` }}>
                    <td style={{ padding: "8px", color: LAB.primary, fontWeight: 800, overflowWrap: "anywhere" }}>{row.provider}</td>
                    <td style={{ padding: "8px", color: row.rawTranscript ? LAB.text : LAB.subtext, overflowWrap: "anywhere" }}>{row.rawTranscript || "none"}</td>
                    <td style={{ padding: "8px", color: row.normalizedText ? LAB.text : LAB.subtext, overflowWrap: "anywhere" }}>{row.normalizedText || "none"}</td>
                    <td style={{ padding: "8px", color: row.command ? LAB.primary : LAB.subtext, overflowWrap: "anywhere" }}>{row.command || "none"}</td>
                    <td style={{ padding: "8px", color: getConfidenceColor(row.confidence), fontVariantNumeric: "tabular-nums" }}>{formatConfidence(row.confidence)}</td>
                    <td style={{ padding: "8px", color: row.latencyMs == null ? LAB.subtext : LAB.text, fontVariantNumeric: "tabular-nums" }}>{formatLatency(row.latencyMs)}</td>
                    <td style={{ padding: "8px", color: row.error ? LAB.error : LAB.subtext, overflowWrap: "anywhere" }}>{row.error || "none"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <div style={{ display: "grid", gap: "8px" }}>
          <h4 style={{ margin: 0, color: LAB.text, fontSize: "0.88rem", fontWeight: 800 }}>Captured Segments</h4>
          <div style={{ maxHeight: "420px", overflowY: "auto", overflowX: "auto", border: `1px solid ${LAB.border}`, borderRadius: "7px", background: LAB.surface }}>
            <table style={{ width: "100%", minWidth: "1120px", tableLayout: "fixed", borderCollapse: "collapse", color: LAB.text, fontSize: "0.76rem" }}>
              <colgroup>
                <col style={{ width: "44px" }} />
                <col style={{ width: "220px" }} />
                <col style={{ width: "82px" }} />
                <col style={{ width: "220px" }} />
                <col style={{ width: "130px" }} />
                <col style={{ width: "92px" }} />
                <col style={{ width: "110px" }} />
                <col style={{ width: "78px" }} />
                <col style={{ width: "100px" }} />
                <col style={{ width: "190px" }} />
              </colgroup>
              <thead>
                <tr style={{ background: LAB.primarySoft, color: LAB.text, textAlign: "left" }}>
                  <th style={capturedHeaderCellStyle}>#</th>
                  <th style={capturedHeaderCellStyle}>Segment</th>
                  <th style={capturedHeaderCellStyle}>Duration</th>
                  <th style={capturedHeaderCellStyle}>Transcript</th>
                  <th style={capturedHeaderCellStyle}>Normalized</th>
                  <th style={capturedHeaderCellStyle}>Confidence</th>
                  <th style={capturedHeaderCellStyle}>Expected</th>
                  <th style={capturedHeaderCellStyle}>Result</th>
                  <th style={capturedHeaderCellStyle}>Corpus</th>
                  <th style={capturedHeaderCellStyle}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {transcriptRows.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ padding: "14px", color: LAB.subtext }}>
                      Connect the engine, start VAD, then speak a short command like "red."
                    </td>
                  </tr>
                ) : transcriptRows.map((row) => {
                  const saveDisabled = !isConnected || !row.expectedRaw || !row.hasSaveableProviderText || row.corpusStatus === "saving" || row.corpusStatus === "saved" || row.corpusStatus === "deleting";
                  const saveTitle = !row.expectedRaw
                    ? "Enter expected text before saving."
                    : !row.hasSaveableProviderText
                      ? "Run ASR first. At least one provider needs a transcript before saving."
                      : "Save segment to corpus.";

                  return (
                  <tr
                    key={row.key}
                    onClick={() => setSelectedDebugFilename(row.filename)}
                    style={{ borderBottom: `1px solid ${LAB.border}`, cursor: "pointer", background: row.selected ? LAB.primarySoft : LAB.surface }}
                    title="Select segment for Advanced / Debug re-run"
                  >
                    <td style={{ ...capturedCellStyle, color: LAB.primary, fontVariantNumeric: "tabular-nums", fontWeight: 800 }}>{row.index}</td>
                    <td style={{ ...capturedCellStyle, color: LAB.text }} title={row.filename}>{row.filename}</td>
                    <td style={{ ...capturedCellStyle, fontVariantNumeric: "tabular-nums" }}>{row.duration}</td>
                    <td style={{ ...capturedCellStyle, color: row.status === "error" ? LAB.error : row.status === "pending" ? LAB.subtext : LAB.text }} title={row.rawTranscript}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", minWidth: 0, maxWidth: "100%" }}>
                        <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.rawTranscript}</span>
                        <span style={{ flex: "0 0 auto", border: `1px solid ${LAB.border}`, background: LAB.surfaceMuted, color: LAB.subtext, borderRadius: "999px", padding: "1px 6px", fontSize: "0.68rem", lineHeight: 1.4 }}>{row.provider}</span>
                      </span>
                    </td>
                    <td style={{ ...capturedCellStyle, color: row.normalizedTranscript ? LAB.text : LAB.subtext }} title={row.normalizedTranscript || "pending"}>{row.normalizedTranscript || "pending"}</td>
                    <td style={{ ...capturedCellStyle, color: getConfidenceColor(row.confidence), fontVariantNumeric: "tabular-nums" }}>{formatConfidence(row.confidence)}</td>
                    <td style={{ ...capturedCellStyle, color: row.expectedRaw ? LAB.text : LAB.subtext }} title={row.expectedRaw || "none"}>{row.expectedRaw || "none"}</td>
                    <td style={{ ...capturedCellStyle, color: row.result.color, fontWeight: 850 }}>{row.result.label}</td>
                    <td style={{ ...capturedCellStyle, color: getStatusColor(row.corpusStatus), fontWeight: 850 }} title={row.corpusError || row.corpusStatus}>{row.corpusStatus}</td>
                    <td style={{ ...capturedCellStyle }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", whiteSpace: "nowrap" }}>
                        <button
                          type="button"
                          title={saveTitle}
                          onClick={(event) => {
                            event.stopPropagation();
                            saveSegmentToCorpus(row.segment);
                          }}
                          disabled={saveDisabled}
                          style={{ minHeight: "28px", background: LAB.primary, color: "#ffffff", border: `1px solid ${LAB.primary}`, borderRadius: "5px", padding: "4px 7px", font: "inherit", fontSize: "0.7rem", fontWeight: 750, cursor: saveDisabled ? "not-allowed" : "pointer", opacity: saveDisabled ? 0.62 : 1 }}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleIgnoreSegment(row.segment);
                          }}
                          disabled={row.corpusStatus === "saved" || row.corpusStatus === "deleting"}
                          style={{ minHeight: "28px", background: LAB.surfaceMuted, color: LAB.text, border: `1px solid ${LAB.border}`, borderRadius: "5px", padding: "4px 7px", font: "inherit", fontSize: "0.7rem", fontWeight: 750, cursor: row.corpusStatus === "saved" || row.corpusStatus === "deleting" ? "not-allowed" : "pointer", opacity: row.corpusStatus === "saved" || row.corpusStatus === "deleting" ? 0.62 : 1 }}
                        >
                          {row.corpusStatus === "ignored" ? "Unignore" : "Ignore"}
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            deleteRecordingSegment(row.segment);
                          }}
                          disabled={!isConnected || row.corpusStatus === "deleting"}
                          style={{ minHeight: "28px", background: LAB.error, color: "#ffffff", border: `1px solid ${LAB.error}`, borderRadius: "5px", padding: "4px 7px", font: "inherit", fontSize: "0.7rem", fontWeight: 750, cursor: !isConnected || row.corpusStatus === "deleting" ? "not-allowed" : "pointer", opacity: !isConnected || row.corpusStatus === "deleting" ? 0.62 : 1 }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        <details style={{ border: `1px solid ${LAB.border}`, borderRadius: "7px", background: LAB.surface, padding: "8px 10px" }}>
          <summary style={{ color: LAB.text, cursor: "pointer", fontSize: "0.8rem", fontWeight: 800 }}>Advanced / Debug</summary>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "end", gap: "8px", marginTop: "10px" }}>
            <label style={{ display: "grid", gap: "6px", color: LAB.text, fontSize: "0.78rem", fontWeight: 700, minWidth: "min(360px, 100%)" }}>
              Segment
              <select
                value={debugSegmentFilename}
                onChange={(event) => setSelectedDebugFilename(event.target.value)}
                disabled={!isConnected || segments.length === 0}
                style={{ minHeight: "36px", background: LAB.surfaceMuted, border: `1px solid ${LAB.border}`, color: LAB.text, borderRadius: "6px", padding: "7px 9px", font: "inherit" }}
              >
                {segments.length === 0 ? (
                  <option value="">No captured segments</option>
                ) : segments.map((segment, index) => (
                  <option key={segment.filename} value={segment.filename}>
                    {index === 0 ? "Latest: " : ""}{segment.filename}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => rerunSegmentTranscription(debugSegmentFilename)}
              disabled={!isConnected || !debugSegmentFilename || asrStatus === "loading" || asrStatus === "transcribing"}
              style={{ minHeight: "36px", background: LAB.surfaceMuted, color: LAB.text, border: `1px solid ${LAB.border}`, borderRadius: "6px", padding: "8px 11px", font: "inherit", fontWeight: 750, cursor: !isConnected || !debugSegmentFilename || asrStatus === "loading" || asrStatus === "transcribing" ? "not-allowed" : "pointer", opacity: !isConnected || !debugSegmentFilename || asrStatus === "loading" || asrStatus === "transcribing" ? 0.7 : 1 }}
            >
              {isDebugLatestSegment ? "Re-run transcription on latest segment" : "Re-run transcription on selected segment"}
            </button>
            <button
              type="button"
              onClick={applySelectedSegmentLabel}
              disabled={!selectedSegment}
              style={{ minHeight: "36px", background: LAB.primary, color: "#ffffff", border: `1px solid ${LAB.primary}`, borderRadius: "6px", padding: "8px 11px", font: "inherit", fontWeight: 750, cursor: !selectedSegment ? "not-allowed" : "pointer", opacity: !selectedSegment ? 0.7 : 1 }}
            >
              Apply Recording Context to selected segment
            </button>
          </div>
          <div style={{ marginTop: "8px", color: LAB.subtext, fontSize: "0.76rem", lineHeight: 1.45, overflowWrap: "anywhere" }}>
            Use this only when a captured segment needs a corrected label snapshot. Saving still happens from the row-level Save button in Captured Segments.
          </div>
          {selectedProviderStatus && (
            <div style={{ marginTop: "10px", color: selectedProviderStatus.available ? LAB.success : LAB.warning, fontSize: "0.78rem", lineHeight: 1.45, overflowWrap: "anywhere" }}>
              {selectedProviderStatus.name}: {selectedProviderStatus.loaded ? "loaded" : selectedProviderStatus.available ? "available" : "unavailable"} / {selectedProviderStatus.message || "no status"} {selectedProviderStatus.model_path ? `/ ${selectedProviderStatus.model_path}` : ""}
            </div>
          )}
          <div style={{ display: "grid", gap: "6px", maxHeight: "220px", overflowY: "auto", marginTop: "10px", borderTop: `1px solid ${LAB.border}`, paddingTop: "8px" }}>
            {events.length === 0 ? (
              <div style={{ color: LAB.subtext, fontSize: "0.78rem" }}>No local VAD events yet.</div>
            ) : events.map((event) => (
              <div key={`${event.sequence}-${event.type}`} style={{ display: "grid", gridTemplateColumns: "62px 1fr", gap: "8px", padding: "6px 0", borderBottom: `1px solid ${LAB.border}`, color: LAB.text, fontSize: "0.76rem", lineHeight: 1.4 }}>
                <span style={{ color: LAB.primary, fontVariantNumeric: "tabular-nums" }}>[{formatClockTime(event.timestamp)}]</span>
                <span style={{ overflowWrap: "anywhere" }}>
                  <strong style={{ color: event.type === "error" ? LAB.error : LAB.text }}>{event.type}</strong>
                  <span style={{ color: LAB.subtext }}> / </span>
                  {summarizeEvent(event)}
                </span>
              </div>
            ))}
          </div>
        </details>
      </section>

      {errorText && (
        <div style={{ color: engineStatus === "listening" ? LAB.warning : LAB.error, background: LAB.surfaceMuted, border: `1px solid ${LAB.border}`, borderRadius: "8px", padding: "10px", fontSize: "0.82rem", lineHeight: 1.45, overflowWrap: "anywhere" }}>
          {errorText}
        </div>
      )}
    </section>
  );
}
