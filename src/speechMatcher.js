const ALIASES = {
  Red: ["red", "bread", "read", "fred", "rad", "redd"],
  Orange: ["orange", "orrange", "oranj", "french", "origin"],
  Yellow: ["yellow", "yello", "hello", "mellow"],
  Green: ["green", "greene", "grin", "grinn"],
  Blue: ["blue", "blew", "blu", "glue"],
  Purple: ["purple", "purpal", "purp", "people"],
  One: ["one", "won", "wun", "juan"],
  Two: ["two", "too", "to", "tu", "do"],
  Three: ["three", "free", "tree", "threee"],
  Four: ["four", "for", "fore", "or"],
  Five: ["five", "fife", "hive"],
  Six: ["six", "styx", "sticks", "dicks", "sicks", "sex", "sic"],
  Circle: ["circle", "circles", "serkle"],
  Oval: ["oval", "ovel", "over"],
  Square: ["square", "squaree", "scare"],
  Rectangle: ["rectangle", "rectangular", "wreck tangle", "rect angle"],
  Triangle: ["triangle", "try angle", "tri angle"],
  Diamond: ["diamond", "diamon", "diamondd"],
  Star: ["star", "starr"],
  Wavy: ["wavy", "wavey", "wavyy"],
  Cross: ["cross", "criss", "crisscross"],
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

function isStrongExactCandidate(candidate, canonical) {
  return candidate === canonical || candidate.length >= 3;
}

export function matchTranscriptToItems(transcript, items) {
  const raw = normalize(transcript);
  if (!raw) return { raw, match: null, score: 0 };

  const candidates = buildCandidates(raw);
  const exactMatches = new Set();
  let best = { raw, match: null, score: 0 };

  for (const item of items) {
    const canonical = normalize(item.name);
    const aliases = [canonical, ...(ALIASES[item.name] ?? [])].map(normalize);

    for (const candidate of candidates) {
      if (aliases.includes(candidate)) {
        if (isStrongExactCandidate(candidate, canonical)) {
          exactMatches.add(item.name);
        }
        if (exactMatches.size > 1) {
          return { raw, match: null, score: 0, ambiguous: true };
        }
        if (candidate === canonical) {
          return { raw, match: item.name, score: 1 };
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

  return best;
}
