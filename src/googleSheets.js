import { buildDotV1SoloTrialRows } from "./csv.js";
import {
  PSILABS_DOT_V1_HEADERS,
  analyzeSoloHeaders,
  convertNormalizedSoloRowToLegacy,
  denormalizeSoloRow,
  normalizeSoloRow,
} from "./schemaRegistry.js";

export const TRIALS_SHEET_TITLE = "Trials";
const MIGRATABLE_PROTOCOL_PHENOMENA = new Set(["", "mindsight"]);

async function fetchGoogleSheetsJson(url, accessToken, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    let errorMessage = "Google Sheets request failed.";

    try {
      const errorPayload = await response.json();
      errorMessage = errorPayload?.error?.message || errorMessage;
    } catch (error) {
      // Keep fallback message.
    }

    throw new Error(errorMessage);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export async function createMindsightSpreadsheet(accessToken) {
  if (!accessToken) {
    throw new Error("Connect Google before creating a Mindsight sheet.");
  }

  const spreadsheet = await fetchGoogleSheetsJson("https://sheets.googleapis.com/v4/spreadsheets", accessToken, {
    method: "POST",
    body: JSON.stringify({
      properties: {
        title: `Mindsight Trials ${new Date().toISOString().slice(0, 10)}`,
      },
      sheets: [
        { properties: { title: TRIALS_SHEET_TITLE } },
      ],
    }),
  });

  return {
    spreadsheetId: spreadsheet.spreadsheetId,
    spreadsheetUrl: spreadsheet.spreadsheetUrl,
    title: spreadsheet.properties?.title || "Mindsight Trials",
  };
}

async function getSpreadsheetMetadata(accessToken, spreadsheetId) {
  return fetchGoogleSheetsJson(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=properties.title,spreadsheetUrl,sheets.properties.title`,
    accessToken
  );
}

async function ensureTrialsSheetExists(accessToken, spreadsheetId) {
  const metadata = await getSpreadsheetMetadata(accessToken, spreadsheetId);
  const hasTrialsSheet = metadata.sheets?.some((sheet) => sheet.properties?.title === TRIALS_SHEET_TITLE);

  if (!hasTrialsSheet) {
    await fetchGoogleSheetsJson(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
      accessToken,
      {
        method: "POST",
        body: JSON.stringify({
          requests: [
            {
              addSheet: {
                properties: {
                  title: TRIALS_SHEET_TITLE,
                },
              },
            },
          ],
        }),
      }
    );
  }

  return metadata;
}

async function getTrialsSheetHeaderRow(accessToken, spreadsheetId) {
  const result = await fetchGoogleSheetsJson(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(`${TRIALS_SHEET_TITLE}!1:1`)}`,
    accessToken
  );

  return result?.values?.[0] ?? [];
}

function validateTrialsSheetHeaders(existingHeaders) {
  const normalizedHeaders = existingHeaders.map((header) => String(header || "").trim()).filter(Boolean);

  if (normalizedHeaders.length === 0) {
    return {
      shouldInitialize: true,
      missingHeaders: [],
    };
  }

  const headerAnalysis = analyzeSoloHeaders(normalizedHeaders);

  return {
    shouldInitialize: false,
    missingHeaders: headerAnalysis.missingRequiredHeaders,
    headerAnalysis,
  };
}

function mapRowsToObjects(headers, rows) {
  return rows.map((rowValues) =>
    Object.fromEntries(headers.map((header, index) => [header, rowValues[index] ?? ""]))
  );
}

async function clearTrialsSheetValues(accessToken, spreadsheetId) {
  await fetchGoogleSheetsJson(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(`${TRIALS_SHEET_TITLE}!A1:ZZ`)}:clear`,
    accessToken,
    {
      method: "POST",
    }
  );
}

async function writeTrialsSheetValues(accessToken, spreadsheetId, values) {
  await fetchGoogleSheetsJson(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(`${TRIALS_SHEET_TITLE}!A1`)}?valueInputOption=RAW`,
    accessToken,
    {
      method: "PUT",
      body: JSON.stringify({ values }),
    }
  );
}

