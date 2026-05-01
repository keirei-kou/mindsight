import { useEffect, useMemo, useState } from 'react';
import { CsvImportButton } from '../components/CsvImportButton.jsx';
import { StatCard } from '../components/StatCard.jsx';
import { buildSessionAnalytics, buildSessionHistoryPoints, buildTrialTimelinePoints, formatGuessPositionLabel } from '../lib/sessionAnalytics.js';
import { buildResultsFilename, buildSoloHistoryResultsCsv, buildSoloResultsCsv, buildUserHistoryFilename, downloadCsv, parseSoloResultsCsv } from '../lib/csv.js';
import { DECK_POLICIES, GUESS_POLICIES, SESSION_MODES } from '../lib/sessionModel.js';
import { speak } from '../lib/tts.js';
import { appendSoloTrials, readTrialsSheetRows } from '../lib/googleSheets.js';
import { buildSoloHistoryFromGoogleSheetRows } from '../lib/googleSheetHistory.js';

function SoloAccuracyGraph({ trials, guessPolicy }) {
  const width = 520;
  const height = 260;
  const padding = { top: 20, right: 18, bottom: 36, left: 42 };
  const points = buildTrialTimelinePoints(trials, guessPolicy);
  const maxX = points.length ? Math.max(...points.map(point => point.x), 1) : 1;
  const graphWidth = width - padding.left - padding.right;
  const graphHeight = height - padding.top - padding.bottom;
  const yTicks = [0, 25, 50, 75, 100];

  const scaleX = (value) => padding.left + (value / maxX) * graphWidth;
  const scaleY = (value) => padding.top + ((100 - value) / 100) * graphHeight;
  const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${scaleX(point.x)} ${scaleY(point.y)}`).join(' ');

  return (
    <div style={{ width: "100%", maxWidth: "520px", background: "var(--color-surface, #FFFFFF)", border: "1px solid var(--color-border, #E6E2D9)", borderRadius: "14px", padding: "18px 18px 12px", overflowX: "auto", boxShadow: "0 12px 30px rgba(31, 31, 31, 0.06)" }}>
      <div style={{ fontSize: "0.78rem", color: "var(--color-subtext, #6B6B6B)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "12px" }}>
        {guessPolicy === GUESS_POLICIES.ONE_SHOT ? "First Guess % (Running) Over Time" : "Weighted Score Over Time"}
      </div>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Solo accuracy graph">
        {yTicks.map((tick) => (
          <g key={tick}>
            <line x1={padding.left} y1={scaleY(tick)} x2={width - padding.right} y2={scaleY(tick)} stroke="#E6E2D9" strokeDasharray="4 4" />
            <text x={padding.left - 10} y={scaleY(tick) + 4} fill="#7f7a9e" fontSize="11" textAnchor="end">
              {tick}
            </text>
          </g>
        ))}
        <line x1={padding.left} y1={padding.top} x2={padding.left} y2={height - padding.bottom} stroke="#BDB6AB" />
        <line x1={padding.left} y1={height - padding.bottom} x2={width - padding.right} y2={height - padding.bottom} stroke="#BDB6AB" />
        <text x={width / 2} y={height - 8} fill="#7f7a9e" fontSize="11" textAnchor="middle">
          Session Time
        </text>
        <text x={16} y={height / 2} fill="#7f7a9e" fontSize="11" textAnchor="middle" transform={`rotate(-90 16 ${height / 2})`}>
          {guessPolicy === GUESS_POLICIES.ONE_SHOT ? "First Guess %" : "Score"}
        </text>
        {path && <path d={path} fill="none" stroke="#60a5fa" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />}
        {points.map((point) => (
          <g key={point.card}>
            <circle cx={scaleX(point.x)} cy={scaleY(point.y)} r="4" fill="#60a5fa" />
            <title>{[
              `Card ${point.card}`,
              point.targetValue ? `Target: ${point.targetValue}` : null,
              guessPolicy === GUESS_POLICIES.ONE_SHOT ? `First Guess % (running): ${point.y}%` : `Score: ${point.y}%`,
              `Card first guess: ${point.firstGuessCorrect ? "correct" : "incorrect"}`,
              point.firstGuess ? `Heard: ${point.firstGuess}` : null,
              formatGuessPositionLabel(point.correctGuessIndex),
            ].filter(Boolean).join(" • ")}</title>
          </g>
        ))}
      </svg>
    </div>
  );
}

function SoloHistoryGraph({ sessions }) {
  const width = 520;
  const height = 260;
  const padding = { top: 20, right: 18, bottom: 36, left: 42 };
  const points = buildSessionHistoryPoints(sessions);
  const maxX = points.length > 1 ? points.length - 1 : 1;
  const graphWidth = width - padding.left - padding.right;
  const graphHeight = height - padding.top - padding.bottom;
  const yTicks = [0, 25, 50, 75, 100];

  const scaleX = (value) => padding.left + ((value - 1) / maxX) * graphWidth;
  const scaleY = (value) => padding.top + ((100 - value) / 100) * graphHeight;
  const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${scaleX(point.x)} ${scaleY(point.y)}`).join(' ');

  return (
    <div style={{ width: "100%", maxWidth: "520px", background: "var(--color-surface, #FFFFFF)", border: "1px solid var(--color-border, #E6E2D9)", borderRadius: "14px", padding: "18px 18px 12px", overflowX: "auto", boxShadow: "0 12px 30px rgba(31, 31, 31, 0.06)" }}>
      <div style={{ fontSize: "0.78rem", color: "var(--color-subtext, #6B6B6B)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "12px" }}>
        Google Sheets Progress
      </div>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Google Sheets session history graph">
        {yTicks.map((tick) => (
          <g key={tick}>
            <line x1={padding.left} y1={scaleY(tick)} x2={width - padding.right} y2={scaleY(tick)} stroke="#E6E2D9" strokeDasharray="4 4" />
            <text x={padding.left - 10} y={scaleY(tick) + 4} fill="#7f7a9e" fontSize="11" textAnchor="end">
              {tick}
            </text>
          </g>
        ))}
        <line x1={padding.left} y1={padding.top} x2={padding.left} y2={height - padding.bottom} stroke="#BDB6AB" />
        <line x1={padding.left} y1={height - padding.bottom} x2={width - padding.right} y2={height - padding.bottom} stroke="#BDB6AB" />
        <text x={width / 2} y={height - 8} fill="#7f7a9e" fontSize="11" textAnchor="middle">
          Session Date
        </text>
        <text x={16} y={height / 2} fill="#7f7a9e" fontSize="11" textAnchor="middle" transform={`rotate(-90 16 ${height / 2})`}>
          Score
        </text>
        {path && <path d={path} fill="none" stroke="#34d399" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />}
        {points.map((point) => (
          <g key={point.sessionId || point.index}>
            <circle cx={scaleX(point.x)} cy={scaleY(point.y)} r="4" fill="#34d399" />
            {point.label && (
              <text x={scaleX(point.x)} y={height - padding.bottom + 16} fill="#7f7a9e" fontSize="10" textAnchor="middle">
                {point.label}
              </text>
            )}
            <title>{[
              point.label ? `Date: ${point.label}` : null,
              `Score: ${point.y}%`,
              point.trialCount ? `Cards: ${point.trialCount}` : null,
              point.firstGuessAccuracy != null ? `First Guess: ${Math.round(point.firstGuessAccuracy * 100)}%` : null,
              point.weightedScore != null ? `Weighted: ${Math.round(point.weightedScore * 100)}%` : null,
              point.zScore != null ? `Z-Score: ${point.zScore.toFixed(2)}` : null,
              point.pValue != null ? `P-Value: ${point.pValue.toFixed(4)}` : null,
            ].filter(Boolean).join(" • ")}</title>
          </g>
        ))}
      </svg>
    </div>
  );
}

export function SoloResults({ data, onRestart, googleAuth, googleSheet }) {
  const [viewData, setViewData] = useState(data);
  const [viewMode, setViewMode] = useState(() => (data?.openedFromGoogleResults ? "overview" : "session"));
  const [importError, setImportError] = useState("");
  const [importStatus, setImportStatus] = useState("");
  const [googleHistory, setGoogleHistory] = useState([]);
  const [googleHistoryUser, setGoogleHistoryUser] = useState(() => (data?.name || ""));
  const [googleHistoryStatus, setGoogleHistoryStatus] = useState("");
  const [googleHistoryError, setGoogleHistoryError] = useState("");
  const [googleSaveStatus, setGoogleSaveStatus] = useState("");
  const [googleSaveError, setGoogleSaveError] = useState("");
  const [isSavingToGoogle, setIsSavingToGoogle] = useState(false);
  const [hasSavedRecovery, setHasSavedRecovery] = useState(false);

  useEffect(() => {
    setViewData(data);
    setHasSavedRecovery(false);
    setGoogleSaveStatus("");
    setGoogleSaveError("");
    if (Array.isArray(data?.googleHistory) && data.googleHistory.length > 0) {
      setGoogleHistory(data.googleHistory);
      setGoogleHistoryStatus(`Loaded ${data.googleHistory.length} sessions from Google Sheets.`);
      setGoogleHistoryError("");
      if (data?.openedFromGoogleResults) {
        setViewMode("overview");
        setGoogleHistoryUser(data?.name || "");
      }
    }
  }, [data]);

  useEffect(() => {
    speak("Results.");
  }, []);

  const { name, results, colors, category, analytics, appMode, shareCode, guessPolicy, deckPolicy, trials } = viewData;
  const avgAcc  = results.length ? Math.round(results.reduce((a, r) => a + r.acc, 0) / results.length) : 0;
  const proxArr = results.filter(r => r.prox !== null).map(r => r.prox);
  const avgProx = proxArr.length ? Math.round(proxArr.reduce((a, b) => a + b, 0) / proxArr.length) : null;
  const isOneShot = guessPolicy === GUESS_POLICIES.ONE_SHOT;
  const modeCards = [
    appMode === SESSION_MODES.SHARED ? "Shared Calibration" : appMode === SESSION_MODES.SOLO ? "Solo Calibration" : null,
    guessPolicy ? (guessPolicy === GUESS_POLICIES.ONE_SHOT ? "One Shot" : "Repeat Until Correct") : null,
    deckPolicy ? (deckPolicy === DECK_POLICIES.BALANCED_DECK ? "Balanced Deck" : "Independent Draws") : null,
  ].filter(Boolean);
  const firstGuessAccuracy = analytics?.firstGuessAccuracy != null ? Math.round(analytics.firstGuessAccuracy * 100) : null;
  const weightedScore = analytics?.weightedScore != null ? Math.round(analytics.weightedScore * 100) : null;
  const averageGuessPosition = analytics?.averageGuessPosition ?? null;
  const guessPositionStdDev = analytics?.guessPositionStdDev ?? null;
  const zScore = analytics?.zScore ?? null;
  const pValue = analytics?.pValue ?? null;
  const headerSubtitle = useMemo(() => {
    if (viewData.importedFromCsv) return `${name} · imported CSV`;
    return name;
  }, [name, viewData.importedFromCsv]);

  const exportSessionCsv = () => {
    downloadCsv(buildResultsFilename(name, category), buildSoloResultsCsv(viewData));
  };

  const exportUserHistoryCsv = () => {
    const selectedUser = googleHistoryUser || viewData.name;
    if (!selectedUser) {
      return;
    }

    const sessions = googleHistory.filter((session) => session?.name === selectedUser);
    if (sessions.length === 0) {
      return;
    }

    downloadCsv(buildUserHistoryFilename(selectedUser), buildSoloHistoryResultsCsv(sessions));
  };

  const importCsv = async (file) => {
    if (!file) return;

    try {
      const text = await file.text();
      const imported = parseSoloResultsCsv(text);
      setViewData(imported);
      setImportStatus(`Loaded ${imported.results.length} cards from ${file.name}.`);
      setImportError("");
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Unable to import that CSV.");
      setImportStatus("");
    }
  };

  const loadGoogleHistory = async () => {
    if (!googleAuth?.accessToken || googleAuth?.status !== "connected") {
      setGoogleHistoryError("Connect Google before loading Google Sheets history.");
      setGoogleHistoryStatus("");
      return;
    }

    if (!googleSheet?.spreadsheetId) {
      setGoogleHistoryError("Choose or create a Google sheet before loading history.");
      setGoogleHistoryStatus("");
      return;
    }

    try {
      const rows = await readTrialsSheetRows(googleAuth.accessToken, googleSheet.spreadsheetId);
      const sessions = buildSoloHistoryFromGoogleSheetRows(rows);
      setGoogleHistory(sessions);
      setGoogleHistoryStatus(`Loaded ${sessions.length} sessions from Google Sheets.`);
      setGoogleHistoryError("");
      setViewMode("overview");
    } catch (error) {
      setGoogleHistory([]);
      setGoogleHistoryError(error instanceof Error ? error.message : "Unable to load Google Sheets history.");
      setGoogleHistoryStatus("");
    }
  };

  const isRecoveredSession = Boolean(data?.interruptedFromRecovery || viewData?.interruptedFromRecovery);

  const saveInterruptedSessionToGoogle = async () => {
    setGoogleSaveStatus("");
    setGoogleSaveError("");

    if (!isRecoveredSession) {
      return;
    }

    if (!googleAuth?.accessToken || googleAuth?.status !== "connected") {
      setGoogleSaveError("Connect Google before saving this recovered session.");
      return;
    }

    if (!googleSheet?.spreadsheetId) {
      setGoogleSaveError("Choose or create a Google sheet before saving this recovered session.");
      return;
    }

    try {
      setIsSavingToGoogle(true);
      const appendResult = await appendSoloTrials(googleAuth.accessToken, googleSheet.spreadsheetId, viewData);
      setGoogleSaveStatus(`Saved ${appendResult.appendedRowCount} trial rows to Google Sheets.`);
      setGoogleSaveError("");
      setHasSavedRecovery(true);
    } catch (error) {
      setGoogleSaveError(error instanceof Error ? error.message : "Unable to save this recovered session to Google Sheets.");
      setGoogleSaveStatus("");
    } finally {
      setIsSavingToGoogle(false);
    }
  };

  const googleHistoryUserNames = useMemo(() => {
    const names = new Set(googleHistory.map((session) => session?.name).filter(Boolean));
    return [...names].sort((a, b) => String(a).localeCompare(String(b)));
  }, [googleHistory]);

  const filteredGoogleHistory = useMemo(() => {
    const selectedUser = googleHistoryUser || viewData.name;
    if (!selectedUser) {
      return [];
    }

    return googleHistory.filter((session) => session?.name === selectedUser);
  }, [googleHistory, googleHistoryUser, viewData.name]);

  const overviewAnalytics = useMemo(() => {
    if (!Array.isArray(filteredGoogleHistory) || filteredGoogleHistory.length === 0) {
      return null;
    }

    const overviewTrials = filteredGoogleHistory.flatMap((session) => Array.isArray(session?.trials) ? session.trials : []);
    if (overviewTrials.length === 0) {
      return null;
    }

    const optionCountHistogram = new Map();
    for (const trial of overviewTrials) {
      const optionCount = trial?.optionCount;
      if (!Number.isFinite(optionCount) || optionCount <= 0) continue;
      optionCountHistogram.set(optionCount, (optionCountHistogram.get(optionCount) || 0) + 1);
    }

    let modeOptionCount = null;
    for (const [optionCount, count] of optionCountHistogram.entries()) {
      if (modeOptionCount == null || count > (optionCountHistogram.get(modeOptionCount) || 0)) {
        modeOptionCount = optionCount;
      }
    }

    const optionValues = [...new Set(overviewTrials.map((trial) => trial?.targetValue).filter((value) => typeof value === "string" && value.length > 0))];

    return {
      trialCount: overviewTrials.length,
      optionCount: modeOptionCount,
      analytics: buildSessionAnalytics({
        trials: overviewTrials,
        optionValues,
        optionCount: modeOptionCount,
        guessPolicy: GUESS_POLICIES.REPEAT_UNTIL_CORRECT,
      }),
    };
  }, [filteredGoogleHistory]);

  useEffect(() => {
    if (googleHistoryUserNames.length === 0) {
      return;
    }

    const latestUser = filteredGoogleHistory.length > 0
      ? filteredGoogleHistory[filteredGoogleHistory.length - 1]?.name
      : (googleHistory[googleHistory.length - 1]?.name || "");

    const defaultUser = viewData.name || latestUser || googleHistoryUserNames[0] || "";

    if (!defaultUser) {
      return;
    }

    if (!googleHistoryUser || !googleHistoryUserNames.includes(googleHistoryUser)) {
      setGoogleHistoryUser(defaultUser);
    }
  }, [filteredGoogleHistory, googleHistory, googleHistoryUser, googleHistoryUserNames, viewData.name]);

  return (
    <div style={{ minHeight: "100vh", background: "var(--color-bg, #F7F6F2)", fontFamily: "'Georgia', serif", color: "var(--color-text, #1F1F1F)", padding: "40px 24px", display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontSize: "2rem", fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--color-primary, #2F5D50)", marginBottom: "6px" }}>Results</div>
      <div style={{ fontSize: "0.7rem", color: "var(--color-subtext, #6B6B6B)", letterSpacing: "0.2em", marginBottom: "32px", textTransform: "uppercase" }}>{headerSubtitle}</div>

      {isRecoveredSession && !hasSavedRecovery && (
        <div style={{ width: "100%", maxWidth: "520px", background: "var(--color-surface, #FFFFFF)", border: "1px solid rgba(197, 139, 43, 0.4)", borderRadius: "12px", padding: "12px 14px", marginBottom: "18px", boxSizing: "border-box" }}>
          <div style={{ fontSize: "0.66rem", color: "#fbbf24", letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: "8px" }}>
            Recovered Session
          </div>
          <div style={{ fontSize: "0.72rem", color: "var(--color-text, #1F1F1F)", lineHeight: 1.6, marginBottom: "12px" }}>
            This test was recovered after an interruption. Save it to Google Sheets to keep it in your history.
          </div>
          <button
            onClick={saveInterruptedSessionToGoogle}
            disabled={isSavingToGoogle}
            style={{ width: "100%", background: isSavingToGoogle ? "var(--color-surface-soft, #FBFAF7)" : "transparent", border: "1px solid rgba(58, 125, 68, 0.4)", borderRadius: "10px", color: isSavingToGoogle ? "var(--color-subtext, #6B6B6B)" : "var(--color-success, #3A7D44)", padding: "12px 14px", fontSize: "0.82rem", fontFamily: "Cormorant Garamond, Georgia, serif", letterSpacing: "0.12em", textTransform: "uppercase", cursor: isSavingToGoogle ? "wait" : "pointer" }}
          >
            {isSavingToGoogle ? "Saving..." : "Save to Google Sheets"}
          </button>
        </div>
      )}

      {googleHistory.length > 0 && (
        <div style={{ width: "100%", maxWidth: "520px", display: "flex", justifyContent: "space-between", gap: "10px", flexWrap: "wrap", alignItems: "center", marginBottom: "18px" }}>
          <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ fontSize: "0.66rem", color: "var(--color-primary, #2F5D50)", letterSpacing: "0.16em", textTransform: "uppercase" }}>History</div>
            {googleHistoryUserNames.length > 1 && (
              <select
                value={googleHistoryUser || viewData.name || ""}
                onChange={(event) => setGoogleHistoryUser(event.target.value)}
                style={{ background: "var(--color-surface, #FFFFFF)", border: "1px solid var(--color-border, #E6E2D9)", borderRadius: "10px", color: "var(--color-text, #1F1F1F)", padding: "8px 10px", fontSize: "0.78rem" }}
              >
                {googleHistoryUserNames.map((nameOption) => (
                  <option key={nameOption} value={nameOption}>
                    {nameOption}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button
              onClick={() => setViewMode("overview")}
              style={{ background: viewMode === "overview" ? "#E7F0EC" : "transparent", border: "1px solid var(--color-border, #E6E2D9)", borderRadius: "10px", color: "var(--color-primary, #2F5D50)", padding: "8px 12px", fontSize: "0.72rem", letterSpacing: "0.12em", textTransform: "uppercase", cursor: "pointer" }}
            >
              Overview
            </button>
            <button
              onClick={() => setViewMode("session")}
              style={{ background: viewMode === "session" ? "#E7F0EC" : "transparent", border: "1px solid var(--color-border, #E6E2D9)", borderRadius: "10px", color: "var(--color-primary, #2F5D50)", padding: "8px 12px", fontSize: "0.72rem", letterSpacing: "0.12em", textTransform: "uppercase", cursor: "pointer" }}
            >
              Session
            </button>
          </div>
        </div>
      )}

      {googleHistory.length > 0 && viewMode === "overview" && (
        <div style={{ width: "100%", maxWidth: "520px", display: "flex", flexDirection: "column", gap: "14px", marginBottom: "26px" }}>
          {overviewAnalytics?.analytics && (
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", justifyContent: "center" }}>
              <StatCard
                label="First Guess"
                value={`${Math.round((overviewAnalytics.analytics.firstGuessAccuracy ?? 0) * 100)}%`}
                color={(overviewAnalytics.analytics.firstGuessAccuracy ?? 0) >= 0.7 ? "#22c55e" : (overviewAnalytics.analytics.firstGuessAccuracy ?? 0) >= 0.4 ? "#eab308" : "#ef4444"}
              />
              {overviewAnalytics.analytics.zScore != null && (
                <StatCard
                  label="Z-Score"
                  value={overviewAnalytics.analytics.zScore.toFixed(2)}
                  color={overviewAnalytics.analytics.zScore >= 2 ? "#22c55e" : overviewAnalytics.analytics.zScore >= 1 ? "#eab308" : "#f97316"}
                />
              )}
              {overviewAnalytics.analytics.pValue != null && (
                <StatCard
                  label="P-Value"
                  value={overviewAnalytics.analytics.pValue.toFixed(4)}
                  color={overviewAnalytics.analytics.pValue <= 0.05 ? "#22c55e" : overviewAnalytics.analytics.pValue <= 0.1 ? "#eab308" : "#f97316"}
                />
              )}
              {overviewAnalytics.analytics.averageGuessPosition != null && (
                <StatCard label="Avg Guess Pos" value={overviewAnalytics.analytics.averageGuessPosition.toFixed(2)} color="#60a5fa" />
              )}
              {overviewAnalytics.analytics.guessPositionStdDev != null && (
                <StatCard label="Guess Std Dev" value={overviewAnalytics.analytics.guessPositionStdDev.toFixed(2)} color="#93c5fd" />
              )}
              {overviewAnalytics.analytics.weightedScore != null && (
                <StatCard
                  label="Weighted Score"
                  value={`${Math.round(overviewAnalytics.analytics.weightedScore * 100)}%`}
                  color={overviewAnalytics.analytics.weightedScore >= 0.7 ? "#22c55e" : overviewAnalytics.analytics.weightedScore >= 0.4 ? "#eab308" : "#ef4444"}
                />
              )}
              <StatCard label="Cards" value={overviewAnalytics.trialCount} color="#60a5fa" />
            </div>
          )}
          <div style={{ width: "100%", display: "flex", justifyContent: "center" }}>
            <SoloHistoryGraph sessions={filteredGoogleHistory} />
          </div>
          <div style={{ background: "var(--color-surface, #FFFFFF)", border: "1px solid var(--color-border, #E6E2D9)", borderRadius: "14px", padding: "14px 16px", boxShadow: "0 12px 30px rgba(31, 31, 31, 0.06)" }}>
            <div style={{ fontSize: "0.72rem", color: "var(--color-subtext, #6B6B6B)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "10px" }}>
              Sessions ({filteredGoogleHistory.length})
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {[...filteredGoogleHistory].slice().reverse().slice(0, 40).map((session) => {
                const endedAt = session?.endedAt || session?.startedAt || "";
                const dateLabel = endedAt ? new Date(endedAt).toLocaleDateString("en-US") : "";
                const score = session?.guessPolicy === GUESS_POLICIES.ONE_SHOT
                  ? session?.analytics?.firstGuessAccuracy
                  : session?.analytics?.weightedScore ?? session?.analytics?.firstGuessAccuracy;
                const scorePercent = score != null ? Math.round(score * 100) : null;

                return (
                  <button
                    key={session.sessionId || `${session.name}-${endedAt}`}
                    onClick={() => {
                      setViewData(session);
                      setViewMode("session");
                    }}
                    style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", textAlign: "left", background: "var(--color-surface-soft, #FBFAF7)", border: "1px solid var(--color-border, #E6E2D9)", borderRadius: "12px", padding: "12px 12px", cursor: "pointer" }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                      <div style={{ fontSize: "0.86rem", color: "var(--color-text, #1F1F1F)", fontWeight: 600 }}>
                        {session.name || "Session"}
                        {session.category ? <span style={{ marginLeft: "10px", fontSize: "0.68rem", color: "#6b5aaa", letterSpacing: "0.14em", textTransform: "uppercase" }}>{session.category}</span> : null}
                      </div>
                      <div style={{ fontSize: "0.7rem", color: "#7f7a9e", letterSpacing: "0.06em" }}>
                        {dateLabel}
                        {session.guessPolicy ? ` · ${session.guessPolicy === GUESS_POLICIES.ONE_SHOT ? "One Shot" : "Repeat Until Correct"}` : ""}
                        {session.deckPolicy ? ` · ${session.deckPolicy === DECK_POLICIES.BALANCED_DECK ? "Balanced" : "Independent"}` : ""}
                        {session.trials?.length ? ` · ${session.trials.length} cards` : ""}
                      </div>
                    </div>
                    <div style={{ fontSize: "0.86rem", fontWeight: 700, color: scorePercent != null ? (scorePercent >= 70 ? "#22c55e" : scorePercent >= 40 ? "#eab308" : "#ef4444") : "#9090bb" }}>
                      {scorePercent != null ? `${scorePercent}%` : "—"}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {viewMode === "session" && (
        <>
          {modeCards.length > 0 && (
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "center", marginBottom: "20px" }}>
              {modeCards.map((label) => (
                <div key={label} style={{ border: "1px solid var(--color-border, #E6E2D9)", borderRadius: "999px", padding: "6px 12px", fontSize: "0.68rem", color: "var(--color-primary, #2F5D50)", letterSpacing: "0.08em", textTransform: "uppercase", background: "var(--color-surface, #FFFFFF)" }}>
                  {label}
                </div>
              ))}
            </div>
          )}
          {shareCode && (
            <div style={{ width: "100%", maxWidth: "520px", background: "var(--color-surface, #FFFFFF)", border: "1px solid var(--color-border, #E6E2D9)", borderRadius: "12px", padding: "14px 16px", marginBottom: "20px", boxSizing: "border-box" }}>
              <div style={{ fontSize: "0.66rem", color: "var(--color-primary, #2F5D50)", letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: "8px" }}>
                Shared Session
              </div>
              <div style={{ fontSize: "0.72rem", color: "var(--color-text, #1F1F1F)", lineHeight: 1.7, wordBreak: "break-all", overflowWrap: "anywhere" }}>
                {shareCode}
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: "16px", marginBottom: "32px", flexWrap: "wrap", justifyContent: "center" }}>
            {firstGuessAccuracy !== null ? (
              <StatCard label="First Guess" value={`${firstGuessAccuracy}%`} color={firstGuessAccuracy >= 70 ? "#22c55e" : firstGuessAccuracy >= 40 ? "#eab308" : "#ef4444"} />
            ) : (
              <StatCard label="Avg Accuracy" value={`${avgAcc}%`} color={avgAcc >= 70 ? "#22c55e" : avgAcc >= 40 ? "#eab308" : "#ef4444"} />
            )}
            {zScore !== null && <StatCard label="Z-Score" value={zScore.toFixed(2)} color={zScore >= 2 ? "#22c55e" : zScore >= 1 ? "#eab308" : "#f97316"} />}
            {pValue !== null && <StatCard label="P-Value" value={pValue.toFixed(4)} color={pValue <= 0.05 ? "#22c55e" : pValue <= 0.1 ? "#eab308" : "#f97316"} />}
            {!isOneShot && averageGuessPosition !== null && <StatCard label="Avg Guess Pos" value={averageGuessPosition.toFixed(2)} color="#60a5fa" />}
            {!isOneShot && guessPositionStdDev !== null && <StatCard label="Guess Std Dev" value={guessPositionStdDev.toFixed(2)} color="#93c5fd" />}
            {!isOneShot && weightedScore !== null && <StatCard label="Weighted Score" value={`${weightedScore}%`} color={weightedScore >= 70 ? "#22c55e" : weightedScore >= 40 ? "#eab308" : "#ef4444"} />}
            {avgProx !== null && <StatCard label="Avg Proximity" value={`${avgProx}%`} color="#a78bfa" />}
            <StatCard label="Cards" value={results.length} color="#60a5fa" />
          </div>

          {Array.isArray(trials) && trials.some((trial) => trial.trialDurationMs != null) && (
            <div style={{ width: "100%", display: "flex", justifyContent: "center", marginBottom: "24px" }}>
              <SoloAccuracyGraph trials={trials} guessPolicy={guessPolicy} />
            </div>
          )}

          {!Array.isArray(trials) && (
            <div style={{ width: "100%", maxWidth: "520px", display: "flex", flexDirection: "column", gap: "8px" }}>
            {results.map((r, i) => {
              const tgt = colors.find(c => c.name === r.target);
          return (
            <div key={i} style={{ background: "var(--color-surface, #FFFFFF)", border: "1px solid var(--color-border, #E6E2D9)", borderRadius: "8px", padding: "10px 14px", borderLeft: `3px solid ${tgt?.hex}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "5px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "1rem" }}>{tgt?.symbol}</span>
                  <span style={{ fontSize: "0.8rem", color: tgt?.hex, fontWeight: 600 }}>{r.target}</span>
                  <span style={{ fontSize: "0.65rem", color: "#4a4a6a" }}>card {i + 1}</span>
                </div>
                <div style={{ display: "flex", gap: "10px", fontSize: "0.68rem" }}>
                  <span style={{ color: r.acc >= 70 ? "#22c55e" : r.acc >= 40 ? "#eab308" : "#ef4444" }}>Acc {r.acc}%</span>
                  {r.prox !== null && <span style={{ color: "#a78bfa" }}>Prox {r.prox}%</span>}
                  {r.pattern && <span style={{ color: "var(--color-subtext, #6B6B6B)", fontStyle: "italic" }}>{r.pattern}</span>}
                </div>
              </div>
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                {r.guesses.map((g, gi) => {
                  const gc = colors.find(c => c.name === g);
                  const isCorr = gi === r.guesses.length - 1 && !r.skipped;
                  return (
                    <div key={gi} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      {gi > 0 && <span style={{ color: "#252535", fontSize: "0.5rem" }}>{"->"}</span>}
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px", padding: "4px 10px", borderRadius: "8px", background: gc?.hex + (isCorr ? "33" : "15"), border: `1px solid ${gc?.hex}${isCorr ? "" : "55"}`, color: gc?.hex }}>
                        <span style={{ fontSize: "0.95rem", lineHeight: 1, color: isCorr ? gc?.hex : "#ffffff" }}>{gc?.symbol}</span>
                        <span style={{ fontSize: "0.65rem", lineHeight: 1, fontWeight: isCorr ? 700 : 400 }}>{g}{isCorr ? " *" : ""}</span>
                      </div>
                    </div>
                  );
                })}
                {r.skipped && <span style={{ fontSize: "0.65rem", color: "var(--color-subtext, #6B6B6B)", fontStyle: "italic", alignSelf: "center" }}>skipped</span>}
              </div>
            </div>
          );
            })}
            </div>
          )}
        </>
      )}
      <div style={{ display: "flex", gap: "12px", marginTop: "32px", flexWrap: "wrap", justifyContent: "center" }}>
        <CsvImportButton
          onSelect={importCsv}
          buttonStyle={{ background: "transparent", border: "1px solid rgba(197, 139, 43, 0.45)", borderRadius: "10px", color: "var(--color-warning, #C58B2B)", padding: "13px 36px", fontSize: "0.9rem", fontFamily: "Cormorant Garamond, Georgia, serif", letterSpacing: "0.15em", textTransform: "uppercase", cursor: "pointer" }}
          statusStyle={{ fontSize: "0.68rem", color: "#d6b06b", marginTop: "12px", letterSpacing: "0.04em", lineHeight: 1.6 }}
        />
        {googleHistory.length > 0 && (
          <button onClick={exportUserHistoryCsv} style={{ background: "transparent", border: "1px solid rgba(58, 125, 68, 0.45)", borderRadius: "10px", color: "var(--color-success, #3A7D44)", padding: "13px 36px", fontSize: "0.9rem", fontFamily: "Cormorant Garamond, Georgia, serif", letterSpacing: "0.15em", textTransform: "uppercase", cursor: "pointer" }}>
            Download Selected User History
          </button>
        )}
        <button onClick={exportSessionCsv} style={{ background: "transparent", border: "1px solid rgba(58, 125, 68, 0.45)", borderRadius: "10px", color: "var(--color-success, #3A7D44)", padding: "13px 36px", fontSize: "0.9rem", fontFamily: "Cormorant Garamond, Georgia, serif", letterSpacing: "0.15em", textTransform: "uppercase", cursor: "pointer" }}>
          Download This Session
        </button>
        <button onClick={loadGoogleHistory} style={{ background: "transparent", border: "1px solid rgba(58, 125, 68, 0.45)", borderRadius: "10px", color: "var(--color-success, #3A7D44)", padding: "13px 36px", fontSize: "0.9rem", fontFamily: "Cormorant Garamond, Georgia, serif", letterSpacing: "0.15em", textTransform: "uppercase", cursor: "pointer" }}>
          Refresh Google History
        </button>
        <button onClick={onRestart} style={{ background: "transparent", border: "1px solid var(--color-border, #E6E2D9)", borderRadius: "10px", color: "var(--color-subtext, #6B6B6B)", padding: "13px 36px", fontSize: "0.9rem", fontFamily: "Cormorant Garamond, Georgia, serif", letterSpacing: "0.15em", textTransform: "uppercase", cursor: "pointer" }}>
          Back to Setup
        </button>
      </div>
      {(importStatus || importError || googleHistoryStatus || googleHistoryError || googleSaveStatus || googleSaveError) && (
        <div style={{ marginTop: "16px", fontSize: "0.72rem", color: importError || googleHistoryError ? "var(--color-error, #A94442)" : "var(--color-success, #3A7D44)", letterSpacing: "0.04em", lineHeight: 1.6 }}>
          {importError || googleHistoryError || googleSaveError || googleSaveStatus || googleHistoryStatus || importStatus}
        </div>
      )}
    </div>
  );
}
