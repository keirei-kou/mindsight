import { useEffect, useMemo, useRef, useState } from "react";
import { CATEGORIES } from "../constants.js";

export function GroupInstructions({ category, activeItems, onContinue, onBack }) {
  const catItems = useMemo(
    () => activeItems || CATEGORIES[category]?.items || CATEGORIES.Colors.items,
    [activeItems, category]
  );

  const [selectedIdx, setSelectedIdx] = useState(0);
  const [allOptionsOpen, setAllOptionsOpen] = useState(false);
  const [presenterCategory, setPresenterCategory] = useState(category);
  const [presentedCard, setPresentedCard] = useState(null);
  const [allOptionsOffset, setAllOptionsOffset] = useState({ x: 0, y: 0 });
  const selectedCardRef = useRef(null);
  const channelRef = useRef(null);
  const allOptionsRef = useRef(null);
  const dragStateRef = useRef(null);
  const allOptionCategories = ["Colors", "Numbers", "Shapes"];
  const presenterItems = CATEGORIES[presenterCategory]?.items || [];

  const selectedCard = useMemo(() => {
    if (presentedCard) return presentedCard;
    const selectedItem = catItems[selectedIdx] ?? catItems[0] ?? null;
    return selectedItem
      ? {
          name: selectedItem.name,
          symbol: selectedItem.symbol,
          hex: selectedItem.hex,
          category,
        }
      : null;
  }, [catItems, selectedIdx, category, presentedCard]);

  useEffect(() => {
    setPresenterCategory(category);
  }, [category]);

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

    if (selectedCardRef.current) {
      channelRef.current.postMessage({ type: "card", card: selectedCardRef.current });
    }

    return () => {
      try {
        channelRef.current?.close();
      } catch {
        // Ignore cleanup errors if the channel is already closed.
      }
      channelRef.current = null;
    };
  }, [catItems.length]);

  useEffect(() => {
    if (catItems.length === 0) return;

    const handler = (e) => {
      if (e.key !== "Tab") return;
      e.preventDefault();
      setPresentedCard(null);
      setSelectedIdx((prev) => {
        const len = catItems.length;
        const dir = e.shiftKey ? -1 : 1;
        return (prev + dir + len) % len;
      });
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [catItems.length]);

  useEffect(() => {
    if (!allOptionsOpen) return;

    const handler = (e) => {
      if (!allOptionsRef.current?.contains(e.target)) {
        setAllOptionsOpen(false);
      }
    };

    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [allOptionsOpen]);

  useEffect(() => {
    const handleMove = (e) => {
      if (!dragStateRef.current) return;
      const { startX, startY, originX, originY } = dragStateRef.current;
      setAllOptionsOffset({
        x: originX + (e.clientX - startX),
        y: originY + (e.clientY - startY),
      });
    };

    const handleUp = () => {
      dragStateRef.current = null;
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, []);

  const selectActiveItem = (index) => {
    setPresentedCard(null);
    setSelectedIdx(index);
  };

  const selectPresenterItem = (item) => {
    setPresentedCard({
      name: item.name,
      symbol: item.symbol,
      hex: item.hex,
      category: presenterCategory,
    });
  };

  const beginDragAllOptions = (e) => {
    e.preventDefault();
    dragStateRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      originX: allOptionsOffset.x,
      originY: allOptionsOffset.y,
    };
  };

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
        Group Tracker
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
            while participants sense the colors. When you are ready, go to the tracker matrix to log participants&apos; guesses.
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
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", marginBottom: "6px" }}>
            <div style={{ ...labelStyle, marginBottom: 0 }}>Active Items - {category}</div>
            <div ref={allOptionsRef} style={{ position: "relative", flexShrink: 0 }}>
              <button
                onClick={() => setAllOptionsOpen((open) => !open)}
                title="All options"
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "8px",
                  border: "1px solid #f9731688",
                  background: allOptionsOpen ? "#f9731622" : "#141420",
                  color: "#fbbf24",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.95rem",
                  lineHeight: 1,
                  boxShadow: allOptionsOpen ? "0 0 0 1px #fbbf2466, 0 0 14px #f9731633" : "none",
                }}
              >
                ⌘
              </button>
              {allOptionsOpen && (
                <div
                  style={{
                    position: "absolute",
                    top: `${34 + allOptionsOffset.y}px`,
                    right: "auto",
                    left: `${allOptionsOffset.x}px`,
                    width: "270px",
                    background: "#12121b",
                    border: "1px solid #2a2a3c",
                    borderRadius: "12px",
                    padding: "10px",
                    boxShadow: "0 18px 40px #05050acc",
                    zIndex: 10,
                  }}
                >
                  <div
                    onMouseDown={beginDragAllOptions}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: "10px",
                      paddingBottom: "8px",
                      borderBottom: "1px solid #25253a",
                      cursor: "grab",
                      userSelect: "none",
                    }}
                  >
                    <span style={{ fontSize: "0.62rem", color: "#a1a1c8", letterSpacing: "0.1em", textTransform: "uppercase" }}>All options</span>
                    <span style={{ fontSize: "0.9rem", color: "#9ca3af", lineHeight: 1 }}>✥</span>
                  </div>
                  <div style={{ display: "flex", gap: "6px", marginBottom: "10px" }}>
                    {allOptionCategories.map((catName) => {
                      const active = presenterCategory === catName;
                      return (
                        <button
                          key={catName}
                          onClick={() => setPresenterCategory(catName)}
                          style={{
                            flex: 1,
                            border: active ? "1px solid #c4b5fd88" : "1px solid #2a2a3c",
                            background: active ? "#7c3aed22" : "#181825",
                            color: active ? "#f0ece4" : "#a1a1c8",
                            borderRadius: "8px",
                            padding: "7px 8px",
                            cursor: "pointer",
                            fontSize: "0.62rem",
                            letterSpacing: "0.08em",
                            textTransform: "uppercase",
                          }}
                        >
                          {catName}
                        </button>
                      );
                    })}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "8px" }}>
                    {presenterItems.map((item) => {
                      const isPresented = selectedCard?.name === item.name && selectedCard?.category === presenterCategory;
                      return (
                        <button
                          key={`${presenterCategory}-${item.name}`}
                          onClick={() => selectPresenterItem(item)}
                          title={`Show ${item.name} on #display`}
                          style={{
                            background: isPresented ? item.hex + "22" : "#181825",
                            border: isPresented ? `2px solid ${item.hex}` : `1px solid ${item.hex}55`,
                            borderRadius: "10px",
                            padding: "9px 6px",
                            cursor: "pointer",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "4px",
                            color: "#f0ece4",
                            minHeight: "58px",
                            boxShadow: isPresented ? `0 0 0 1px #ffffff33, 0 0 16px ${item.hex}33` : "none",
                          }}
                        >
                          <span style={{ fontSize: "1rem", lineHeight: 1, color: "#f5f7fb" }}>{item.symbol}</span>
                          <span style={{ fontSize: "0.6rem", color: "#d6cfff" }}>{item.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
            {catItems.map((item, i) => {
              const isSelected = !presentedCard && i === selectedIdx;
              return (
                <button
                  key={item.name}
                  onClick={() => selectActiveItem(i)}
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
              <b>Dot chain</b> - the horizontal sequence of logged guesses (ex: - - -).
            </div>
            <div>
              <b>Dot</b> - a single item within the dot chain, representing one guess.
            </div>
            <div>
              <b>Edit cursor</b> - the currently selected dot (highlighted with a white ring glow).
            </div>
            <div>
              <b>Input toolbar</b> - the row of color/shape/number buttons inside an active cell, used to log new guesses.
            </div>
            <div>
              <b>Input button</b> - one button in the input toolbar (one per active item).
            </div>
            <div>
              <b>DNF button</b> - the "-" button in the input toolbar (skip / miss).
            </div>
            <div>
              <b>Cell</b> - participant x slot container.
            </div>
            <div>
              <b>Slot</b> - a column in the matrix representing one card in the round.
            </div>
            <div>
              <b>Participant row</b> - the horizontal row for one participant.
            </div>
            <div style={{ marginTop: "10px", color: "#9090bb" }}>
              Tip: In the tracker, click a dot to set the edit cursor. Then click an input button to replace that guess.
              Use Shift+click for quick removal, and Ctrl/click to insert or truncate depending on context.
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
            Enter Session / Tracker -&gt;
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
            &lt;- Back to Setup
          </button>
        </div>
      </div>
    </div>
  );
}
