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

  let recognition = null;
  let stopped = false;
  let starting = false;

  const start = () => {
    if (stopped || starting) return;
    starting = true;

    recognition = new RecognitionCtor();
    recognition.lang = lang;
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      starting = false;
      onStateChange("listening");
    };

    recognition.onresult = (event) => {
      const result = event.results?.[0]?.[0];
      if (!result) return;
      onResult({
        transcript: result.transcript?.trim() ?? "",
        confidence: result.confidence ?? null,
      });
    };

    recognition.onerror = (event) => {
      starting = false;
      if (stopped) return;

      if (event.error === "no-speech" || event.error === "aborted") {
        onStateChange("retrying");
        return;
      }

      onError(new Error(event.error || "Speech recognition failed."));
    };

    recognition.onend = () => {
      starting = false;
      if (stopped) {
        onStateChange("stopped");
        return;
      }

      onStateChange("retrying");
      window.setTimeout(start, 150);
    };

    try {
      recognition.start();
    } catch (error) {
      starting = false;
      onError(error instanceof Error ? error : new Error("Speech recognition failed to start."));
    }
  };

  const stop = () => {
    stopped = true;
    starting = false;
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
