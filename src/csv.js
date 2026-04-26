import { CATEGORIES } from './constants.js';
import { buildSessionAnalytics, buildTrialRecord } from './analytics.js';
import { buildGroupParticipantSummary, buildGroupRollupSummary } from './groupAnalytics.js';
import { accuracyScore, patternLabel, proximityScore } from './utils.js';
import { getTimeOfDayTag } from './timeOfDay.js';
import {
  PSILABS_DOT_V1_HEADERS,
  analyzeSoloHeaders,
  convertLegacySoloRowToDotV1Values,
  convertNormalizedSoloRowToLegacy,
  normalizeSoloRow,
} from './schemaRegistry.js';

export function slugifyCsvPart(value, fallback = "session") {
  return String(value || fallback)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || fallback;
}

export function createCsvTimestamp(date = new Date()) {
  return date
    .toISOString()
    .replace("T", "-")
    .slice(0, 19)
    .replace(/:/g, "-");
}

export function buildResultsFilename(name, category, timestamp = createCsvTimestamp()) {
  const safeName = slugifyCsvPart(name, "participant");
  const safeCategory = slugifyCsvPart(category, "session");
  return `${safeName}-${safeCategory}-${timestamp}-results.csv`;
}

export function buildUserHistoryFilename(name, timestamp = createCsvTimestamp()) {
  const safeName = slugifyCsvPart(name, "participant");
  return `${safeName}-google-history-${timestamp}-results.csv`;
}

