export const GUESS_POLICIES = {
  REPEAT_UNTIL_CORRECT: "repeatUntilCorrect",
  ONE_SHOT: "oneShot",
};

export const SESSION_MODES = {
  SOLO: "solo",
  SHARED: "shared",
  GROUP: "group",
};

export const DECK_POLICIES = {
  INDEPENDENT_DRAWS: "independentDraws",
  BALANCED_DECK: "balancedDeck",
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
    value: DECK_POLICIES.INDEPENDENT_DRAWS,
    label: "Independent",
    description: "Sample each card target independently from the active option set.",
  },
  {
    value: DECK_POLICIES.BALANCED_DECK,
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

export function createSessionId() {
  if (typeof globalThis !== "undefined" && globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createShareCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const parts = [];

  for (let partIndex = 0; partIndex < 2; partIndex += 1) {
    let part = "";
    for (let charIndex = 0; charIndex < 4; charIndex += 1) {
      const randomIndex = Math.floor(Math.random() * alphabet.length);
      part += alphabet[randomIndex];
    }
    parts.push(part);
  }

  return parts.join("-");
}

export function buildSessionMetadata({
  sessionId = createSessionId(),
  startedAt = null,
  endedAt = null,
  appMode = SESSION_MODES.SOLO,
  shareCode = null,
  category,
  activeOptions,
  guessPolicy,
  deckPolicy,
  trialCount,
}) {
  const optionValues = getCategoryOptionValues(activeOptions);

  return {
    sessionId,
    startedAt,
    endedAt,
    appMode,
    shareCode,
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
//   sessionId: string,
//   startedAt: string | null,
//   endedAt: string | null,
//   appMode: "solo" | "shared" | "group",
//   shareCode: string | null,
//   category: string,
//   optionValues: string[],
//   optionCount: number,
//   guessPolicy: "repeatUntilCorrect" | "oneShot",
//   deckPolicy: "independentDraws" | "balancedDeck",
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
//   deckPolicy: "independentDraws" | "balancedDeck",
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
