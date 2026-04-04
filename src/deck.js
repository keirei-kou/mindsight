import { DECK_POLICIES } from './sessionModel.js';
import { cryptoRandomInt } from './utils.js';

function buildBalancedDeck(activeOptions, trialCount) {
  if (!Array.isArray(activeOptions) || activeOptions.length === 0 || trialCount <= 0) {
    return [];
  }

  // Repeat the full active option set until the pool is large enough, then
  // shuffle and trim. This keeps exposure as even as possible when the trial
  // count is not perfectly divisible by the number of available options.
  const repeatedSetCount = Math.ceil(trialCount / activeOptions.length);
  const optionPool = Array.from({ length: repeatedSetCount }, () => [...activeOptions]).flat();

  for (let index = optionPool.length - 1; index > 0; index -= 1) {
    const swapIndex = cryptoRandomInt(index + 1);
    [optionPool[index], optionPool[swapIndex]] = [optionPool[swapIndex], optionPool[index]];
  }

  return optionPool.slice(0, trialCount);
}

function buildIndependentDrawDeck(activeOptions, trialCount) {
  if (!Array.isArray(activeOptions) || activeOptions.length === 0 || trialCount <= 0) {
    return [];
  }

  return Array.from({ length: trialCount }, () => {
    const optionIndex = cryptoRandomInt(activeOptions.length);
    return activeOptions[optionIndex];
  });
}

function hashSeed(value) {
  const input = String(value || "");
  let hash = 2166136261;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function createSeededRandom(seedInput) {
  let seed = hashSeed(seedInput) || 1;

  return () => {
    seed = (seed + 0x6D2B79F5) >>> 0;
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function buildBalancedDeckWithRandom(activeOptions, trialCount, random) {
  if (!Array.isArray(activeOptions) || activeOptions.length === 0 || trialCount <= 0) {
    return [];
  }

  const repeatedSetCount = Math.ceil(trialCount / activeOptions.length);
  const optionPool = Array.from({ length: repeatedSetCount }, () => [...activeOptions]).flat();

  for (let index = optionPool.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [optionPool[index], optionPool[swapIndex]] = [optionPool[swapIndex], optionPool[index]];
  }

  return optionPool.slice(0, trialCount);
}

function buildIndependentDrawDeckWithRandom(activeOptions, trialCount, random) {
  if (!Array.isArray(activeOptions) || activeOptions.length === 0 || trialCount <= 0) {
    return [];
  }

  return Array.from({ length: trialCount }, () => {
    const optionIndex = Math.floor(random() * activeOptions.length);
    return activeOptions[optionIndex];
  });
}

export function buildSessionDeck(activeOptions, trialCount, deckPolicy) {
  if (deckPolicy === DECK_POLICIES.BALANCED_DECK) {
    return buildBalancedDeck(activeOptions, trialCount);
  }

  return buildIndependentDrawDeck(activeOptions, trialCount);
}

export function buildSharedSessionDeck(activeOptions, trialCount, deckPolicy, shareCode) {
  const random = createSeededRandom(`${shareCode}|${deckPolicy}|${trialCount}|${activeOptions.map((option) => option.name).join("|")}`);

  if (deckPolicy === DECK_POLICIES.BALANCED_DECK) {
    return buildBalancedDeckWithRandom(activeOptions, trialCount, random);
  }

  return buildIndependentDrawDeckWithRandom(activeOptions, trialCount, random);
}
