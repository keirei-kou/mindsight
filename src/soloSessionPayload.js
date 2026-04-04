import { buildSessionAnalytics, buildTrialRecord } from './analytics.js';
import { buildSessionMetadata } from './sessionModel.js';

export function buildSoloSessionPayload({
  appMode,
  shareCode,
  sessionId,
  startedAt,
  endedAt,
  name,
  category,
  activeOptions,
  guessPolicy,
  deckPolicy,
  completedResults,
}) {
  const sessionMetadata = buildSessionMetadata({
    appMode,
    shareCode,
    sessionId,
    startedAt,
    endedAt,
    category,
    activeOptions,
    guessPolicy,
    deckPolicy,
    trialCount: completedResults.length,
  });

  const trials = completedResults.map((result, index) => {
    const trialDurationMs = [result.timeToFirst, ...(result.guessDeltas || [])]
      .filter((value) => value != null)
      .reduce((sum, value) => sum + value, 0);

    return buildTrialRecord({
      cardIndex: index + 1,
      category,
      optionCount: sessionMetadata.optionCount,
      targetValue: result.target,
      guesses: result.guesses,
      guessPolicy,
      deckPolicy,
      timeToFirstMs: result.timeToFirst ?? null,
      guessIntervalsMs: result.guessDeltas ?? [],
      trialDurationMs: trialDurationMs || null,
    });
  });

  return {
    name,
    results: completedResults,
    colors: activeOptions,
    category,
    appMode: sessionMetadata.appMode,
    shareCode: sessionMetadata.shareCode,
    sessionId: sessionMetadata.sessionId,
    startedAt: sessionMetadata.startedAt,
    endedAt: sessionMetadata.endedAt,
    guessPolicy,
    deckPolicy,
    optionValues: sessionMetadata.optionValues,
    optionCount: sessionMetadata.optionCount,
    trials,
    analytics: buildSessionAnalytics({
      trials,
      optionValues: sessionMetadata.optionValues,
      optionCount: sessionMetadata.optionCount,
      guessPolicy,
    }),
  };
}
