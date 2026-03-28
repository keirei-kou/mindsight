import { useEffect, useMemo, useState } from 'react';
import { CsvImportButton } from '../components/CsvImportButton.jsx';
import { StatCard } from '../components/StatCard.jsx';
import { buildResultsFilename, buildSoloResultsCsv, downloadCsv, parseSoloResultsCsv } from '../csv.js';

function buildSoloGraphPoints(results) {
  let elapsedMs = 0;
  return results.map((result, index) => {
    const durations = [result.timeToFirst, ...(result.guessDeltas || [])].filter(value => value != null);
    const cardTotalMs = durations.reduce((sum, value) => sum + value, 0);
    elapsedMs += cardTotalMs;
    return {
      x: elapsedMs,
      y: result.acc,
      card: index + 1,
      target: result.target,
    };
  });
}

function SoloAccuracyGraph({ results }) {
  const width = 520;
  const height = 260;
  const padding = { top: 20, right: 18, bottom: 36, left: 42 };
  const points = buildSoloGraphPoints(results).filter(point => point.x > 0);
  const maxX = points.length ? Math.max(...points.map(point => point.x), 1) : 1;
  const graphWidth = width - padding.left - padding.right;
  const graphHeight = height - padding.top - padding.bottom;
  const yTicks = [0, 25, 50, 75, 100];

  const scaleX = (value) => padding.left + (value / maxX) * graphWidth;
  const scaleY = (value) => padding.top + ((100 - value) / 100) * graphHeight;
  const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${scaleX(point.x)} ${scaleY(point.y)}`).join(' ');

  return (
    <div style={{ width: "100%", maxWidth: "520px", background: "#111118", border: "1px solid #252530", borderRadius: "14px", padding: "18px 18px 12px", overflowX: "auto" }}>
      <div style={{ fontSize: "0.78rem", color: "#b9b4d8", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "12px" }}>Accuracy Over Time</div>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Solo accuracy graph">
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
        <text x={16} y={height / 2} fill="#7f7a9e" fontSize="11" textAnchor="middle" transform={`rotate(-90 16 ${height / 2})`}>
          Accuracy
        </text>
        {path && <path d={path} fill="none" stroke="#60a5fa" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />}
        {points.map((point) => (
          <g key={point.card}>
            <circle cx={scaleX(point.x)} cy={scaleY(point.y)} r="4" fill="#60a5fa" />
            <title>{`Card ${point.card}: ${point.y}% accuracy`}</title>
          </g>
        ))}
      </svg>
    </div>
  );
}

export function SoloResults({ data, onRestart, onRedo }) {
  const [viewData, setViewData] = useState(data);
  const [importError, setImportError] = useState("");
  const [importStatus, setImportStatus] = useState("");

  useEffect(() => {
    setViewData(data);
  }, [data]);

  const { name, results, colors, category } = viewData;
  const avgAcc  = results.length ? Math.round(results.reduce((a, r) => a + r.acc, 0) / results.length) : 0;
  const proxArr = results.filter(r => r.prox !== null).map(r => r.prox);
  const avgProx = proxArr.length ? Math.round(proxArr.reduce((a, b) => a + b, 0) / proxArr.length) : null;
  const headerSubtitle = useMemo(() => {
    if (viewData.importedFromCsv) return `${name} · imported CSV`;
    return name;
  }, [name, viewData.importedFromCsv]);

  const exportCSV = () => {
    downloadCsv(buildResultsFilename(name, category), buildSoloResultsCsv(viewData));
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

  return (
    <div style={{ minHeight: "100vh", background: "#141420", fontFamily: "'Georgia', serif", color: "#f0ece4", padding: "40px 24px", display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontSize: "2rem", fontWeight: 600, letterSpacing: "0.2em", textTransform: "uppercase", background: "linear-gradient(120deg, #93c5fd 0%, #a78bfa 40%, #e879f9 70%, #f9a8d4 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", marginBottom: "6px" }}>Results</div>
      <div style={{ fontSize: "0.7rem", color: "#6b5aaa", letterSpacing: "0.2em", marginBottom: "32px", textTransform: "uppercase" }}>{headerSubtitle}</div>

      <div style={{ display: "flex", gap: "16px", marginBottom: "32px", flexWrap: "wrap", justifyContent: "center" }}>
        <StatCard label="Avg Accuracy" value={`${avgAcc}%`} color={avgAcc >= 70 ? "#22c55e" : avgAcc >= 40 ? "#eab308" : "#ef4444"} />
        {avgProx !== null && <StatCard label="Avg Proximity" value={`${avgProx}%`} color="#a78bfa" />}
        <StatCard label="Cards" value={results.length} color="#60a5fa" />
      </div>

      {results.some(result => result.timeToFirst != null || result.guessDeltas?.length) && (
        <div style={{ width: "100%", display: "flex", justifyContent: "center", marginBottom: "24px" }}>
          <SoloAccuracyGraph results={results} />
        </div>
      )}

      <div style={{ width: "100%", maxWidth: "520px", display: "flex", flexDirection: "column", gap: "8px" }}>
        {results.map((r, i) => {
          const tgt = colors.find(c => c.name === r.target);
          return (
            <div key={i} style={{ background: "#181825", borderRadius: "8px", padding: "10px 14px", borderLeft: `3px solid ${tgt?.hex}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "5px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "1rem" }}>{tgt?.symbol}</span>
                  <span style={{ fontSize: "0.8rem", color: tgt?.hex, fontWeight: 600 }}>{r.target}</span>
                  <span style={{ fontSize: "0.65rem", color: "#4a4a6a" }}>card {i + 1}</span>
                </div>
                <div style={{ display: "flex", gap: "10px", fontSize: "0.68rem" }}>
                  <span style={{ color: r.acc >= 70 ? "#22c55e" : r.acc >= 40 ? "#eab308" : "#ef4444" }}>Acc {r.acc}%</span>
                  {r.prox !== null && <span style={{ color: "#a78bfa" }}>Prox {r.prox}%</span>}
                  {r.pattern && <span style={{ color: "#6060a0", fontStyle: "italic" }}>{r.pattern}</span>}
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
                {r.skipped && <span style={{ fontSize: "0.65rem", color: "#6060a0", fontStyle: "italic", alignSelf: "center" }}>skipped</span>}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: "12px", marginTop: "32px", flexWrap: "wrap", justifyContent: "center" }}>
        <button onClick={onRedo} style={{ background: "linear-gradient(120deg, #3b82f6 0%, #7c3aed 50%, #db2777 100%)", border: "none", borderRadius: "10px", color: "white", padding: "13px 36px", fontSize: "0.9rem", fontFamily: "Cormorant Garamond, Georgia, serif", letterSpacing: "0.15em", textTransform: "uppercase", cursor: "pointer", boxShadow: "0 4px 20px #7c3aed44" }}>
          Redo Test
        </button>
        <CsvImportButton
          onSelect={importCsv}
          buttonStyle={{ background: "transparent", border: "1px solid #f59e0b66", borderRadius: "10px", color: "#fbbf24", padding: "13px 36px", fontSize: "0.9rem", fontFamily: "Cormorant Garamond, Georgia, serif", letterSpacing: "0.15em", textTransform: "uppercase", cursor: "pointer" }}
          statusStyle={{ fontSize: "0.68rem", color: "#d6b06b", marginTop: "12px", letterSpacing: "0.04em", lineHeight: 1.6 }}
        />
        <button onClick={exportCSV} style={{ background: "transparent", border: "1px solid #22c55e66", borderRadius: "10px", color: "#22c55e", padding: "13px 36px", fontSize: "0.9rem", fontFamily: "Cormorant Garamond, Georgia, serif", letterSpacing: "0.15em", textTransform: "uppercase", cursor: "pointer" }}>
          Download CSV
        </button>
        <button onClick={onRestart} style={{ background: "transparent", border: "1px solid #252530", borderRadius: "10px", color: "#9090bb", padding: "13px 36px", fontSize: "0.9rem", fontFamily: "Cormorant Garamond, Georgia, serif", letterSpacing: "0.15em", textTransform: "uppercase", cursor: "pointer" }}>
          Back to Setup
        </button>
      </div>
      {(importStatus || importError) && (
        <div style={{ marginTop: "16px", fontSize: "0.72rem", color: importError ? "#fca5a5" : "#a7f3d0", letterSpacing: "0.04em", lineHeight: 1.6 }}>
          {importError || importStatus}
        </div>
      )}
    </div>
  );
}