export function downloadCsv(filename, csvText) {
  const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function toCsvCell(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function joinPipe(values) {
  return Array.isArray(values) ? values.filter(Boolean).join("|") : "";
}

export const SOLO_TRIAL_HEADERS = [
  "session_id",
  "run_id",
  "app_mode",
  "share_code",
  "started_at",
  "ended_at",
  "date",
  "time",
  "trial_started_at",
  "trial_ended_at",
  "trial_started_at_estimated",
  "trial_ended_at_estimated",
  "time_of_day_tag",
  "time_of_day_is_estimated",
  "notes",
  "training_overlay_opens",
  "training_overlay_ms",
  "name",
  "category",
  "guess_policy",
  "deck_policy",
  "option_count",
  "option_values",
  "trial_count",
  "card_index",
  "target_value",
  "guesses",
  "first_guess",
  "first_guess_correct",
  "correct_guess_index",
  "guess_count",
  "time_to_first_ms",
  "guess_intervals_ms",
  "trial_duration_ms",
  "score_percent",
  "proximity",
  "pattern",
  "skipped",
  "first_guess_accuracy",
  "z_score",
  "p_value",
  "average_guess_position",
  "guess_position_std_dev",
  "weighted_score",
];

export function buildSoloTrialRows(data) {
  const {
    appMode = "",
    shareCode = "",
    sessionId = new Date().toISOString().replace(/[:.]/g, "-"),
    runId = "",
    startedAt = null,
    endedAt = null,
    name,
    results,
    category,
    trials = [],
    analytics = null,
    guessPolicy = "",
    deckPolicy = "",
    optionCount = data.colors?.length ?? 0,
    optionValues = data.colors?.map((item) => item.name) ?? [],
  } = data;
  const now = new Date(endedAt || startedAt || new Date());
  const dateStr = now.toLocaleDateString("en-CA");
  const timeStr = now.toLocaleTimeString("en-GB");
  const effectiveTrials = trials.length > 0
    ? trials
    : results.map((result, index) => buildTrialRecord({
        cardIndex: index + 1,
        category,
        optionCount,
        targetValue: result.target,
        guesses: result.guesses,
        guessPolicy,
        deckPolicy,
        timeToFirstMs: result.timeToFirst ?? null,
        guessIntervalsMs: result.guessDeltas ?? [],
        trialDurationMs: [result.timeToFirst, ...(result.guessDeltas || [])]
          .filter((value) => value != null)
          .reduce((sum, value) => sum + value, 0) || null,
      }));

  return effectiveTrials.map((trial, index) => {
    const legacyResult = results[index];
    const hasExactTrialTimes = Boolean(trial.trialStartedAt);
    const derivedExactStartedAt = trial.trialStartedAt ? new Date(trial.trialStartedAt) : null;
    const derivedExactEndedAt = trial.trialEndedAt ? new Date(trial.trialEndedAt) : null;
    const derivedEstimatedStartedAt = trial.trialStartedAtEstimated ? new Date(trial.trialStartedAtEstimated) : null;
    const derivedEstimatedEndedAt = trial.trialEndedAtEstimated ? new Date(trial.trialEndedAtEstimated) : null;
    const derivedEstimatedFromSession = (() => {
      if (hasExactTrialTimes) return null;
      const sessionStartMs = Date.parse(startedAt || "");
      if (!Number.isFinite(sessionStartMs)) return null;
      const durations = effectiveTrials.map((t) => {
        if (Number.isFinite(t.trialDurationMs)) return t.trialDurationMs;
        const base = Number.isFinite(t.timeToFirstMs) ? t.timeToFirstMs : 0;
        const sum = Array.isArray(t.guessIntervalsMs)
          ? t.guessIntervalsMs.filter((v) => Number.isFinite(v)).reduce((acc, v) => acc + v, 0)
          : 0;
        const resolved = base + sum;
        return resolved > 0 ? resolved : 0;
      });
      const previousDurationMs = durations.slice(0, index).reduce((acc, v) => acc + (v || 0), 0);
      const durationMs = durations[index] ?? 0;
      const estimatedStart = new Date(sessionStartMs + previousDurationMs);
      const estimatedEnd = new Date(sessionStartMs + previousDurationMs + durationMs);
      if (!Number.isFinite(estimatedStart.getTime())) return null;
      return { estimatedStart, estimatedEnd };
    })();

    const exactStart = derivedExactStartedAt && Number.isFinite(derivedExactStartedAt.getTime()) ? derivedExactStartedAt : null;
    const exactEnd = derivedExactEndedAt && Number.isFinite(derivedExactEndedAt.getTime()) ? derivedExactEndedAt : null;
    const estimatedStart = derivedEstimatedStartedAt && Number.isFinite(derivedEstimatedStartedAt.getTime())
      ? derivedEstimatedStartedAt
      : (derivedEstimatedFromSession?.estimatedStart ?? null);
    const estimatedEnd = derivedEstimatedEndedAt && Number.isFinite(derivedEstimatedEndedAt.getTime())
      ? derivedEstimatedEndedAt
      : (derivedEstimatedFromSession?.estimatedEnd ?? null);

    const timeOfDayIsEstimated = trial.timeOfDayIsEstimated != null
      ? Boolean(trial.timeOfDayIsEstimated)
      : (!exactStart && Boolean(estimatedStart));
    const timeOfDayTag = trial.timeOfDayTag || getTimeOfDayTag(exactStart || estimatedStart);
    const scorePercent = legacyResult?.acc ?? (
      Number.isFinite(trial.correctGuessIndex)
        ? accuracyScore(trial.correctGuessIndex)
        : 0
    );
    const prox = legacyResult?.prox ?? (
      category === "Colors" && trial.firstGuess
        ? proximityScore(trial.firstGuess, trial.targetValue)
        : null
    );
    const pattern = legacyResult?.pattern ?? (
      category === "Colors" && trial.guesses.length > 0
        ? patternLabel(trial.guesses, trial.targetValue)
        : null
    );
    const skipped = legacyResult?.skipped === true;

    return [
      sessionId,
      runId ?? "",
      appMode,
      shareCode,
      startedAt ?? "",
      endedAt ?? "",
      dateStr,
      timeStr,
      exactStart ? exactStart.toISOString() : "",
      exactEnd ? exactEnd.toISOString() : "",
      estimatedStart ? estimatedStart.toISOString() : "",
      estimatedEnd ? estimatedEnd.toISOString() : "",
      timeOfDayTag || "",
      timeOfDayTag ? String(timeOfDayIsEstimated) : "",
      trial.notes ?? legacyResult?.notes ?? "",
      trial.trainingOverlayOpens ?? legacyResult?.trainingOverlayOpens ?? "",
      trial.trainingOverlayMs ?? legacyResult?.trainingOverlayMs ?? "",
      name,
      category,
      guessPolicy,
      deckPolicy,
      optionCount,
      joinPipe(optionValues),
      effectiveTrials.length,
      trial.cardIndex,
      trial.targetValue,
      joinPipe(trial.guesses),
      trial.firstGuess ?? "",
      trial.firstGuessCorrect,
      trial.correctGuessIndex ?? "",
      trial.guessCount,
      trial.timeToFirstMs ?? "",
      joinPipe(trial.guessIntervalsMs),
      trial.trialDurationMs ?? "",
      scorePercent,
      prox ?? "",
      pattern ?? "",
      skipped,
      analytics?.firstGuessAccuracy ?? "",
      analytics?.zScore ?? "",
      analytics?.pValue ?? "",
      analytics?.averageGuessPosition ?? "",
      analytics?.guessPositionStdDev ?? "",
      analytics?.weightedScore ?? "",
    ];
  });
}

export function buildDotV1SoloTrialRows(data) {
  return buildSoloTrialRows(data).map((rowValues) => {
    const legacyRowObject = Object.fromEntries(SOLO_TRIAL_HEADERS.map((header, index) => [header, rowValues[index] ?? ""]));
    return convertLegacySoloRowToDotV1Values(legacyRowObject);
  });
}

export function buildSoloResultsCsv(data) {
  const rows = buildDotV1SoloTrialRows(data).map((row) => row.map(toCsvCell).join(","));

  return [PSILABS_DOT_V1_HEADERS.join(","), ...rows].join("\n");
}

export function buildSoloHistoryResultsCsv(sessions) {
  const normalizedSessions = Array.isArray(sessions) ? sessions : [];
  const rows = normalizedSessions
    .flatMap((session) => buildDotV1SoloTrialRows(session))
    .map((row) => row.map(toCsvCell).join(","));

  return [PSILABS_DOT_V1_HEADERS.join(","), ...rows].join("\n");
}

function buildGroupRows(data) {
  const {
    participants,
    slots,
    colors,
    category,
    session,
    timers = [],
    endedAt,
    sessionId = new Date(endedAt || new Date()).toISOString().replace(/[:.]/g, "-"),
    startedAt = null,
    appMode = "",
    shareCode = "",
    guessPolicy = "",
    deckPolicy = "",
  } = data;
  const now = new Date(endedAt || startedAt || new Date());
  const dateStr = now.toLocaleDateString("en-CA");
  const timeStr = now.toLocaleTimeString("en-GB");
  const optionValues = colors?.map((item) => item.name) ?? [];
  const optionCount = optionValues.length;
  const participantSummaries = participants.map((participant) => {
    return buildGroupParticipantSummary({
      participant,
      session,
      slots,
      activeOptions: colors,
      category,
      guessPolicy,
      deckPolicy,
      timers,
    });
  });
  const rollup = buildGroupRollupSummary(participantSummaries, guessPolicy);

  return participantSummaries.flatMap((summary) => {
    const participant = summary.participant;
    const firstGuessAccuracy = summary.analytics?.firstGuessAccuracy ?? "";
    const zScore = summary.analytics?.zScore ?? "";
    const pValue = summary.analytics?.pValue ?? "";
    const averageGuessPosition = summary.analytics?.averageGuessPosition ?? "";
    const guessPositionStdDev = summary.analytics?.guessPositionStdDev ?? "";
    const weightedScore = summary.analytics?.weightedScore ?? "";

    return summary.trials.map((trial, index) => {
      const cell = session?.[participant.id]?.[index] ?? { dnf: false };
      const legacyAccuracy = Number.isFinite(trial.correctGuessIndex)
        ? accuracyScore(trial.correctGuessIndex)
        : 0;

      return [
        sessionId,
        appMode,
        shareCode,
        startedAt ?? "",
        endedAt ?? "",
        dateStr,
        timeStr,
        participant.id,
        participant.name,
        participant.active ? "true" : "false",
        category,
        guessPolicy,
        deckPolicy,
        optionCount,
        joinPipe(optionValues),
        slots.length,
        trial.cardIndex,
        trial.targetValue,
        joinPipe(trial.guesses),
        trial.firstGuess ?? "",
        trial.firstGuessCorrect,
        trial.correctGuessIndex ?? "",
        trial.guessCount,
        trial.timeToFirstMs ?? "",
        joinPipe(trial.guessIntervalsMs),
        trial.trialDurationMs ?? "",
        legacyAccuracy,
        cell.dnf ? "true" : "false",
        firstGuessAccuracy,
        zScore,
        pValue,
        averageGuessPosition,
        guessPositionStdDev,
        weightedScore,
        rollup.firstGuessAccuracy ?? "",
        rollup.zScore ?? "",
        rollup.pValue ?? "",
        rollup.averageGuessPosition ?? "",
        rollup.weightedScore ?? "",
        rollup.averageTimeMs ?? "",
      ].map(toCsvCell).join(",");
    });
  });
}

export function buildGroupResultsCsv(data) {
  const headers = [
    "session_id",
    "app_mode",
    "share_code",
    "started_at",
    "ended_at",
    "date",
    "time",
    "participant_id",
    "participant_name",
    "participant_active",
    "category",
    "guess_policy",
    "deck_policy",
    "option_count",
    "option_values",
    "trial_count",
    "card_index",
    "target_value",
    "guesses",
    "first_guess",
    "first_guess_correct",
    "correct_guess_index",
    "guess_count",
    "time_to_first_ms",
    "guess_intervals_ms",
    "trial_duration_ms",
    "score_percent",
    "skipped",
    "participant_first_guess_accuracy",
    "participant_z_score",
    "participant_p_value",
    "participant_average_guess_position",
    "participant_guess_position_std_dev",
    "participant_weighted_score",
    "group_first_guess_accuracy",
    "group_z_score",
    "group_p_value",
    "group_average_guess_position",
    "group_weighted_score",
    "group_average_time_ms",
  ];

  return [headers.join(","), ...buildGroupRows(data)].join("\n");
}

export function buildGroupParticipantCsv(data, participantId) {
  const participant = data.participants.find(p => p.id === participantId);
  if (!participant) return "";
  const filteredData = { ...data, participants: [participant] };
  return buildGroupResultsCsv(filteredData);
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      if (row.some(value => value !== "")) rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  if (cell !== "" || row.length > 0) {
    row.push(cell);
    if (row.some(value => value !== "")) rows.push(row);
  }

  if (!rows.length) return [];

  const [headers, ...body] = rows;
  return body.map((values) =>
    Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]))
  );
}

