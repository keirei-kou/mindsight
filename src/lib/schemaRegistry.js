import { buildSessionAnalytics, buildTrialRecord } from "./sessionAnalytics.js";
import { getTimeOfDayTag } from "./timeOfDay.js";

export const SOLO_SCHEMA_VERSION = "1.0";

export const SCHEMA_IDS = {
  MINDSIGHT_LEGACY_V0: "mindsight_legacy_v0",
  PSILABS_DOT_V1: "psilabs_dot_v1",
};

export const SOLO_SCHEMA_NAMESPACE_DESCRIPTIONS = {
  schema: "Schema identity and migration metadata.",
  session: "Repeated session-level context shared by every trial row.",
  run: "A completed run or block within a broader session.",
  participant: "Participant identity fields.",
  protocol: "Protocol design/configuration fields that describe what kind of experiment produced the row.",
  rng: "Randomness/provenance fields describing how targets were generated or reproduced.",
  trial: "Trial-level identity and status fields.",
  target: "The hidden target or outcome for the trial.",
  response: "Participant response values and response-attempt metadata.",
  score: "Trial-level and session-level scoring/summary metrics.",
  timing: "Trial/session timing, latency, and estimated timing fields.",
  context: "Environmental, input, and UI-context fields useful for filtering.",
  analysis: "Post-hoc inclusion/exclusion fields used for analysis filtering.",
  notes: "Human-entered notes and transcripts.",
  archive: "External archive and synchronization metadata.",
};

export const MINDSIGHT_LEGACY_V0_HEADERS = [
  "session_id",
  "run_id",
  "app_mode",
  "share_code",
  "started_at",
  "ended_at",
  "date",
  "time",
  "name",
  "category",
  "guess_policy",
  "deck_policy",
  "option_count",
  "option_values",
  "trial_count",
  "card_index",
  "target_value",
  "guesses",
  "first_guess",
  "first_guess_correct",
  "correct_guess_index",
  "guess_count",
  "time_to_first_ms",
  "guess_intervals_ms",
  "trial_duration_ms",
  "score_percent",
  "proximity",
  "pattern",
  "skipped",
  "first_guess_accuracy",
  "z_score",
  "average_guess_position",
  "guess_position_std_dev",
  "weighted_score",
  "trial_started_at",
  "trial_ended_at",
  "trial_started_at_estimated",
  "trial_ended_at_estimated",
  "time_of_day_tag",
  "time_of_day_is_estimated",
  "notes",
  "training_overlay_opens",
  "training_overlay_ms",
  "p_value",
];

