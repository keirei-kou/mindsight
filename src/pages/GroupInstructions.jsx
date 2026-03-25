import { useEffect, useMemo, useRef, useState } from "react";
import { CATEGORIES } from "../constants.js";

export function GroupInstructions({ category, activeItems, onContinue, onBack }) {
  const catItems = useMemo(
    () => activeItems || CATEGORIES[category]?.items || CATEGORIES.Colors.items,
    [activeItems, category]
  );

  const [selectedIdx, setSelectedIdx] = useState(0);
  const selectedIdxRef = useRef(0);
  selectedIdxRef.current = selectedIdx;

  const selectedCardRef = useRef(null);
  const channelRef = useRef(null);

  const selectedItem = catItems[selectedIdx] ?? catItems[0] ?? null;
  const selectedCard = selectedItem
    ? {
        name: selectedItem.name,
        symbol: selectedItem.symbol,
        hex: selectedItem.hex,
        category,
      }
    : null;

  useEffect(() => {
    selectedCardRef.current = selectedCard;
    if (channelRef.current && selectedCardRef.current) {
      channelRef.current.postMessage({ type: "card", card: selectedCardRef.current });
    }
  }, [selectedCard]);

  useEffect(() => {
    if (catItems.length === 0) return;

    channelRef.current = new BroadcastChannel("mindsight-display");
    channelRef.current.onmessage = (e) => {
      if (e.data?.type === "request" && selectedCardRef.current) {
        channelRef.current.postMessage({ type: "card", card: selectedCardRef.current });
      }
    };

    // Push initial card to display immediately.
    if (selectedCardRef.current) {
      channelRef.current.postMessage({ type: "card", card: selectedCardRef.current });
    }

    return () => {
      try {
        channelRef.current?.postMessage({ type: "clear" });
      } catch {}
      try {
        channelRef.current?.close();
      } catch {}
      channelRef.current = null;
    };
  }, [catItems.length]);

  useEffect(() => {
    if (catItems.length === 0) return;

    const handler = (e) => {
      if (e.key !== "Tab") return;
      // Let facilitator cycle between active items with Tab.
      e.preventDefault();
      setSelectedIdx((prev) => {
        const len = catItems.length;
        const dir = e.shiftKey ? -1 : 1;
        return (prev + dir + len) % len;
      });
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [catItems.length]);

  const cardStyle = (borderColor) => ({
    background: "#181825",
    borderRadius: "10px",
    padding: "16px 18px",
    borderLeft: `3px solid ${borderColor}`,
  });

  const labelStyle = {
    fontSize: "0.65rem",
    color: "#7070aa",
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    marginBottom: "6px",
  };

  const openDisplayTab = () => {
    const url = new URL(window.location.href);
    url.hash = "#display";
    window.open(url.toString(), "_blank", "noopener,noreferrer");
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#141420",
        color: "#f0ece4",
        fontFamily: "'Georgia', serif",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "48px 24px",
      }}
    >
      <div
        style={{
          fontFamily: "Cormorant Garamond, Georgia, serif",
          fontSize: "2rem",
          fontWeight: 600,
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          background: "linear-gradient(120deg, #93c5fd 0%, #a78bfa 40%, #e879f9 70%, #f9a8d4 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
          filter: "drop-shadow(0 0 16px #a78bfaaa)",
          marginBottom: "6px",
        }}
      >
        Group Facilitation
      </div>

      <div style={{ fontSize: "0.68rem", color: "#6b5aaa", letterSpacing: "0.25em", textTransform: "uppercase", marginBottom: "40px" }}>
        Before You Begin
      </div>

      <div style={{ width: "100%", maxWidth: "520px", display: "flex", flexDirection: "column", gap: "18px" }}>
        <div style={cardStyle("#7c3aed")}>
          <div style={labelStyle}>Eyes On, Then Blindfold On</div>
          <div style={{ fontSize: "0.82rem", color: "#c4b5fd", lineHeight: 1.7 }}>
            You will control what appears on <span style={{ color: "#f0ece4", fontWeight: 700 }}>#display</span>.
            First run the active items while participants can see (eyes on). Then put on blindfolds and run them again
            while participants sense the colors. When you are ready, go to the tracker matrix to log participants' guesses.
          </div>
        </div>

        <div style={cardStyle("#db2777")}>
          <div style={labelStyle}>Testing Participant on Items</div>
          <div style={{ fontSize: "0.82rem", color: "#f9a8d4", lineHeight: 1.7 }}>
            Cycle the active items to show each item on the big display. Use <b>Tab</b> to move to the next active item (it wraps).
            You can also <b>click</b> any active item button directly.
          </div>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "14px", alignItems: "center" }}>
            <button
              onClick={openDisplayTab}
              style={{
                background: "linear-gradient(120deg, #3b82f6 0%, #7c3aed 50%, #db2777 100%)",
                border: "none",
                borderRadius: "10px",
                color: "white",
                padding: "12px 14px",
                fontSize: "0.92rem",
                fontFamily: "Cormorant Garamond, Georgia, serif",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                cursor: "pointer",
                boxShadow: "0 4px 28px #7c3aed55",
                whiteSpace: "nowrap",
              }}
            >
              Display mode
            </button>
          </div>
        </div>

        <div style={cardStyle("#f97316")}>
          <div style={labelStyle}>Active Items — {category}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
            {catItems.map((item, i) => {
              const isSelected = i === selectedIdx;
              return (
                <button
                  key={item.name}
                  onClick={() => setSelectedIdx(i)}
                  style={{
                    background: isSelected ? item.hex + "22" : "#141420",
                    border: isSelected ? "2px solid white" : `1px solid ${item.hex}55`,
                    borderRadius: "10px",
                    padding: "10px 12px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    boxShadow: isSelected ? `0 0 0 2px rgba(255,255,255,0.35), 0 0 18px ${item.hex}33` : "none",
                    transition: "all 0.12s",
                    minWidth: "160px",
                    justifyContent: "flex-start",
                  }}
                  title={isSelected ? "Currently shown on #display" : "Click to show on #display"}
                >
                  <span style={{ fontSize: "1.3rem", lineHeight: 1, color: isSelected ? "white" : item.hex }}>{item.symbol}</span>
                  <span style={{ fontSize: "0.82rem", color: isSelected ? "white" : "#c4b5fd", fontWeight: isSelected ? 700 : 500 }}>
                    {item.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ background: "#181825", borderRadius: "10px", padding: "16px 18px", borderLeft: "3px solid #22c55e" }}>
          <div style={labelStyle}>Special Keys + Cell Matrix</div>
          <div style={{ fontSize: "0.80rem", color: "#f0ece4", lineHeight: 1.7 }}>
            <div>
              <b>Dot chain</b> — the horizontal sequence of logged guesses (ex: → → →).
            </div>
            <div>
              <b>Dot</b> — a single item within the dot chain, representing one guess.
            </div>
            <div>
              <b>Edit cursor</b> — the currently selected dot (highlighted with a white ring glow).
            </div>
            <div>
              <b>Input toolbar</b> — the row of color/shape/number buttons inside an active cell, used to log new guesses.
            </div>
            <div>
              <b>Input button</b> — one button in the input toolbar (one per active item).
            </div>
            <div>
              <b>DNF button</b> — the “—” button in the input toolbar (skip / miss).
            </div>
            <div>
              <b>Cell</b> — participant × slot container.
            </div>
            <div>
              <b>Slot</b> — a column in the matrix representing one card in the round.
            </div>
            <div>
              <b>Participant row</b> — the horizontal row for one participant.
            </div>
            <div style={{ marginTop: "10px", color: "#9090bb" }}>
              Tip: In the tracker, click a dot to set the edit cursor. Then click an input button to replace that guess.
              Use Shift+click for quick removal, and Ctrl/⌘+click to insert/truncate (depending on context).
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px", alignItems: "stretch" }}>
          <button
            onClick={() => onContinue()}
            style={{
              background: "linear-gradient(120deg, #3b82f6 0%, #7c3aed 50%, #db2777 100%)",
              border: "none",
              borderRadius: "10px",
              color: "white",
              padding: "14px",
              fontSize: "0.95rem",
              fontFamily: "Cormorant Garamond, Georgia, serif",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              cursor: "pointer",
              boxShadow: "0 4px 28px #7c3aed55",
            }}
          >
            Enter Session / Tracker →
          </button>
          <button
            onClick={onBack}
            style={{
              background: "transparent",
              border: "1px solid #252530",
              borderRadius: "8px",
              color: "#555",
              padding: "10px",
              fontSize: "0.78rem",
              fontFamily: "inherit",
              letterSpacing: "0.06em",
              cursor: "pointer",
            }}
          >
            ← Back to Setup
          </button>
        </div>
      </div>
    </div>
  );
}

