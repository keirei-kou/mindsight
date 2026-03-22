import { useState, useEffect, useRef } from "react";

export function SlotPicker({ value, onChange, colorCount = 6 }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const presets = Array.from({ length: 6 }, (_, i) => colorCount * (i + 1)).filter(n => n <= 36);

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-flex", width: "110px" }}>
      <input
        type="number" min={2} max={36} value={value}
        onChange={e => { const v = parseInt(e.target.value); if (!isNaN(v)) onChange(Math.min(36, v)); }}
        onBlur={e => { const v = parseInt(e.target.value); if (isNaN(v) || v < 2) onChange(2); }}
        onFocus={e => e.target.select()}
        onClick={e => e.target.select()}
        style={{ flex: 1, width: "100%", background: "#1c1c28", border: "1px solid #252530", borderRadius: "6px", color: "#f0ece4", padding: "9px 32px 9px 12px", fontSize: "1rem", fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
      />
      <button onClick={() => setOpen(o => !o)} style={{ position: "absolute", right: "0", top: "0", bottom: "0", width: "28px", background: "none", border: "none", borderLeft: "1px solid #252530", cursor: "pointer", color: "#555", fontSize: "0.6rem", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "0 6px 6px 0" }}>▾</button>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, width: "100%", background: "#1c1c28", border: "1px solid #252530", borderRadius: "6px", overflow: "hidden", zIndex: 100, boxShadow: "0 8px 24px rgba(0,0,0,0.5)" }}>
          {presets.map(n => (
            <div
              key={n}
              onClick={() => { onChange(n); setOpen(false); }}
              onMouseEnter={e => { e.currentTarget.style.background = "#1e1e2e"; }}
              onMouseLeave={e => { e.currentTarget.style.background = n === value ? "#1e1e2e" : "transparent"; }}
              style={{ padding: "8px 12px", fontSize: "0.85rem", color: n === value ? "#f97316" : "#888", cursor: "pointer", background: n === value ? "#1e1e2e" : "transparent", fontFamily: "inherit" }}
            >
              {n} cards
            </div>
          ))}
        </div>
      )}
    </div>
  );
}