function asNumber(value) {
  if (value === "" || value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asBool(value) {
  return String(value).toLowerCase() === "true";
}

function secondsToMs(value) {
  const seconds = asNumber(value);
  return seconds == null ? null : Math.round(seconds * 1000);
}

function splitPipe(value) {
  return String(value || "")
    .split("|")
    .map(part => part.trim())
    .filter(Boolean);
}

function looksLikeSoloTrialRows(rows) {
  const first = rows[0] || {};
  if ("participant_name" in first) return false;

  const headerAnalysis = analyzeSoloHeaders(Object.keys(first));
  return headerAnalysis.canNormalize || headerAnalysis.recognizedHeaders.length > 0;
}

function normalizeSoloRowsForImport(rows) {
  if (!Array.isArray(rows) || rows.length === 0 || !looksLikeSoloTrialRows(rows)) {
    return rows;
  }

  return rows.map((row) => {
    const normalizedRow = normalizeSoloRow(row);
    return { ...row, ...convertNormalizedSoloRowToLegacy(normalizedRow) };
  });
}

function buildColorsForCategory(category, rows) {
  const categoryItems = CATEGORIES[category]?.items ?? [];
  if (!categoryItems.length) return [];

  const namesInCsv = new Set(
    rows.flatMap((row) => [
      row.target ?? row.target_value,
      ...splitPipe(row.guesses),
    ])
  );

  return categoryItems.filter(item => namesInCsv.has(item.name) || namesInCsv.size === 0);
}

export function parseResultsCsvSummary(text) {
  const rows = normalizeSoloRowsForImport(parseCsv(text));
  if (!rows.length) throw new Error("CSV file is empty.");

  const first = rows[0];
  if ("participant_name" in first) {
    const names = Array.from(new Set(rows.map(row => row.participant_name).filter(Boolean)));
    return {
      kind: "group",
      category: first.category || "Colors",
      roundSize: asNumber(first.trial_count) ?? asNumber(first.round_size) ?? rows.length,
      participantNames: names,
    };
  }

  if ("card_index" in first || "target_value" in first) {
    return {
      kind: "solo",
      appMode: first.app_mode || "solo",
      shareCode: first.share_code || "",
      category: first.category || "Colors",
      roundSize: asNumber(first.trial_count) ?? rows.length,
      participantNames: first.name ? [first.name] : [],
    };
  }

  if ("name" in first) {
    return {
      kind: "solo",
      appMode: first.app_mode || "solo",
      shareCode: first.share_code || "",
      category: first.category || "Colors",
      roundSize: asNumber(first.round_size) ?? rows.length,
      participantNames: first.name ? [first.name] : [],
    };
  }

  throw new Error("This CSV format is not recognized.");
}

export function parseSoloResultsCsv(text) {
  const rows = normalizeSoloRowsForImport(parseCsv(text));
  if (!rows.length) throw new Error("CSV file is empty.");
  if (!("name" in rows[0])) throw new Error("This does not look like a solo results CSV.");

  const first = rows[0];
  if ("card_index" in first || "target_value" in first) {
    const category = first.category || "Colors";
    const optionValues = splitPipe(first.option_values);
    const colors = buildColorsForCategory(category, rows).filter((item) => {
      return optionValues.length === 0 || optionValues.includes(item.name);
    });
    const guessPolicy = first.guess_policy || "";
    const deckPolicy = first.deck_policy || "";
    const orderedRows = [...rows].sort((a, b) => (asNumber(a.card_index) ?? 0) - (asNumber(b.card_index) ?? 0));
    const resolvedOptionCount = asNumber(first.option_count) ?? (optionValues.length || colors.length);

    const trials = orderedRows
      .map((row) => buildTrialRecord({
        cardIndex: asNumber(row.card_index) ?? 0,
        category,
        optionCount: asNumber(row.option_count) ?? resolvedOptionCount,
        targetValue: row.target_value,
        guesses: splitPipe(row.guesses),
        guessPolicy,
        deckPolicy,
        timeToFirstMs: asNumber(row.time_to_first_ms),
        guessIntervalsMs: splitPipe(row.guess_intervals_ms).map(asNumber).filter((value) => value != null),
        trialDurationMs: asNumber(row.trial_duration_ms),
        trialStartedAt: row.trial_started_at || null,
        trialEndedAt: row.trial_ended_at || null,
        trialStartedAtEstimated: row.trial_started_at_estimated || null,
        trialEndedAtEstimated: row.trial_ended_at_estimated || null,
        timeOfDayTag: row.time_of_day_tag || "",
        timeOfDayIsEstimated: row.time_of_day_is_estimated == null || row.time_of_day_is_estimated === ""
          ? null
          : asBool(row.time_of_day_is_estimated),
        notes: row.notes || "",
        trainingOverlayOpens: asNumber(row.training_overlay_opens),
        trainingOverlayMs: asNumber(row.training_overlay_ms),
      }));

    const analytics = buildSessionAnalytics({
      trials,
      optionValues: optionValues.length ? optionValues : colors.map((item) => item.name),
      optionCount: resolvedOptionCount,
      guessPolicy,
    });

    const results = trials.map((trial, index) => ({
      target: trial.targetValue,
      guesses: trial.guesses,
      acc: Number.isFinite(trial.correctGuessIndex) ? accuracyScore(trial.correctGuessIndex) : 0,
      prox: category === "Colors" && trial.firstGuess ? proximityScore(trial.firstGuess, trial.targetValue) : null,
      pattern: category === "Colors" && trial.guesses.length > 0 ? patternLabel(trial.guesses, trial.targetValue) : null,
      skipped: asBool(orderedRows[index]?.skipped),
      timeToFirst: trial.timeToFirstMs,
      guessDeltas: trial.guessIntervalsMs,
    }));

    return {
      appMode: first.app_mode || "solo",
      shareCode: first.share_code || null,
      sessionId: first.session_id || "",
      startedAt: first.started_at || null,
      endedAt: first.ended_at || null,
      name: first.name || "Imported Session",
      category,
      colors,
      results,
      guessPolicy,
      deckPolicy,
      optionValues: optionValues.length ? optionValues : colors.map((item) => item.name),
      optionCount: resolvedOptionCount,
      trials,
      analytics,
      importedFromCsv: true,
    };
  }

  const category = first.category || "Colors";
  const colors = buildColorsForCategory(category, rows);
  const baseMs = Date.now();

  const results = [...rows]
    .sort((a, b) => (asNumber(a.card_position) ?? 0) - (asNumber(b.card_position) ?? 0))
    .map((row, index) => {
      const timeToFirst = secondsToMs(row.time_to_first_s);
      const guessDeltas = splitPipe(row.time_per_guess_s)
        .map(secondsToMs)
        .filter(value => value != null);
      let currentTs = baseMs + index * 10000;
      const guesses = splitPipe(row.guesses);
      const guessTimeline = guesses.map((guess, guessIndex) => {
        if (guessIndex === 0 && timeToFirst != null) {
          currentTs += timeToFirst;
        } else if (guessIndex > 0) {
          currentTs += guessDeltas[guessIndex - 1] ?? 0;
        }
        return { color: guess, ts: currentTs };
      });

      return {
        target: row.target,
        guesses,
        acc: asNumber(row.accuracy) ?? 0,
        prox: asNumber(row.proximity),
        pattern: row.pattern || null,
        skipped: asBool(row.skipped),
        timeToFirst,
        guessDeltas,
        importedTimeline: guessTimeline,
      };
    });

    return {
      appMode: first.app_mode || "solo",
      shareCode: first.share_code || null,
      sessionId: first.session_id || "",
      startedAt: first.started_at || null,
      endedAt: first.ended_at || null,
      name: first.name || "Imported Session",
      category,
    colors,
    results,
    importedFromCsv: true,
  };
}

export function parseGroupResultsCsv(text) {
  const rows = parseCsv(text);
  if (!rows.length) throw new Error("CSV file is empty.");
  if (!("participant_name" in rows[0])) throw new Error("This does not look like a group results CSV.");

  const first = rows[0];
  if ("card_index" in first || "target_value" in first) {
    const orderedRows = [...rows].sort((a, b) => {
      const cardDiff = (asNumber(a.card_index) ?? 0) - (asNumber(b.card_index) ?? 0);
      if (cardDiff !== 0) return cardDiff;
      return String(a.participant_name).localeCompare(String(b.participant_name));
    });

    const category = first.category || "Colors";
    const optionValues = splitPipe(first.option_values);
    const colors = buildColorsForCategory(category, orderedRows).filter((item) => {
      return optionValues.length === 0 || optionValues.includes(item.name);
    });
    const guessPolicy = first.guess_policy || "";
    const deckPolicy = first.deck_policy || "";

    const participantMap = new Map();
    orderedRows.forEach((row, rowIndex) => {
      const fallbackId = asNumber(row.participant_id) ?? rowIndex;
      const participantName = row.participant_name || `Participant ${fallbackId + 1}`;
      if (!participantMap.has(participantName)) {
        participantMap.set(participantName, {
          id: fallbackId,
          name: participantName,
          active: asBool(row.participant_active) || row.participant_active === "",
        });
      }
    });

    const participants = [...participantMap.values()].sort((a, b) => a.id - b.id);
    const participantIdByName = Object.fromEntries(participants.map((participant) => [participant.name, participant.id]));
    const slotByIndex = new Map();
    const maxDurationBySlot = new Map();

    orderedRows.forEach((row) => {
      const slotIndex = Math.max(0, (asNumber(row.card_index) ?? 1) - 1);
      if (!slotByIndex.has(slotIndex)) {
        const fallback = colors.find((item) => item.name === row.target_value);
        slotByIndex.set(slotIndex, fallback ?? { name: row.target_value, symbol: row.target_value?.[0] ?? "?", hex: "#8080a0" });
      }

      const durationMs = asNumber(row.trial_duration_ms);
      if (durationMs != null) {
        maxDurationBySlot.set(slotIndex, Math.max(durationMs, maxDurationBySlot.get(slotIndex) ?? 0));
      }
    });

    const slots = [...slotByIndex.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, slot]) => slot);

    let runningMs = Date.now();
    const timers = slots.map((_, slotIndex) => {
      const durationMs = maxDurationBySlot.get(slotIndex) ?? 0;
      const startMs = runningMs;
      const endMs = durationMs > 0 ? startMs + durationMs : startMs;
      runningMs = endMs;
      return { startMs, endMs };
    });

    const session = {};
    orderedRows.forEach((row) => {
      const pid = participantIdByName[row.participant_name];
      const slotIndex = Math.max(0, (asNumber(row.card_index) ?? 1) - 1);
      const slotStartMs = timers[slotIndex]?.startMs ?? Date.now();
      const timeToFirst = asNumber(row.time_to_first_ms);
      const deltas = splitPipe(row.guess_intervals_ms)
        .map(asNumber)
        .filter((value) => value != null);

      let currentTs = slotStartMs;
      const guesses = splitPipe(row.guesses).map((guess, guessIndex) => {
        if (guessIndex === 0 && timeToFirst != null) {
          currentTs += timeToFirst;
        } else if (guessIndex > 0) {
          currentTs += deltas[guessIndex - 1] ?? 0;
        }
        return { color: guess, ts: currentTs };
      });

      session[pid] = {
        ...(session[pid] ?? {}),
        [slotIndex]: {
          guesses,
          dnf: asBool(row.skipped),
          slotStart: slotStartMs,
        },
      };
    });

    return {
      appMode: first.app_mode || "group",
      shareCode: first.share_code || null,
      sessionId: first.session_id || "",
      startedAt: first.started_at || null,
      endedAt: first.ended_at || new Date(runningMs).toISOString(),
      participants,
      slots,
      colors,
      category,
      guessPolicy,
      deckPolicy,
      session,
      timers,
      endedAt: new Date(runningMs).toISOString(),
      importedFromCsv: true,
    };
  }

  const orderedRows = [...rows].sort((a, b) => {
    const cardDiff = (asNumber(a.card_position) ?? 0) - (asNumber(b.card_position) ?? 0);
    if (cardDiff !== 0) return cardDiff;
    return String(a.participant_name).localeCompare(String(b.participant_name));
  });

  const category = orderedRows[0].category || "Colors";
  const colors = buildColorsForCategory(category, orderedRows);

  const participantNames = Array.from(
    new Set(orderedRows.map(row => row.participant_name).filter(Boolean))
  );
  const participants = participantNames.map((name, index) => {
    const row = orderedRows.find(item => item.participant_name === name);
    return {
      id: index,
      name,
      active: row ? asBool(row.participant_active) : true,
    };
  });

  const participantIdByName = Object.fromEntries(participants.map(p => [p.name, p.id]));
  const slotByIndex = new Map();
  const maxDurationBySlot = new Map();

  orderedRows.forEach((row) => {
    const slotIndex = Math.max(0, (asNumber(row.card_position) ?? 1) - 1);
    if (!slotByIndex.has(slotIndex)) {
      const fallback = colors.find(item => item.name === row.target);
      slotByIndex.set(slotIndex, fallback ?? { name: row.target, symbol: row.target?.[0] ?? "?", hex: "#8080a0" });
    }
    const durationMs = secondsToMs(row.card_total_time_s);
    if (durationMs != null) {
      maxDurationBySlot.set(slotIndex, Math.max(durationMs, maxDurationBySlot.get(slotIndex) ?? 0));
    }
  });

  const slots = [...slotByIndex.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, slot]) => slot);

  let runningMs = Date.now();
  const timers = slots.map((_, slotIndex) => {
    const durationMs = maxDurationBySlot.get(slotIndex) ?? 0;
    const startMs = runningMs;
    const endMs = durationMs > 0 ? startMs + durationMs : startMs;
    runningMs = endMs;
    return { startMs, endMs };
  });

  const session = {};
  orderedRows.forEach((row) => {
    const pid = participantIdByName[row.participant_name];
    const slotIndex = Math.max(0, (asNumber(row.card_position) ?? 1) - 1);
    const slotStartMs = timers[slotIndex]?.startMs ?? Date.now();
    const timeToFirst = secondsToMs(row.time_to_first_s);
    const deltas = splitPipe(row.time_per_guess_s)
      .map(secondsToMs)
      .filter(value => value != null);

    let currentTs = slotStartMs;
    const guesses = splitPipe(row.guesses).map((guess, guessIndex) => {
      if (guessIndex === 0 && timeToFirst != null) {
        currentTs += timeToFirst;
      } else if (guessIndex > 0) {
        currentTs += deltas[guessIndex - 1] ?? 0;
      }
      return { color: guess, ts: currentTs };
    });

    session[pid] = {
      ...(session[pid] ?? {}),
      [slotIndex]: {
        guesses,
        dnf: asBool(row.skipped),
        slotStart: slotStartMs,
      },
    };
  });

  return {
    appMode: orderedRows[0].app_mode || "group",
    shareCode: orderedRows[0].share_code || null,
    sessionId: orderedRows[0].session_id || "",
    startedAt: orderedRows[0].started_at || null,
    participants,
    slots,
    colors,
    category,
    session,
    timers,
    endedAt: orderedRows[0].ended_at || new Date(runningMs).toISOString(),
    importedFromCsv: true,
  };
}
