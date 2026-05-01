import { useEffect, useMemo, useRef, useState } from "react";

const RETRY_COLLAPSE_WINDOW_MS = 1500;

function formatValue(value) {
  if (value == null || value === "") {
    return "none";
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? String(Math.round(value * 1000) / 1000) : "none";
  }

  return String(value);
}

function escapeMarkdownCell(value) {
  return String(value ?? "")
    .replace(/\|/g, "\\|")
    .replace(/\r?\n/g, " ");
}

function escapeCsvCell(value) {
  const text = String(value ?? "");
  if (!/[",\r\n]/.test(text)) {
    return text;
  }

  return `"${text.replace(/"/g, '""')}"`;
}

function getProviderLabel(row) {
  if (row.eventType === "provider-switch") {
    return `${formatValue(row.fromProvider)} -> ${formatValue(row.toProvider)}`;
  }

  return formatValue(row.provider);
}

function formatClockTime(timestamp) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return formatValue(timestamp);
  }

  const pad = (value) => String(value).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function getTimestampMs(row) {
  const ms = new Date(row.timestamp).getTime();
  return Number.isNaN(ms) ? null : ms;
}

function getTimeDistanceMs(rowA, rowB) {
  const a = getTimestampMs(rowA);
  const b = getTimestampMs(rowB);
  if (a == null || b == null) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.abs(a - b);
}

function hasDisplayValue(value) {
  return value != null && value !== "" && value !== "none";
}

