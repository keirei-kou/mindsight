import { useEffect, useState } from 'react';
import { CsvImportButton } from '../components/CsvImportButton.jsx';
import { buildGroupParticipantCsv, buildGroupResultsCsv, buildResultsFilename, downloadCsv, parseGroupResultsCsv } from '../csv.js';
import { fmt } from '../utils.js';

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

function getParticipantSummary(stats) {
  const accuracyValues = stats.filter(card => card.guesses.length || card.skipped).map(card => card.accuracy);
  const timeValues = stats.map(card => card.elapsedMs).filter(value => value != null);
  const resolvedCount = stats.filter(card => card.resolved).length;
  const skippedCount = stats.filter(card => card.skipped).length;

  return {
    avgAccuracy: accuracyValues.length ? Math.round(accuracyValues.reduce((sum, value) => sum + value, 0) / accuracyValues.length) : 0,
    avgTimeMs: timeValues.length ? Math.round(timeValues.reduce((sum, value) => sum + value, 0) / timeValues.length) : null,
    resolvedCount,
    skippedCount,
  };
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
    <div style={{ background: "#111118", border: "1px solid #252530", borderRadius: "14px", padding: "18px 18px 12px", overflowX: "auto" }}>
      <div style={{ fontSize: "0.82rem", color: "#b9b4d8", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "12px" }}>Accuracy Over Time</div>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Group accuracy graph">
        {yTicks.map((tick) => (
          <g key={tick}>
            <line x1={padding.left} y1={scaleY(tick)} x2={width - padding.right} y2={scaleY(tick)} stroke="#252530" strokeDasharray="4 4" />
            <text x={padding.left - 10} y={scaleY(tick) + 4} fill="#7f7a9e" fontSize="11" textAnchor="end">
              {tick}
            </text>
          </g>
        ))}
        <line x1={padding.left} y1={padding.top} x2={padding.left} y2={height - padding.bottom} stroke="#3a3a55" />
        <line x1={padding.left} y1={height - padding.bottom} x2={width - padding.right} y2={height - padding.bottom} stroke="#3a3a55" />
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
          <div key={item.participant.id} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.74rem", color: "#c9c3e5" }}>
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
    <div style={{ minHeight: "100vh", background: "#141420", color: "#f0ece4", fontFamily: "'Georgia', serif", padding: "32px 24px 40px" }}>
      <div style={{ maxWidth: "1180px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "22px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "20px", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontSize: "2rem", fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", background: "linear-gradient(120deg, #93c5fd 0%, #a78bfa 40%, #e879f9 70%, #f9a8d4 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              Group Results
            </div>
            <div style={{ fontSize: "0.72rem", color: "#8a84b2", letterSpacing: "0.12em", textTransform: "uppercase", marginTop: "6px" }}>
              {viewData.category} · {viewData.participants.length} participants · {viewData.slots.length} cards{viewData.importedFromCsv ? " · imported CSV" : ""}
            </div>
          </div>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "flex-start" }}>
            <CsvImportButton
              onSelect={importCsv}
              buttonStyle={{ background: "transparent", border: "1px solid #f59e0b66", borderRadius: "10px", color: "#fbbf24", padding: "13px 20px", fontSize: "0.85rem", fontFamily: "Cormorant Garamond, Georgia, serif", letterSpacing: "0.12em", textTransform: "uppercase", cursor: "pointer" }}
              statusStyle={{ fontSize: "0.68rem", color: "#d6b06b", marginTop: "8px", letterSpacing: "0.04em", lineHeight: 1.5 }}
            />
            <button onClick={exportAllCsv} style={{ background: "transparent", border: "1px solid #22c55e66", borderRadius: "10px", color: "#22c55e", padding: "13px 20px", fontSize: "0.85rem", fontFamily: "Cormorant Garamond, Georgia, serif", letterSpacing: "0.12em", textTransform: "uppercase", cursor: "pointer" }}>
              Export All CSV
            </button>
            <button onClick={onBack} style={{ background: "transparent", border: "1px solid #3b82f666", borderRadius: "10px", color: "#93c5fd", padding: "13px 20px", fontSize: "0.85rem", fontFamily: "Cormorant Garamond, Georgia, serif", letterSpacing: "0.12em", textTransform: "uppercase", cursor: "pointer" }}>
              Back to Tracker
            </button>
            <button onClick={onRestart} style={{ background: "transparent", border: "1px solid #252530", borderRadius: "10px", color: "#9090bb", padding: "13px 20px", fontSize: "0.85rem", fontFamily: "Cormorant Garamond, Georgia, serif", letterSpacing: "0.12em", textTransform: "uppercase", cursor: "pointer" }}>
              Back to Setup
            </button>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {viewData.participants.map((participant) => {
            const stats = getParticipantCardStats(viewData, participant);
            const summary = getParticipantSummary(stats);
            return (
              <div key={participant.id} style={{ background: "#181825", border: "1px solid #252530", borderRadius: "12px", padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "18px", flexWrap: "wrap" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <div style={{ fontSize: "1rem", color: "#f0ece4", fontWeight: 600 }}>{participant.name}</div>
                  <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", fontSize: "0.72rem", color: "#9d97c4" }}>
                    <span>Avg Accuracy {summary.avgAccuracy}%</span>
                    <span>Resolved {summary.resolvedCount}/{viewData.slots.length}</span>
                    <span>Skipped {summary.skippedCount}</span>
                    {summary.avgTimeMs !== null && <span>Avg Time {fmt(summary.avgTimeMs)}</span>}
                  </div>
                </div>
                <button
                  onClick={() => downloadCsv(buildResultsFilename(participant.name, viewData.category), buildGroupParticipantCsv(viewData, participant.id))}
                  style={{ background: "transparent", border: "1px solid #22c55e66", borderRadius: "10px", color: "#22c55e", padding: "11px 18px", fontSize: "0.78rem", fontFamily: "Cormorant Garamond, Georgia, serif", letterSpacing: "0.12em", textTransform: "uppercase", cursor: "pointer" }}
                >
                  Export {participant.name}
                </button>
              </div>
            );
          })}
        </div>

        {(importStatus || importError) && (
          <div style={{ fontSize: "0.72rem", color: importError ? "#fca5a5" : "#a7f3d0", letterSpacing: "0.04em", lineHeight: 1.6 }}>
            {importError || importStatus}
          </div>
        )}

        <AccuracyGraph data={viewData} />
      </div>
    </div>
  );
}
