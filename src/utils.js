import { HUE_ORDER, WARM } from './constants.js';

export function itemMap(items) {
  return Object.fromEntries(items.map(c => [c.name, c]));
}

export function hueDistance(a, b) {
  const ai = HUE_ORDER.indexOf(a), bi = HUE_ORDER.indexOf(b);
  const n = HUE_ORDER.length;
  const d = Math.abs(ai - bi);
  return Math.min(d, n - d);
}

export function proximityScore(firstGuess, target) {
  const d = hueDistance(firstGuess, target);
  return Math.round((1 - d / 3) * 100);
}

export function accuracyScore(attempts) {
  return attempts > 0 ? Math.round((1 / attempts) * 100) : 0;
}

export function patternLabel(guesses, target) {
  if (!guesses.length) return null;
  const firstDist = hueDistance(guesses[0], target);
  if (firstDist === 0) return "Exact";
  const inFamily = WARM.has(target) === WARM.has(guesses[0]);
  if (guesses.length === 1) return firstDist === 1 ? "Adjacent" : inFamily ? "Warm/Cool" : "Off-family";
  let converging = true;
  for (let i = 1; i < guesses.length; i++) {
    if (hueDistance(guesses[i], target) >= hueDistance(guesses[i-1], target)) { converging = false; break; }
  }
  if (converging) return inFamily ? "Converging +" : "Converging";
  return inFamily ? "Warm/Cool" : "Random";
}

export function fmt(ms) {
  if (ms == null) return "—";
  return (ms / 1000).toFixed(1) + "s";
}

export function cryptoRandom() {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return arr[0] / (0xFFFFFFFF + 1);
}

// Crypto-secure integer in [0, maxExclusive) with rejection sampling (avoids modulo bias).
export function cryptoRandomInt(maxExclusive) {
  if (maxExclusive <= 0) return 0;
  // Support non-browser environments defensively.
  if (typeof crypto === "undefined" || !crypto.getRandomValues) {
    return Math.floor(Math.random() * maxExclusive);
  }

  const maxUint32 = 0xffffffff;
  const limit = maxUint32 - ((maxUint32 + 1) % maxExclusive);

  while (true) {
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    const v = arr[0];
    if (v < limit) return v % maxExclusive;
  }
}

export function cryptoShuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = cryptoRandomInt(i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