export const PSILABS_DOT_V1_FIELDS = [
  {
    field: "schema.version",
    aliases: ["schema_version", "schemaVersion"],
    required: false,
    defaultValue: SOLO_SCHEMA_VERSION,
  },
  {
    field: "session.date",
    aliases: ["date"],
    required: false,
    defaultValue: "",
  },
  {
    field: "session.time",
    aliases: ["time"],
    required: false,
    defaultValue: "",
  },
  {
    field: "session.started_at",
    aliases: ["started_at", "startedAt"],
    required: false,
    defaultValue: "",
  },
  {
    field: "session.ended_at",
    aliases: ["ended_at", "endedAt"],
    required: false,
    defaultValue: "",
  },
  {
    field: "session.id",
    aliases: ["session_id", "sessionId"],
    required: true,
    defaultValue: "",
  },
  {
    field: "session.mode",
    aliases: ["app_mode", "appMode"],
    required: false,
    defaultValue: "solo",
  },
  {
    field: "session.share_code",
    aliases: ["share_code", "shareCode"],
    required: false,
    defaultValue: "",
  },
  {
    field: "session.trial_count",
    aliases: ["trial_count", "trialCount"],
    required: false,
    defaultValue: "",
  },
  {
    field: "session.is_test",
    aliases: ["is_test", "session_is_test", "sessionIsTest"],
    required: false,
    defaultValue: "true",
  },
  {
    field: "run.id",
    aliases: ["run_id", "runId"],
    required: false,
    defaultValue: "",
  },
  {
    field: "participant.name",
    aliases: ["name", "participant_name", "participantName"],
    required: true,
    defaultValue: "",
  },
  {
    field: "protocol.phenomenon",
    aliases: ["phenomenon"],
    required: false,
    defaultValue: "mindsight",
  },
  {
    field: "protocol.type",
    aliases: ["protocol_type", "protocolType"],
    required: false,
    defaultValue: "forced_choice_perception",
  },
  {
    field: "protocol.target_type",
    aliases: ["category", "target_type", "targetType"],
    required: true,
    defaultValue: "Colors",
  },
  {
    field: "protocol.response_mode",
    aliases: ["guess_policy", "guessPolicy", "response_mode", "responseMode"],
    required: false,
    defaultValue: "",
  },
  {
    field: "protocol.deck_policy",
    aliases: ["deck_policy", "deckPolicy"],
    required: false,
    defaultValue: "",
  },
  {
    field: "protocol.option_count",
    aliases: ["option_count", "optionCount"],
    required: false,
    defaultValue: "",
  },
  {
    field: "protocol.options",
    aliases: ["option_values", "optionValues", "options"],
    required: false,
    defaultValue: "",
  },
  {
    field: "protocol.label",
    aliases: ["protocol_label", "protocolLabel"],
    required: false,
    defaultValue: "",
  },
  {
    field: "protocol.tags",
    aliases: ["protocol_tags", "protocolTags"],
    required: false,
    defaultValue: "",
  },
  {
    field: "protocol.notes",
    aliases: ["protocol_notes", "protocolNotes"],
    required: false,
    defaultValue: "",
  },
  {
    field: "rng.method",
    aliases: ["rng_method", "rngMethod"],
    required: false,
    defaultValue: "crypto_rng",
  },
  {
    field: "rng.provider",
    aliases: ["rng_provider", "rngProvider"],
    required: false,
    defaultValue: "browser_crypto",
  },
  {
    field: "rng.seed",
    aliases: ["rng_seed", "rngSeed"],
    required: false,
    defaultValue: "",
  },
  {
    field: "rng.source_url",
    aliases: ["rng_source_url", "rngSourceUrl"],
    required: false,
    defaultValue: "",
  },
  {
    field: "rng.device_id",
    aliases: ["rng_device_id", "rngDeviceId"],
    required: false,
    defaultValue: "",
  },
  {
    field: "rng.sample_id",
    aliases: ["rng_sample_id", "rngSampleId"],
    required: false,
    defaultValue: "",
  },
  {
    field: "trial.index",
    aliases: ["card_index", "cardIndex", "trial_index", "trialIndex"],
    required: true,
    defaultValue: "",
  },
  {
    field: "trial.is_skipped",
    aliases: ["skipped", "trial.skipped", "is_skipped"],
    required: false,
    defaultValue: "false",
    description: "Whether this trial was skipped or marked incomplete.",
  },
  {
    field: "target.value",
    aliases: ["target_value", "targetValue", "target"],
    required: true,
    defaultValue: "",
  },
  {
    field: "response.first_value",
    aliases: ["first_guess", "firstGuess", "first_response", "response.first"],
    required: false,
    defaultValue: "",
    description: "First response value submitted for this trial.",
  },
  {
    field: "response.correct_position",
    aliases: ["correct_guess_index", "correctGuessIndex", "correct_position"],
    required: false,
    defaultValue: "",
  },
  {
    field: "response.attempt_count",
    aliases: ["guess_count", "guessCount", "response_count", "response.count"],
    required: false,
    defaultValue: "",
    description: "Number of response attempts submitted for this trial.",
  },
  {
    field: "response.attempt_sequence",
    aliases: ["guesses", "guess_sequence", "response_sequence", "response.sequence"],
    required: false,
    defaultValue: "",
    description: "Pipe-separated ordered response attempts for this trial.",
  },
  {
    field: "score.z",
    aliases: ["z_score", "zScore"],
    required: false,
    defaultValue: "",
  },
  {
    field: "score.p_value",
    aliases: ["p_value", "pValue"],
    required: false,
    defaultValue: "",
  },
  {
    field: "score.hit_rate",
    aliases: ["first_guess_accuracy", "firstGuessAccuracy", "first_response_accuracy", "score.first_response_accuracy", "hit_rate"],
    required: false,
    defaultValue: "",
  },
  {
    field: "score.is_hit",
    aliases: ["first_guess_correct", "firstGuessCorrect", "first_response_correct", "score.first_response_correct", "score.hit", "hit", "is_hit"],
    required: false,
    defaultValue: "",
    description: "Whether the trial's scoring response matched the target. For Mindsight this means the first response was correct.",
  },
  {
    field: "score.weighted_score",
    aliases: ["weighted_score", "weightedScore", "score.weighted"],
    required: false,
    defaultValue: "",
    description: "Session-level weighted score, mainly useful for repeat-until-correct response mode.",
  },
  {
    field: "score.average_response_position",
    aliases: ["average_guess_position", "averageGuessPosition", "average_response_position"],
    required: false,
    defaultValue: "",
  },
  {
    field: "score.response_position_std_dev",
    aliases: ["guess_position_std_dev", "guessPositionStdDev", "response_position_std_dev"],
    required: false,
    defaultValue: "",
  },
  {
    field: "score.chance_baseline",
    aliases: ["chance_baseline", "first_guess_chance_baseline"],
    required: false,
    defaultValue: "",
  },
  {
    field: "score.expected_avg_response_position",
    aliases: ["expected_avg_guess_position", "expected_average_guess_position", "expected_avg_response_position"],
    required: false,
    defaultValue: "",
  },
  {
    field: "score.proximity_score",
    aliases: ["proximity", "score.proximity"],
    required: false,
    defaultValue: "",
    description: "Legacy/color-specific proximity score; unclear for future generic protocols.",
  },
  {
    field: "score.pattern",
    aliases: ["pattern"],
    required: false,
    defaultValue: "",
  },
  {
    field: "score.legacy_percent",
    aliases: ["score_percent", "accuracy"],
    required: false,
    defaultValue: "",
  },
  {
    field: "timing.trial_started_at",
    aliases: ["trial_started_at", "trialStartedAt"],
    required: false,
    defaultValue: "",
  },
  {
    field: "timing.trial_ended_at",
    aliases: ["trial_ended_at", "trialEndedAt"],
    required: false,
    defaultValue: "",
  },
  {
    field: "timing.trial_started_at_estimated",
    aliases: ["trial_started_at_estimated", "trialStartedAtEstimated"],
    required: false,
    defaultValue: "",
  },
  {
    field: "timing.trial_ended_at_estimated",
    aliases: ["trial_ended_at_estimated", "trialEndedAtEstimated"],
    required: false,
    defaultValue: "",
  },
  {
    field: "timing.trial_duration_ms",
    aliases: ["trial_duration_ms", "trialDurationMs"],
    required: false,
    defaultValue: "",
  },
  {
    field: "timing.time_to_first_ms",
    aliases: ["time_to_first_ms", "timeToFirstMs"],
    required: false,
    defaultValue: "",
  },
  {
    field: "timing.response_intervals_ms",
    aliases: ["guess_intervals_ms", "guessIntervalsMs", "response_intervals_ms"],
    required: false,
    defaultValue: "",
  },
  {
    field: "context.time_of_day",
    aliases: ["time_of_day_tag", "timeOfDayTag"],
    required: false,
    defaultValue: "",
  },
  {
    field: "context.time_of_day_is_estimated",
    aliases: ["time_of_day_is_estimated", "timeOfDayIsEstimated"],
    required: false,
    defaultValue: "",
  },
  {
    field: "context.input_method",
    aliases: ["input_method", "inputMethod"],
    required: false,
    defaultValue: "mixed",
  },
  {
    field: "context.training_overlay_opens",
    aliases: ["training_overlay_opens", "trainingOverlayOpens"],
    required: false,
    defaultValue: "",
  },
  {
    field: "context.training_overlay_ms",
    aliases: ["training_overlay_ms", "trainingOverlayMs"],
    required: false,
    defaultValue: "",
  },
  {
    field: "notes.trial",
    aliases: ["notes", "trial_notes", "trialNotes"],
    required: false,
    defaultValue: "",
  },
  {
    field: "notes.voice_text",
    aliases: ["voice_text", "voiceText"],
    required: false,
    defaultValue: "",
  },
  {
    field: "notes.voice_source",
    aliases: ["voice_source", "voiceSource"],
    required: false,
    defaultValue: "",
  },
  {
    field: "analysis.is_excluded",
    aliases: ["excluded", "analysis_excluded", "analysis.excluded", "is_excluded"],
    required: false,
    defaultValue: "false",
    description: "Whether this row should be excluded from analysis views.",
  },
  {
    field: "analysis.exclusion_reason",
    aliases: ["exclusion_reason", "analysis_exclusion_reason"],
    required: false,
    defaultValue: "",
  }
];

