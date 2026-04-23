const ALIASES = {
  Red: ["red", "bread", "read", "fred", "rad", "redd"],
  Orange: ["orange", "orrange", "oranj", "french", "origin"],
  Yellow: ["yellow", "yello", "hello", "mellow"],
  Green: ["green", "greene", "grin", "grinn", "queen"],
  Blue: ["blue", "blew", "blu", "glue"],
  Purple: ["purple", "purpal", "purp", "people"],
  One: ["one", "won", "wun", "juan", "1", "11"],
  Two: ["two", "too", "to", "tu", "do", "2", "22"],
  Three: ["three", "free", "tree", "threee", "3", "33"],
  Four: ["four", "for", "fore", "or", "4", "44"],
  Five: ["five", "fife", "hive", "5", "55"],
  Six: ["six", "styx", "sticks", "dicks", "sicks", "sex", "sic", "6", "66"],
  Circle: ["circle", "circles", "serkle"],
  Oval: ["oval", "ovel", "over", "mobile", "moval", "oh val"],
  Square: ["square", "squaree", "scare"],
  Rectangle: ["rectangle", "rectangular", "wreck tangle", "rect angle"],
  Triangle: ["triangle", "try angle", "tri angle"],
  Diamond: ["diamond", "diamon", "diamondd"],
  Star: ["star", "starr"],
  Wavy: ["wavy", "wavey", "wavyy"],
  Cross: ["cross", "criss", "crisscross", "brought", "ross", "crossed", "kross"],
};

export const VOICE_COMMAND_ALIASES = {
  trainingRoom: [
    "training room",
    "training",
    "go to training room",
    "back to training room",
    "return to training room",
  ],
  resumeTest: [
    "resume test",
    "resume",
    "close training",
    "close training room",
    "close hotline",
    "test continue",
    "continue test",
  ],
  beginTest: [
    "test",
    "begin test",
    "start test",
    "test started",
  ],
  results: [
    "results",
    "results go to results",
    "show results",
    "go to results",
  ],
};

function normalize(text) {
  return String(text ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a, b) {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dp = Array.from({ length: rows }, () => Array(cols).fill(0));

  for (let i = 0; i < rows; i++) dp[i][0] = i;
  for (let j = 0; j < cols; j++) dp[0][j] = j;

  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }

  return dp[a.length][b.length];
}

function similarity(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const distance = levenshtein(a, b);
  return 1 - distance / Math.max(a.length, b.length);
}

function buildCandidates(raw) {
  const tokens = raw.split(" ").filter(Boolean);
  const candidates = new Set([raw]);

  if (tokens.length > 0) {
    candidates.add(tokens[tokens.length - 1]);
    candidates.add(tokens[0]);
    candidates.add(tokens.join(" "));
    candidates.add(tokens.filter((token, index) => token !== tokens[index - 1]).join(" "));
  }

  for (let start = 0; start < tokens.length; start++) {
    for (let size = 1; size <= 3 && start + size <= tokens.length; size++) {
      candidates.add(tokens.slice(start, start + size).join(" "));
    }
  }

  return [...candidates].filter(Boolean);
}

function commandAliasAppearsInTranscript(raw, alias) {
  if (!raw || !alias) {
    return false;
  }

  if (raw === alias) {
    return true;
  }

  const rawTokens = raw.split(" ").filter(Boolean);
  const aliasTokens = alias.split(" ").filter(Boolean);

  if (aliasTokens.length === 0 || aliasTokens.length > rawTokens.length) {
    return false;
  }

  for (let start = 0; start <= rawTokens.length - aliasTokens.length; start++) {
    let matches = true;

    for (let offset = 0; offset < aliasTokens.length; offset++) {
      if (rawTokens[start + offset] !== aliasTokens[offset]) {
        matches = false;
        break;
      }
    }

    if (matches) {
      return true;
    }
  }

  return false;
}

function isStrongExactCandidate(candidate, canonical) {
  return candidate === canonical || candidate.length >= 3;
}

function findContainedAliasMatch(candidates, itemName, aliases) {
  for (const candidate of candidates) {
    for (const alias of aliases) {
      if (candidate.length <= alias.length) {
        continue;
      }

      if (candidate.includes(alias)) {
        return {
          raw: candidate,
          match: itemName,
          score: Math.max(0.9, alias.length / candidate.length),
        };
      }
    }
  }

  return null;
}

export function matchTranscriptToItems(transcript, items) {
  const raw = normalize(transcript);
  if (!raw) return { raw, match: null, score: 0 };

  const candidates = buildCandidates(raw);
  const exactMatches = new Set();
  let exactCanonicalMatch = null;
  let best = { raw, match: null, score: 0 };

  for (const item of items) {
    const canonical = normalize(item.name);
    const aliases = [canonical, ...(ALIASES[item.name] ?? [])].map(normalize);
    const containedMatch = findContainedAliasMatch(candidates, item.name, aliases);

    if (containedMatch && containedMatch.score > best.score) {
      best = containedMatch;
    }

    for (const candidate of candidates) {
      if (aliases.includes(candidate)) {
        if (isStrongExactCandidate(candidate, canonical)) {
          exactMatches.add(item.name);
        }
        if (exactMatches.size > 1) {
          return { raw, match: null, score: 0, ambiguous: true };
        }
        if (candidate === canonical) {
          exactCanonicalMatch = item.name;
        }
      }

      for (const alias of aliases) {
        const score = similarity(candidate, alias);
        if (score > best.score) {
          best = { raw, match: item.name, score };
        }
      }
    }
  }

  if (best.score < 0.55) {
    return { raw, match: null, score: best.score };
  }

  if (exactMatches.size > 1) {
    return { raw, match: null, score: 0, ambiguous: true };
  }

  if (exactCanonicalMatch) {
    return { raw, match: exactCanonicalMatch, score: 1 };
  }

  return best;
}

export function matchTranscriptToCommand(transcript) {
  const raw = normalize(transcript);
  if (!raw) {
    return { raw, command: null, score: 0 };
  }

  const candidates = buildCandidates(raw);
  let best = { raw, command: null, score: 0 };

  for (const [command, aliases] of Object.entries(VOICE_COMMAND_ALIASES)) {
    const normalizedAliases = aliases.map(normalize);

    for (const alias of normalizedAliases) {
      if (commandAliasAppearsInTranscript(raw, alias)) {
        return { raw, command, score: 1 };
      }
    }

    for (const candidate of candidates) {
      if (normalizedAliases.includes(candidate)) {
        return { raw, command, score: 1 };
      }

      for (const alias of normalizedAliases) {
        const score = similarity(candidate, alias);
        if (score > best.score) {
          best = { raw, command, score };
        }
      }
    }
  }

  if (best.score < 0.88) {
    return { raw, command: null, score: best.score };
  }

  return best;
}
