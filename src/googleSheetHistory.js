import { CATEGORIES } from "./constants.js";
import { buildSessionAnalytics, buildTrialRecord } from "./analytics.js";
import { accuracyScore, patternLabel, proximityScore } from "./utils.js";

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
  const firstRow = sessionRows[0];
  const category = firstRow.category || "Colors";
  const optionValues = splitPipe(firstRow.option_values);
  const colors = buildColorsForCategory(category, optionValues);
  const optionCount = asNumber(firstRow.option_count) ?? (optionValues.length || colors.length);
  const guessPolicy = firstRow.guess_policy || "";
  const deckPolicy = firstRow.deck_policy || "";
  const runId = firstRow.run_id || null;
  const orderedRows = [...sessionRows].sort((a, b) => (asNumber(a.card_index) ?? 0) - (asNumber(b.card_index) ?? 0));

  const trials = orderedRows.map((row) => buildTrialRecord({
    cardIndex: asNumber(row.card_index) ?? 0,
    category,
    optionCount,
    targetValue: row.target_value,
    guesses: splitPipe(row.guesses),
    guessPolicy,
    deckPolicy,
    timeToFirstMs: asNumber(row.time_to_first_ms),
    guessIntervalsMs: splitPipe(row.guess_intervals_ms).map(asNumber).filter((value) => value != null),
    trialDurationMs: asNumber(row.trial_duration_ms),
  }));

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
    skipped: asBool(orderedRows[index]?.skipped),
    timeToFirst: trial.timeToFirstMs,
    guessDeltas: trial.guessIntervalsMs,
  }));

  return {
    appMode: firstRow.app_mode || "solo",
    shareCode: firstRow.share_code || null,
    sessionId: firstRow.session_id || "",
    runId,
    startedAt: firstRow.started_at || null,
    endedAt: firstRow.ended_at || null,
    name: firstRow.name || "Imported Session",
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
  const filteredRows = Array.isArray(rows)
    ? rows.filter((row) => {
        if (!row?.session_id || !row?.name) {
          return false;
        }

        if (!participantName) {
          return true;
        }

        return row.name === participantName;
      })
    : [];

  const sessionRowsById = new Map();

  filteredRows.forEach((row) => {
    const sessionId = `${row.name}::${row.session_id}`;
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