function toFiniteNumber(value) {
  if (value == null || value === "") {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function quoteTranscript(value) {
  if (value === "") {
    return "\"\"";
  }

  const text = formatValue(value);
  return text === "none" ? text : `"${text}"`;
}

function getNormalizedLabel(row) {
  if (row.eventType === "no-result") {
    return "none";
  }

  if (!row.normalizedCommand || row.normalizedCommand === "unmatched") {
    return "unknown";
  }

  return row.normalizedCommand;
}

function getSuccessLabel(row) {
  return row.expectedCommand ? formatValue(row.success) : "none";
}

function getOutcomeColor(row) {
  if (row.eventType === "no-result") return "#fbbf24";
  if (row.errors) return "#fca5a5";
  if (normalizeAction(row) === "model load success") return "#86efac";
  if (normalizeAction(row) === "model load failure") return "#fca5a5";
  if (row.success === "success") return "#86efac";
  if (row.success === "fail") return "#fca5a5";
  return "#d8d4ee";
}

function getStatusTone(row) {
  if (row.eventType === "no-result") return "warn";
  if (row.errors) return "bad";
  if (row.success === "success") return "good";
  if (row.success === "fail") return "bad";
  return "neutral";
}

function normalizeAction(row) {
  return String(row.action || row.message || row.eventType || "").toLowerCase();
}

function isRoutineLifecycleRow(row) {
  if (row.eventType !== "lifecycle") {
    return false;
  }

  if (row.errors) {
    return false;
  }

  const action = normalizeAction(row);
  return action === "provider cleanup"
    || action === "provider stopped"
    || action === "provider started"
    || action === "provider load status"
    || action === "provider status"
    || row.message === "Provider cleanup completed."
    || row.message === "Provider cleanup completed before switch."
    || row.message === "Provider stop requested."
    || row.message === "Provider start requested."
    || row.message === "Provider started.";
}

function isDefaultVisibleRow(row) {
  if (row.eventType === "speech"
    || row.eventType === "no-result"
    || row.eventType === "error"
    || row.eventType === "provider-switch") {
    return true;
  }

  if (row.eventType !== "lifecycle") {
    return true;
  }

  if (row.errors) {
    return true;
  }

  const action = normalizeAction(row);
  return action === "listening started"
    || action === "listening stopped"
    || action === "listening ended"
    || action === "retry scheduled"
    || action === "no speech detected"
    || action === "speech timeout"
    || action === "model load start"
    || action === "model load success"
    || action === "model load failure";
}

function shouldCreateStopSummary(row) {
  if (row.eventType !== "lifecycle" || row.errors) {
    return false;
  }

  const action = normalizeAction(row);
  return action === "provider cleanup"
    || row.message === "Provider cleanup completed."
    || row.message === "Provider cleanup completed before switch.";
}

function isSameProvider(...rows) {
  const providers = rows.map((row) => row?.provider).filter(Boolean);
  return providers.length > 0 && providers.every((provider) => provider === providers[0]);
}

function isListeningStopLifecycle(row) {
  if (row?.eventType !== "lifecycle" || row.errors) {
    return false;
  }

  const action = normalizeAction(row);
  return action === "listening stopped" || action === "listening ended";
}

function isRetryScheduledLifecycle(row) {
  return row?.eventType === "lifecycle" && normalizeAction(row) === "retry scheduled";
}

function isSpeechTimeoutLifecycle(row) {
  return row?.eventType === "lifecycle" && normalizeAction(row) === "speech timeout";
}

function isListeningStartedLifecycle(row) {
  return row?.eventType === "lifecycle" && normalizeAction(row) === "listening started";
}

function isSpeechResultRow(row) {
  return row?.eventType === "speech" && row.provider === "browserSpeech";
}

function isBrowserSpeechRetryNoResult(row) {
  if (row?.eventType !== "no-result" || row.provider !== "browserSpeech") {
    return false;
  }

  const detail = `${row.reason || ""} ${row.message || ""}`.toLowerCase();
  return detail.includes("without result") || detail.includes("no speech") || detail.includes("aborted before");
}

function findRetryNoResultIndex(rows, retryIndex, usedNoResultIndexes) {
  const retryRow = rows[retryIndex];
  for (let index = retryIndex - 1; index >= 0; index -= 1) {
    const row = rows[index];
    if (getTimeDistanceMs(row, retryRow) > RETRY_COLLAPSE_WINDOW_MS) {
      break;
    }

    if (usedNoResultIndexes.has(index)) {
      continue;
    }

    if (isBrowserSpeechRetryNoResult(row) && isSameProvider(row, retryRow)) {
      return index;
    }
  }

  return null;
}

function findImmediateListeningStartedIndex(rows, retryIndex) {
  const retryRow = rows[retryIndex];
  for (let index = retryIndex + 1; index < rows.length; index += 1) {
    const row = rows[index];
    if (getTimeDistanceMs(row, retryRow) > RETRY_COLLAPSE_WINDOW_MS) {
      break;
    }

    if (!isSameProvider(row, retryRow)) {
      continue;
    }

    if (isListeningStartedLifecycle(row)) {
      return index;
    }
  }

  return null;
}

function isRetryPlumbingRow(row) {
  return isListeningStopLifecycle(row)
    || isListeningStartedLifecycle(row)
    || isRetryScheduledLifecycle(row)
    || isSpeechTimeoutLifecycle(row)
    || shouldCreateStopSummary(row)
    || normalizeAction(row) === "provider stopped"
    || normalizeAction(row) === "provider cleanup";
}

function collectRetryCycleIndexes(rows, noResultIndex, retryIndex, startedIndex) {
  const indexes = new Set([noResultIndex, retryIndex]);
  if (startedIndex != null) {
    indexes.add(startedIndex);
  }

  const anchorRows = [rows[noResultIndex], rows[retryIndex], rows[startedIndex]].filter(Boolean);
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    if (!isSameProvider(row, rows[retryIndex])) {
      continue;
    }

    const isNearRetry = anchorRows.some((anchorRow) => getTimeDistanceMs(row, anchorRow) <= RETRY_COLLAPSE_WINDOW_MS);
    if (isNearRetry && isRetryPlumbingRow(row)) {
      indexes.add(index);
    }
  }

  return indexes;
}

function getRetryCycleView(rows) {
  const collapsedIndexes = new Set();
  const summaries = new Map();
  const usedNoResultIndexes = new Set();

  rows.forEach((row, index) => {
    if (!isRetryScheduledLifecycle(row) || row.provider !== "browserSpeech") {
      return;
    }

    const noResultIndex = findRetryNoResultIndex(rows, index, usedNoResultIndexes);
    if (noResultIndex == null) {
      return;
    }

    const startedIndex = findImmediateListeningStartedIndex(rows, index);
    collectRetryCycleIndexes(rows, noResultIndex, index, startedIndex).forEach((matchedIndex) => collapsedIndexes.add(matchedIndex));
    usedNoResultIndexes.add(noResultIndex);
    summaries.set(noResultIndex, {
      ...rows[noResultIndex],
      action: "no speech detected",
      reason: "retrying",
      message: "No speech detected, retrying.",
      listeningStatus: "retrying",
      retryStatus: "retrying",
      isRetryCycleSummary: true,
    });
  });

  return { collapsedIndexes, summaries };
}

function collectAutomaticBrowserSpeechIndexes(rows) {
  const indexes = new Set();

  rows.forEach((row, index) => {
    if (!isSpeechResultRow(row) && !isBrowserSpeechRetryNoResult(row)) {
      return;
    }

    for (let nextIndex = index + 1; nextIndex < rows.length; nextIndex += 1) {
      const nextRow = rows[nextIndex];
      if (getTimeDistanceMs(row, nextRow) > RETRY_COLLAPSE_WINDOW_MS) {
        break;
      }

      if (!isSameProvider(row, nextRow)) {
        continue;
      }

      if (isRetryPlumbingRow(nextRow)) {
        indexes.add(nextIndex);
      }
    }

  });

  return indexes;
}

function isAmbientAttemptRow(row, scoredAttemptIds) {
  return isAttemptRow(row) && !scoredAttemptIds.has(row.id);
}

function getDisplayRows(rows, {
  showVerboseLifecycleLogs,
  showAmbientEvents,
  scoredAttemptIds,
}) {
  if (showVerboseLifecycleLogs) {
    return rows;
  }

  const { collapsedIndexes, summaries } = getRetryCycleView(rows);
  const automaticBrowserSpeechIndexes = collectAutomaticBrowserSpeechIndexes(rows);

  return rows.flatMap((row, index) => {
    if (summaries.has(index)) {
      const summary = summaries.get(index);
      if (isAmbientAttemptRow(summary, scoredAttemptIds) && !showAmbientEvents) {
        return [];
      }
      return [{ ...summary, isScored: scoredAttemptIds.has(summary.id) }];
    }

    if (collapsedIndexes.has(index) || automaticBrowserSpeechIndexes.has(index)) {
      return [];
    }

    if (isAmbientAttemptRow(row, scoredAttemptIds)) {
      return showAmbientEvents ? [{ ...row, isAmbient: true, isScored: false }] : [];
    }

    if (shouldCreateStopSummary(row)) {
      return [{
        ...row,
        id: `${row.id}-listening-stopped-summary`,
        eventType: "lifecycle",
        action: "listening stopped",
        message: "Listening stopped. Cleanup complete.",
        reason: row.reason || "cleanup complete",
        listeningStatus: "stopped",
        cleanupStatus: "complete",
        isDisplaySummary: true,
      }];
    }

    return isDefaultVisibleRow(row) && !isRoutineLifecycleRow(row)
      ? [{ ...row, isScored: isAttemptRow(row) ? scoredAttemptIds.has(row.id) : false }]
      : [];
  });
}

function getExportNotes(row, scoredAttemptIds = new Set()) {
  const notes = [];

  if (isAttemptRow(row)) notes.push(scoredAttemptIds.has(row.id) ? "scored_attempt=true" : "scored_attempt=false");
  if (row.notes) notes.push(row.notes);
  if (row.action) notes.push(`action=${row.action}`);
  if (row.reason) notes.push(`reason=${row.reason}`);
  if (row.message) notes.push(`message=${row.message}`);
  if (row.modelUrl) notes.push(`model_url=${row.modelUrl}`);
  if (row.fetchUrl) notes.push(`fetch_url=${row.fetchUrl}`);
  if (row.fromProvider || row.toProvider) {
    notes.push(`from_provider=${formatValue(row.fromProvider)}`);
    notes.push(`to_provider=${formatValue(row.toProvider)}`);
  }
  if (row.providerStatus) notes.push(`provider_status=${row.providerStatus}`);
  if (row.providerLoadStatus) notes.push(`provider_load_status=${row.providerLoadStatus}`);
  if (row.listeningStatus) notes.push(`listening_status=${row.listeningStatus}`);

  return notes.join("; ");
}

function buildMarkdownTable(rows, scoredAttemptIds = new Set()) {
  const header = [
    "Timestamp",
    "Event",
    "Provider",
    "Expected command",
    "Raw transcript",
    "Normalized command",
    "Success/fail",
    "Confidence",
    "Latency ms",
    "Errors",
    "Notes",
  ];
  const divider = header.map(() => "---");
  const body = rows.map((row) => [
    row.timestamp,
    row.eventType,
    getProviderLabel(row),
    row.expectedCommand,
    row.rawTranscript,
    row.normalizedCommand,
    getSuccessLabel(row),
    row.confidence,
    row.latencyMs,
    row.errors,
    getExportNotes(row, scoredAttemptIds),
  ].map(escapeMarkdownCell));

  return [
    `| ${header.join(" | ")} |`,
    `| ${divider.join(" | ")} |`,
    ...body.map((cells) => `| ${cells.join(" | ")} |`),
  ].join("\n");
}

function buildCsv(rows, scoredAttemptIds = new Set()) {
  const header = [
    "timestamp",
    "event_type",
    "provider",
    "expected_command",
    "raw_transcript",
    "normalized_command",
    "success_fail",
    "confidence",
    "latency_ms",
    "errors",
    "notes",
  ];
  const body = rows.map((row) => [
    row.timestamp,
    row.eventType,
    getProviderLabel(row),
    row.expectedCommand,
    row.rawTranscript,
    row.normalizedCommand,
    getSuccessLabel(row),
    row.confidence,
    row.latencyMs,
    row.errors,
    getExportNotes(row, scoredAttemptIds),
  ].map(escapeCsvCell).join(","));

  return [header.join(","), ...body].join("\n");
}

function isAttemptRow(row) {
  return (row.eventType === "speech" || row.eventType === "no-result") && hasDisplayValue(row.expectedCommand);
}

function isSuccessfulAttempt(row) {
  return row.eventType === "speech" && row.success === "success";
}

function getMostCommonFailure(failures) {
  if (failures.size === 0) {
    return "";
  }

  let bestTranscript = "";
  let bestCount = 0;
  failures.forEach((count, transcript) => {
    if (count > bestCount) {
      bestTranscript = transcript;
      bestCount = count;
    }
  });

  return bestTranscript;
}

function buildScorecard(rows, targetAttempts, scoredAttemptIds) {
  const providers = [];
  const providerMap = new Map();

  rows.forEach((row) => {
    if (!isAttemptRow(row) || !scoredAttemptIds.has(row.id)) {
      return;
    }

    const provider = row.provider || "unknown";
    const expected = row.expectedCommand;

    if (!providerMap.has(provider)) {
      const providerStats = { provider, commands: [], commandMap: new Map() };
      providerMap.set(provider, providerStats);
      providers.push(providerStats);
    }

    const providerStats = providerMap.get(provider);
    if (!providerStats.commandMap.has(expected)) {
      const commandStats = {
        expected,
        attempts: 0,
        successes: 0,
        failures: 0,
        confidenceTotal: 0,
        confidenceCount: 0,
        latencyTotal: 0,
        latencyCount: 0,
        failedTranscripts: new Map(),
      };
      providerStats.commandMap.set(expected, commandStats);
      providerStats.commands.push(commandStats);
    }

    const stats = providerStats.commandMap.get(expected);
    stats.attempts += 1;

    if (isSuccessfulAttempt(row)) {
      stats.successes += 1;
    } else {
      stats.failures += 1;
      const failedTranscript = hasDisplayValue(row.rawTranscript) ? row.rawTranscript : "no speech";
      stats.failedTranscripts.set(failedTranscript, (stats.failedTranscripts.get(failedTranscript) || 0) + 1);
    }

    const confidence = toFiniteNumber(row.confidence);
    if (confidence != null) {
      stats.confidenceTotal += confidence;
      stats.confidenceCount += 1;
    }

    const latency = toFiniteNumber(row.latencyMs);
    if (latency != null) {
      stats.latencyTotal += latency;
      stats.latencyCount += 1;
    }
  });

  return providers.map((providerStats) => ({
    provider: providerStats.provider,
    commands: providerStats.commands.map((stats) => {
      const successRate = stats.attempts > 0 ? Math.round((stats.successes / stats.attempts) * 100) : 0;
      const testedLabel = stats.attempts >= targetAttempts
        ? `${stats.attempts}/${targetAttempts} complete`
        : `${stats.attempts}/${targetAttempts} tested`;

      return {
        expected: stats.expected,
        attempts: stats.attempts,
        successes: stats.successes,
        failures: stats.failures,
        successRate,
        testedLabel,
        averageConfidence: stats.confidenceCount > 0 ? stats.confidenceTotal / stats.confidenceCount : null,
        averageLatency: stats.latencyCount > 0 ? stats.latencyTotal / stats.latencyCount : null,
        commonFailure: getMostCommonFailure(stats.failedTranscripts),
      };
    }),
  }));
}

function formatPercent(value) {
  return `${Math.round(value)}%`;
}

function formatAverageConfidence(value) {
  if (value == null) {
    return "";
  }

  return Math.round(value * 100) / 100;
}

function formatAverageLatency(value) {
  if (value == null) {
    return "";
  }

  return `${Math.round(value)}ms`;
}

function Scorecard({ scorecard, targetAttempts, latestScorecardKey, onTargetAttemptsChange }) {
  const scorecardScrollRef = useRef(null);

  useEffect(() => {
    if (latestScorecardKey && scorecardScrollRef.current) {
      scorecardScrollRef.current.scrollTop = scorecardScrollRef.current.scrollHeight;
    }
  }, [latestScorecardKey]);

  return (
    <section style={{ display: "grid", gap: "10px", padding: "12px 14px", borderBottom: "1px solid #303049", background: "#151520" }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
        <h3 style={{ margin: 0, fontSize: "0.9rem" }}>ASR Test Scorecard</h3>
        <label style={{ display: "inline-flex", alignItems: "center", gap: "7px", color: "#d8d4ee", fontSize: "0.78rem" }}>
          Target attempts
          <input
            type="number"
            min="1"
            max="99"
            value={targetAttempts}
            onChange={(event) => {
              const nextValue = Number(event.target.value);
              onTargetAttemptsChange(Number.isFinite(nextValue) && nextValue > 0 ? Math.round(nextValue) : 1);
            }}
            style={{ width: "64px", background: "#101018", border: "1px solid #454564", color: "#ffffff", borderRadius: "5px", padding: "5px 7px", font: "inherit" }}
          />
        </label>
      </div>

      {scorecard.length === 0 ? (
        <div style={{ color: "#bfc7d5", fontSize: "0.8rem" }}>No attempts yet. Click 'Arm next attempt' to begin testing.</div>
      ) : (
        <div ref={scorecardScrollRef} style={{ display: "grid", gap: "10px", maxHeight: "150px", overflowY: "auto" }}>
          {scorecard.map((providerStats) => (
            <div key={providerStats.provider} style={{ display: "grid", gap: "5px" }}>
              <strong style={{ color: "#ffffff", fontSize: "0.82rem" }}>{providerStats.provider}</strong>
              <div style={{ display: "grid", gap: "4px" }}>
                {providerStats.commands.map((commandStats) => {
                  const scorecardKey = `${providerStats.provider}::${commandStats.expected}`;
                  const isLatest = scorecardKey === latestScorecardKey;
                  const details = [
                    `${commandStats.successes}/${commandStats.attempts} success = ${formatPercent(commandStats.successRate)}`,
                    commandStats.testedLabel,
                    commandStats.averageConfidence != null ? `avg conf: ${formatAverageConfidence(commandStats.averageConfidence)}` : "",
                    commandStats.averageLatency != null ? `avg latency: ${formatAverageLatency(commandStats.averageLatency)}` : "",
                    commandStats.commonFailure ? `common fail: ${quoteTranscript(commandStats.commonFailure)}` : "",
                  ].filter(Boolean);

                  return (
                    <div
                      key={commandStats.expected}
                      style={{
                        color: "#d8d4ee",
                        fontSize: "0.78rem",
                        lineHeight: 1.4,
                        overflowWrap: "anywhere",
                        background: isLatest ? "rgba(37, 99, 235, 0.28)" : "transparent",
                        borderRadius: "5px",
                        padding: "3px 5px",
                        transition: "background 0.25s ease",
                      }}
                    >
                      <strong style={{ color: commandStats.attempts >= targetAttempts ? "#86efac" : "#fbbf24" }}>{commandStats.expected}:</strong>{" "}
                      {details.join(" | ")}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function downloadTextFile(filename, text, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function Detail({ label, value, tone = "neutral" }) {
  const color = tone === "bad" ? "#fca5a5" : tone === "good" ? "#86efac" : tone === "warn" ? "#fbbf24" : "#d8d4ee";

  return (
    <div style={{ display: "grid", gap: "3px", minWidth: 0 }}>
      <span style={{ color: "#bfc7d5", fontSize: "0.66rem", letterSpacing: "0.08em", textTransform: "uppercase" }}>
        {label}
      </span>
      <span style={{ color, fontSize: "0.8rem", overflowWrap: "anywhere" }}>{formatValue(value)}</span>
    </div>
  );
}

function StatusPill({ row }) {
  const tone = getStatusTone(row);
  const color = tone === "good" ? "#86efac" : tone === "bad" ? "#fca5a5" : tone === "warn" ? "#fbbf24" : "#d8d4ee";
  const label = row.eventType === "no-result"
    ? "no speech"
    : row.errors ? "error" : row.success === "success" ? "✅ success" : row.success === "fail" ? "❌ fail" : row.expectedCommand ? getSuccessLabel(row) : formatValue(row.eventType);

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", color, fontWeight: 700 }}>
      <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: color, flex: "0 0 auto" }} />
      {label}
    </span>
  );
}

function CompactSpeechRow({ row }) {
  const confidence = hasDisplayValue(row.confidence) ? formatValue(row.confidence) : "";
  const latency = hasDisplayValue(row.latencyMs) ? `${formatValue(row.latencyMs)}ms` : "";

  if (row.isAmbient) {
    return (
      <span style={{ display: "flex", flexWrap: "wrap", gap: "6px 8px", alignItems: "center", minWidth: 0 }}>
        <strong style={{ color: "#ffffff" }}>{formatValue(row.provider)}</strong>
        <span style={{ color: "#bfc7d5" }}>|</span>
        <strong style={{ color: "#fbbf24" }}>ambient</strong>
        <span style={{ color: "#bfc7d5" }}>|</span>
        <span>heard: {quoteTranscript(row.rawTranscript)}</span>
        <span style={{ color: "#bfc7d5" }}>|</span>
        <span>normalized: {getNormalizedLabel(row)}</span>
        <span style={{ color: "#bfc7d5" }}>|</span>
        <span style={{ color: "#bfc7d5" }}>unscored</span>
      </span>
    );
  }

  return (
    <span style={{ display: "flex", flexWrap: "wrap", gap: "6px 8px", alignItems: "center", minWidth: 0 }}>
      <strong style={{ color: "#ffffff" }}>{formatValue(row.provider)}</strong>
      <span style={{ color: "#bfc7d5" }}>|</span>
      <span>expected: {formatValue(row.expectedCommand)}</span>
      <span style={{ color: "#bfc7d5" }}>|</span>
      <span>heard: {quoteTranscript(row.rawTranscript)}</span>
      <span style={{ color: "#bfc7d5" }}>|</span>
      <span>normalized: {getNormalizedLabel(row)}</span>
      <span style={{ color: "#bfc7d5" }}>|</span>
      <StatusPill row={row} />
      {confidence && (
        <>
          <span style={{ color: "#bfc7d5" }}>|</span>
          <span>conf: {confidence}</span>
        </>
      )}
      {latency && (
        <>
          <span style={{ color: "#bfc7d5" }}>|</span>
          <span>{latency}</span>
        </>
      )}
    </span>
  );
}

function CompactNoResultRow({ row }) {
  const latency = hasDisplayValue(row.latencyMs) ? `${formatValue(row.latencyMs)}ms` : "";
  const reason = row.reason || row.message || "";

  if (row.isRetryCycleSummary) {
    return (
      <span style={{ display: "flex", flexWrap: "wrap", gap: "6px 8px", alignItems: "center", minWidth: 0 }}>
        <strong style={{ color: "#ffffff" }}>{formatValue(row.provider)}</strong>
        <span style={{ color: "#bfc7d5" }}>|</span>
        <strong style={{ color: "#fbbf24" }}>no speech detected</strong>
        <span style={{ color: "#bfc7d5" }}>|</span>
        <span style={{ color: "#fbbf24", fontWeight: 700 }}>{formatValue(row.retryStatus || row.listeningStatus)}</span>
      </span>
    );
  }

  if (row.isAmbient) {
    return (
      <span style={{ display: "flex", flexWrap: "wrap", gap: "6px 8px", alignItems: "center", minWidth: 0 }}>
        <strong style={{ color: "#ffffff" }}>{formatValue(row.provider)}</strong>
        <span style={{ color: "#bfc7d5" }}>|</span>
        <strong style={{ color: "#fbbf24" }}>ambient</strong>
        <span style={{ color: "#bfc7d5" }}>|</span>
        <span>no speech detected</span>
        <span style={{ color: "#bfc7d5" }}>|</span>
        <span style={{ color: "#bfc7d5" }}>unscored</span>
      </span>
    );
  }

  return (
    <span style={{ display: "flex", flexWrap: "wrap", gap: "6px 8px", alignItems: "center", minWidth: 0 }}>
      <strong style={{ color: "#ffffff" }}>{formatValue(row.provider)}</strong>
      <span style={{ color: "#bfc7d5" }}>|</span>
      <span>no-result</span>
      <span style={{ color: "#bfc7d5" }}>|</span>
      <span>expected: {formatValue(row.expectedCommand)}</span>
      <span style={{ color: "#bfc7d5" }}>|</span>
      <span>heard: {quoteTranscript(row.rawTranscript)}</span>
      <span style={{ color: "#bfc7d5" }}>|</span>
      <span>normalized: none</span>
      <span style={{ color: "#bfc7d5" }}>|</span>
      <StatusPill row={row} />
      {reason && (
        <>
          <span style={{ color: "#bfc7d5" }}>|</span>
          <span>reason: {reason}</span>
        </>
      )}
      {latency && (
        <>
          <span style={{ color: "#bfc7d5" }}>|</span>
          <span>{latency}</span>
        </>
      )}
    </span>
  );
}

function CompactSystemRow({ row }) {
  const provider = row.eventType === "provider-switch" ? formatValue(row.toProvider || row.provider) : formatValue(row.provider);
  const action = normalizeAction(row);
  const isListeningStarted = row.eventType === "lifecycle" && action === "listening started";
  const isListeningStopped = row.eventType === "lifecycle" && (action === "listening stopped" || action === "listening ended");
  const isModelLoading = row.eventType === "lifecycle" && action === "model load start";
  const isModelLoaded = row.eventType === "lifecycle" && action === "model load success";
  const isModelLoadFailure = row.eventType === "lifecycle" && action === "model load failure";
  const systemType = row.eventType === "lifecycle" || row.eventType === "provider-switch" ? "system" : row.eventType;
  const label = row.eventType === "provider-switch"
    ? `provider switched: ${formatValue(row.fromProvider)} -> ${formatValue(row.toProvider)}`
    : row.eventType === "error"
      ? "error"
      : isModelLoading
        ? "model loading"
        : isModelLoaded
          ? "model loaded"
          : isModelLoadFailure
            ? "model load failure"
            : isListeningStopped
              ? "listening stopped"
              : formatValue(row.action || row.eventType);
  const reason = row.reason || row.message || row.errors;
  const url = row.fetchUrl || row.modelUrl;
  const shouldShowSystemType = !isListeningStarted && !isListeningStopped && !isModelLoading && !isModelLoaded && !isModelLoadFailure && row.eventType !== "error";
  const shouldShowReason = !isListeningStarted && !isListeningStopped && !isModelLoading && !isModelLoaded;
  const shouldShowLoad = !isModelLoading && !isModelLoaded && !isModelLoadFailure && row.eventType !== "error";
  const shouldShowListening = shouldShowLoad && !isListeningStarted;

  return (
    <span style={{ display: "flex", flexWrap: "wrap", gap: "6px 8px", alignItems: "center", minWidth: 0 }}>
      <strong style={{ color: "#ffffff" }}>{provider}</strong>
      <span style={{ color: "#bfc7d5" }}>|</span>
      {shouldShowSystemType && (
        <>
          <span>{systemType}</span>
          <span style={{ color: "#bfc7d5" }}>|</span>
        </>
      )}
      <strong style={{ color: getOutcomeColor(row) }}>{label}</strong>
      {row.eventType === "error" && reason && (
        <>
          <span style={{ color: "#bfc7d5" }}>|</span>
          <span>{reason}</span>
        </>
      )}
      {shouldShowReason && row.eventType !== "error" && reason && (
        <>
          <span style={{ color: "#bfc7d5" }}>|</span>
          <span>reason: {formatValue(reason)}</span>
        </>
      )}
      {url && (isModelLoading ? true : !isModelLoaded) && (
        <>
          <span style={{ color: "#bfc7d5" }}>|</span>
          <span>{isModelLoading ? formatValue(url) : `url: ${formatValue(url)}`}</span>
        </>
      )}
      {shouldShowLoad && (
        <>
          <span style={{ color: "#bfc7d5" }}>|</span>
          <span>load: {formatValue(row.providerLoadStatus)}</span>
        </>
      )}
      {isListeningStopped ? (
        <>
          <span style={{ color: "#bfc7d5" }}>|</span>
          <span>cleanup: {formatValue(row.cleanupStatus || (row.errors ? "failed" : "complete"))}</span>
        </>
      ) : shouldShowListening && (
        <>
          <span style={{ color: "#bfc7d5" }}>|</span>
          <span>listening: {formatValue(row.listeningStatus)}</span>
        </>
      )}
    </span>
  );
}

function ChatIcon() {
  return (
    <span
      aria-hidden="true"
      style={{
        position: "relative",
        display: "inline-block",
        width: "24px",
        height: "19px",
        border: "2px solid currentColor",
        borderRadius: "7px",
        boxSizing: "border-box",
      }}
    >
      <span
        style={{
          position: "absolute",
          right: "3px",
          bottom: "-5px",
          width: "8px",
          height: "8px",
          borderRight: "2px solid currentColor",
          borderBottom: "2px solid currentColor",
          transform: "rotate(45deg)",
          background: "#2563eb",
          boxSizing: "border-box",
        }}
      />
      <span style={{ position: "absolute", left: "5px", top: "7px", width: "3px", height: "3px", borderRadius: "50%", background: "currentColor" }} />
      <span style={{ position: "absolute", left: "10px", top: "7px", width: "3px", height: "3px", borderRadius: "50%", background: "currentColor" }} />
      <span style={{ position: "absolute", left: "15px", top: "7px", width: "3px", height: "3px", borderRadius: "50%", background: "currentColor" }} />
    </span>
  );
}

export function VoiceDebugConsole({
  rows,
  providerName,
  providerLoadStatus,
  listeningStatus,
  onClearLog,
  onAttemptArmedChange,
  mode = "floating",
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedRows, setExpandedRows] = useState(() => new Set());
  const [copyStatus, setCopyStatus] = useState("");
  const [showVerboseLifecycleLogs, setShowVerboseLifecycleLogs] = useState(false);
  const [showAmbientEvents, setShowAmbientEvents] = useState(false);
  const [isAttemptArmed, setIsAttemptArmed] = useState(false);
  const [scoredAttemptIds, setScoredAttemptIds] = useState(() => new Set());
  const [highlightedScorecardKey, setHighlightedScorecardKey] = useState("");
  const [targetAttempts, setTargetAttempts] = useState(5);
  const processedAttemptIdsRef = useRef(new Set());
  const logScrollRef = useRef(null);
  const markdownLog = useMemo(() => buildMarkdownTable(rows, scoredAttemptIds), [rows, scoredAttemptIds]);
  const csvLog = useMemo(() => buildCsv(rows, scoredAttemptIds), [rows, scoredAttemptIds]);
  const displayRows = useMemo(() => getDisplayRows(rows, {
    showVerboseLifecycleLogs,
    showAmbientEvents,
    scoredAttemptIds,
  }), [rows, showVerboseLifecycleLogs, showAmbientEvents, scoredAttemptIds]);
  const scorecard = useMemo(() => buildScorecard(rows, targetAttempts, scoredAttemptIds), [rows, targetAttempts, scoredAttemptIds]);
  const latestError = [...rows].reverse().find((row) => row.errors)?.errors || "";
  const isPanelMode = mode === "panel";
  const latestScorecardKey = useMemo(() => {
    const latestAttempt = [...rows].reverse().find((row) => isAttemptRow(row) && scoredAttemptIds.has(row.id));
    return latestAttempt ? `${latestAttempt.provider || "unknown"}::${latestAttempt.expectedCommand}` : "";
  }, [rows, scoredAttemptIds]);

  useEffect(() => {
    if ((isOpen || isPanelMode) && logScrollRef.current) {
      logScrollRef.current.scrollTop = logScrollRef.current.scrollHeight;
    }
  }, [rows.length, displayRows.length, isOpen, isPanelMode]);

  useEffect(() => {
    const startId = window.setTimeout(() => setHighlightedScorecardKey(latestScorecardKey), 0);
    const endId = window.setTimeout(() => setHighlightedScorecardKey(""), latestScorecardKey ? 1800 : 0);
    return () => {
      window.clearTimeout(startId);
      window.clearTimeout(endId);
    };
  }, [latestScorecardKey]);

  useEffect(() => {
    onAttemptArmedChange?.(isAttemptArmed);
  }, [isAttemptArmed, onAttemptArmedChange]);

  useEffect(() => {
    let consumedArm = false;
    rows.forEach((row) => {
      if (!isAttemptRow(row) || processedAttemptIdsRef.current.has(row.id)) {
        return;
      }

      processedAttemptIdsRef.current.add(row.id);
      if (isAttemptArmed && !consumedArm) {
        consumedArm = true;
        setScoredAttemptIds((ids) => {
          const next = new Set(ids);
          next.add(row.id);
          return next;
        });
        setIsAttemptArmed(false);
      }
    });
  }, [rows, isAttemptArmed]);

  const copyMarkdownLog = async () => {
    setCopyStatus("");
    try {
      await navigator.clipboard.writeText(markdownLog);
      setCopyStatus("Copied markdown");
    } catch {
      setCopyStatus("Unable to copy");
    }
  };

  const toggleRow = (rowId) => {
    setExpandedRows((expanded) => {
      const next = new Set(expanded);
      if (next.has(rowId)) {
        next.delete(rowId);
      } else {
        next.add(rowId);
      }
      return next;
    });
  };

  return (
    <>
      {!isPanelMode && <button
        type="button"
        aria-label={isOpen ? "Close voice debug console" : "Open voice debug console"}
        title="Voice debug console"
        onClick={() => setIsOpen((open) => !open)}
        style={{
          position: "fixed",
          right: "20px",
          bottom: "20px",
          zIndex: 80,
          width: "56px",
          height: "56px",
          borderRadius: "50%",
          border: "1px solid #93c5fd",
          background: "#2563eb",
          color: "#ffffff",
          display: "grid",
          placeItems: "center",
          boxShadow: "0 18px 46px rgba(0, 0, 0, 0.42)",
          cursor: "pointer",
        }}
      >
        <ChatIcon />
      </button>}

      {(isOpen || isPanelMode) && (
        <aside
          aria-label="Voice debug console"
          style={{
            position: isPanelMode ? "sticky" : "fixed",
            top: isPanelMode ? "16px" : "auto",
            right: isPanelMode ? "auto" : "20px",
            bottom: isPanelMode ? "auto" : "88px",
            zIndex: isPanelMode ? 1 : 79,
            width: isPanelMode ? "100%" : "min(92vw, 660px)",
            maxHeight: isPanelMode ? "calc(100vh - 64px)" : "min(78vh, 760px)",
            display: "grid",
            gridTemplateRows: "auto auto auto 1fr",
            overflow: "hidden",
            background: "#141420",
            border: "1px solid #454564",
            borderRadius: "8px",
            boxShadow: isPanelMode ? "none" : "0 24px 70px rgba(0, 0, 0, 0.55)",
            color: "#ffffff",
            fontFamily: "Inter, system-ui, sans-serif",
          }}
        >
          <header style={{ display: "grid", gap: "8px", padding: "12px", borderBottom: "1px solid #303049", background: "#1b1b29" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
              <div style={{ display: "grid", gap: "3px", minWidth: 0 }}>
                <h2 style={{ margin: 0, color: "#ffffff", fontSize: "1rem" }}>Voice Debug Console</h2>
                <span style={{ color: "#bfc7d5", fontSize: "0.78rem", overflowWrap: "anywhere" }}>
                  {providerName} / {providerLoadStatus} / {listeningStatus}
                </span>
              </div>
              {!isPanelMode && <button
                type="button"
                aria-label="Close voice debug console"
                onClick={() => setIsOpen(false)}
                style={{ width: "34px", height: "34px", borderRadius: "6px", border: "1px solid #484867", background: "#242438", color: "#ffffff", font: "inherit", cursor: "pointer" }}
              >
                X
              </button>}
            </div>
            {latestError && (
              <div style={{ color: "#fca5a5", fontSize: "0.78rem", overflowWrap: "anywhere" }}>
                {latestError}
              </div>
            )}
          </header>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", padding: "12px", borderBottom: "1px solid #303049", background: "#181824" }}>
            <button
              type="button"
              onClick={() => {
                onClearLog();
                setCopyStatus("");
                setExpandedRows(new Set());
                setScoredAttemptIds(new Set());
                processedAttemptIdsRef.current = new Set();
                setIsAttemptArmed(false);
              }}
              style={{ background: "#2d2d40", color: "#ffffff", border: "1px solid #5a5a78", borderRadius: "6px", padding: "8px 10px", font: "inherit", cursor: "pointer" }}
            >
              Clear log
            </button>
            <button
              type="button"
              onClick={copyMarkdownLog}
              style={{ background: "#2d2d40", color: "#ffffff", border: "1px solid #5a5a78", borderRadius: "6px", padding: "8px 10px", font: "inherit", cursor: "pointer" }}
            >
              Copy markdown
            </button>
            <button
              type="button"
              onClick={() => downloadTextFile("psilabs-voice-debug-log.md", markdownLog, "text/markdown")}
              style={{ background: "#2d2d40", color: "#ffffff", border: "1px solid #5a5a78", borderRadius: "6px", padding: "8px 10px", font: "inherit", cursor: "pointer" }}
            >
              Download .md
            </button>
            <button
              type="button"
              onClick={() => downloadTextFile("psilabs-voice-debug-log.csv", csvLog, "text/csv")}
              style={{ background: "#2d2d40", color: "#ffffff", border: "1px solid #5a5a78", borderRadius: "6px", padding: "8px 10px", font: "inherit", cursor: "pointer" }}
            >
              Download .csv
            </button>
            <button
              type="button"
              onClick={() => setIsAttemptArmed((armed) => !armed)}
              style={{
                width: "164px",
                minHeight: "34px",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                background: isAttemptArmed ? "#14532d" : "#2563eb",
                color: "#ffffff",
                border: "1px solid " + (isAttemptArmed ? "#86efac" : "#93c5fd"),
                borderRadius: "6px",
                padding: "8px 10px",
                font: "inherit",
                fontWeight: 700,
                lineHeight: 1,
                whiteSpace: "nowrap",
                cursor: "pointer",
              }}
            >
              {isAttemptArmed ? "Cancel arm attempt" : "Arm next attempt"}
            </button>
            <label style={{ display: "inline-flex", alignItems: "center", gap: "7px", color: "#d8d4ee", fontSize: "0.78rem", padding: "6px 2px" }}>
              <input
                type="checkbox"
                checked={showVerboseLifecycleLogs}
                onChange={(event) => setShowVerboseLifecycleLogs(event.target.checked)}
                style={{ accentColor: "#60a5fa" }}
              />
              Show verbose lifecycle logs
            </label>
            <label style={{ display: "inline-flex", alignItems: "center", gap: "7px", color: "#d8d4ee", fontSize: "0.78rem", padding: "6px 2px" }}>
              <input
                type="checkbox"
                checked={showAmbientEvents}
                onChange={(event) => setShowAmbientEvents(event.target.checked)}
                style={{ accentColor: "#60a5fa" }}
              />
              Show ambient/unscored events
            </label>
            {copyStatus && (
              <span style={{ alignSelf: "center", color: copyStatus.startsWith("Copied") ? "#86efac" : "#fca5a5", fontSize: "0.78rem" }}>
                {copyStatus}
              </span>
            )}
          </div>

          <Scorecard
            scorecard={scorecard}
            targetAttempts={targetAttempts}
            latestScorecardKey={highlightedScorecardKey}
            onTargetAttemptsChange={setTargetAttempts}
          />

          <div ref={logScrollRef} style={{ overflowY: "auto", background: "#11111a" }}>
            {displayRows.length === 0 ? (
              <div style={{ color: "#bfc7d5", padding: "18px 16px", fontSize: "0.86rem" }}>
                {rows.length === 0 ? "No ASR events logged yet." : "Only verbose lifecycle events are currently hidden."}
              </div>
            ) : (
              displayRows.map((row) => {
                const expanded = expandedRows.has(row.id);

                return (
                  <div key={row.id} style={{ borderBottom: "1px solid #27273d" }}>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "28px minmax(72px, auto) 1fr",
                        gap: "8px",
                        alignItems: "center",
                        padding: "8px 12px",
                        color: "#d8d4ee",
                        fontSize: "0.8rem",
                        lineHeight: 1.45,
                      }}
                    >
                      <button
                        type="button"
                        aria-label={expanded ? "Collapse log row" : "Expand log row"}
                        onClick={() => toggleRow(row.id)}
                        style={{
                          width: "24px",
                          height: "24px",
                          borderRadius: "5px",
                          border: "1px solid #3d3d59",
                          background: expanded ? "#2b2b43" : "#1a1a28",
                          color: "#d8d4ee",
                          font: "inherit",
                          lineHeight: 1,
                          cursor: "pointer",
                        }}
                      >
                        {expanded ? "v" : ">"}
                      </button>
                      <span style={{ color: "#93c5fd", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                        [{formatClockTime(row.timestamp)}]
                      </span>
                      {row.eventType === "speech"
                        ? <CompactSpeechRow row={row} />
                        : row.eventType === "no-result"
                          ? <CompactNoResultRow row={row} />
                          : <CompactSystemRow row={row} />}
                    </div>

                    {expanded && (
                      <div style={{ display: "grid", gap: "10px", padding: "0 12px 12px 48px" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(132px, 1fr))", gap: "10px", padding: "10px", background: "#181824", border: "1px solid #303049", borderRadius: "8px" }}>
                          <Detail label="Event" value={row.eventType} />
                          <Detail label="Action" value={row.action} />
                          <Detail label="Provider" value={getProviderLabel(row)} />
                          <Detail label="Expected" value={row.expectedCommand} />
                          <Detail label="Success/fail" value={getSuccessLabel(row)} tone={row.success === "success" ? "good" : row.success === "fail" ? "bad" : "neutral"} />
                          <Detail label="Confidence" value={row.confidence} />
                          <Detail label="Latency ms" value={row.latencyMs} />
                          <Detail label="Reason" value={row.reason} tone={row.eventType === "no-result" ? "warn" : "neutral"} />
                          <Detail label="Message" value={row.message} />
                          <Detail label="Model URL" value={row.modelUrl} />
                          <Detail label="Fetch URL" value={row.fetchUrl} />
                          <Detail label="Load status" value={row.providerLoadStatus} tone={row.providerLoadStatus === "error" ? "bad" : "neutral"} />
                          <Detail label="Listening" value={row.listeningStatus} tone={row.listeningStatus === "error" ? "bad" : "neutral"} />
                          <Detail label="Errors" value={row.errors} tone={row.errors ? "bad" : "neutral"} />
                        </div>
                        <pre style={{ margin: 0, padding: "10px", whiteSpace: "pre-wrap", overflowX: "auto", color: "#cbd5e1", background: "#181824", border: "1px solid #303049", borderRadius: "8px", fontSize: "0.74rem", lineHeight: 1.45 }}>
                          {JSON.stringify({ ...row, notes: getExportNotes(row) }, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </aside>
      )}
    </>
  );
}
