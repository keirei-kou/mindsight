import { GUESS_POLICIES } from './sessionModel.js';

function getOrdinalSuffix(value) {
  const absoluteValue = Math.abs(Number(value));
  const lastTwoDigits = absoluteValue % 100;

  if (lastTwoDigits >= 11 && lastTwoDigits <= 13) {
    return "th";
  }

  switch (absoluteValue % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
}

export function formatGuessPositionLabel(correctGuessIndex) {
  if (!Number.isFinite(correctGuessIndex) || correctGuessIndex <= 0) {
    return null;
  }

  return `Pos ${correctGuessIndex}${getOrdinalSuffix(correctGuessIndex)} guess`;
}

function clampRatio(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  if (value < 0) {
    return 0;
  }

  if (value > 1) {
    return 1;
  }

  return value;
}

function roundTo(value, digits = 4) {
  if (!Number.isFinite(value)) {
    return null;
  }

  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function getFirstGuessChanceBaseline(optionCount) {
  if (!Number.isFinite(optionCount) || optionCount <= 0) {
    return 0;
  }

  return 1 / optionCount;
}

function getSequentialGuessBaseline(optionCount) {
  if (!Number.isFinite(optionCount) || optionCount <= 0) {
    return null;
  }

  return (optionCount + 1) / 2;
}

function getFirstGuessAccuracy(trials) {
  if (!Array.isArray(trials) || trials.length === 0) {
    return 0;
  }

  const hitCount = trials.filter((trial) => trial.firstGuessCorrect).length;
  return clampRatio(hitCount / trials.length);
}

function getZScore(trials, optionCount) {
  if (!Array.isArray(trials) || trials.length === 0) {
    return null;
  }

  const p0 = getFirstGuessChanceBaseline(optionCount);
  if (p0 <= 0 || p0 >= 1) {
    return null;
  }

  const pHat = getFirstGuessAccuracy(trials);
  const standardError = Math.sqrt((p0 * (1 - p0)) / trials.length);

  if (standardError === 0) {
    return null;
  }

  return (pHat - p0) / standardError;
}

function getCorrectGuessIndexes(trials) {
  if (!Array.isArray(trials)) {
    return [];
  }

  return trials
    .map((trial) => trial.correctGuessIndex)
    .filter((value) => Number.isFinite(value) && value > 0);
}

function getAverage(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return null;
  }

  const total = values.reduce((sum, value) => sum + value, 0);
  return total / values.length;
}

function getStandardDeviation(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return null;
  }

  const average = getAverage(values);
  if (average == null) {
    return null;
  }

  const variance = values.reduce((sum, value) => {
    const distance = value - average;
    return sum + distance * distance;
  }, 0) / values.length;

  return Math.sqrt(variance);
}

function getWeightedScorePerTrial(correctGuessIndex, optionCount) {
  if (!Number.isFinite(correctGuessIndex) || correctGuessIndex <= 0) {
    return null;
  }

  if (!Number.isFinite(optionCount) || optionCount <= 0) {
    return null;
  }

  return (optionCount + 1 - correctGuessIndex) / optionCount;
}

function getTrialDisplayScore(trial, guessPolicy) {
  if (!trial) {
    return null;
  }

  if (guessPolicy === GUESS_POLICIES.ONE_SHOT) {
    return trial.firstGuessCorrect ? 1 : 0;
  }

  return getWeightedScorePerTrial(trial.correctGuessIndex, trial.optionCount);
}

function getWeightedScore(trials, optionCount, guessPolicy) {
  if (guessPolicy === GUESS_POLICIES.ONE_SHOT) {
    return null;
  }

  const perTrialScores = trials
    .map((trial) => getWeightedScorePerTrial(trial.correctGuessIndex, optionCount))
    .filter((value) => value != null);

  return getAverage(perTrialScores);
}

