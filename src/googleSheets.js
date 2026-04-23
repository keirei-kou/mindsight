import { SOLO_TRIAL_HEADERS, buildSoloTrialRows } from "./csv.js";

export const TRIALS_SHEET_TITLE = "Trials";
const OPTIONAL_SOLO_HEADERS = ["run_id"];

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

  const requiredHeaders = SOLO_TRIAL_HEADERS.filter((header) => !OPTIONAL_SOLO_HEADERS.includes(header));
  const missingHeaders = requiredHeaders.filter((requiredHeader) => !normalizedHeaders.includes(requiredHeader));

  return {
    shouldInitialize: false,
    missingHeaders,
  };
}

function mapRowsToObjects(headers, rows) {
  return rows.map((rowValues) =>
    Object.fromEntries(headers.map((header, index) => [header, rowValues[index] ?? ""]))
  );
}

async function initializeTrialsSheetHeaders(accessToken, spreadsheetId) {
  await fetchGoogleSheetsJson(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(`${TRIALS_SHEET_TITLE}!1:1`)}?valueInputOption=RAW`,
    accessToken,
    {
      method: "PUT",
      body: JSON.stringify({
        values: [SOLO_TRIAL_HEADERS],
      }),
    }
  );
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
    await initializeTrialsSheetHeaders(accessToken, spreadsheetId);
  } else if (headerValidation.missingHeaders.length > 0) {
    throw new Error(`Trials sheet is missing required columns: ${headerValidation.missingHeaders.join(", ")}`);
  }

  const trialRows = buildSoloTrialRows(sessionData);
  if (trialRows.length === 0) {
    return { appendedRowCount: 0 };
  }

  const normalizedHeaders = existingHeaders.map((header) => String(header || "").trim()).filter(Boolean);
  const headerOrder = normalizedHeaders.length > 0 ? normalizedHeaders : SOLO_TRIAL_HEADERS;
  const mappedTrialRows = trialRows.map((rowValues) => {
    const rowObject = Object.fromEntries(SOLO_TRIAL_HEADERS.map((header, index) => [header, rowValues[index] ?? ""]));
    return headerOrder.map((header) => rowObject[header] ?? "");
  });

  await fetchGoogleSheetsJson(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(`${TRIALS_SHEET_TITLE}!A1`)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    accessToken,
    {
      method: "POST",
      body: JSON.stringify({
        values: mappedTrialRows,
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

  const result = await fetchGoogleSheetsJson(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(`${TRIALS_SHEET_TITLE}!A2:ZZ`)}`,
    accessToken
  );

  const rows = result?.values ?? [];
  return mapRowsToObjects(existingHeaders, rows);
}
