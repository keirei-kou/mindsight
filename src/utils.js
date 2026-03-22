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

export function generateSlots(colors, count, mode) {
  if (mode === "stratified") {
    const sets = Math.ceil(count / colors.length);
    const pool = Array.from({ length: sets }, () => [...colors]).flat();
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(cryptoRandom() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, count);
  }
  return Array.from({ length: count }, () => colors[Math.floor(cryptoRandom() * colors.length)]);
}