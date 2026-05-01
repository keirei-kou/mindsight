import { useEffect, useState } from 'react';
import { CsvImportButton } from '../components/CsvImportButton.jsx';
import { buildGroupParticipantCsv, buildGroupResultsCsv, buildResultsFilename, downloadCsv, parseGroupResultsCsv } from '../lib/csv.js';
import { buildGroupParticipantSummary, buildGroupRollupSummary } from '../lib/groupAnalytics.js';
import { GUESS_POLICIES } from '../lib/sessionModel.js';
import { fmt } from '../lib/utils.js';

function getParticipantCell(data, participantId, slotIndex) {
  return data.session?.[participantId]?.[slotIndex] ?? { guesses: [], dnf: false };
}

function getParticipantCardStats(data, participant) {
  return data.slots.map((slot, index) => {
    const cell = getParticipantCell(data, participant.id, index);
    const guesses = cell.guesses ?? [];
    const resolved = guesses.length > 0 && guesses[guesses.length - 1].color === slot.name;
    const accuracy = resolved ? Math.round((1 / Math.max(1, guesses.length)) * 100) : 0;
    const slotTimer = data.timers?.[index] ?? {};
    const fallbackEnd = guesses.length ? guesses[guesses.length - 1].ts : slotTimer.endMs ?? slotTimer.startMs ?? null;
    return {
      index,
      target: slot.name,
      guesses: guesses.map(g => g.color),
      skipped: Boolean(cell.dnf),
      resolved,
      accuracy,
      elapsedMs: slotTimer.startMs && fallbackEnd ? fallbackEnd - slotTimer.startMs : null,
      xMs: slotTimer.startMs && fallbackEnd ? fallbackEnd - (data.timers?.[0]?.startMs ?? slotTimer.startMs) : null,
    };
  });
}

function getGuessPolicy(viewData) {
  return viewData.guessPolicy ?? GUESS_POLICIES.REPEAT_UNTIL_CORRECT;
}

function buildGraphSeries(data) {
  return data.participants.map((participant, seriesIndex) => {
    const stats = getParticipantCardStats(data, participant);
    const points = stats
      .filter(card => card.xMs != null)
      .map(card => ({ x: card.xMs, y: card.accuracy, card: card.index + 1 }));

    return {
      participant,
      color: ["#60a5fa", "#f472b6", "#34d399", "#f59e0b", "#a78bfa", "#fb7185"][seriesIndex % 6],
      points,
    };
  });
}