function buildPerOptionStats(optionValues, trials) {
  if (!Array.isArray(optionValues)) {
    return [];
  }

  return optionValues.map((targetValue) => {
    const matchingTrials = trials.filter((trial) => trial.targetValue === targetValue);
    const firstGuessHits = matchingTrials.filter((trial) => trial.firstGuessCorrect).length;
    const correctGuessIndexes = matchingTrials
      .map((trial) => trial.correctGuessIndex)
      .filter((value) => Number.isFinite(value) && value > 0);

    return {
      targetValue,
      appearances: matchingTrials.length,
      firstGuessHits,
      firstGuessAccuracy: matchingTrials.length > 0 ? firstGuessHits / matchingTrials.length : 0,
      averageGuessPosition: getAverage(correctGuessIndexes),
    };
  });
}

export function buildTrialRecord({
  cardIndex,
  category,
  optionCount,
  targetValue,
  guesses,
  guessPolicy,
  deckPolicy,
  timeToFirstMs = null,
  guessIntervalsMs = [],
  trialDurationMs = null,
}) {
  const orderedGuesses = Array.isArray(guesses) ? guesses.filter(Boolean) : [];
  const firstGuess = orderedGuesses[0] ?? null;
  const correctGuessIndex = orderedGuesses.findIndex((guess) => guess === targetValue);
  const resolvedCorrectGuessIndex = correctGuessIndex >= 0 ? correctGuessIndex + 1 : null;

  return {
    cardIndex,
    category,
    optionCount,
    targetValue,
    guesses: orderedGuesses,
    firstGuess,
    firstGuessCorrect: firstGuess === targetValue,
    correctGuessIndex: resolvedCorrectGuessIndex,
    guessCount: orderedGuesses.length,
    guessPolicy,
    deckPolicy,
    timeToFirstMs,
    guessIntervalsMs: Array.isArray(guessIntervalsMs) ? guessIntervalsMs.filter((value) => Number.isFinite(value)) : [],
    trialDurationMs,
  };
}

export function buildSessionAnalytics({
  trials,
  optionValues,
  optionCount,
  guessPolicy,
}) {
  const normalizedTrials = Array.isArray(trials) ? trials : [];
  const correctGuessIndexes = getCorrectGuessIndexes(normalizedTrials);
  const firstGuessAccuracy = getFirstGuessAccuracy(normalizedTrials);
  const firstGuessChanceBaseline = getFirstGuessChanceBaseline(optionCount);
  const averageGuessPositionBaseline = getSequentialGuessBaseline(optionCount);

  return {
    trialCount: normalizedTrials.length,
    firstGuessAccuracy: roundTo(firstGuessAccuracy),
    firstGuessChanceBaseline: roundTo(firstGuessChanceBaseline),
    zScore: roundTo(getZScore(normalizedTrials, optionCount)),
    averageGuessPosition: roundTo(getAverage(correctGuessIndexes)),
    averageGuessPositionBaseline: roundTo(averageGuessPositionBaseline),
    guessPositionStdDev: roundTo(getStandardDeviation(correctGuessIndexes)),
    weightedScore: roundTo(getWeightedScore(normalizedTrials, optionCount, guessPolicy)),
    perOptionStats: buildPerOptionStats(optionValues, normalizedTrials).map((stat) => ({
      ...stat,
      firstGuessAccuracy: roundTo(stat.firstGuessAccuracy),
      averageGuessPosition: roundTo(stat.averageGuessPosition),
    })),
  };
}

export function buildTrialTimelinePoints(trials, guessPolicy) {
  if (!Array.isArray(trials)) {
    return [];
  }

  let elapsedMs = 0;

  return trials
    .map((trial, index) => {
      const durationMs = Number.isFinite(trial.trialDurationMs) ? trial.trialDurationMs : null;
      if (durationMs != null) {
        elapsedMs += durationMs;
      }

      const score = getTrialDisplayScore(trial, guessPolicy);

      return {
        x: elapsedMs,
        y: score != null ? score * 100 : null,
        card: trial.cardIndex ?? index + 1,
        targetValue: trial.targetValue ?? null,
        firstGuess: trial.firstGuess ?? null,
        firstGuessCorrect: Boolean(trial.firstGuessCorrect),
        correctGuessIndex: trial.correctGuessIndex ?? null,
        guessCount: trial.guessCount ?? 0,
      };
    })
    .filter((point) => point.x > 0 && point.y != null);
}
