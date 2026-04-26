export const SOLO_SCHEMA_VERSION = "1.0";

export const SCHEMA_IDS = {
  MINDSIGHT_LEGACY_V0: "mindsight_legacy_v0",
  PSILABS_DOT_V1: "psilabs_dot_v1",
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
    field: "session.id",
    aliases: ["session_id", "sessionId"],
    required: true,
    defaultValue: "",
  },
  {
    field: "run.id",
    aliases: ["run_id", "runId"],
    required: false,
    defaultValue: "",
  },
  {
    field: "schema.version",
    aliases: ["schema_version", "schemaVersion"],
    required: false,
    defaultValue: SOLO_SCHEMA_VERSION,
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
    field: "session.is_test",
    aliases: ["is_test", "session_is_test", "sessionIsTest"],
    required: false,
    defaultValue: "true",
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
    field: "score.first_response_accuracy",
    aliases: ["first_guess_accuracy", "firstGuessAccuracy", "first_response_accuracy"],
    required: false,
    defaultValue: "",
  },
  {
    field: "score.weighted",
    aliases: ["weighted_score", "weightedScore"],
    required: false,
    defaultValue: "",
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
    field: "session.trial_count",
    aliases: ["trial_count", "trialCount"],
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
    field: "target.value",
    aliases: ["target_value", "targetValue", "target"],
    required: true,
    defaultValue: "",
  },
  {
    field: "response.first",
    aliases: ["first_guess", "firstGuess", "first_response"],
    required: false,
    defaultValue: "",
  },
  {
    field: "score.first_response_correct",
    aliases: ["first_guess_correct", "firstGuessCorrect", "first_response_correct"],
    required: false,
    defaultValue: "",
  },
  {
    field: "response.correct_position",
    aliases: ["correct_guess_index", "correctGuessIndex", "correct_position"],
    required: false,
    defaultValue: "",
  },
  {
    field: "response.count",
    aliases: ["guess_count", "guessCount", "response_count"],
    required: false,
    defaultValue: "",
  },
  {
    field: "response.sequence",
    aliases: ["guesses", "guess_sequence", "response_sequence"],
    required: false,
    defaultValue: "",
  },
  {
    field: "trial.skipped",
    aliases: ["skipped"],
    required: false,
    defaultValue: "false",
  },
  {
    field: "analysis.excluded",
    aliases: ["excluded", "analysis_excluded"],
    required: false,
    defaultValue: "false",
  },
  {
    field: "analysis.exclusion_reason",
    aliases: ["exclusion_reason", "analysis_exclusion_reason"],
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
    field: "score.legacy_percent",
    aliases: ["score_percent", "accuracy"],
    required: false,
    defaultValue: "",
  },
  {
    field: "score.proximity",
    aliases: ["proximity"],
    required: false,
    defaultValue: "",
  },
  {
    field: "score.pattern",
    aliases: ["pattern"],
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
  "response.sequence": "guesses",
  "response.first": "first_guess",
  "score.first_response_correct": "first_guess_correct",
  "response.correct_position": "correct_guess_index",
  "response.count": "guess_count",
  "timing.time_to_first_ms": "time_to_first_ms",
  "timing.response_intervals_ms": "guess_intervals_ms",
  "timing.trial_duration_ms": "trial_duration_ms",
  "score.legacy_percent": "score_percent",
  "score.proximity": "proximity",
  "score.pattern": "pattern",
  "trial.skipped": "skipped",
  "score.first_response_accuracy": "first_guess_accuracy",
  "score.z": "z_score",
  "score.p_value": "p_value",
  "score.average_response_position": "average_guess_position",
  "score.response_position_std_dev": "guess_position_std_dev",
  "score.weighted": "weighted_score",
  "timing.trial_started_at": "trial_started_at",
  "timing.trial_ended_at": "trial_ended_at",
  "timing.trial_started_at_estimated": "trial_started_at_estimated",
  "timing.trial_ended_at_estimated": "trial_ended_at_estimated",
  "context.time_of_day": "time_of_day_tag",
  "context.time_of_day_is_estimated": "time_of_day_is_estimated",
  "notes.trial": "notes",
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

export function denormalizeSoloRow(normalizedRow, headers = PSILABS_DOT_V1_HEADERS) {
  return headers.map((header) => normalizedRow?.[header] ?? getSoloFieldDefinition(header)?.defaultValue ?? "");
}

export function convertLegacySoloRowToDotV1Values(rowObject, headers = PSILABS_DOT_V1_HEADERS) {
  return denormalizeSoloRow(normalizeSoloRow(rowObject), headers);
}

export function convertNormalizedSoloRowToLegacy(normalizedRow) {
  const legacyRow = {};

  Object.entries(LEGACY_SOLO_FIELD_BY_CANONICAL).forEach(([canonicalField, legacyField]) => {
    legacyRow[legacyField] = normalizedRow?.[canonicalField] ?? "";
  });

  return legacyRow;
}
