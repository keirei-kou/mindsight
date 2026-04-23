import { useState } from 'react';
import { CATEGORIES } from '../constants.js';
import { VOICE_COMMAND_ALIASES } from '../speechMatcher.js';
import { speak } from '../tts.js';

export function Instructions({ category, activeItems, onContinue, onBack }) {
  const catItems = activeItems || CATEGORIES[category]?.items || CATEGORIES.Colors.items;
  const [isVoiceHelpOpen, setIsVoiceHelpOpen] = useState(false);

  const cardStyle = (borderColor) => ({
    background: "#181825", borderRadius: "10px", padding: "16px 18px", borderLeft: `3px solid ${borderColor}`
  });
  const labelStyle = {
    fontSize: "0.65rem", color: "#7070aa", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "6px"
  };

  const speakerIcon = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M3 10v4a2 2 0 0 0 2 2h3l4 3a1 1 0 0 0 1.6-.8V6.8A1 1 0 0 0 12 6l-4 3H5a2 2 0 0 0-2 2Zm14.5 2a4.5 4.5 0 0 0-2.24-3.89 1 1 0 0 0-1 1.73 2.5 2.5 0 0 1 0 4.32 1 1 0 1 0 1 1.73A4.5 4.5 0 0 0 17.5 12Zm2.5 0a7 7 0 0 0-3.5-6.06 1 1 0 1 0-1 1.73A5 5 0 0 1 18 12a5 5 0 0 1-2.5 4.33 1 1 0 1 0 1 1.73A7 7 0 0 0 20 12Z" />
    </svg>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#141420", color: "#f0ece4", fontFamily: "'Georgia', serif", display: "flex", flexDirection: "column", alignItems: "center", padding: "48px 24px" }}>
      <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontSize: "2rem", fontWeight: 600, letterSpacing: "0.2em", textTransform: "uppercase", background: "linear-gradient(120deg, #93c5fd 0%, #a78bfa 40%, #e879f9 70%, #f9a8d4 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", filter: "drop-shadow(0 0 16px #a78bfaaa)", marginBottom: "6px" }}>Instructions</div>
      <div style={{ fontSize: "0.68rem", color: "#6b5aaa", letterSpacing: "0.25em", textTransform: "uppercase", marginBottom: "40px" }}>Before You Begin</div>

      <div style={{ width: "100%", maxWidth: "420px", display: "flex", flexDirection: "column", gap: "20px" }}>
        <div style={cardStyle("#7c3aed")}>
          <div style={labelStyle}>Training Room</div>
          <div style={{ fontSize: "0.82rem", color: "#c4b5fd", lineHeight: 1.7 }}>The screen shows each item one at a time. Use A / D to cycle — each press announces the item name. First without the blindfold, then blindfold on. Start the test when ready.</div>
        </div>

        <div style={cardStyle("#db2777")}>
          <div style={labelStyle}>Test Phase</div>
          <div style={{ fontSize: "0.82rem", color: "#f9a8d4", lineHeight: 1.7 }}>Blindfold on. Use A / D to cycle through items and Space to submit. The Training overlay can be opened during the test; guessing is locked while it is open.</div>
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
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
            <div style={labelStyle}>Special Keys</div>
            <button
              onClick={() => setIsVoiceHelpOpen(true)}
              style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "transparent", border: "1px solid #3a3a55", color: "#c9c3e5", borderRadius: "999px", padding: "7px 12px", cursor: "pointer", fontFamily: "inherit", letterSpacing: "0.08em", textTransform: "uppercase", fontSize: "0.68rem" }}
              aria-label="Voice commands"
            >
              {speakerIcon}
              Voice
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {[
              { key: "Ctrl",  color: "#fbbf24", desc: "Test: toggle Training overlay (guessing locked while open)" },
              { key: "A",     color: "#f97316", desc: "Training: previous item (announces name) · Test: cycles back" },
              { key: "D",     color: "#f97316", desc: "Training: next item (announces name) · Test: cycles forward" },
              { key: "S",     color: "#60a5fa", desc: "Repeat the current item aloud" },
              { key: "X",     color: "#ef4444", desc: "Test: skip current card" },
              { key: "Space", color: "#22c55e", desc: "Training: begin test · Test: submit · Done: results" },
              { key: "Enter", color: "#a78bfa", desc: "Training: begin test · Done: results" },
              { key: "Shift", color: "#a78bfa", desc: "Test: repeat card number · Training overlay: repeat current item name" },
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

      {isVoiceHelpOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 999, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div onClick={() => setIsVoiceHelpOpen(false)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)" }} />
          <div style={{ position: "relative", width: "100%", maxWidth: "560px", margin: "0 16px 16px", background: "linear-gradient(180deg, rgba(17,17,24,0.98) 0%, rgba(10,10,18,0.98) 100%)", border: "1px solid #2a2a3d", borderRadius: "16px", padding: "14px 14px 12px", boxShadow: "0 24px 90px rgba(0,0,0,0.6)", maxHeight: "82vh", overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", marginBottom: "10px" }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: "10px" }}>
                <span style={{ width: "30px", height: "30px", borderRadius: "10px", display: "inline-flex", alignItems: "center", justifyContent: "center", background: "#141420", border: "1px solid #2a2a3d", color: "#c9c3e5" }}>
                  {speakerIcon}
                </span>
                <div>
                  <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontSize: "1.05rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "#f0ece4" }}>Voice Commands</div>
                  <div style={{ fontSize: "0.74rem", color: "#8b84b0", lineHeight: 1.4 }}>Examples you can say aloud.</div>
                </div>
              </div>
              <button onClick={() => setIsVoiceHelpOpen(false)} style={{ background: "transparent", border: "1px solid #2a2a3d", borderRadius: "10px", color: "#c9c3e5", padding: "8px 10px", cursor: "pointer", fontFamily: "inherit", letterSpacing: "0.08em", textTransform: "uppercase", fontSize: "0.7rem" }}>
                Close
              </button>
            </div>

            <div style={{ overflowY: "auto", paddingRight: "2px", paddingBottom: "6px", overscrollBehavior: "contain" }}>
              {[
                { title: "Open Training Overlay", subtitle: "During test", phrases: VOICE_COMMAND_ALIASES.trainingRoom },
                { title: "Close Training Overlay", subtitle: "When overlay is open", phrases: VOICE_COMMAND_ALIASES.resumeTest },
                { title: "Begin Test", subtitle: "From training room", phrases: VOICE_COMMAND_ALIASES.beginTest },
                { title: "Results", subtitle: "After finishing", phrases: VOICE_COMMAND_ALIASES.results },
              ].map((section) => (
                <div key={section.title} style={{ background: "#141420", border: "1px solid #252530", borderRadius: "12px", padding: "12px 12px 10px", marginTop: "10px" }}>
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "10px", marginBottom: "8px" }}>
                    <div style={{ fontSize: "0.78rem", color: "#f0ece4", letterSpacing: "0.08em", textTransform: "uppercase" }}>{section.title}</div>
                    <div style={{ fontSize: "0.68rem", color: "#6b5aaa", letterSpacing: "0.12em", textTransform: "uppercase" }}>{section.subtitle}</div>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", rowGap: "8px", columnGap: "8px" }}>
                    {section.phrases.map((phrase) => (
                      <div key={phrase} style={{ padding: "6px 10px", borderRadius: "999px", background: "#0f0f18", border: "1px solid #2a2a3d", color: "#c9c3e5", fontSize: "0.76rem", letterSpacing: "0.02em" }}>
                        {phrase}
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              <div style={{ background: "#141420", border: "1px solid #252530", borderRadius: "12px", padding: "12px 12px 10px", marginTop: "10px" }}>
                <div style={{ fontSize: "0.78rem", color: "#f0ece4", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "8px" }}>Confirmations</div>
                <div style={{ display: "flex", flexWrap: "wrap", rowGap: "8px", columnGap: "8px" }}>
                  {["yes", "yeah", "yep", "correct", "no", "nope", "nah"].map((phrase) => (
                    <div key={phrase} style={{ padding: "6px 10px", borderRadius: "999px", background: "#0f0f18", border: "1px solid #2a2a3d", color: "#c9c3e5", fontSize: "0.76rem", letterSpacing: "0.02em" }}>
                      {phrase}
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ background: "#141420", border: "1px solid #252530", borderRadius: "12px", padding: "12px 12px 10px", marginTop: "10px" }}>
                <div style={{ fontSize: "0.78rem", color: "#f0ece4", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "8px" }}>Option Values</div>
                <div style={{ display: "flex", flexWrap: "wrap", rowGap: "8px", columnGap: "8px" }}>
                  {catItems.map((item) => (
                    <div key={item.name} style={{ padding: "6px 10px", borderRadius: "999px", background: "#0f0f18", border: `1px solid ${item.hex}55`, color: "#f0ece4", fontSize: "0.76rem", letterSpacing: "0.02em" }}>
                      {item.name}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