async function readTrialsSheetValueRows(accessToken, spreadsheetId) {
  const result = await fetchGoogleSheetsJson(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(`${TRIALS_SHEET_TITLE}!A2:ZZ`)}`,
    accessToken
  );

  return result?.values ?? [];
}

async function migrateTrialsSheetToDotV1(accessToken, spreadsheetId, existingHeaders) {
  const normalizedHeaders = existingHeaders.map((header) => String(header || "").trim()).filter(Boolean);
  const headerAnalysis = analyzeSoloHeaders(normalizedHeaders);

  if (headerAnalysis.missingRequiredHeaders.length > 0) {
    throw new Error(`Trials sheet is missing required columns: ${headerAnalysis.missingRequiredHeaders.join(", ")}`);
  }

  if (headerAnalysis.unknownHeaders.length > 0) {
    throw new Error(`Trials sheet has columns this app does not know how to migrate yet: ${headerAnalysis.unknownHeaders.join(", ")}`);
  }

  if (headerAnalysis.isPreferredOrder) {
    return PSILABS_DOT_V1_HEADERS;
  }

  const rows = await readTrialsSheetValueRows(accessToken, spreadsheetId);
  const rowObjects = mapRowsToObjects(normalizedHeaders, rows);
  const normalizedRows = rowObjects.map((rowObject) => normalizeSoloRow(rowObject));
  const unsupportedProtocolRows = normalizedRows.filter((row) => {
    return !MIGRATABLE_PROTOCOL_PHENOMENA.has(String(row["protocol.phenomenon"] || "").trim().toLowerCase());
  });

  if (unsupportedProtocolRows.length > 0) {
    throw new Error("This sheet contains non-Mindsight protocol rows. Choose a Mindsight-only sheet before migration.");
  }

  const migratedRows = normalizedRows.map((row) => denormalizeSoloRow(row, PSILABS_DOT_V1_HEADERS));

  await clearTrialsSheetValues(accessToken, spreadsheetId);
  await writeTrialsSheetValues(accessToken, spreadsheetId, [PSILABS_DOT_V1_HEADERS, ...migratedRows]);

  return PSILABS_DOT_V1_HEADERS;
}

export async function appendSoloTrials(accessToken, spreadsheetId, sessionData) {
  if (!accessToken) {
    throw new Error("Connect Google before appending trials.");
  }

  if (!spreadsheetId) {
    throw new Error("Choose or create a Mindsight sheet before appending trials.");
  }

  await ensureTrialsSheetExists(accessToken, spreadsheetId);
  const existingHeaders = await getTrialsSheetHeaderRow(accessToken, spreadsheetId);
  const headerValidation = validateTrialsSheetHeaders(existingHeaders);

  if (headerValidation.shouldInitialize) {
    await writeTrialsSheetValues(accessToken, spreadsheetId, [PSILABS_DOT_V1_HEADERS]);
  } else if (headerValidation.missingHeaders.length > 0) {
    throw new Error(`Trials sheet is missing required columns: ${headerValidation.missingHeaders.join(", ")}`);
  }

  if (!headerValidation.shouldInitialize) {
    await migrateTrialsSheetToDotV1(accessToken, spreadsheetId, existingHeaders);
  }

  const trialRows = buildDotV1SoloTrialRows(sessionData);
  if (trialRows.length === 0) {
    return { appendedRowCount: 0 };
  }

  await fetchGoogleSheetsJson(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(`${TRIALS_SHEET_TITLE}!A1`)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    accessToken,
    {
      method: "POST",
      body: JSON.stringify({
        values: trialRows,
      }),
    }
  );

  return {
    appendedRowCount: trialRows.length,
  };
}

export async function readTrialsSheetRows(accessToken, spreadsheetId) {
  if (!accessToken) {
    throw new Error("Connect Google before reading trials.");
  }

  if (!spreadsheetId) {
    throw new Error("Choose or create a Mindsight sheet before reading trials.");
  }

  await ensureTrialsSheetExists(accessToken, spreadsheetId);
  const existingHeaders = await getTrialsSheetHeaderRow(accessToken, spreadsheetId);
  const headerValidation = validateTrialsSheetHeaders(existingHeaders);

  if (headerValidation.shouldInitialize) {
    return [];
  }

  if (headerValidation.missingHeaders.length > 0) {
    throw new Error(`Trials sheet is missing required columns: ${headerValidation.missingHeaders.join(", ")}`);
  }

  const headerOrder = await migrateTrialsSheetToDotV1(accessToken, spreadsheetId, existingHeaders);
  const rows = await readTrialsSheetValueRows(accessToken, spreadsheetId);
  return mapRowsToObjects(headerOrder, rows).map((rowObject) => {
    const normalizedRow = normalizeSoloRow(rowObject);
    return { ...rowObject, ...convertNormalizedSoloRowToLegacy(normalizedRow) };
  });
}
