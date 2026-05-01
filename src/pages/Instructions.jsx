import { useState } from 'react';
import { CATEGORIES } from '../lib/constants.js';
import { VOICE_COMMAND_ALIASES } from '../lib/speechMatcher.js';

export function Instructions({ category, activeItems, onContinue, onBack }) {
  const catItems = activeItems || CATEGORIES[category]?.items || CATEGORIES.Colors.items;
  const [isVoiceHelpOpen, setIsVoiceHelpOpen] = useState(false);
  const allOptionGroups = [
    { label: "Colors", items: CATEGORIES.Colors?.items || [] },
    { label: "Numbers", items: CATEGORIES.Numbers?.items || [] },
    { label: "Shapes", items: CATEGORIES.Shapes?.items || [] },
  ];

  const cardStyle = (borderColor) => ({
    background: "var(--color-surface, #FFFFFF)",
    borderRadius: "12px",
    padding: "16px",
    border: "1px solid var(--color-border, #E6E2D9)",
    borderLeft: `3px solid ${borderColor}`,
    boxShadow: "0 12px 30px rgba(31, 31, 31, 0.06)"
  });
  const labelStyle = {
    fontSize: "0.65rem", color: "var(--color-subtext, #6B6B6B)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "6px"
  };

  const speakerIcon = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M3 10v4a2 2 0 0 0 2 2h3l4 3a1 1 0 0 0 1.6-.8V6.8A1 1 0 0 0 12 6l-4 3H5a2 2 0 0 0-2 2Zm14.5 2a4.5 4.5 0 0 0-2.24-3.89 1 1 0 0 0-1 1.73 2.5 2.5 0 0 1 0 4.32 1 1 0 1 0 1 1.73A4.5 4.5 0 0 0 17.5 12Zm2.5 0a7 7 0 0 0-3.5-6.06 1 1 0 1 0-1 1.73A5 5 0 0 1 18 12a5 5 0 0 1-2.5 4.33 1 1 0 1 0 1 1.73A7 7 0 0 0 20 12Z" />
    </svg>
  );

  return (
    <div style={{ minHeight: "100vh", background: "var(--color-bg, #F7F6F2)", color: "var(--color-text, #1F1F1F)", fontFamily: "'Georgia', serif", display: "flex", flexDirection: "column", alignItems: "center", padding: "32px 24px" }}>
      <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontSize: "2rem", fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--color-primary, #2F5D50)", marginBottom: "6px" }}>Instructions</div>
      <div style={{ fontSize: "0.68rem", color: "var(--color-subtext, #6B6B6B)", letterSpacing: "0.25em", textTransform: "uppercase", marginBottom: "32px" }}>Before You Begin</div>

      <div style={{ width: "100%", maxWidth: "520px", display: "flex", flexDirection: "column", gap: "24px" }}>
        <div style={cardStyle("#7c3aed")}>
          <div style={labelStyle}>Calibration</div>
          <div style={{ fontSize: "0.88rem", color: "var(--color-text, #1F1F1F)", lineHeight: 1.7 }}>The screen shows each item one at a time. Use A / D to cycle through the options. Calibration helps tune color perception before recorded test responses begin.</div>
        </div>

        <div style={cardStyle("#db2777")}>
          <div style={labelStyle}>Test Phase</div>
          <div style={{ fontSize: "0.88rem", color: "var(--color-text, #1F1F1F)", lineHeight: 1.7 }}>Blindfold on. Use A / D to cycle through items and Space to submit. Calibration can be opened during the test; guessing is locked while it is open.</div>
        </div>

        <div style={cardStyle("#f97316")}>
          <div style={labelStyle}>Active Items — {category}</div>
          <div style={{ display: "flex", flexWrap: "wrap", rowGap: "8px", columnGap: "8px" }}>
            {catItems.map((item) => (
              <div key={item.name} style={{ display: "flex", alignItems: "center", gap: "8px", background: "var(--color-surface-soft, #FBFAF7)", borderRadius: "8px", padding: "7px 12px", border: `1px solid ${item.hex}55` }}>
                <span style={{ fontSize: "1.1rem", lineHeight: 1 }}>{item.symbol}</span>
                <span style={{ fontSize: "0.78rem", color: item.hex }}>{item.name}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: "var(--color-surface, #FFFFFF)", borderRadius: "12px", padding: "16px", border: "1px solid var(--color-border, #E6E2D9)", borderLeft: "3px solid var(--color-success, #3A7D44)", boxShadow: "0 12px 30px rgba(31, 31, 31, 0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
            <div style={labelStyle}>Special Keys</div>
            <button
              onClick={() => setIsVoiceHelpOpen(true)}
              style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "transparent", border: "1px solid var(--color-border, #E6E2D9)", color: "var(--color-primary, #2F5D50)", borderRadius: "999px", padding: "7px 12px", cursor: "pointer", fontFamily: "inherit", letterSpacing: "0.08em", textTransform: "uppercase", fontSize: "0.68rem" }}
              aria-label="Voice commands"
            >
              {speakerIcon}
              Voice
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {[
              { key: "A",     color: "#f97316", desc: "Cycle to the previous option" },
              { key: "D",     color: "#f97316", desc: "Cycle to the next option" },
              { key: "Space", color: "#22c55e", desc: "Calibration: begin test · Test: confirm · Done: results" },
              { key: "Ctrl",  color: "#fbbf24", desc: "Toggle Calibration / Test" },
              { key: "Shift", color: "#a78bfa", desc: "Repeat the current mode instructions" },
              { key: "X",     color: "#ef4444", desc: "Test: skip current card" },
            ].map(({ key, color, desc }) => (
              <div key={key} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ background: "var(--color-surface-soft, #FBFAF7)", border: `1px solid ${color}66`, borderRadius: "6px", padding: "5px 10px", fontSize: "0.75rem", color, fontFamily: "monospace", fontWeight: 700, flexShrink: 0, minWidth: "44px", textAlign: "center" }}>{key}</div>
                <div style={{ fontSize: "0.78rem", color: "var(--color-subtext, #6B6B6B)", lineHeight: 1.5 }}>{desc}</div>
              </div>
            ))}
            <div style={{ fontSize: "0.72rem", color: "var(--color-subtext, #6B6B6B)", marginTop: "4px", lineHeight: 1.6 }}>Tip: Space and Shift are your tactile anchors. A and D cycle left and right from there.</div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <button onClick={() => { onContinue(null); }} style={{ background: "var(--color-primary, #2F5D50)", border: "none", borderRadius: "10px", color: "white", padding: "14px", fontSize: "0.95rem", fontFamily: "Cormorant Garamond, Georgia, serif", letterSpacing: "0.16em", textTransform: "uppercase", cursor: "pointer", boxShadow: "0 10px 24px rgba(47, 93, 80, 0.22)" }}>
            Enter Calibration →
          </button>
          <button onClick={onBack} style={{ background: "transparent", border: "1px solid var(--color-border, #E6E2D9)", borderRadius: "8px", color: "var(--color-subtext, #6B6B6B)", padding: "10px", fontSize: "0.78rem", fontFamily: "inherit", letterSpacing: "0.06em", cursor: "pointer" }}>← Back to Setup</button>
        </div>
      </div>

      {isVoiceHelpOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 999, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div onClick={() => setIsVoiceHelpOpen(false)} style={{ position: "absolute", inset: 0, background: "rgba(31, 31, 31, 0.35)" }} />
          <div style={{ position: "relative", width: "100%", maxWidth: "640px", margin: "0 16px 16px", background: "var(--color-surface, #FFFFFF)", border: "1px solid var(--color-border, #E6E2D9)", borderRadius: "16px", padding: "16px 16px 12px", boxShadow: "0 24px 90px rgba(31, 31, 31, 0.22)", maxHeight: "82vh", overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", marginBottom: "10px" }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: "10px" }}>
                <span style={{ width: "30px", height: "30px", borderRadius: "10px", display: "inline-flex", alignItems: "center", justifyContent: "center", background: "var(--color-surface-soft, #FBFAF7)", border: "1px solid var(--color-border, #E6E2D9)", color: "var(--color-primary, #2F5D50)" }}>
                  {speakerIcon}
                </span>
                <div>
                  <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontSize: "1.05rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--color-text, #1F1F1F)" }}>Voice Commands</div>
                  <div style={{ fontSize: "0.74rem", color: "var(--color-subtext, #6B6B6B)", lineHeight: 1.4 }}>Examples you can say aloud.</div>
                </div>
              </div>
              <button onClick={() => setIsVoiceHelpOpen(false)} style={{ background: "transparent", border: "1px solid var(--color-border, #E6E2D9)", borderRadius: "10px", color: "var(--color-primary, #2F5D50)", padding: "8px 10px", cursor: "pointer", fontFamily: "inherit", letterSpacing: "0.08em", textTransform: "uppercase", fontSize: "0.7rem" }}>
                Close
              </button>
            </div>

            <div style={{ overflowY: "auto", paddingRight: "4px", paddingBottom: "8px", overscrollBehavior: "contain" }}>
              {[
                { title: "Open Calibration", subtitle: "During test", phrases: VOICE_COMMAND_ALIASES.trainingRoom },
                { title: "Close Calibration", subtitle: "When calibration is open", phrases: VOICE_COMMAND_ALIASES.resumeTest },
                { title: "Begin Test", subtitle: "From calibration", phrases: VOICE_COMMAND_ALIASES.beginTest },
                { title: "Results", subtitle: "After finishing", phrases: VOICE_COMMAND_ALIASES.results },
              ].map((section) => (
                <div key={section.title} style={{ background: "var(--color-surface-soft, #FBFAF7)", border: "1px solid var(--color-border, #E6E2D9)", borderRadius: "12px", padding: "12px 12px 10px", marginTop: "10px" }}>
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "10px", marginBottom: "8px" }}>
                    <div style={{ fontSize: "0.78rem", color: "var(--color-text, #1F1F1F)", letterSpacing: "0.08em", textTransform: "uppercase" }}>{section.title}</div>
                    <div style={{ fontSize: "0.68rem", color: "var(--color-subtext, #6B6B6B)", letterSpacing: "0.12em", textTransform: "uppercase" }}>{section.subtitle}</div>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", rowGap: "8px", columnGap: "8px" }}>
                    {section.phrases.map((phrase) => (
                      <div key={phrase} style={{ padding: "6px 10px", borderRadius: "999px", background: "var(--color-surface, #FFFFFF)", border: "1px solid var(--color-border, #E6E2D9)", color: "var(--color-primary, #2F5D50)", fontSize: "0.76rem", letterSpacing: "0.02em" }}>
                        {phrase}
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              <div style={{ background: "var(--color-surface-soft, #FBFAF7)", border: "1px solid var(--color-border, #E6E2D9)", borderRadius: "12px", padding: "12px 12px 10px", marginTop: "10px" }}>
                <div style={{ fontSize: "0.78rem", color: "var(--color-text, #1F1F1F)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "8px" }}>Confirmations</div>
                <div style={{ display: "flex", flexWrap: "wrap", rowGap: "8px", columnGap: "8px" }}>
                  {["yes", "yeah", "yep", "correct", "no", "nope", "nah"].map((phrase) => (
                    <div key={phrase} style={{ padding: "6px 10px", borderRadius: "999px", background: "var(--color-surface, #FFFFFF)", border: "1px solid var(--color-border, #E6E2D9)", color: "var(--color-primary, #2F5D50)", fontSize: "0.76rem", letterSpacing: "0.02em" }}>
                      {phrase}
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ background: "var(--color-surface-soft, #FBFAF7)", border: "1px solid var(--color-border, #E6E2D9)", borderRadius: "12px", padding: "12px 12px 10px", marginTop: "10px" }}>
                <div style={{ fontSize: "0.78rem", color: "var(--color-text, #1F1F1F)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "8px" }}>Option Values (All)</div>
                {allOptionGroups.map((group) => (
                  <div key={group.label} style={{ marginTop: "12px" }}>
                    <div style={{ fontSize: "0.68rem", color: "var(--color-subtext, #6B6B6B)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "8px" }}>
                      {group.label}
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", rowGap: "8px", columnGap: "8px" }}>
                      {group.items.map((item) => (
                        <div key={`${group.label}-${item.name}`} style={{ padding: "6px 10px", borderRadius: "999px", background: "var(--color-surface, #FFFFFF)", border: `1px solid ${item.hex}55`, color: "var(--color-text, #1F1F1F)", fontSize: "0.76rem", letterSpacing: "0.02em" }}>
                          {item.name}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
