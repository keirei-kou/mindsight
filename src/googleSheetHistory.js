import { CATEGORIES } from "./constants.js";
import { buildSessionAnalytics, buildTrialRecord } from "./analytics.js";
import { accuracyScore, patternLabel, proximityScore } from "./utils.js";
import { getTimeOfDayTag } from "./timeOfDay.js";
import { normalizeSoloRow } from "./schemaRegistry.js";

function asNumber(value) {
  if (value === "" || value == null) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asBool(value) {
  return String(value).toLowerCase() === "true";
}

function splitPipe(value) {
  return String(value || "")
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);
}

function normalizeHistoryRow(row) {
  return normalizeSoloRow(row);
}

function getTrialDurationMsFromRow(row) {
  const direct = asNumber(row["timing.trial_duration_ms"]);
  if (direct != null) {
    return direct;
  }

  const timeToFirst = asNumber(row["timing.time_to_first_ms"]) ?? 0;
  const intervals = splitPipe(row["timing.response_intervals_ms"]).map(asNumber).filter((value) => value != null);
  const sum = intervals.reduce((acc, value) => acc + value, 0);
  const duration = timeToFirst + sum;
  return duration > 0 ? duration : 0;
}

function buildColorsForCategory(category, optionValues) {
  const categoryItems = CATEGORIES[category]?.items ?? [];
  if (!categoryItems.length) {
    return [];
  }

  if (!Array.isArray(optionValues) || optionValues.length === 0) {
    return categoryItems;
  }

  const allowedOptionValues = new Set(optionValues);
  return categoryItems.filter((item) => allowedOptionValues.has(item.name));
}

