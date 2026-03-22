import { useState } from "react";
import { StatCard } from '../components/StatCard.jsx';

export function SoloResults({ data, onRestart, onRedo }) {
  const { name, results, colors, category } = data;
  const isColors = category === "Colors";
  const avgAcc  = results.length ? Math.round(results.reduce((a,r) => a + r.acc, 0) / results.length) : 0;
  const proxArr = results.filter(r => r.prox !== null).map(r => r.prox);
  const avgProx = proxArr.length ? Math.round(proxArr.reduce((a,b) => a+b,0) / proxArr.length) : null;

  const [csvText, setCsvText] = useState(null);

  const exportCSV = () => {
    const sessionId = new Date().toISOString().replace(/[:.]/g, "-");
    const now = new Date();
    const dateStr = now.toLocaleDateString("en-CA");
    const timeStr = now.toLocaleTimeString("en-GB");

    const headers = [
      "session_id","date","time","name","category","card_position",
      "round_size","target","guesses","attempts","accuracy",
      "proximity","pattern","first_guess_correct",
      "time_to_first_s","time_per_guess_s","card_total_time_s","skipped"
    ];

    const rows = results.map((r, i) => {
      const timeToFirst = r.timeToFirst != null ? (r.timeToFirst / 1000).toFixed(2) : "";
      const guessDeltas = r.guessDeltas?.length
        ? r.guessDeltas.map(d => (d / 1000).toFixed(2)).join("|")
        : "";
      const allTimes = r.timeToFirst != null
        ? [r.timeToFirst, ...(r.guessDeltas || [])]
        : [];
      const cardTotal = allTimes.length ? (allTimes.reduce((a,b) => a+b, 0) / 1000).toFixed(2) : "";

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

    const csv = [headers.join(","), ...rows].join("\n");
    setCsvText(csv);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#141420", fontFamily: "'Georgia', serif", color: "#f0ece4", padding: "40px 24px", display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontSize: "2rem", fontWeight: 600, letterSpacing: "0.2em", textTransform: "uppercase", background: "linear-gradient(120deg, #93c5fd 0%, #a78bfa 40%, #e879f9 70%, #f9a8d4 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", marginBottom: "6px" }}>Results</div>
      <div style={{ fontSize: "0.7rem", color: "#6b5aaa", letterSpacing: "0.2em", marginBottom: "32px", textTransform: "uppercase" }}>{name}</div>

      <div style={{ display: "flex", gap: "16px", marginBottom: "32px", flexWrap: "wrap", justifyContent: "center" }}>
        <StatCard label="Avg Accuracy" value={`${avgAcc}%`} color={avgAcc >= 70 ? "#22c55e" : avgAcc >= 40 ? "#eab308" : "#ef4444"} />
        {avgProx !== null && <StatCard label="Avg Proximity" value={`${avgProx}%`} color="#a78bfa" />}
        <StatCard label="Cards" value={results.length} color="#60a5fa" />
      </div>

      <div style={{ width: "100%", maxWidth: "520px", display: "flex", flexDirection: "column", gap: "8px" }}>
        {results.map((r, i) => {
          const tgt = colors.find(c => c.name === r.target);
          return (
            <div key={i} style={{ background: "#181825", borderRadius: "8px", padding: "10px 14px", borderLeft: `3px solid ${tgt?.hex}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "5px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "1rem" }}>{tgt?.symbol}</span>
                  <span style={{ fontSize: "0.8rem", color: tgt?.hex, fontWeight: 600 }}>{r.target}</span>
                  <span style={{ fontSize: "0.65rem", color: "#4a4a6a" }}>card {i+1}</span>
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
                      {gi > 0 && <span style={{ color: "#252535", fontSize: "0.5rem" }}>→</span>}
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px", padding: "4px 10px", borderRadius: "8px", background: gc?.hex + (isCorr ? "33" : "15"), border: `1px solid ${gc?.hex}${isCorr ? "" : "55"}`, color: gc?.hex }}>
                        <span style={{ fontSize: "0.95rem", lineHeight: 1, color: isCorr ? gc?.hex : "#ffffff" }}>{gc?.symbol}</span>
                        <span style={{ fontSize: "0.65rem", lineHeight: 1, fontWeight: isCorr ? 700 : 400 }}>{g}{isCorr ? " ✓" : ""}</span>
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
          Redo Test →
        </button>
        <button onClick={exportCSV} style={{ background: "transparent", border: "1px solid #22c55e66", borderRadius: "10px", color: "#22c55e", padding: "13px 36px", fontSize: "0.9rem", fontFamily: "Cormorant Garamond, Georgia, serif", letterSpacing: "0.15em", textTransform: "uppercase", cursor: "pointer" }}>
          ↓ Export CSV
        </button>
        <button onClick={onRestart} style={{ background: "transparent", border: "1px solid #252530", borderRadius: "10px", color: "#9090bb", padding: "13px 36px", fontSize: "0.9rem", fontFamily: "Cormorant Garamond, Georgia, serif", letterSpacing: "0.15em", textTransform: "uppercase", cursor: "pointer" }}>
          ← Back to Setup
        </button>
      </div>
      {csvText && (
        <div style={{ width: "100%", maxWidth: "700px", marginTop: "24px" }}>
          <div style={{ fontSize: "0.68rem", color: "#6060a0", marginBottom: "8px", letterSpacing: "0.08em" }}>Click inside → Ctrl+A → Ctrl+C → paste into Google Sheets or a .csv file</div>
          <textarea readOnly value={csvText} onClick={e => e.target.select()} style={{ width: "100%", height: "200px", background: "#0c0c12", border: "1px solid #252530", borderRadius: "6px", color: "#9090bb", fontFamily: "monospace", fontSize: "0.62rem", padding: "10px", resize: "vertical", boxSizing: "border-box", outline: "none" }} />
        </div>
      )}
    </div>
  );
}