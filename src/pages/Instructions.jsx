import { CATEGORIES } from '../constants.js';
import { speak } from '../tts.js';

export function Instructions({ category, activeItems, onContinue, onBack }) {
  const catItems = activeItems || CATEGORIES[category]?.items || CATEGORIES.Colors.items;

  const cardStyle = (borderColor) => ({
    background: "#181825", borderRadius: "10px", padding: "16px 18px", borderLeft: `3px solid ${borderColor}`
  });
  const labelStyle = {
    fontSize: "0.65rem", color: "#7070aa", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "6px"
  };

  return (
    <div style={{ minHeight: "100vh", background: "#141420", color: "#f0ece4", fontFamily: "'Georgia', serif", display: "flex", flexDirection: "column", alignItems: "center", padding: "48px 24px" }}>
      <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontSize: "2rem", fontWeight: 600, letterSpacing: "0.2em", textTransform: "uppercase", background: "linear-gradient(120deg, #93c5fd 0%, #a78bfa 40%, #e879f9 70%, #f9a8d4 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", filter: "drop-shadow(0 0 16px #a78bfaaa)", marginBottom: "6px" }}>Instructions</div>
      <div style={{ fontSize: "0.68rem", color: "#6b5aaa", letterSpacing: "0.25em", textTransform: "uppercase", marginBottom: "40px" }}>Before You Begin</div>

      <div style={{ width: "100%", maxWidth: "420px", display: "flex", flexDirection: "column", gap: "20px" }}>
        <div style={cardStyle("#7c3aed")}>
          <div style={labelStyle}>Training Room</div>
          <div style={{ fontSize: "0.82rem", color: "#c4b5fd", lineHeight: 1.7 }}>The screen shows each item one at a time. Press D to cycle forward, A to cycle back — each press announces the name aloud. First without the blindfold — look and sense. Then blindfold on — sense again. Press Space or Begin Test when ready.</div>
        </div>

        <div style={cardStyle("#db2777")}>
          <div style={labelStyle}>Test Phase</div>
          <div style={{ fontSize: "0.82rem", color: "#f9a8d4", lineHeight: 1.7 }}>Blindfold on. Use A and D to cycle through items — each press announces your position. When you sense the target, press Space to submit. Correct moves to the next card. "Different" means try again.</div>
        </div>

        <div style={cardStyle("#f97316")}>
          <div style={labelStyle}>Active Items — {category}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {catItems.map((item) => (
              <div key={item.name} style={{ display: "flex", alignItems: "center", gap: "8px", background: "#141420", borderRadius: "8px", padding: "7px 12px", border: `1px solid ${item.hex}55` }}>
                <span style={{ fontSize: "1.1rem", lineHeight: 1 }}>{item.symbol}</span>
                <span style={{ fontSize: "0.78rem", color: item.hex }}>{item.name}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: "#181825", borderRadius: "10px", padding: "16px 18px", borderLeft: "3px solid #22c55e" }}>
          <div style={labelStyle}>Special Keys</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {[
              { key: "A",     color: "#f97316", desc: "Training: previous item (announces name) · Test: cycles back (announces position)" },
              { key: "D",     color: "#f97316", desc: "Training: next item (announces name) · Test: cycles forward (announces position)" },
              { key: "S",     color: "#60a5fa", desc: "Training: item N of total active · Test: card N of total round" },
              { key: "X",     color: "#ef4444", desc: "Skip current card — scores 0% accuracy" },
              { key: "Space", color: "#22c55e", desc: "Training: begin test · Test: submit · Done: results" },
              { key: "Shift", color: "#a78bfa", desc: 'Repeat "Find X" — when you forget the target' },
            ].map(({ key, color, desc }) => (
              <div key={key} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ background: "#141420", border: `1px solid ${color}66`, borderRadius: "6px", padding: "5px 10px", fontSize: "0.75rem", color, fontFamily: "monospace", fontWeight: 700, flexShrink: 0, minWidth: "44px", textAlign: "center" }}>{key}</div>
                <div style={{ fontSize: "0.78rem", color: "#9090bb", lineHeight: 1.5 }}>{desc}</div>
              </div>
            ))}
            <div style={{ fontSize: "0.72rem", color: "#6060a0", marginTop: "4px", lineHeight: 1.6 }}>Tip: Space and Shift are your tactile anchors. A and D cycle left and right from there.</div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <button onClick={() => { speak("Training room."); onContinue(null); }} style={{ background: "linear-gradient(120deg, #3b82f6 0%, #7c3aed 50%, #db2777 100%)", border: "none", borderRadius: "10px", color: "white", padding: "14px", fontSize: "0.95rem", fontFamily: "Cormorant Garamond, Georgia, serif", letterSpacing: "0.18em", textTransform: "uppercase", cursor: "pointer", boxShadow: "0 4px 28px #7c3aed55" }}>
            Enter Training Room →
          </button>
          <button onClick={onBack} style={{ background: "transparent", border: "1px solid #252530", borderRadius: "8px", color: "#555", padding: "10px", fontSize: "0.78rem", fontFamily: "inherit", letterSpacing: "0.06em", cursor: "pointer" }}>← Back to Setup</button>
        </div>
      </div>
    </div>
  );
}
