function getRecognitionCtor() {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

export function isSpeechRecognitionSupported() {
  return Boolean(getRecognitionCtor());
}

export function listenOnce(options = {}) {
  const RecognitionCtor = getRecognitionCtor();
  if (!RecognitionCtor) {
    return Promise.reject(new Error("Speech recognition is not supported in this browser."));
  }

  const lang = options.lang ?? "en-US";
  const timeoutMs = options.timeoutMs ?? 5000;

  return new Promise((resolve, reject) => {
    const recognition = new RecognitionCtor();
    let settled = false;
    let timeoutId = null;

    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      if (timeoutId) window.clearTimeout(timeoutId);
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      fn(value);
    };

    recognition.lang = lang;
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      const result = event.results?.[0]?.[0];
      finish(resolve, {
        transcript: result?.transcript?.trim() ?? "",
        confidence: result?.confidence ?? null,
      });
    };

    recognition.onerror = (event) => {
      finish(reject, new Error(event.error || "Speech recognition failed."));
    };

    recognition.onend = () => {
      if (!settled) {
        finish(reject, new Error("Speech recognition ended without a result."));
      }
    };

    timeoutId = window.setTimeout(() => {
      recognition.abort();
      finish(reject, new Error("Speech recognition timed out."));
    }, timeoutMs);

    recognition.start();
  });
}

export function startContinuousListening(options = {}) {
  const RecognitionCtor = getRecognitionCtor();
  if (!RecognitionCtor) {
    throw new Error("Speech recognition is not supported in this browser.");
  }

  const lang = options.lang ?? "en-US";
  const onResult = options.onResult ?? (() => {});
  const onError = options.onError ?? (() => {});
  const onStateChange = options.onStateChange ?? (() => {});
  const onLifecycle = options.onLifecycle ?? (() => {});

  let recognition = null;
  let stopped = false;
  let starting = false;
  let providerStartedEmitted = false;

  const emitLifecycle = (event) => {
    onLifecycle({
      providerName: "browserSpeech",
      timestamp: new Date().toISOString(),
      ...event,
    });
  };

  const getSpeechErrorMessage = (errorCode) => {
    switch (errorCode) {
      case "no-speech":
        return "No speech detected.";
      case "aborted":
        return "Recognition aborted before a transcript.";
      case "audio-capture":
        return "Audio capture failed or no microphone was found.";
      case "not-allowed":
        return "Microphone permission was denied.";
      case "network":
        return "Speech recognition network error.";
      case "service-not-allowed":
        return "Speech recognition service is not allowed.";
      default:
        return errorCode ? `Speech recognition error: ${errorCode}.` : "Speech recognition failed.";
    }
  };

  const start = () => {
    if (stopped || starting) return;
    starting = true;

    recognition = new RecognitionCtor();
    let hadResult = false;
    let noResultEmitted = false;
    let retryReason = "recognition ended without result";
    recognition.lang = lang;
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      starting = false;
      onStateChange("listening");
      emitLifecycle({
        eventType: "lifecycle",
        action: "listening started",
        message: "Browser Speech listening started.",
        listeningStatus: "listening",
      });
    };

    recognition.onresult = (event) => {
      const result = event.results?.[0]?.[0];
      if (!result) return;
      hadResult = true;
      onResult({
        transcript: result.transcript?.trim() ?? "",
        confidence: result.confidence ?? null,
      });
    };

    recognition.onerror = (event) => {
      starting = false;
      if (stopped) return;

      if (event.error === "no-speech" || event.error === "aborted") {
        const message = getSpeechErrorMessage(event.error);
        retryReason = event.error === "no-speech"
          ? "no speech detected / recognition ended without result"
          : message;
        noResultEmitted = true;
        emitLifecycle({
          eventType: "no-result",
          action: event.error === "no-speech" ? "no speech detected" : "recognition aborted",
          reason: retryReason,
          message,
          rawTranscript: "",
          normalizedCommand: "",
          success: "no speech",
          listeningStatus: "retrying",
        });
        if (event.error === "no-speech") {
          emitLifecycle({
            eventType: "lifecycle",
            action: "speech timeout",
            reason: retryReason,
            message: "Browser Speech timed out without a transcript.",
            listeningStatus: "retrying",
          });
        }
        onStateChange("retrying");
        return;
      }

      const message = getSpeechErrorMessage(event.error);
      emitLifecycle({
        eventType: "error",
        action: "provider error",
        reason: event.error || "unknown",
        message,
        listeningStatus: "error",
      });
      onError(new Error(message));
    };

    recognition.onend = () => {
      starting = false;
      const endedReason = hadResult ? "recognition ended after result" : "recognition ended without result";
      emitLifecycle({
        eventType: "lifecycle",
        action: "listening ended",
        reason: endedReason,
        message: "Browser Speech listening ended.",
        listeningStatus: stopped ? "stopped" : "retrying",
      });

      if (stopped) {
        onStateChange("stopped");
        return;
      }

      if (!hadResult && !noResultEmitted) {
        emitLifecycle({
          eventType: "no-result",
          action: "recognition ended without transcript",
          reason: endedReason,
          message: "Recognition ended without a transcript.",
          rawTranscript: "",
          normalizedCommand: "",
          success: "no speech",
          listeningStatus: "retrying",
        });
        retryReason = endedReason;
      }

      emitLifecycle({
        eventType: "lifecycle",
        action: "retry scheduled",
        reason: retryReason,
        message: `Retry scheduled: ${retryReason}.`,
        listeningStatus: "retrying",
      });
      onStateChange("retrying");
      window.setTimeout(start, 150);
    };

    try {
      if (!providerStartedEmitted) {
        providerStartedEmitted = true;
        emitLifecycle({
          eventType: "lifecycle",
          action: "provider started",
          message: "Browser Speech provider start requested.",
          listeningStatus: "starting",
        });
      }
      recognition.start();
    } catch (error) {
      starting = false;
      const normalizedError = error instanceof Error ? error : new Error("Speech recognition failed to start.");
      emitLifecycle({
        eventType: "error",
        action: "provider error",
        reason: "start failed",
        message: normalizedError.message,
        listeningStatus: "error",
      });
      onError(normalizedError);
    }
  };

  const stop = () => {
    stopped = true;
    starting = false;
    emitLifecycle({
      eventType: "lifecycle",
      action: "provider stopped",
      message: "Browser Speech provider stop requested.",
      listeningStatus: "stopped",
    });
    try {
      recognition?.abort();
    } catch {
      // Ignore stop failures during teardown.
    }
    onStateChange("stopped");
  };

  start();
  return { stop };
}
