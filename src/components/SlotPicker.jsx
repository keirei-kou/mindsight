import { useState, useEffect, useRef } from "react";

export function SlotPicker({ value, onChange, colorCount = 6 }) {
  const [open, setOpen] = useState(false);
  const [draftValue, setDraftValue] = useState(String(value));
  const ref = useRef(null);

  useEffect(() => {
    setDraftValue(String(value));
  }, [value]);

  useEffect(() => {
    const handler = (event) => {
      if (ref.current && !ref.current.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const presets = Array.from({ length: 6 }, (_, index) => colorCount * (index + 1)).filter((count) => count <= 36);

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-flex", width: "138px" }}>
      <input
        type="number"
        min={2}
        max={36}
        value={draftValue}
        onChange={(event) => {
          const nextDraft = event.target.value;
          setDraftValue(nextDraft);
          const parsedValue = parseInt(nextDraft, 10);
          if (!Number.isNaN(parsedValue)) {
            onChange(Math.min(36, parsedValue));
          }
        }}
        onBlur={(event) => {
          const parsedValue = parseInt(event.target.value, 10);
          if (Number.isNaN(parsedValue) || parsedValue < 2) {
            onChange(2);
            return;
          }
          onChange(Math.min(36, parsedValue));
        }}
        onFocus={(event) => event.target.select()}
        onClick={(event) => event.target.select()}
        style={{
          flex: 1,
          width: "100%",
          minHeight: "44px",
          background: "linear-gradient(135deg, #161227 0%, #22153d 55%, #1a1330 100%)",
          border: "1px solid #6d4aff",
          borderRadius: "10px",
          color: "#f0ece4",
          padding: "10px 36px 10px 14px",
          fontSize: "1.05rem",
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          letterSpacing: "0.08em",
          textAlign: "center",
          outline: "none",
          boxSizing: "border-box",
          boxShadow: "0 0 0 1px rgba(167, 139, 250, 0.18), 0 6px 20px rgba(76, 29, 149, 0.18)",
        }}
      />
      <button
        onClick={() => setOpen((isOpen) => !isOpen)}
        style={{
          position: "absolute",
          right: "0",
          top: "0",
          bottom: "0",
          width: "34px",
          background: "none",
          border: "none",
          borderLeft: "1px solid rgba(109, 74, 255, 0.35)",
          cursor: "pointer",
          color: "#c4b5fd",
          fontSize: "0.72rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "0 10px 10px 0",
        }}
      >
        v
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            width: "100%",
            background: "#161227",
            border: "1px solid #6d4aff",
            borderRadius: "10px",
            overflow: "hidden",
            zIndex: 100,
            boxShadow: "0 10px 28px rgba(0,0,0,0.45)",
          }}
        >
          {presets.map((count) => (
            <div
              key={count}
              onClick={() => {
                onChange(count);
                setOpen(false);
              }}
              onMouseEnter={(event) => {
                event.currentTarget.style.background = "#2b1f4d";
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.background = count === value ? "#2b1f4d" : "transparent";
              }}
              style={{
                padding: "10px 12px",
                fontSize: "0.92rem",
                color: count === value ? "#f0ece4" : "#b7afd6",
                cursor: "pointer",
                background: count === value ? "#2b1f4d" : "transparent",
                fontFamily: "'Cormorant Garamond', Georgia, serif",
                letterSpacing: "0.06em",
                textAlign: "center",
              }}
            >
              {count} cards
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
