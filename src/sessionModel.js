export const GUESS_POLICIES = {
  REPEAT_UNTIL_CORRECT: "repeatUntilCorrect",
  ONE_SHOT: "oneShot",
};

export const DECK_POLICIES = {
  INDEPENDENT: "independent",
  BALANCED: "balanced",
};

export const GUESS_POLICY_OPTIONS = [
  {
    value: GUESS_POLICIES.REPEAT_UNTIL_CORRECT,
    label: "Repeat Until Correct",
    description: "Allow repeated guesses on the same card until the target is found.",
  },
  {
    value: GUESS_POLICIES.ONE_SHOT,
    label: "One Shot",
    description: "Allow exactly one guess per card, then reveal the result and advance.",
  },
];

export const DECK_POLICY_OPTIONS = [
  {
    value: DECK_POLICIES.INDEPENDENT,
    label: "Independent",
    description: "Sample each card target independently from the active option set.",
  },
  {
    value: DECK_POLICIES.BALANCED,
    label: "Balanced",
    description: "Prebuild a deck with evenly distributed targets, then shuffle it.",
  },
];

export function getCategoryOptionValues(activeOptions) {
  if (!Array.isArray(activeOptions)) {
    return [];
  }

  return activeOptions
    .map((option) => option?.name)
    .filter((name) => typeof name === "string" && name.length > 0);
}

export function getOptionCount(activeOptions) {
  return getCategoryOptionValues(activeOptions).length;
}

export function buildSessionMetadata({
  category,
  activeOptions,
  guessPolicy,
  deckPolicy,
  trialCount,
}) {
  const optionValues = getCategoryOptionValues(activeOptions);

  return {
    category,
    optionValues,
    optionCount: optionValues.length,
    guessPolicy,
    deckPolicy,
    trialCount,
  };
}

// Canonical analytics model for future implementation.
//
// Session shape:
// {
//   category: string,
//   optionValues: string[],
//   optionCount: number,
//   guessPolicy: "repeatUntilCorrect" | "oneShot",
//   deckPolicy: "independent" | "balanced",
//   trialCount: number,
//   trials: TrialRecord[],
//   analytics: SessionAnalytics,
// }
//
// TrialRecord shape:
// {
//   cardIndex: number,
//   category: string,
//   optionCount: number,
//   targetValue: string,
//   guesses: string[],
//   firstGuess: string | null,
//   firstGuessCorrect: boolean,
//   correctGuessIndex: number | null,
//   guessCount: number,
//   guessPolicy: "repeatUntilCorrect" | "oneShot",
//   deckPolicy: "independent" | "balanced",
//   timeToFirstMs: number | null,
//   guessIntervalsMs: number[],
//   trialDurationMs: number | null,
// }
//
// SessionAnalytics shape:
// {
//   firstGuessAccuracy: number,
//   zScore: number | null,
//   averageGuessPosition: number | null,
//   guessPositionStdDev: number | null,
//   weightedScore: number | null,
//   perOptionStats: Array<{
//     targetValue: string,
//     appearances: number,
//     firstGuessHits: number,
//     firstGuessAccuracy: number,
//     averageGuessPosition: number | null,
//   }>,
// }