export const PSILABS_DOT_V1_HEADERS = PSILABS_DOT_V1_FIELDS.map(({ field }) => field);

export const LEGACY_SOLO_FIELD_BY_CANONICAL = {
  "session.id": "session_id",
  "run.id": "run_id",
  "session.mode": "app_mode",
  "session.share_code": "share_code",
  "session.started_at": "started_at",
  "session.ended_at": "ended_at",
  "session.date": "date",
  "session.time": "time",
  "participant.name": "name",
  "protocol.target_type": "category",
  "protocol.response_mode": "guess_policy",
  "protocol.deck_policy": "deck_policy",
  "protocol.option_count": "option_count",
  "protocol.options": "option_values",
  "session.trial_count": "trial_count",
  "trial.index": "card_index",
  "target.value": "target_value",
  "response.attempt_sequence": "guesses",
  "response.first_value": "first_guess",
  "score.is_hit": "first_guess_correct",
  "response.correct_position": "correct_guess_index",
  "response.attempt_count": "guess_count",
  "timing.time_to_first_ms": "time_to_first_ms",
  "timing.response_intervals_ms": "guess_intervals_ms",
  "timing.trial_duration_ms": "trial_duration_ms",
  "score.legacy_percent": "score_percent",
  "score.proximity_score": "proximity",
  "score.pattern": "pattern",
  "trial.is_skipped": "skipped",
  "score.hit_rate": "first_guess_accuracy",
  "score.z": "z_score",
  "score.p_value": "p_value",
  "score.average_response_position": "average_guess_position",
  "score.response_position_std_dev": "guess_position_std_dev",
  "score.weighted_score": "weighted_score",
  "timing.trial_started_at": "trial_started_at",
  "timing.trial_ended_at": "trial_ended_at",
  "timing.trial_started_at_estimated": "trial_started_at_estimated",
  "timing.trial_ended_at_estimated": "trial_ended_at_estimated",
  "context.time_of_day": "time_of_day_tag",
  "context.time_of_day_is_estimated": "time_of_day_is_estimated",
  "notes.trial": "notes",
  "notes.voice_text": "voice_text",
  "notes.voice_source": "voice_source",
  "context.training_overlay_opens": "training_overlay_opens",
  "context.training_overlay_ms": "training_overlay_ms",
};