function buildSessionFromTrialRows(sessionRows) {
  const normalizedRows = sessionRows.map(normalizeHistoryRow);
  const firstRow = normalizedRows[0];
  const category = firstRow["protocol.target_type"] || "Colors";
  const optionValues = splitPipe(firstRow["protocol.options"]);
  const colors = buildColorsForCategory(category, optionValues);
  const optionCount = asNumber(firstRow["protocol.option_count"]) ?? (optionValues.length || colors.length);
  const guessPolicy = firstRow["protocol.response_mode"] || "";
  const deckPolicy = firstRow["protocol.deck_policy"] || "";
  const runId = firstRow["run.id"] || null;
  const orderedRows = [...normalizedRows].sort((a, b) => (asNumber(a["trial.index"]) ?? 0) - (asNumber(b["trial.index"]) ?? 0));
  const sessionStartMs = Date.parse(firstRow["session.started_at"] || "");
  let cumulativeMs = 0;

  const trials = orderedRows.map((row) => {
    const exactStartedAt = row["timing.trial_started_at"] || null;
    const exactEndedAt = row["timing.trial_ended_at"] || null;
    const estimatedStartedAtFromRow = row["timing.trial_started_at_estimated"] || null;
    const estimatedEndedAtFromRow = row["timing.trial_ended_at_estimated"] || null;
    const durationMs = getTrialDurationMsFromRow(row);

    const shouldEstimate = !exactStartedAt && !estimatedStartedAtFromRow && Number.isFinite(sessionStartMs);
    const estimatedStart = shouldEstimate ? new Date(sessionStartMs + cumulativeMs) : null;
    const estimatedEnd = shouldEstimate ? new Date(sessionStartMs + cumulativeMs + durationMs) : null;
    if (shouldEstimate) {
      cumulativeMs += durationMs;
    }

    const timeOfDayIsEstimated = asBool(row["context.time_of_day_is_estimated"]);
    const computedIsEstimated = exactStartedAt
      ? false
      : (shouldEstimate || Boolean(estimatedStartedAtFromRow) ? true : null);
    const hasIsEstimatedValue = row["context.time_of_day_is_estimated"] != null && row["context.time_of_day_is_estimated"] !== "";
    const resolvedIsEstimated = hasIsEstimatedValue ? timeOfDayIsEstimated : computedIsEstimated;
    const timeOfDayDate = exactStartedAt
      ? new Date(exactStartedAt)
      : (estimatedStartedAtFromRow ? new Date(estimatedStartedAtFromRow) : estimatedStart);
    const timeOfDayTag = row["context.time_of_day"] || getTimeOfDayTag(timeOfDayDate);

    return buildTrialRecord({
      cardIndex: asNumber(row["trial.index"]) ?? 0,
      category,
      optionCount,
      targetValue: row["target.value"],
      guesses: splitPipe(row["response.sequence"]),
      guessPolicy,
      deckPolicy,
      timeToFirstMs: asNumber(row["timing.time_to_first_ms"]),
      guessIntervalsMs: splitPipe(row["timing.response_intervals_ms"]).map(asNumber).filter((value) => value != null),
      trialDurationMs: durationMs,
      trialStartedAt: exactStartedAt,
      trialEndedAt: exactEndedAt,
      trialStartedAtEstimated: estimatedStartedAtFromRow || (estimatedStart ? estimatedStart.toISOString() : null),
      trialEndedAtEstimated: estimatedEndedAtFromRow || (estimatedEnd ? estimatedEnd.toISOString() : null),
      timeOfDayTag,
      timeOfDayIsEstimated: resolvedIsEstimated,
      notes: row["notes.trial"] || "",
      trainingOverlayOpens: asNumber(row["context.training_overlay_opens"]),
      trainingOverlayMs: asNumber(row["context.training_overlay_ms"]),
    });
  });

  const analytics = buildSessionAnalytics({
    trials,
    optionValues: optionValues.length ? optionValues : colors.map((item) => item.name),
    optionCount,
    guessPolicy,
  });

  const results = trials.map((trial, index) => ({
    target: trial.targetValue,
    guesses: trial.guesses,
    acc: Number.isFinite(trial.correctGuessIndex) ? accuracyScore(trial.correctGuessIndex) : 0,
    prox: category === "Colors" && trial.firstGuess ? proximityScore(trial.firstGuess, trial.targetValue) : null,
    pattern: category === "Colors" && trial.guesses.length > 0 ? patternLabel(trial.guesses, trial.targetValue) : null,
    skipped: asBool(orderedRows[index]?.["trial.skipped"]),
    timeToFirst: trial.timeToFirstMs,
    guessDeltas: trial.guessIntervalsMs,
    notes: trial.notes || "",
    trainingOverlayOpens: trial.trainingOverlayOpens ?? null,
    trainingOverlayMs: trial.trainingOverlayMs ?? null,
  }));

  return {
    appMode: firstRow["session.mode"] || "solo",
    shareCode: firstRow["session.share_code"] || null,
    sessionId: firstRow["session.id"] || "",
    runId,
    startedAt: firstRow["session.started_at"] || null,
    endedAt: firstRow["session.ended_at"] || null,
    name: firstRow["participant.name"] || "Imported Session",
    category,
    colors,
    results,
    guessPolicy,
    deckPolicy,
    optionValues: optionValues.length ? optionValues : colors.map((item) => item.name),
    optionCount,
    trials,
    analytics,
    importedFromGoogleSheets: true,
  };
}

export function buildLatestSoloSessionFromGoogleSheetRows(rows) {
  const sessions = buildSoloHistoryFromGoogleSheetRows(rows);
  return sessions.length > 0 ? sessions[sessions.length - 1] : null;
}

export function buildSoloHistoryFromGoogleSheetRows(rows, participantName) {
  const normalizedRows = Array.isArray(rows) ? rows.map(normalizeHistoryRow) : [];
  const filteredRows = normalizedRows.filter((row) => {
    if (!row?.["session.id"] || !row?.["participant.name"]) {
      return false;
    }

    if (!participantName) {
      return true;
    }

    return row["participant.name"] === participantName;
  });

  const sessionRowsById = new Map();

  filteredRows.forEach((row) => {
    const sessionId = `${row["participant.name"]}::${row["session.id"]}`;
    if (!sessionRowsById.has(sessionId)) {
      sessionRowsById.set(sessionId, []);
    }

    sessionRowsById.get(sessionId).push(row);
  });

  return [...sessionRowsById.values()]
    .map((sessionRows) => buildSessionFromTrialRows(sessionRows))
    .sort((left, right) => {
      const leftTime = Date.parse(left.endedAt || left.startedAt || "") || 0;
      const rightTime = Date.parse(right.endedAt || right.startedAt || "") || 0;
      return leftTime - rightTime;
    });
}
