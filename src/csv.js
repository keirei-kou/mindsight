import { CATEGORIES } from './constants.js';

export function slugifyCsvPart(value, fallback = "session") {
  return String(value || fallback)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || fallback;
}

export function createCsvTimestamp(date = new Date()) {
  return date
    .toISOString()
    .replace("T", "-")
    .slice(0, 19)
    .replace(/:/g, "-");
}

export function buildResultsFilename(name, category, timestamp = createCsvTimestamp()) {
  const safeName = slugifyCsvPart(name, "participant");
  const safeCategory = slugifyCsvPart(category, "session");
  return `${safeName}-${safeCategory}-${timestamp}-results.csv`;
}

export function downloadCsv(filename, csvText) {
  const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function buildSoloResultsCsv(data) {
  const { name, results, category } = data;
  const sessionId = new Date().toISOString().replace(/[:.]/g, "-");
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-CA");
  const timeStr = now.toLocaleTimeString("en-GB");

  const headers = [
    "session_id", "date", "time", "name", "category", "card_position",
    "round_size", "target", "guesses", "attempts", "accuracy",
    "proximity", "pattern", "first_guess_correct",
    "time_to_first_s", "time_per_guess_s", "card_total_time_s", "skipped"
  ];

  const rows = results.map((r, i) => {
    const timeToFirst = r.timeToFirst != null ? (r.timeToFirst / 1000).toFixed(2) : "";
    const guessDeltas = r.guessDeltas?.length
      ? r.guessDeltas.map(d => (d / 1000).toFixed(2)).join("|")
      : "";
    const allTimes = r.timeToFirst != null
      ? [r.timeToFirst, ...(r.guessDeltas || [])]
      : [];
    const cardTotal = allTimes.length ? (allTimes.reduce((a, b) => a + b, 0) / 1000).toFixed(2) : "";

    return [
      sessionId, dateStr, timeStr, name, category, i + 1, results.length,
      r.target, r.guesses.join("|"),
      r.skipped ? 0 : r.guesses.length,
      r.acc, r.prox ?? "", r.pattern ?? "",
      r.skipped ? "false" : (r.guesses[0] === r.target ? "true" : "false"),
      timeToFirst, guessDeltas, cardTotal,
      r.skipped ? "true" : "false"
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(",");
  });

  return [headers.join(","), ...rows].join("\n");
}

function buildGroupRows(data) {
  const { participants, slots, category, session, timers = [], endedAt } = data;
  const now = endedAt ? new Date(endedAt) : new Date();
  const sessionId = new Date(endedAt || now).toISOString().replace(/[:.]/g, "-");
  const dateStr = now.toLocaleDateString("en-CA");
  const timeStr = now.toLocaleTimeString("en-GB");

  return participants.flatMap((participant) => {
    return slots.map((slot, index) => {
      const cell = session?.[participant.id]?.[index] ?? { guesses: [], dnf: false };
      const guesses = cell.guesses ?? [];
      const guessNames = guesses.map(g => g.color);
      const resolved = guessNames.length > 0 && guessNames[guessNames.length - 1] === slot.name;
      const attempts = cell.dnf ? 0 : guessNames.length;
      const accuracy = resolved ? Math.round((1 / Math.max(1, guessNames.length)) * 100) : 0;
      const slotTimer = timers[index] ?? {};
      const timeToFirst = guesses[0]?.ts && slotTimer.startMs ? ((guesses[0].ts - slotTimer.startMs) / 1000).toFixed(2) : "";
      const guessDeltas = guesses.slice(1).map((guess, guessIndex) => ((guess.ts - guesses[guessIndex].ts) / 1000).toFixed(2));
      const cardTotal = guesses.length && slotTimer.startMs ? ((guesses[guesses.length - 1].ts - slotTimer.startMs) / 1000).toFixed(2) : "";

      return [
        sessionId,
        dateStr,
        timeStr,
        participant.name,
        participant.active ? "true" : "false",
        category,
        index + 1,
        slots.length,
        slot.name,
        guessNames.join("|"),
        attempts,
        accuracy,
        cell.dnf ? "true" : "false",
        resolved ? "true" : "false",
        timeToFirst,
        guessDeltas.join("|"),
        cardTotal,
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(",");
    });
  });
}

export function buildGroupResultsCsv(data) {
  const headers = [
    "session_id",
    "date",
    "time",
    "participant_name",
    "participant_active",
    "category",
    "card_position",
    "round_size",
    "target",
    "guesses",
    "attempts",
    "accuracy",
    "skipped",
    "resolved",
    "time_to_first_s",
    "time_per_guess_s",
    "card_total_time_s",
  ];

  return [headers.join(","), ...buildGroupRows(data)].join("\n");
}

export function buildGroupParticipantCsv(data, participantId) {
  const participant = data.participants.find(p => p.id === participantId);
  if (!participant) return "";
  const filteredData = { ...data, participants: [participant] };
  return buildGroupResultsCsv(filteredData);
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      if (row.some(value => value !== "")) rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  if (cell !== "" || row.length > 0) {
    row.push(cell);
    if (row.some(value => value !== "")) rows.push(row);
  }

  if (!rows.length) return [];

  const [headers, ...body] = rows;
  return body.map((values) =>
    Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]))
  );
}