const FIELD_DEFINITION_BY_CANONICAL = new Map(
  PSILABS_DOT_V1_FIELDS.map((definition) => [definition.field, definition])
);

const CANONICAL_FIELD_BY_HEADER = new Map(
  PSILABS_DOT_V1_FIELDS.flatMap((definition) => [
    [definition.field, definition.field],
    ...(definition.aliases || []).map((alias) => [alias, definition.field]),
  ])
);

function normalizeHeaderName(header) {
  return String(header || "").trim();
}

export function getCanonicalSoloFieldName(header) {
  return CANONICAL_FIELD_BY_HEADER.get(normalizeHeaderName(header)) || "";
}

export function getSoloFieldDefinition(field) {
  return FIELD_DEFINITION_BY_CANONICAL.get(field) || null;
}

export function getRequiredSoloFields() {
  return PSILABS_DOT_V1_FIELDS
    .filter((definition) => definition.required)
    .map((definition) => definition.field);
}

export function analyzeSoloHeaders(headers) {
  const normalizedHeaders = headers.map(normalizeHeaderName).filter(Boolean);
  const canonicalHeaders = normalizedHeaders.map((header) => getCanonicalSoloFieldName(header));
  const recognizedHeaders = canonicalHeaders.filter(Boolean);
  const recognizedHeaderSet = new Set(recognizedHeaders);
  const unknownHeaders = normalizedHeaders.filter((header, index) => !canonicalHeaders[index]);
  const missingRequiredHeaders = getRequiredSoloFields().filter((field) => !recognizedHeaderSet.has(field));
  const usesLegacyAliases = normalizedHeaders.some((header) => {
    const canonical = getCanonicalSoloFieldName(header);
    return canonical && canonical !== header;
  });
  const usesCanonicalHeaders = normalizedHeaders.some((header) => PSILABS_DOT_V1_HEADERS.includes(header));
  const isPreferredOrder = PSILABS_DOT_V1_HEADERS.every((field, index) => normalizedHeaders[index] === field);

  return {
    schemaId: usesCanonicalHeaders && !usesLegacyAliases ? SCHEMA_IDS.PSILABS_DOT_V1 : SCHEMA_IDS.MINDSIGHT_LEGACY_V0,
    recognizedHeaders,
    unknownHeaders,
    missingRequiredHeaders,
    usesLegacyAliases,
    usesCanonicalHeaders,
    isPreferredOrder,
    canNormalize: missingRequiredHeaders.length === 0,
  };
}

