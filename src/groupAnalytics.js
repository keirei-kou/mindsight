import { buildSessionAnalytics, buildTrialRecord } from './analytics.js';
import { GUESS_POLICIES } from './sessionModel.js';
import { buildSessionMetadata } from './sessionModel.js';

function getParticipantCell(session, participantId, slotIndex) {
  return session?.[participantId]?.[slotIndex] ?? { guesses: [], dnf: false };
}

function getTrialDurationMs(guesses, slotTimer) {
  const slotStartMs = slotTimer?.startMs ?? null;
  const lastGuessTs = guesses.length > 0 ? guesses[guesses.length - 1].ts : null;
  const slotEndMs = slotTimer?.endMs ?? null;
  const fallbackEndMs = lastGuessTs ?? slotEndMs ?? slotStartMs;

  if (!Number.isFinite(slotStartMs) || !Number.isFinite(fallbackEndMs)) {
    return null;
  }

  return fallbackEndMs - slotStartMs;
}

export function buildGroupParticipantTrials({
  participantId,
  session,
  slots,
  activeOptions,
  category,
  guessPolicy,
  deckPolicy,
  timers,
}) {
  return slots.map((slot, index) => {
    const cell = getParticipantCell(session, participantId, index);
    const guesses = Array.isArray(cell.guesses) ? cell.guesses : [];
    const guessNames = guesses.map((guess) => guess.color).filter(Boolean);
    const slotTimer = timers?.[index] ?? null;
    const slotStartMs = slotTimer?.startMs ?? null;
    const firstGuessTs = guesses[0]?.ts ?? null;
    const guessIntervalsMs = guesses.slice(1).map((guess, guessIndex) => {
      return guess.ts - guesses[guessIndex].ts;
    });

    return buildTrialRecord({
      cardIndex: index + 1,
      category,
      optionCount: activeOptions.length,
      targetValue: slot.name,
      guesses: guessNames,
      guessPolicy,
      deckPolicy,
      timeToFirstMs: Number.isFinite(slotStartMs) && Number.isFinite(firstGuessTs) ? firstGuessTs - slotStartMs : null,
      guessIntervalsMs,
      trialDurationMs: getTrialDurationMs(guesses, slotTimer),
    });
  });
}

export function buildGroupParticipantSummary({
  participant,
  session,
  slots,
  activeOptions,
  category,
  guessPolicy,
  deckPolicy,
  timers,
}) {
  const trials = buildGroupParticipantTrials({
    participantId: participant.id,
    session,
    slots,
    activeOptions,
    category,
    guessPolicy,
    deckPolicy,
    timers,
  });

  const metadata = buildSessionMetadata({
    category,
    activeOptions,
    guessPolicy,
    deckPolicy,
    trialCount: trials.length,
  });

  const analytics = buildSessionAnalytics({
    trials,
    optionValues: metadata.optionValues,
    optionCount: metadata.optionCount,
    guessPolicy,
  });

  const completedTrials = trials.filter((trial) => trial.guessCount > 0);
  const skippedCount = slots.filter((_, index) => getParticipantCell(session, participant.id, index).dnf).length;
  const averageTimeMs = (() => {
    const timedTrials = trials
      .map((trial) => trial.trialDurationMs)
      .filter((value) => Number.isFinite(value));

    if (timedTrials.length === 0) {
      return null;
    }

    return timedTrials.reduce((sum, value) => sum + value, 0) / timedTrials.length;
  })();

  return {
    participant,
    trials,
    analytics,
    completedCount: completedTrials.length,
    skippedCount,
    averageTimeMs,
  };
}

export function buildGroupRollupSummary(participantSummaries, guessPolicy) {
  const summaries = Array.isArray(participantSummaries) ? participantSummaries : [];
  const analyticsList = summaries.map((summary) => summary.analytics).filter(Boolean);
  const timedSummaries = summaries.map((summary) => summary.averageTimeMs).filter((value) => Number.isFinite(value));

  const getAverageMetric = (metricName) => {
    const values = analyticsList
      .map((analytics) => analytics?.[metricName])
      .filter((value) => Number.isFinite(value));

    if (values.length === 0) {
      return null;
    }

    return values.reduce((sum, value) => sum + value, 0) / values.length;
  };

  return {
    participantCount: summaries.length,
    firstGuessAccuracy: getAverageMetric('firstGuessAccuracy'),
    zScore: getAverageMetric('zScore'),
    averageGuessPosition: guessPolicy === GUESS_POLICIES.ONE_SHOT ? null : getAverageMetric('averageGuessPosition'),
    weightedScore: guessPolicy === GUESS_POLICIES.ONE_SHOT ? null : getAverageMetric('weightedScore'),
    averageTimeMs: timedSummaries.length > 0 ? timedSummaries.reduce((sum, value) => sum + value, 0) / timedSummaries.length : null,
  };
}