function AccuracyGraph({ data }) {
  const width = 920;
  const height = 320;
  const padding = { top: 20, right: 24, bottom: 40, left: 48 };
  const series = buildGraphSeries(data);
  const allPoints = series.flatMap(item => item.points);
  const maxX = allPoints.length ? Math.max(...allPoints.map(point => point.x), 1) : 1;
  const graphWidth = width - padding.left - padding.right;
  const graphHeight = height - padding.top - padding.bottom;
  const yTicks = [0, 25, 50, 75, 100];

  const scaleX = (value) => padding.left + (value / maxX) * graphWidth;
  const scaleY = (value) => padding.top + ((100 - value) / 100) * graphHeight;

  return (
    <div style={{ background: "var(--color-surface, #FFFFFF)", border: "1px solid var(--color-border, #E6E2D9)", borderRadius: "14px", padding: "18px 18px 12px", overflowX: "auto", boxShadow: "0 12px 30px rgba(31, 31, 31, 0.06)" }}>
      <div style={{ fontSize: "0.82rem", color: "var(--color-subtext, #6B6B6B)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "12px" }}>Accuracy Over Time</div>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Group accuracy graph">
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
        <text x={18} y={height / 2} fill="#7f7a9e" fontSize="11" textAnchor="middle" transform={`rotate(-90 18 ${height / 2})`}>
          Accuracy
        </text>
        {series.map((item) => {
          if (item.points.length === 0) return null;
          const path = item.points.map((point, index) => `${index === 0 ? "M" : "L"} ${scaleX(point.x)} ${scaleY(point.y)}`).join(" ");
          return (
            <g key={item.participant.id}>
              <path d={path} fill="none" stroke={item.color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
              {item.points.map((point) => (
                <g key={`${item.participant.id}-${point.card}`}>
                  <circle cx={scaleX(point.x)} cy={scaleY(point.y)} r="4" fill={item.color} />
                  <title>{`${item.participant.name}: card ${point.card}, ${point.y}% accuracy at ${fmt(point.x)}`}</title>
                </g>
              ))}
            </g>
          );
        })}
      </svg>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginTop: "10px" }}>
        {series.map((item) => (
          <div key={item.participant.id} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.74rem", color: "var(--color-text, #1F1F1F)" }}>
            <span style={{ width: "10px", height: "10px", borderRadius: "999px", background: item.color, display: "inline-block" }} />
            <span>{item.participant.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function GroupResults({ data, onRestart, onBack }) {
  const [viewData, setViewData] = useState(data);
  const [importError, setImportError] = useState("");
  const [importStatus, setImportStatus] = useState("");

  useEffect(() => {
    setViewData(data);
  }, [data]);

  const guessPolicy = getGuessPolicy(viewData);
  const participantSummaries = viewData.participants.map((participant) => {
    return buildGroupParticipantSummary({
      participant,
      session: viewData.session,
      slots: viewData.slots,
      activeOptions: viewData.colors,
      category: viewData.category,
      guessPolicy,
      deckPolicy: viewData.deckPolicy,
      timers: viewData.timers,
    });
  });
  const rollupSummary = buildGroupRollupSummary(participantSummaries, guessPolicy);

  const exportAllCsv = () => {
    downloadCsv(buildResultsFilename("group", viewData.category), buildGroupResultsCsv(viewData));
  };

  const importCsv = async (file) => {
    if (!file) return;

    try {
      const text = await file.text();
      const imported = parseGroupResultsCsv(text);
      setViewData(imported);
      setImportStatus(`Loaded ${imported.participants.length} participants from ${file.name}.`);
      setImportError("");
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Unable to import that CSV.");
      setImportStatus("");
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--color-bg, #F7F6F2)", color: "var(--color-text, #1F1F1F)", fontFamily: "'Georgia', serif", padding: "32px 24px 40px" }}>
      <div style={{ maxWidth: "1180px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "22px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "20px", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontSize: "2rem", fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--color-primary, #2F5D50)" }}>
              Group Results
            </div>
            <div style={{ fontSize: "0.72rem", color: "var(--color-subtext, #6B6B6B)", letterSpacing: "0.12em", textTransform: "uppercase", marginTop: "6px" }}>
              {viewData.category} · {viewData.participants.length} participants · {viewData.slots.length} cards{viewData.importedFromCsv ? " · imported CSV" : ""}
            </div>
          </div>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "flex-start" }}>
            <CsvImportButton
              onSelect={importCsv}
              buttonStyle={{ background: "transparent", border: "1px solid rgba(197, 139, 43, 0.45)", borderRadius: "10px", color: "var(--color-warning, #C58B2B)", padding: "13px 20px", fontSize: "0.85rem", fontFamily: "Cormorant Garamond, Georgia, serif", letterSpacing: "0.12em", textTransform: "uppercase", cursor: "pointer" }}
              statusStyle={{ fontSize: "0.68rem", color: "#d6b06b", marginTop: "8px", letterSpacing: "0.04em", lineHeight: 1.5 }}
            />
            <button onClick={exportAllCsv} style={{ background: "transparent", border: "1px solid rgba(58, 125, 68, 0.45)", borderRadius: "10px", color: "var(--color-success, #3A7D44)", padding: "13px 20px", fontSize: "0.85rem", fontFamily: "Cormorant Garamond, Georgia, serif", letterSpacing: "0.12em", textTransform: "uppercase", cursor: "pointer" }}>
              Download All Users Data
            </button>
            <button onClick={onBack} style={{ background: "transparent", border: "1px solid rgba(47, 93, 80, 0.45)", borderRadius: "10px", color: "var(--color-primary, #2F5D50)", padding: "13px 20px", fontSize: "0.85rem", fontFamily: "Cormorant Garamond, Georgia, serif", letterSpacing: "0.12em", textTransform: "uppercase", cursor: "pointer" }}>
              Back to Tracker
            </button>
            <button onClick={onRestart} style={{ background: "transparent", border: "1px solid var(--color-border, #E6E2D9)", borderRadius: "10px", color: "var(--color-subtext, #6B6B6B)", padding: "13px 20px", fontSize: "0.85rem", fontFamily: "Cormorant Garamond, Georgia, serif", letterSpacing: "0.12em", textTransform: "uppercase", cursor: "pointer" }}>
              Back to Setup
            </button>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {participantSummaries.map((participantSummary) => {
            const participant = participantSummary.participant;
            const firstGuessPercent = participantSummary.analytics?.firstGuessAccuracy != null ? Math.round(participantSummary.analytics.firstGuessAccuracy * 100) : null;
            const weightedPercent = participantSummary.analytics?.weightedScore != null ? Math.round(participantSummary.analytics.weightedScore * 100) : null;
            return (
              <div key={participant.id} style={{ background: "var(--color-surface, #FFFFFF)", border: "1px solid var(--color-border, #E6E2D9)", borderRadius: "12px", padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "18px", flexWrap: "wrap", boxShadow: "0 10px 24px rgba(31, 31, 31, 0.05)" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <div style={{ fontSize: "1rem", color: "var(--color-text, #1F1F1F)", fontWeight: 600 }}>{participant.name}</div>
                  <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", fontSize: "0.72rem", color: "var(--color-subtext, #6B6B6B)" }}>
                    {firstGuessPercent !== null && <span>First Guess {firstGuessPercent}%</span>}
                    {guessPolicy !== GUESS_POLICIES.ONE_SHOT && weightedPercent !== null && <span>Weighted {weightedPercent}%</span>}
                    {guessPolicy !== GUESS_POLICIES.ONE_SHOT && participantSummary.analytics?.averageGuessPosition != null && <span>Avg Pos {participantSummary.analytics.averageGuessPosition.toFixed(2)}</span>}
                    {participantSummary.analytics?.zScore != null && <span>Z-Score {participantSummary.analytics.zScore.toFixed(2)}</span>}
                    {participantSummary.analytics?.pValue != null && <span>P-Value {participantSummary.analytics.pValue.toFixed(4)}</span>}
                    <span>Completed {participantSummary.completedCount}/{viewData.slots.length}</span>
                    <span>Skipped {participantSummary.skippedCount}</span>
                    {participantSummary.averageTimeMs !== null && <span>Avg Time {fmt(participantSummary.averageTimeMs)}</span>}
                  </div>
                </div>
                <button
                  onClick={() => downloadCsv(buildResultsFilename(participant.name, viewData.category), buildGroupParticipantCsv(viewData, participant.id))}
                  style={{ background: "transparent", border: "1px solid rgba(58, 125, 68, 0.45)", borderRadius: "10px", color: "var(--color-success, #3A7D44)", padding: "11px 18px", fontSize: "0.78rem", fontFamily: "Cormorant Garamond, Georgia, serif", letterSpacing: "0.12em", textTransform: "uppercase", cursor: "pointer" }}
                >
                  Download {participant.name}
                </button>
              </div>
            );
          })}
        </div>

        {(importStatus || importError) && (
          <div style={{ fontSize: "0.72rem", color: importError ? "var(--color-error, #A94442)" : "var(--color-success, #3A7D44)", letterSpacing: "0.04em", lineHeight: 1.6 }}>
            {importError || importStatus}
          </div>
        )}

        <div style={{ background: "var(--color-surface, #FFFFFF)", border: "1px solid var(--color-border, #E6E2D9)", borderRadius: "12px", padding: "14px 16px", display: "flex", flexDirection: "column", gap: "6px", boxShadow: "0 10px 24px rgba(31, 31, 31, 0.05)" }}>
          <div style={{ fontSize: "0.78rem", color: "var(--color-subtext, #6B6B6B)", letterSpacing: "0.12em", textTransform: "uppercase" }}>Group Rollup</div>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", fontSize: "0.72rem", color: "var(--color-subtext, #6B6B6B)" }}>
            {rollupSummary.firstGuessAccuracy != null && <span>First Guess {Math.round(rollupSummary.firstGuessAccuracy * 100)}%</span>}
            {guessPolicy !== GUESS_POLICIES.ONE_SHOT && rollupSummary.weightedScore != null && <span>Weighted {Math.round(rollupSummary.weightedScore * 100)}%</span>}
            {guessPolicy !== GUESS_POLICIES.ONE_SHOT && rollupSummary.averageGuessPosition != null && <span>Avg Pos {rollupSummary.averageGuessPosition.toFixed(2)}</span>}
            {rollupSummary.zScore != null && <span>Z-Score {rollupSummary.zScore.toFixed(2)}</span>}
            {rollupSummary.pValue != null && <span>P-Value {rollupSummary.pValue.toFixed(4)}</span>}
            {rollupSummary.averageTimeMs != null && <span>Avg Time {fmt(rollupSummary.averageTimeMs)}</span>}
          </div>
        </div>

        <AccuracyGraph data={viewData} />
      </div>
    </div>
  );
}