export function normalizeSoloRow(row) {
  const normalizedRow = {};

  PSILABS_DOT_V1_FIELDS.forEach((definition) => {
    normalizedRow[definition.field] = definition.defaultValue ?? "";
  });

  Object.entries(row || {}).forEach(([header, value]) => {
    const canonicalField = getCanonicalSoloFieldName(header);
    if (canonicalField) {
      normalizedRow[canonicalField] = value ?? "";
    }
  });

  return normalizedRow;
}

function asNumber(value) {
  if (value === "" || value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function splitPipe(value) {
  return String(value || "")
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);
}

function getTrialDurationMs(row) {
  const direct = asNumber(row["timing.trial_duration_ms"]);
  if (direct != null) return direct;

  const timeToFirst = asNumber(row["timing.time_to_first_ms"]) ?? 0;
  const intervals = splitPipe(row["timing.response_intervals_ms"])
    .map(asNumber)
    .filter((value) => value != null);
  const duration = timeToFirst + intervals.reduce((sum, value) => sum + value, 0);
  return duration > 0 ? duration : null;
}

function getSessionBackfillKey(row) {
  return [
    row["participant.name"] || "",
    row["session.id"] || "",
    row["run.id"] || "",
  ].join("::");
}

function hasValue(value) {
  return value !== "" && value != null;
}

function valueOrBackfill(value, backfillValue) {
  return hasValue(value) ? value : (backfillValue ?? "");
}

function backfillSoloSessionRows(sessionRows) {
  const orderedRows = [...sessionRows].sort((left, right) => {
    return (asNumber(left["trial.index"]) ?? 0) - (asNumber(right["trial.index"]) ?? 0);
  });
  const firstRow = orderedRows[0] || {};
  const sessionStartMs = Date.parse(firstRow["session.started_at"] || "");
  const optionValues = splitPipe(firstRow["protocol.options"]);
  const optionCount = asNumber(firstRow["protocol.option_count"]) ?? optionValues.length;
  const guessPolicy = firstRow["protocol.response_mode"] || "";
  const deckPolicy = firstRow["protocol.deck_policy"] || "";
  let cumulativeMs = 0;

  const backfilledRows = orderedRows.map((row) => {
    const nextRow = { ...row };
    const durationMs = getTrialDurationMs(nextRow);
    const exactStart = nextRow["timing.trial_started_at"];
    const exactEnd = nextRow["timing.trial_ended_at"];
    const estimatedStartFromRow = nextRow["timing.trial_started_at_estimated"];
    const estimatedEndFromRow = nextRow["timing.trial_ended_at_estimated"];
    const canEstimate = !exactStart && !estimatedStartFromRow && Number.isFinite(sessionStartMs);
    const estimatedStart = canEstimate ? new Date(sessionStartMs + cumulativeMs) : null;
    const estimatedEnd = canEstimate && durationMs != null
      ? new Date(sessionStartMs + cumulativeMs + durationMs)
      : null;

    if (durationMs != null && !nextRow["timing.trial_duration_ms"]) {
      nextRow["timing.trial_duration_ms"] = String(durationMs);
    }

    if (estimatedStart && Number.isFinite(estimatedStart.getTime())) {
      nextRow["timing.trial_started_at_estimated"] = estimatedStart.toISOString();
    }

    if (estimatedEnd && Number.isFinite(estimatedEnd.getTime())) {
      nextRow["timing.trial_ended_at_estimated"] = estimatedEnd.toISOString();
    }

    if (canEstimate && durationMs != null) {
      cumulativeMs += durationMs;
    }

    const timingDate = exactStart
      ? new Date(exactStart)
      : new Date(nextRow["timing.trial_started_at_estimated"] || "");
    if (!nextRow["context.time_of_day"]) {
      nextRow["context.time_of_day"] = getTimeOfDayTag(timingDate);
    }

    if (nextRow["context.time_of_day"] && nextRow["context.time_of_day_is_estimated"] === "") {
      nextRow["context.time_of_day_is_estimated"] = exactStart ? "false" : "true";
    }

    if (nextRow["analysis.is_excluded"] === "") {
      nextRow["analysis.is_excluded"] = "false";
    }

    return nextRow;
  });

  const trials = backfilledRows.map((row) => buildTrialRecord({
    cardIndex: asNumber(row["trial.index"]) ?? 0,
    category: row["protocol.target_type"] || "Colors",
    optionCount,
    targetValue: row["target.value"],
    guesses: splitPipe(row["response.attempt_sequence"]),
    guessPolicy,
    deckPolicy,
    timeToFirstMs: asNumber(row["timing.time_to_first_ms"]),
    guessIntervalsMs: splitPipe(row["timing.response_intervals_ms"]).map(asNumber).filter((value) => value != null),
    trialDurationMs: asNumber(row["timing.trial_duration_ms"]),
  }));

  const analytics = buildSessionAnalytics({
    trials,
    optionValues,
    optionCount,
    guessPolicy,
  });

  return backfilledRows.map((row, index) => {
    const trial = trials[index] || {};

    return {
      ...row,
      "response.first_value": valueOrBackfill(row["response.first_value"], trial.firstGuess),
      "score.is_hit": valueOrBackfill(row["score.is_hit"], trial.firstGuessCorrect),
      "response.correct_position": valueOrBackfill(row["response.correct_position"], trial.correctGuessIndex),
      "response.attempt_count": valueOrBackfill(row["response.attempt_count"], trial.guessCount),
      "score.hit_rate": valueOrBackfill(row["score.hit_rate"], analytics.firstGuessAccuracy),
      "score.z": valueOrBackfill(row["score.z"], analytics.zScore),
      "score.p_value": valueOrBackfill(row["score.p_value"], analytics.pValue),
      "score.chance_baseline": valueOrBackfill(row["score.chance_baseline"], analytics.firstGuessChanceBaseline),
      "score.expected_avg_response_position": valueOrBackfill(row["score.expected_avg_response_position"], analytics.averageGuessPositionBaseline),
      "score.average_response_position": valueOrBackfill(row["score.average_response_position"], analytics.averageGuessPosition),
      "score.response_position_std_dev": valueOrBackfill(row["score.response_position_std_dev"], analytics.guessPositionStdDev),
      "score.weighted_score": valueOrBackfill(row["score.weighted_score"], analytics.weightedScore),
    };
  });
}

export function backfillSoloRows(rows) {
  const normalizedRows = Array.isArray(rows) ? rows.map((row) => normalizeSoloRow(row)) : [];
  const sessionRowsByKey = new Map();

  normalizedRows.forEach((row) => {
    const key = getSessionBackfillKey(row);
    if (!sessionRowsByKey.has(key)) {
      sessionRowsByKey.set(key, []);
    }
    sessionRowsByKey.get(key).push(row);
  });

  const backfilledRowsByIdentity = new Map();
  [...sessionRowsByKey.values()].forEach((sessionRows) => {
    backfillSoloSessionRows(sessionRows).forEach((row) => {
      const identity = `${getSessionBackfillKey(row)}::${row["trial.index"]}`;
      backfilledRowsByIdentity.set(identity, row);
    });
  });

  return normalizedRows.map((row) => {
    const identity = `${getSessionBackfillKey(row)}::${row["trial.index"]}`;
    return backfilledRowsByIdentity.get(identity) || row;
  });
}

export function denormalizeSoloRow(normalizedRow, headers = PSILABS_DOT_V1_HEADERS) {
  return headers.map((header) => {
    const canonicalField = getCanonicalSoloFieldName(header) || header;
    return normalizedRow?.[canonicalField] ?? getSoloFieldDefinition(canonicalField)?.defaultValue ?? "";
  });
}

export function convertLegacySoloRowsToDotV1Values(rowObjects, headers = PSILABS_DOT_V1_HEADERS) {
  return backfillSoloRows(rowObjects).map((row) => denormalizeSoloRow(row, headers));
}

export function convertLegacySoloRowToDotV1Values(rowObject, headers = PSILABS_DOT_V1_HEADERS) {
  const [rowValues] = convertLegacySoloRowsToDotV1Values([rowObject], headers);
  return rowValues || denormalizeSoloRow(normalizeSoloRow(rowObject), headers);
}

export function convertNormalizedSoloRowToLegacy(normalizedRow) {
  const legacyRow = {};

  Object.entries(LEGACY_SOLO_FIELD_BY_CANONICAL).forEach(([canonicalField, legacyField]) => {
    legacyRow[legacyField] = normalizedRow?.[canonicalField] ?? "";
  });

  return legacyRow;
}