function asNumber(value) {
  if (value === "" || value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asBool(value) {
  return String(value).toLowerCase() === "true";
}

function secondsToMs(value) {
  const seconds = asNumber(value);
  return seconds == null ? null : Math.round(seconds * 1000);
}

function splitPipe(value) {
  return String(value || "")
    .split("|")
    .map(part => part.trim())
    .filter(Boolean);
}

function buildColorsForCategory(category, rows) {
  const categoryItems = CATEGORIES[category]?.items ?? [];
  if (!categoryItems.length) return [];

  const namesInCsv = new Set(
    rows.flatMap((row) => [
      row.target,
      ...splitPipe(row.guesses),
    ])
  );

  return categoryItems.filter(item => namesInCsv.has(item.name) || namesInCsv.size === 0);
}

export function parseResultsCsvSummary(text) {
  const rows = parseCsv(text);
  if (!rows.length) throw new Error("CSV file is empty.");

  const first = rows[0];
  if ("participant_name" in first) {
    const names = Array.from(new Set(rows.map(row => row.participant_name).filter(Boolean)));
    return {
      kind: "group",
      category: first.category || "Colors",
      roundSize: asNumber(first.round_size) ?? rows.length,
      participantNames: names,
    };
  }

  if ("name" in first) {
    return {
      kind: "solo",
      category: first.category || "Colors",
      roundSize: asNumber(first.round_size) ?? rows.length,
      participantNames: first.name ? [first.name] : [],
    };
  }

  throw new Error("This CSV format is not recognized.");
}

export function parseSoloResultsCsv(text) {
  const rows = parseCsv(text);
  if (!rows.length) throw new Error("CSV file is empty.");
  if (!("name" in rows[0])) throw new Error("This does not look like a solo results CSV.");

  const first = rows[0];
  const category = first.category || "Colors";
  const colors = buildColorsForCategory(category, rows);
  const baseMs = Date.now();

  const results = [...rows]
    .sort((a, b) => (asNumber(a.card_position) ?? 0) - (asNumber(b.card_position) ?? 0))
    .map((row, index) => {
      const timeToFirst = secondsToMs(row.time_to_first_s);
      const guessDeltas = splitPipe(row.time_per_guess_s)
        .map(secondsToMs)
        .filter(value => value != null);
      let currentTs = baseMs + index * 10000;
      const guesses = splitPipe(row.guesses);
      const guessTimeline = guesses.map((guess, guessIndex) => {
        if (guessIndex === 0 && timeToFirst != null) {
          currentTs += timeToFirst;
        } else if (guessIndex > 0) {
          currentTs += guessDeltas[guessIndex - 1] ?? 0;
        }
        return { color: guess, ts: currentTs };
      });

      return {
        target: row.target,
        guesses,
        acc: asNumber(row.accuracy) ?? 0,
        prox: asNumber(row.proximity),
        pattern: row.pattern || null,
        skipped: asBool(row.skipped),
        timeToFirst,
        guessDeltas,
        importedTimeline: guessTimeline,
      };
    });

  return {
    name: first.name || "Imported Session",
    category,
    colors,
    results,
    importedFromCsv: true,
  };
}

export function parseGroupResultsCsv(text) {
  const rows = parseCsv(text);
  if (!rows.length) throw new Error("CSV file is empty.");
  if (!("participant_name" in rows[0])) throw new Error("This does not look like a group results CSV.");

  const orderedRows = [...rows].sort((a, b) => {
    const cardDiff = (asNumber(a.card_position) ?? 0) - (asNumber(b.card_position) ?? 0);
    if (cardDiff !== 0) return cardDiff;
    return String(a.participant_name).localeCompare(String(b.participant_name));
  });

  const category = orderedRows[0].category || "Colors";
  const colors = buildColorsForCategory(category, orderedRows);

  const participantNames = Array.from(
    new Set(orderedRows.map(row => row.participant_name).filter(Boolean))
  );
  const participants = participantNames.map((name, index) => {
    const row = orderedRows.find(item => item.participant_name === name);
    return {
      id: index,
      name,
      active: row ? asBool(row.participant_active) : true,
    };
  });

  const participantIdByName = Object.fromEntries(participants.map(p => [p.name, p.id]));
  const slotByIndex = new Map();
  const maxDurationBySlot = new Map();

  orderedRows.forEach((row) => {
    const slotIndex = Math.max(0, (asNumber(row.card_position) ?? 1) - 1);
    if (!slotByIndex.has(slotIndex)) {
      const fallback = colors.find(item => item.name === row.target);
      slotByIndex.set(slotIndex, fallback ?? { name: row.target, symbol: row.target?.[0] ?? "?", hex: "#8080a0" });
    }
    const durationMs = secondsToMs(row.card_total_time_s);
    if (durationMs != null) {
      maxDurationBySlot.set(slotIndex, Math.max(durationMs, maxDurationBySlot.get(slotIndex) ?? 0));
    }
  });

  const slots = [...slotByIndex.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, slot]) => slot);

  let runningMs = Date.now();
  const timers = slots.map((_, slotIndex) => {
    const durationMs = maxDurationBySlot.get(slotIndex) ?? 0;
    const startMs = runningMs;
    const endMs = durationMs > 0 ? startMs + durationMs : startMs;
    runningMs = endMs;
    return { startMs, endMs };
  });

  const session = {};
  orderedRows.forEach((row) => {
    const pid = participantIdByName[row.participant_name];
    const slotIndex = Math.max(0, (asNumber(row.card_position) ?? 1) - 1);
    const slotStartMs = timers[slotIndex]?.startMs ?? Date.now();
    const timeToFirst = secondsToMs(row.time_to_first_s);
    const deltas = splitPipe(row.time_per_guess_s)
      .map(secondsToMs)
      .filter(value => value != null);

    let currentTs = slotStartMs;
    const guesses = splitPipe(row.guesses).map((guess, guessIndex) => {
      if (guessIndex === 0 && timeToFirst != null) {
        currentTs += timeToFirst;
      } else if (guessIndex > 0) {
        currentTs += deltas[guessIndex - 1] ?? 0;
      }
      return { color: guess, ts: currentTs };
    });

    session[pid] = {
      ...(session[pid] ?? {}),
      [slotIndex]: {
        guesses,
        dnf: asBool(row.skipped),
        slotStart: slotStartMs,
      },
    };
  });

  return {
    participants,
    slots,
    colors,
    category,
    session,
    timers,
    endedAt: new Date(runningMs).toISOString(),
    importedFromCsv: true,
  };
}
