import { useState, useEffect, useRef } from "react";

/* ─── CONSTANTS ─────────────────────────────────────── */
// Load elegant font
if (typeof document !== 'undefined' && !document.getElementById('gs-font')) {
  const l = document.createElement('link');
  l.id = 'gs-font';
  l.rel = 'stylesheet';
  l.href = 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;600&display=swap';
  document.head.appendChild(l);
}

if (typeof document !== "undefined" && !document.getElementById("pulse-style")) {
  const s = document.createElement("style");
  s.id = "pulse-style";
  s.textContent = "@keyframes pulse { 0%,100%{box-shadow:0 2px 20px #7c3aed88} 50%{box-shadow:0 2px 32px #db2777cc} }";
  document.head.appendChild(s);
}

const SPINNER_STYLE = 'input[type=number]::-webkit-inner-spin-button,input[type=number]::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}input[type=number]{-moz-appearance:textfield}';

if (typeof document !== 'undefined' && !document.getElementById('no-spinner')) {
  const s = document.createElement('style');
  s.id = 'no-spinner';
  s.textContent = SPINNER_STYLE;
  document.head.appendChild(s);
}

const CATEGORIES = {
  Colors: { label: "Colors", items: [
    { name: "Red",    symbol: "🔴", hex: "#ef4444" },
    { name: "Orange", symbol: "🟠", hex: "#f97316" },
    { name: "Yellow", symbol: "🟡", hex: "#eab308" },
    { name: "Green",  symbol: "🟢", hex: "#22c55e" },
    { name: "Blue",   symbol: "🔵", hex: "#3b82f6" },
    { name: "Purple", symbol: "🟣", hex: "#a855f7" },
  ]},
  Numbers: { label: "Numbers", items: [
    { name: "One",   symbol: "⚀", hex: "#f87171" },
    { name: "Two",   symbol: "⚁", hex: "#fb923c" },
    { name: "Three", symbol: "⚂", hex: "#facc15" },
    { name: "Four",  symbol: "⚃", hex: "#4ade80" },
    { name: "Five",  symbol: "⚄", hex: "#60a5fa" },
    { name: "Six",   symbol: "⚅", hex: "#c084fc" },
  ]},
  Shapes: { label: "Shapes", items: [
    { name: "Circle",    symbol: "⬤", hex: "#f87171" },
    { name: "Oval",      symbol: "🥚", hex: "#fb923c" },
    { name: "Square",    symbol: "■", hex: "#facc15" },
    { name: "Rectangle", symbol: "➖", hex: "#4ade80" },
    { name: "Triangle",  symbol: "▲", hex: "#60a5fa" },
    { name: "Diamond",   symbol: "◆", hex: "#c084fc" },
    { name: "Star",      symbol: "★", hex: "#f9a8d4" },
    { name: "Wavy",      symbol: "≋", hex: "#a78bfa" },
    { name: "Cross",     symbol: "✚", hex: "#f0abfc" },
  ]},
};

const HUE_ORDER = ["Red","Orange","Yellow","Green","Blue","Purple"];
const WARM = new Set(["Red","Orange","Yellow"]);

function itemMap(items) { return Object.fromEntries(items.map(c => [c.name, c])); }

function hueDistance(a, b) {
  const ai = HUE_ORDER.indexOf(a), bi = HUE_ORDER.indexOf(b);
  const n = HUE_ORDER.length;
  const d = Math.abs(ai - bi);
  return Math.min(d, n - d);
}

function proximityScore(firstGuess, target) {
  const d = hueDistance(firstGuess, target);
  return Math.round((1 - d / 3) * 100);
}

function accuracyScore(attempts) {
  return attempts > 0 ? Math.round((1 / attempts) * 100) : 0;
}

function patternLabel(guesses, target) {
  if (!guesses.length) return null;
  const firstDist = hueDistance(guesses[0], target);
  if (firstDist === 0) return "Exact";
  const inFamily = WARM.has(target) === WARM.has(guesses[0]);
  if (guesses.length === 1) return firstDist === 1 ? "Adjacent" : inFamily ? "Warm/Cool" : "Off-family";
  let converging = true;
  for (let i = 1; i < guesses.length; i++) {
    if (hueDistance(guesses[i], target) >= hueDistance(guesses[i-1], target)) { converging = false; break; }
  }
  if (converging) return inFamily ? "Converging +" : "Converging";
  return inFamily ? "Warm/Cool" : "Random";
}

function fmt(ms) {
  if (ms == null) return "—";
  return (ms / 1000).toFixed(1) + "s";
}

function cryptoRandom() {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return arr[0] / (0xFFFFFFFF + 1);
}

function generateSlots(colors, count, mode) {
  if (mode === "stratified") {
    const sets = Math.ceil(count / colors.length);
    const pool = Array.from({ length: sets }, () => [...colors]).flat();
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(cryptoRandom() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, count);
  }
  return Array.from({ length: count }, () => colors[Math.floor(cryptoRandom() * colors.length)]);
}

/* ─── SETUP ─────────────────────────────────────────── */
function SlotPicker({ value, onChange, colorCount = 6 }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);
  const presets = Array.from({ length: 6 }, (_, i) => colorCount * (i + 1)).filter(n => n <= 36);
  return (
    <div ref={ref} style={{ position: "relative", display: "inline-flex", width: "110px" }}>
      <input type="number" min={2} max={36} value={value} onChange={e => { const v = parseInt(e.target.value); if (!isNaN(v)) onChange(Math.min(36, v)); }} onBlur={e => { const v = parseInt(e.target.value); if (isNaN(v) || v < 2) onChange(2); }} onFocus={e => e.target.select()} onClick={e => e.target.select()} style={{ flex: 1, width: "100%", background: "#1c1c28", border: "1px solid #252530", borderRadius: "6px", color: "#f0ece4", padding: "9px 32px 9px 12px", fontSize: "1rem", fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
      <button onClick={() => setOpen(o => !o)} style={{ position: "absolute", right: "0", top: "0", bottom: "0", width: "28px", background: "none", border: "none", borderLeft: "1px solid #252530", cursor: "pointer", color: "#555", fontSize: "0.6rem", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "0 6px 6px 0" }}>▾</button>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, width: "100%", background: "#1c1c28", border: "1px solid #252530", borderRadius: "6px", overflow: "hidden", zIndex: 100, boxShadow: "0 8px 24px rgba(0,0,0,0.5)" }}>
          {presets.map(n => (
            <div key={n} onClick={() => { onChange(n); setOpen(false); }} style={{ padding: "8px 12px", fontSize: "0.85rem", color: n === value ? "#f97316" : "#888", cursor: "pointer", background: n === value ? "#1e1e2e" : "transparent", fontFamily: "inherit" }} onMouseEnter={e => e.currentTarget.style.background="#1e1e2e"} onMouseLeave={e => e.currentTarget.style.background=n===value?"#1e1e2e":"transparent"}>{n} cards</div>
          ))}
        </div>
      )}
    </div>
  );
}

function Setup({ onStart }) {
  const [appMode, setAppMode]   = useState("group");
  const [soloName, setSoloName] = useState("User 1");
  const [names, setNames]       = useState(["User 1", "User 2"]);
  const defaultEnabled = new Set(["Red", "Blue"]);
  const [slots, setSlots]       = useState(defaultEnabled.size);
  const [category, setCategory] = useState("Colors");
  const [enabled, setEnabled]   = useState(new Set(["Red", "Blue"]));
  const [mode, setMode]         = useState("stratified");
  const slotsUserSet = useRef(false);
  const slotsRef     = useRef(defaultEnabled.size);
  slotsRef.current = slots;
  const catMemory = useRef(
    Object.fromEntries(Object.keys(CATEGORIES).map(cat => [
      cat,
      { enabled: cat === "Colors" ? new Set(defaultEnabled) : new Set(CATEGORIES[cat].items.map(c => c.name)), preview: null }
    ]))
  );

  const updateName = (i, v) => { const n = [...names]; n[i] = v; setNames(n); };
  const inputRefs = useRef([]);

  const handleNameKeyDown = (e, i) => {
    if (e.key === "Tab" && !e.shiftKey) {
      if (i === names.length - 1 && names[i].trim() && names.length < 10) {
        e.preventDefault();
        setNames(prev => {
          const next = [...prev, ""];
          setTimeout(() => inputRefs.current[next.length - 1]?.focus(), 0);
          return next;
        });
      }
    }
  };
  const addP   = () => names.length < 10 && setNames([...names, ""]);
  const removeP = (i) => names.length > 1 && setNames(names.filter((_, j) => j !== i));

  const switchCategory = (cat) => {
    catMemory.current[category] = { enabled: new Set(enabled), preview };
    const saved = catMemory.current[cat];
    const restoredEnabled = saved.enabled;
    const restoredItems = CATEGORIES[cat].items.filter(c => restoredEnabled.has(c.name));
    setCategory(cat);
    setEnabled(restoredEnabled);
    const currentSlots = slotsRef.current;
    if (!slotsUserSet.current) setSlots(Math.max(2, restoredItems.length));
    // If preview exists and user has set a slot count, re-roll with current slot value
    if (saved.preview && slotsUserSet.current) {
      const g = generateSlots(restoredItems, currentSlots, mode);
      const ct = {};
      restoredItems.forEach(c => { ct[c.name] = 0; });
      g.forEach(s => { ct[s.name] = (ct[s.name] || 0) + 1; });
      const p = { generated: g, counts: ct };
      setPreview(p);
      catMemory.current[cat] = { enabled: restoredEnabled, preview: p };
    } else {
      setPreview(saved.preview ?? null);
    }
  };

  const toggleItem = (name) => {
    if (enabled.has(name) && enabled.size <= 2) return;
    const s = new Set(enabled); s.has(name) ? s.delete(name) : s.add(name); setEnabled(s);
    const newActiveItems = CATEGORIES[category].items.filter(c => s.has(c.name));
    const effectiveSlots = slotsUserSet.current ? slots : newActiveItems.length;
    if (!slotsUserSet.current) setSlots(newActiveItems.length);
    if (preview) {
      const generated = generateSlots(newActiveItems, effectiveSlots, mode);
      const counts = {};
      newActiveItems.forEach(c => { counts[c.name] = 0; });
      generated.forEach(sl => { counts[sl.name] = (counts[sl.name] || 0) + 1; });
      const newPreview = { generated, counts };
      setPreview(newPreview);
      catMemory.current[category] = { enabled: s, preview: newPreview };
    } else {
      catMemory.current[category] = { enabled: s, preview: null };
    }
  };

  const activeItems = CATEGORIES[category].items.filter(c => enabled.has(c.name));
  const canStart = (appMode === "individual" ? soloName.trim() : names.some(n => n.trim())) && activeItems.length >= 1;
  const [preview, setPreview] = useState(null);

  const runPreview = () => {
    const hasAnyPreview = Object.values(catMemory.current).some(m => m.preview !== null);
    if (!hasAnyPreview) {
      Object.keys(CATEGORIES).forEach(cat => {
        const mem = catMemory.current[cat];
        const catEnabled = mem?.enabled ?? new Set(CATEGORIES[cat].items.map(c => c.name));
        const catItems = CATEGORIES[cat].items.filter(c => catEnabled.has(c.name));
        const count = slotsUserSet.current ? slots : catItems.length;
        const g = generateSlots(catItems, count, mode);
        const ct = {};
        catItems.forEach(c => { ct[c.name] = 0; });
        g.forEach(s => { ct[s.name] = (ct[s.name] || 0) + 1; });
        const p = { generated: g, counts: ct };
        catMemory.current[cat] = { enabled: catEnabled, preview: p };
        if (cat === category) setPreview(p);
      });
    } else {
      const generated = generateSlots(activeItems, slots, mode);
      const counts = {};
      activeItems.forEach(c => { counts[c.name] = 0; });
      generated.forEach(s => { counts[s.name] = (counts[s.name] || 0) + 1; });
      const newPreview = { generated, counts };
      setPreview(newPreview);
      catMemory.current[category] = { enabled, preview: newPreview };
    }
  };

  const go = () => {
    const generated = preview ? preview.generated : generateSlots(activeItems, slots, mode);
    if (appMode === "individual") {
      onStart({ appMode: "individual", name: soloName.trim(), slots: generated, colors: activeItems, category });
    } else {
      const participants = names.filter(n => n.trim()).map((n, i) => ({ id: i, name: n.trim(), active: true }));
      onStart({ appMode: "group", participants, slots: generated, colors: activeItems, category });
    }
  };

  const inp = { flex: 1, background: "#1c1c28", border: "1px solid #252530", borderRadius: "6px", color: "#f0ece4", padding: "9px 12px", fontSize: "0.88rem", fontFamily: "inherit", outline: "none" };

  return (
    <div style={{ minHeight: "100vh", background: "#141420", color: "#f0ece4", fontFamily: "'Georgia', serif", display: "flex", flexDirection: "column", alignItems: "center", padding: "48px 24px" }}>
      <div style={{ position: "relative", marginBottom: "40px", textAlign: "center", padding: "28px 20px", borderRadius: "16px", background: "linear-gradient(180deg, #06030f 0%, #0a0618 50%, #111118 100%)", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: "10%", left: "10%", width: "200px", height: "80px", background: "radial-gradient(ellipse, #4c1d9555 0%, transparent 70%)", filter: "blur(16px)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: "20%", right: "10%", width: "160px", height: "70px", background: "radial-gradient(ellipse, #86198f44 0%, transparent 70%)", filter: "blur(14px)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: "0%", left: "30%", width: "180px", height: "50px", background: "radial-gradient(ellipse, #3730a344 0%, transparent 70%)", filter: "blur(18px)", pointerEvents: "none" }} />
        {[
          ["3%","8px","#e9d5ff","0.9","0.5rem","✦"],["8%","52px","#fff","0.5","0.16rem","·"],
          ["13%","20px","#c4b5fd","0.7","0.22rem","★"],["18%","65px","#f0abfc","0.85","0.4rem","✦"],
          ["23%","5px","#fff","0.35","0.15rem","·"],["28%","48px","#ddd6fe","0.7","0.28rem","✦"],
          ["33%","75px","#a5b4fc","0.5","0.2rem","·"],["38%","2px","#f5d0fe","0.9","0.46rem","★"],
          ["43%","68px","#fff","0.3","0.15rem","·"],["49%","0px","#c4b5fd","0.8","0.44rem","✦"],
          ["54%","72px","#fbcfe8","0.6","0.24rem","★"],["59%","10px","#fff","0.4","0.17rem","·"],
          ["64%","58px","#e9d5ff","0.8","0.36rem","✦"],["69%","4px","#a5b4fc","0.65","0.3rem","★"],
          ["74%","66px","#fff","0.28","0.14rem","·"],["79%","12px","#f0abfc","0.88","0.5rem","✦"],
          ["84%","54px","#ddd6fe","0.55","0.2rem","·"],["89%","7px","#fbcfe8","0.75","0.32rem","★"],
          ["94%","44px","#c4b5fd","0.6","0.22rem","✦"],["97%","25px","#fff","0.4","0.16rem","·"],
          ["46%","38px","#fff","0.22","0.13rem","·"],["15%","40px","#e9d5ff","0.4","0.18rem","✦"],
          ["70%","36px","#f5d0fe","0.45","0.2rem","★"],["52%","18px","#ddd6fe","0.3","0.15rem","·"],
        ].map(([l,t,c,o,fs,sym],i) => (
          <div key={i} style={{ position: "absolute", left: l, top: t, color: c, opacity: parseFloat(o), fontSize: fs, pointerEvents: "none", userSelect: "none", lineHeight: 1, zIndex: 0 }}>{sym}</div>
        ))}
        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontSize: "2.9rem", fontWeight: 600, letterSpacing: "0.35em", textTransform: "uppercase", background: "linear-gradient(120deg, #93c5fd 0%, #a78bfa 40%, #e879f9 70%, #f9a8d4 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", lineHeight: 1.1, filter: "drop-shadow(0 0 20px #a78bfacc) drop-shadow(0 0 50px #7c3aed66)" }}>
            MINDSIGHT
          </div>
          <div style={{ fontSize: "0.78rem", letterSpacing: "0.35em", color: "#6b5aaa", textTransform: "uppercase", marginTop: "6px" }}>ROUND SETUP</div>
        </div>
      </div>
      <div style={{ width: "100%", maxWidth: "340px", display: "flex", flexDirection: "column", gap: "32px" }}>

        <section>
          <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
            <button onClick={() => setAppMode("individual")} style={{ flex: 1, padding: "11px 12px", borderRadius: "10px", border: appMode==="individual" ? "none" : "1.5px solid #2a2a3a", background: appMode==="individual" ? "linear-gradient(135deg, #1e1a2e, #2d1f4e)" : "#1c1c28", color: appMode==="individual" ? "#c4b5fd" : "#555", fontSize: "0.8rem", fontFamily: "inherit", fontWeight: appMode==="individual" ? 600 : 400, letterSpacing: "0.04em", cursor: "pointer", boxShadow: appMode==="individual" ? "0 4px 16px #7c3aed33" : "none", transition: "all 0.15s" }}>Individual Training</button>
            <button onClick={() => setAppMode("group")} style={{ flex: 1, padding: "11px 12px", borderRadius: "10px", border: appMode==="group" ? "none" : "1.5px solid #2a2a3a", background: appMode==="group" ? "linear-gradient(135deg, #1e1a2e, #2d1f4e)" : "#1c1c28", color: appMode==="group" ? "#c4b5fd" : "#555", fontSize: "0.8rem", fontFamily: "inherit", fontWeight: appMode==="group" ? 600 : 400, letterSpacing: "0.04em", cursor: "pointer", boxShadow: appMode==="group" ? "0 4px 16px #7c3aed33" : "none", transition: "all 0.15s" }}>Group Facilitation</button>
          </div>
          {appMode === "individual" ? (
            <div>
              <SLabel>Your Name</SLabel>
              <input value={soloName} onChange={e => setSoloName(e.target.value)} onClick={e => e.target.select()} placeholder="Your name" style={{ ...inp, width: "100%", boxSizing: "border-box" }} />
            </div>
          ) : (
            <div>
              <SLabel>Participants</SLabel>
              {names.map((n, i) => (
                <div key={i} style={{ display: "flex", gap: "8px", marginBottom: "7px", alignItems: "center" }}>
                  <span style={{ color: "#353545", fontSize: "0.75rem", width: "16px", textAlign: "right", flexShrink: 0 }}>{i+1}</span>
                  <input ref={el => inputRefs.current[i] = el} value={n} onChange={e => updateName(i, e.target.value)} onKeyDown={e => handleNameKeyDown(e, i)} onClick={e => e.target.select()} placeholder={"Participant " + (i+1)} style={inp} />
                  {names.length > 1 && <GhostBtn small tabIndex={-1} onClick={() => removeP(i)}>✕</GhostBtn>}
                </div>
              ))}
              {names.length < 10 && <div style={{display:"flex",justifyContent:"center"}}><button onClick={addP} style={{ marginTop: "16px", width: "fit-content", background: "#2a2a55", border: "1px solid #7777cc", borderRadius: "6px", color: "#bbbbee", padding: "7px 16px", cursor: "pointer", fontSize: "0.78rem", fontFamily: "inherit", letterSpacing: "0.06em" }}>+ Add Participant</button></div>}
            </div>
          )}
        </section>

        <section>
          <SLabel centered>Cards per Round</SLabel>
          <div style={{display:"flex",justifyContent:"center"}}><SlotPicker value={slots} onChange={(newSlots) => {
  setSlots(newSlots);
  slotsUserSet.current = true;
  if (catMemory.current[category]?.preview) {
    const g = generateSlots(activeItems, newSlots, mode);
    const ct = {};
    activeItems.forEach(c => { ct[c.name] = 0; });
    g.forEach(s => { ct[s.name] = (ct[s.name]||0)+1; });
    const p = { generated: g, counts: ct };
    setPreview(p);
    catMemory.current[category] = { enabled, preview: p };
  }
}} colorCount={activeItems.length} /></div>
        </section>

        <section>
          <div style={{ fontSize: "0.78rem", color: "#9090bb", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "10px", fontWeight: 500 }}>Category</div>
          <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
            {Object.keys(CATEGORIES).map(cat => {
              const isActive = category === cat;
              const styles = {
                Colors: { bg: "linear-gradient(135deg, #dc2626 0%, #ea580c 20%, #ca8a04 40%, #16a34a 60%, #2563eb 80%, #9333ea 100%)", border: "1.5px solid rgba(255,255,255,0.35)", color: "white", shadow: "0 0 0 1px rgba(255,255,255,0.15), 0 4px 16px rgba(0,0,0,0.4)", textShadow: "0 1px 4px rgba(0,0,0,0.5)" },
                Numbers: { bg: "linear-gradient(135deg, #1a1200, #2d2000, #1a1200)", border: "1.5px solid #b8972a", color: "#f0c040", shadow: "0 4px 16px rgba(184,151,42,0.3)", textShadow: "0 0 8px rgba(240,192,64,0.6)" },
                Shapes:  { bg: "linear-gradient(135deg, #a7f3d0, #bfdbfe, #ddd6fe)", border: "1.5px solid rgba(255,255,255,0.5)", color: "#334155", shadow: "none", textShadow: "none" },
              };
              const s = styles[cat] || styles.Colors;
              return (
                <button key={cat} onClick={() => switchCategory(cat)} style={{ position: "relative", background: isActive ? s.bg : "#1c1c28", border: isActive ? s.border : "1.5px solid #2a2a3a", borderRadius: "10px", padding: "11px 22px", cursor: "pointer", color: isActive ? s.color : "#555", fontSize: "0.88rem", fontFamily: cat==="Numbers" ? "Georgia, serif" : "inherit", fontWeight: isActive ? 600 : 400, letterSpacing: "0.06em", transition: "all 0.15s", boxShadow: isActive ? s.shadow : "none", textShadow: isActive ? s.textShadow : "none", overflow: "hidden" }}>
                  {isActive && cat==="Colors" && <span style={{ position: "absolute", top: "-30%", left: "-20%", width: "40%", height: "160%", background: "linear-gradient(105deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.28) 50%, rgba(255,255,255,0) 100%)", pointerEvents: "none", transform: "skewX(-15deg)" }} />}
                  {cat}
                </button>
              );
            })}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
            <div style={{ fontSize: "0.72rem", color: "#b0b0cc", letterSpacing: "0.15em", textTransform: "uppercase", fontWeight: 500 }}>Active {CATEGORIES[category].label}</div>
            <div style={{ display: "flex", gap: "6px" }}>
              <button onClick={() => {
                const s = new Set(CATEGORIES[category].items.map(c => c.name));
                setEnabled(s);
                const items = CATEGORIES[category].items;
                const effectiveSlots = slotsUserSet.current ? slots : items.length;
                if (!slotsUserSet.current) setSlots(items.length);
                if (preview) {
                  const g = generateSlots(items, effectiveSlots, mode);
                  const ct = {}; items.forEach(c => { ct[c.name]=0; }); g.forEach(sl => { ct[sl.name]=(ct[sl.name]||0)+1; });
                  const p = { generated: g, counts: ct }; setPreview(p); catMemory.current[category] = { enabled: s, preview: p };
                } else { catMemory.current[category] = { enabled: s, preview: null }; }
              }} style={{ fontSize: "0.65rem", color: "#9090bb", background: "transparent", border: "1px solid #3a3a55", borderRadius: "4px", padding: "3px 8px", cursor: "pointer", fontFamily: "inherit", letterSpacing: "0.05em" }}>All</button>
              <button onClick={() => {
                const defaultPairs = { Colors: ["Red","Blue"], Numbers: ["One","Six"], Shapes: ["Circle","Triangle"] };
                const pair = defaultPairs[category] || [CATEGORIES[category].items[0].name, CATEGORIES[category].items[1].name];
                const s = new Set(pair);
                const pairItems = CATEGORIES[category].items.filter(c => s.has(c.name));
                setEnabled(s);
                const effectiveSlots = slotsUserSet.current ? Math.max(2, slots) : 2;
                if (!slotsUserSet.current) setSlots(2);
                else setSlots(prev => Math.max(2, prev));
                if (preview) {
                  const g = generateSlots(pairItems, effectiveSlots, mode);
                  const ct = {}; pairItems.forEach(c => { ct[c.name]=0; }); g.forEach(sl => { ct[sl.name]=(ct[sl.name]||0)+1; });
                  const p = { generated: g, counts: ct }; setPreview(p); catMemory.current[category] = { enabled: s, preview: p };
                } else { catMemory.current[category] = { enabled: s, preview: null }; }
              }} style={{ fontSize: "0.65rem", color: "#9090bb", background: "transparent", border: "1px solid #3a3a55", borderRadius: "4px", padding: "3px 8px", cursor: "pointer", fontFamily: "inherit", letterSpacing: "0.05em" }}>None</button>
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {CATEGORIES[category].items.map(c => {
              const on = enabled.has(c.name);
              return (
                <button key={c.name} title={on && enabled.size <= 2 ? "Minimum 2 active items, 2 rounds" : c.name} onClick={() => toggleItem(c.name)} style={{ background: on ? "#1c1c28" : "transparent", border: `2px solid ${on ? c.hex : "#252530"}`, borderRadius: "8px", padding: "7px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", opacity: on ? 1 : 0.7, transition: "all 0.12s", fontFamily: "inherit", position: "relative" }}>
                  <span style={{ fontSize: "1.1rem", lineHeight: 1 }}>{c.symbol}</span>
                  <span style={{ fontSize: "0.78rem", color: on ? c.hex : "#888" }}>{c.name}</span>
                  {on && preview && (
                    <span style={{ position: "absolute", top: "-10px", right: "-10px", background: preview.counts[c.name] > 0 ? c.hex : "#252535", color: preview.counts[c.name] > 0 ? "white" : "#666", borderRadius: "99px", fontSize: "0.7rem", fontWeight: 700, minWidth: "22px", height: "22px", display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px", lineHeight: 1, border: "2px solid #111118", boxShadow: preview.counts[c.name] > 0 ? `0 0 6px ${c.hex}88` : "none" }}>
                      {preview.counts[c.name] > 0 ? `×${preview.counts[c.name]}` : "×0"}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        <section>
          <div style={{ fontSize: "0.72rem", color: "#b0b0cc", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "10px", fontWeight: 500 }}>Generation Mode</div>
          <div style={{ display: "flex", gap: "10px" }}>
            <button onClick={() => { setMode("stratified"); setPreview(null); Object.keys(CATEGORIES).forEach(cat => { catMemory.current[cat] = { enabled: catMemory.current[cat]?.enabled ?? new Set(CATEGORIES[cat].items.map(c => c.name)), preview: null }; }); }} style={{ background: mode==="stratified" ? "#1a0f00" : "transparent", border: `2px solid ${mode==="stratified" ? "#f97316" : "#252530"}`, borderRadius: "8px", padding: "9px 18px", cursor: "pointer", color: mode==="stratified" ? "#f97316" : "#444", fontSize: "0.83rem", fontFamily: "inherit", transition: "all 0.12s" }}>⚖️ Stratified</button>
            <button onClick={() => { setMode("pure"); setPreview(null); Object.keys(CATEGORIES).forEach(cat => { catMemory.current[cat] = { enabled: catMemory.current[cat]?.enabled ?? new Set(CATEGORIES[cat].items.map(c => c.name)), preview: null }; }); }} style={{ background: mode==="pure" ? "#00101a" : "transparent", border: `2px solid ${mode==="pure" ? "#38bdf8" : "#252530"}`, borderRadius: "8px", padding: "9px 18px", cursor: "pointer", color: mode==="pure" ? "#38bdf8" : "#444", fontSize: "0.83rem", fontFamily: "inherit", transition: "all 0.12s" }}>🎲 Pure Crypto</button>
          </div>
        </section>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "8px" }}>
          <button onClick={runPreview} disabled={!canStart} style={{ background: canStart ? "#0f1a2e" : "#1c1c28", border: canStart ? "1px solid #3b82f6" : "1px solid #252530", borderRadius: "8px", color: canStart ? "#60a5fa" : "#333", padding: "12px", fontSize: "0.82rem", fontFamily: "inherit", letterSpacing: "0.1em", textTransform: "uppercase", cursor: canStart ? "pointer" : "not-allowed", transition: "all 0.2s" }}>
            {preview ? "🔄 Re-roll Preview" : "🎲 Preview Distribution"}
          </button>
          <div style={{ fontSize: "0.68rem", color: "#6060a0", letterSpacing: "0.04em", lineHeight: 1.6 }}>
            {mode === "stratified"
              ? "Stratified: every item appears equally, counts guaranteed. Order is shuffled by CSPRNG — computationally unpredictable, seeded from OS hardware entropy."
              : "CSPRNG: each card drawn independently from OS entropy (hardware noise, CPU jitter). Sits between deterministic PRNG and true QRNG — computationally unpredictable but classically deterministic in principle. Items can cluster, repeat, or go missing from the pool entirely."}
            {preview && <span style={{ color: "#7070aa" }}> · {slots} cards locked in.</span>}
          </div>
          <button onClick={go} disabled={!canStart || !preview} style={{ background: (canStart && preview) ? "linear-gradient(120deg, #3b82f6 0%, #7c3aed 50%, #db2777 100%)" : "#1c1c28", border: (canStart && preview) ? "none" : "1px solid #252530", borderRadius: "8px", color: (canStart && preview) ? "white" : "#333", padding: "15px", fontSize: "0.95rem", fontFamily: "Cormorant Garamond, Georgia, serif", letterSpacing: "0.18em", textTransform: "uppercase", cursor: (canStart && preview) ? "pointer" : "not-allowed", boxShadow: (canStart && preview) ? "0 4px 28px #7c3aed55, 0 0 60px #3b82f622" : "none", transition: "all 0.2s" }}>
            {appMode === "individual" ? "Begin Training →" : "Start Round →"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── SLOT TIMER HOOK ────────────────────────────────── */
function useSlotTimers(slotCount) {
  const [timers, setTimers] = useState(() => Array.from({ length: slotCount }, () => ({ startMs: null, endMs: null })));
  const [now, setNow]       = useState(Date.now());
  const raf                 = useRef(null);

  useEffect(() => {
    const tick = () => { setNow(Date.now()); raf.current = requestAnimationFrame(tick); };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, []);

  const startSlot = (si) => setTimers(prev => {
    const next = [...prev];
    if (!next[si].startMs) next[si] = { ...next[si], startMs: Date.now(), endMs: null };
    return next;
  });

  const endSlot = (si) => setTimers(prev => {
    const next = [...prev];
    if (next[si].startMs && !next[si].endMs) next[si] = { ...next[si], endMs: Date.now() };
    return next;
  });

  const elapsed = (si) => {
    const t = timers[si];
    if (!t.startMs) return null;
    return (t.endMs ?? now) - t.startMs;
  };

  const totalSessionMs = () => {
    const starts = timers.map(t => t.startMs).filter(Boolean);
    const ends   = timers.map(t => t.endMs).filter(Boolean);
    if (!starts.length) return null;
    const first = Math.min(...starts);
    const last  = ends.length === timers.filter(t => t.startMs).length ? Math.max(...ends) : now;
    return last - first;
  };

  return { timers, startSlot, endSlot, elapsed, totalSessionMs };
}

/* ─── SESSION ────────────────────────────────────────── */
function Session({ participants: initP, slots, colors, category, onEnd }) {
  const itemLookup = itemMap(colors);
  const [participants, setParticipants] = useState(initP);
  const [activeSlot, setActiveSlot]     = useState(null);
  const [session, setSession]           = useState({});
  const [editCursor, setEditCursor]     = useState(null);
  const { timers, startSlot, endSlot, elapsed, totalSessionMs } = useSlotTimers(slots.length);

  const getCell    = (pid, si) => session[pid]?.[si] ?? { guesses: [], dnf: false, slotStart: null };
  const isResolved = (pid, si) => {
    const { guesses } = getCell(pid, si);
    return guesses.length > 0 && guesses[guesses.length-1].color === slots[si].name;
  };

  const allResolved = (si) => {
    const active = participants.filter(p => p.active);
    return active.length > 0 && active.every(p => isResolved(p.id, si) || getCell(p.id, si).dnf);
  };

  const isSlotLocked = (fromSi) => {
    if (fromSi === null) return false;
    return !allResolved(fromSi);
  };

  const activateSlot = (si) => {
    if (si !== activeSlot && isSlotLocked(activeSlot)) return;
    const lastCompleted = slots.reduce((acc, _, i) => allResolved(i) ? i : acc, -1);
    if (si > lastCompleted + 1 && si !== activeSlot) return;
    setActiveSlot(si);
    startSlot(si);
  };

  const logGuess = (pid, si, colorName) => {
    if (isResolved(pid, si)) return;
    setEditCursor(null);
    const now = Date.now();
    setSession(prev => {
      const cell = prev[pid]?.[si] ?? { guesses: [], dnf: false, slotStart: now };
      const newCell = { ...cell, guesses: [...cell.guesses, { color: colorName, ts: now }], dnf: false };
      return { ...prev, [pid]: { ...(prev[pid]??{}), [si]: newCell } };
    });
  };

  const markDNF = (pid, si) => {
    setSession(prev => ({ ...prev, [pid]: { ...(prev[pid]??{}), [si]: { guesses: [], dnf: true, slotStart: prev[pid]?.[si]?.slotStart ?? Date.now() } } }));
  };

  const removeDot = (pid, si, idx) => {
    setSession(prev => {
      const cell = prev[pid]?.[si] ?? { guesses: [], dnf: false };
      const newGuesses = cell.guesses.filter((_,i) => i !== idx);
      return { ...prev, [pid]: { ...(prev[pid]??{}), [si]: { ...cell, guesses: newGuesses } } };
    });
    setActiveSlot(si);
    setEditCursor(prev => {
      if (!prev || prev.pid !== pid || prev.si !== si) return prev;
      const cell = session[pid]?.[si] ?? { guesses: [] };
      const newLen = Math.max(0, cell.guesses.length - 1);
      const newIdx = Math.min(idx, newLen - 1);
      return newLen === 0 ? null : { pid, si, idx: Math.max(0, newIdx) };
    });
  };

  const truncateFrom = (pid, si, idx) => {
    setSession(prev => {
      const cell = prev[pid]?.[si] ?? { guesses: [], dnf: false };
      return { ...prev, [pid]: { ...(prev[pid]??{}), [si]: { ...cell, guesses: cell.guesses.slice(0, idx), dnf: true } } };
    });
    setActiveSlot(si);
    setEditCursor(null);
  };

  const selectDot = (pid, si, idx) => {
    if (editCursor?.pid === pid && editCursor?.si === si && editCursor?.idx === idx) {
      setEditCursor(null);
    } else {
      setEditCursor({ pid, si, idx });
    }
  };

  useEffect(() => {
    if (activeSlot !== null && allResolved(activeSlot)) endSlot(activeSlot);
  });

  useEffect(() => {
    const channel = new BroadcastChannel("mindsight-display");
    if (activeSlot !== null && slots[activeSlot]) {
      const slot = slots[activeSlot];
      channel.postMessage({ type: "card", card: { name: slot.name, symbol: slot.symbol, hex: slot.hex, category } });
    } else {
      channel.postMessage({ type: "clear" });
    }
    channel.onmessage = (e) => {
      if (e.data?.type === "request" && activeSlot !== null && slots[activeSlot]) {
        const slot = slots[activeSlot];
        channel.postMessage({ type: "card", card: { name: slot.name, symbol: slot.symbol, hex: slot.hex, category } });
      }
    };
    return () => channel.close();
  }, [activeSlot]);

  useEffect(() => {
    if (!editCursor) return;
    const { pid, si, idx } = editCursor;
    const handler = (e) => {
      const cell = session[pid]?.[si] ?? { guesses: [] };
      const len = cell.guesses.length;
      if (e.key === "Backspace") {
        e.preventDefault();
        setSession(prev => {
          const c = prev[pid]?.[si] ?? { guesses: [], dnf: false };
          return { ...prev, [pid]: { ...(prev[pid]??{}), [si]: { ...c, guesses: c.guesses.filter((_,i) => i !== idx) } } };
        });
        setActiveSlot(si);
        setEditCursor(len <= 1 ? null : { pid, si, idx: Math.max(0, idx - 1) });
      }
      if (e.key === "Delete") {
        e.preventDefault();
        if (idx < len - 1) {
          setSession(prev => {
            const c = prev[pid]?.[si] ?? { guesses: [], dnf: false };
            return { ...prev, [pid]: { ...(prev[pid]??{}), [si]: { ...c, guesses: c.guesses.filter((_,i) => i !== idx + 1) } } };
          });
          setActiveSlot(si);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [editCursor, session]);

  useEffect(() => {
    if (!editCursor) return;
    const { pid, si, idx } = editCursor;
    const handler = (e) => {
      const cell = session[pid]?.[si] ?? { guesses: [] };
      const len = cell.guesses.length;
      if (len === 0) return;
      e.preventDefault();
      if (e.deltaY > 0) {
        setEditCursor({ pid, si, idx: idx === len - 1 ? 0 : idx + 1 });
      } else {
        setEditCursor({ pid, si, idx: idx === 0 ? len - 1 : idx - 1 });
      }
    };
    window.addEventListener("wheel", handler, { passive: false });
    return () => window.removeEventListener("wheel", handler);
  }, [editCursor, session]);

  const toggleP = (pid) => setParticipants(prev => prev.map(p => p.id===pid ? {...p, active:!p.active} : p));

  const cellStats = (pid, si) => {
    const cell   = getCell(pid, si);
    const target = slots[si].name;
    const guesses = cell.guesses.map(g => g.color);
    if (!guesses.length && !cell.dnf) return null;
    const resolved = isResolved(pid, si);
    const acc      = resolved ? accuracyScore(guesses.length) : 0;
    const isColors = category === "Colors";
    const prox     = (guesses.length > 0 && isColors) ? proximityScore(guesses[0], target) : null;
    const pattern  = (guesses.length > 0 && isColors) ? patternLabel(guesses, target) : null;
    const slotStartTs = timers[si].startMs;
    const deltas = [];
    if (slotStartTs && cell.guesses.length > 0) {
      deltas.push(cell.guesses[0].ts - slotStartTs);
      for (let i = 1; i < cell.guesses.length; i++) deltas.push(cell.guesses[i].ts - cell.guesses[i-1].ts);
    }
    const avgTime = deltas.length > 1 ? deltas.slice(0,-1).reduce((a,b)=>a+b,0)/(deltas.length-1) : (deltas.length===1 ? deltas[0] : null);
    return { acc, prox, pattern, deltas, avgTime, resolved };
  };

  const participantSummary = (pid) => {
    const accs = [], proxs = [], times = [];
    slots.forEach((_, si) => {
      const s = cellStats(pid, si);
      if (!s) return;
      accs.push(s.acc);
      if (s.prox !== null) proxs.push(s.prox);
      if (s.avgTime !== null) times.push(s.avgTime);
    });
    return {
      avgAcc:  accs.length  ? Math.round(accs.reduce((a,b)=>a+b,0)/accs.length)  : null,
      avgProx: proxs.length ? Math.round(proxs.reduce((a,b)=>a+b,0)/proxs.length) : null,
      avgTime: times.length ? times.reduce((a,b)=>a+b,0)/times.length             : null,
    };
  };

  const NAME_W = 160, CELL_W = 200, SUMM_W = 200;
  const totalMs = totalSessionMs();

  return (
    <div style={{ minHeight: "100vh", background: "#141420", color: "#f0ece4", fontFamily: "'Georgia', serif", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "12px 20px", borderBottom: "1px solid #1c1c28", display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", flexShrink: 0, position: "relative" }}>
        <div style={{ position: "absolute", top: "12px", right: "20px" }}>
          <GhostBtn small danger onClick={onEnd}>End</GhostBtn>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: "10px" }}>
          <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontSize: "1.4rem", fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", background: "linear-gradient(120deg, #93c5fd 0%, #a78bfa 40%, #e879f9 70%, #f9a8d4 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", filter: "drop-shadow(0 0 8px #a78bfa66)" }}>MINDSIGHT</div>
          <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontSize: "1.4rem", fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", background: "linear-gradient(120deg, #93c5fd 0%, #a78bfa 40%, #e879f9 70%, #f9a8d4 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", filter: "drop-shadow(0 0 8px #a78bfa66)" }}>TRACKER</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <GhostBtn small onClick={() => activateSlot(Math.max(0, (activeSlot??0)-1))} disabled={activeSlot===0||activeSlot===null||isSlotLocked(activeSlot)}>← Prev Card</GhostBtn>
          {totalMs && <span style={{ fontSize: "0.72rem", color: "#22c55e", letterSpacing: "0.06em", fontVariantNumeric: "tabular-nums", display: "flex", alignItems: "center", gap: "5px" }}><span style={{ fontSize: "0.6rem", color: "#22c55e99", letterSpacing: "0.1em", textTransform: "uppercase" }}>Round Timer:</span><span style={{ fontVariantNumeric: "tabular-nums" }}>{fmt(totalMs)}</span></span>}
          <GhostBtn small onClick={() => activateSlot(Math.min(slots.length-1, (activeSlot??-1)+1))} disabled={activeSlot===slots.length-1||isSlotLocked(activeSlot)}>Next Card →</GhostBtn>
        </div>
      </div>

      <div style={{ overflowX: "auto", flex: 1, paddingTop: "16px", paddingRight: "16px", paddingBottom: "16px", paddingLeft: "0", position: "relative" }}>
        <div style={{ minWidth: `${NAME_W + slots.length*CELL_W + SUMM_W + 32}px` }}>
          <div style={{ display: "flex", marginBottom: "4px" }}>
            <div style={{ width: `${NAME_W}px`, minWidth: `${NAME_W}px`, position: "sticky", left: 0, background: "#141420", zIndex: 2, boxShadow: "4px 0 8px #111118" }} />
            {slots.map((slot, si) => {
              const isActive = si === activeSlot;
              const ms = elapsed(si);
              const done = timers[si].endMs !== null;
              return (
                <div key={si} onClick={() => activateSlot(si)}
                  title={
                    si === activeSlot ? "" :
                    isSlotLocked(activeSlot) ? "🚫 Cannot select card while current card is in session" :
                    activeSlot === null ? "Click this card to edit guesses" :
                    allResolved(activeSlot) ? "Click this card to edit guesses" : ""
                  }
                  style={{ width: `${CELL_W}px`, minWidth: `${CELL_W}px`, textAlign: "center", cursor: (si !== activeSlot && isSlotLocked(activeSlot)) ? "not-allowed" : "pointer", padding: "6px 4px 8px", borderRadius: "6px 6px 0 0", background: isActive ? "#1c1c28" : "transparent", borderBottom: `2px solid ${isActive ? slot.hex : "#2e2e44"}`, transition: "all 0.12s", userSelect: "none", opacity: (si !== activeSlot && isSlotLocked(activeSlot) && si > activeSlot) ? 0.35 : 1 }}>
                  <div style={{ fontSize: "0.72rem", fontWeight: 600, color: isActive ? slot.hex : "#6060a0", letterSpacing: "0.04em", marginBottom: "2px" }}>#{si+1}</div>
                  <div style={{ fontSize: "1.1rem", lineHeight: 1 }}>{slot.symbol}</div>
                  <div style={{ fontSize: "0.62rem", color: isActive ? slot.hex : "#5a5a7a", letterSpacing: "0.03em", marginTop: "2px", fontWeight: isActive ? 600 : 400 }}>{slot.name}</div>
                  {ms !== null && <div style={{ fontSize: "0.58rem", marginTop: "2px", color: done ? "#22c55e" : "#f97316", fontVariantNumeric: "tabular-nums" }}>{fmt(ms)}{done ? " ✓" : ""}</div>}
                </div>
              );
            })}
            <div style={{ width: `${SUMM_W}px`, minWidth: `${SUMM_W}px`, padding: "6px 8px 8px", borderBottom: "2px solid #1c1c28" }}>
              <div style={{ fontSize: "0.65rem", color: "#7070aa", letterSpacing: "0.08em", textTransform: "uppercase" }}>Total Round</div>
              {totalMs && <div style={{ fontSize: "0.75rem", color: "#22c55e", marginTop: "2px" }}>{fmt(totalMs)}</div>}
            </div>
          </div>

          {participants.map(p => {
            const summ = participantSummary(p.id);
            return (
              <div key={p.id} style={{ display: "flex", alignItems: "stretch", marginBottom: "4px", opacity: p.active ? 1 : 0.25, transition: "opacity 0.2s" }}>
                <div style={{ width: `${NAME_W}px`, minWidth: `${NAME_W}px`, display: "flex", alignItems: "center", justifyContent: "center", paddingRight: "8px", paddingLeft: "4px", position: "sticky", left: 0, background: "#141420", zIndex: 2, boxShadow: "4px 0 8px #111118", border: "1px solid #1e1e2e", borderRadius: "5px" }}>
                  <button onClick={() => toggleP(p.id)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", color: "#f0ece4", padding: "4px 0", width: "100%", textAlign: "center", justifyContent: "center", fontFamily: "inherit" }}>
                    <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: p.active ? "#22c55e" : "#252535", flexShrink: 0, transition: "background 0.2s" }} />
                    <span style={{ fontSize: "0.82rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100px" }}>{p.name}</span>
                  </button>
                </div>

                {slots.map((slot, si) => {
                  const cell     = getCell(p.id, si);
                  const resolved = isResolved(p.id, si);
                  const isActive = si === activeSlot;
                  const stats    = cellStats(p.id, si);
                  return (
                    <div key={si} style={{ width: `${CELL_W}px`, minWidth: `${CELL_W}px`, background: isActive ? "#181825" : "#111118", border: resolved ? `1px solid ${slot.hex}66` : isActive ? "1px solid #3a3a55" : "1px solid #1e1e2e", borderRadius: "5px", padding: "8px 7px", display: "flex", flexDirection: "column", gap: "5px", transition: "background 0.12s", alignItems: "center", textAlign: "center", userSelect: "none" }}>
                      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "2px", minHeight: "18px" }}>
                        {cell.guesses.map((g, gi) => {
                          const gc = itemLookup[g.color];
                          const isLast = gi === cell.guesses.length - 1;
                          const isCorr = isLast && g.color === slot.name;
                          const delta  = stats?.deltas?.[gi];
                          return (
                            <div key={gi} style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
                              {gi > 0 && delta != null && (
                                <div style={{ display: "flex", alignItems: "center", margin: "0 1px" }}>
                                  <div style={{ height: "1px", width: "6px", background: "#252535" }} />
                                  <span style={{ fontSize: "0.5rem", color: "#5a5a80", whiteSpace: "nowrap", margin: "0 1px" }}>{fmt(delta)}</span>
                                  <div style={{ height: "1px", width: "6px", background: "#252535" }} />
                                </div>
                              )}
                              <div onClick={(e) => {
                                  e.preventDefault();
                                  if (!p.active || si !== activeSlot) return;
                                  if (e.shiftKey) {
                                    removeDot(p.id, si, gi);
                                  } else if (e.ctrlKey || e.metaKey) {
                                    truncateFrom(p.id, si, gi);
                                  } else {
                                    selectDot(p.id, si, gi);
                                  }
                                }}
                                title={
                                  si === activeSlot
                                    ? (editCursor?.pid === p.id && editCursor?.si === si && editCursor?.idx === gi
                                        ? "Selected · Scroll to cycle · Backspace/Del to remove · click again to deselect"
                                        : `${g.color}${isCorr?" ✓":""} · click to select · Shift+click to remove · Ctrl+click to truncate from here`)
                                    : isSlotLocked(activeSlot)
                                      ? "🚫 Cannot make edits to this guess while current card is in session"
                                      : "Click card first to edit this guess"
                                }
                                style={{ width: isCorr?"20px":"17px", height: category==="Numbers" ? (isCorr?"24px":"20px") : (isCorr?"20px":"17px"), borderRadius: "4px", background: isCorr ? gc?.hex+"33" : "#20202e", border: isCorr ? `2px solid ${gc?.hex}` : `1px solid ${gc?.hex}66`, boxShadow: (editCursor?.pid === p.id && editCursor?.si === si && editCursor?.idx === gi) ? `0 0 0 2px white, 0 0 10px ${gc?.hex}` : isCorr ? `0 0 8px ${gc?.hex}88` : "none",
                                cursor: (p.active && si === activeSlot) ? "pointer" : "not-allowed", flexShrink: 0, transition: "transform 0.08s", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", lineHeight: 1, gap: "1px", padding: "1px" }}
                                onMouseEnter={e => { if(p.active && si === activeSlot && !(editCursor?.pid === p.id && editCursor?.si === si && editCursor?.idx === gi)) e.currentTarget.style.transform="scale(1.15)"; }}
                                onMouseLeave={e => { e.currentTarget.style.transform="scale(1)"; }}
                              >
                                <span>{gc?.symbol}</span>
                                {category==="Numbers" && <span style={{ fontSize: "0.38rem", color: gc?.hex, lineHeight: 1 }}>{g.color}</span>}
                              </div>
                              {isCorr && <span style={{ fontSize: "0.55rem", color: slot.hex, marginLeft: "2px" }}>✓</span>}
                            </div>
                          );
                        })}
                        {cell.dnf && <span style={{ fontSize: "0.58rem", color: "#6060a0", fontStyle: "italic" }}>skip</span>}
                      </div>
                      {stats && (
                        <div style={{ fontSize: "0.58rem", color: "#7070aa", lineHeight: 1.5, display: "flex", flexWrap: "wrap", gap: "4px" }}>
                          <span style={{ color: stats.acc >= 70 ? "#22c55e" : stats.acc >= 40 ? "#eab308" : "#ef4444" }}>Acc {stats.acc}%</span>
                          {stats.prox !== null && <span style={{ color: "#8888bb" }}>· Prox {stats.prox}%</span>}
                          {stats.avgTime !== null && <span style={{ color: "#7070aa" }}>· Avg t {fmt(stats.avgTime)}</span>}
                          {stats.pattern && <span style={{ color: "#6060a0", fontStyle: "italic" }}>· {stats.pattern}</span>}
                        </div>
                      )}
                      {isActive && p.active && (!resolved || (editCursor?.pid === p.id && editCursor?.si === si)) && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", marginTop: "2px" }}>
                          {colors.map(c => (
                            <button key={c.name}
                              title={editCursor?.pid === p.id && editCursor?.si === si ? `Left: replace · Shift+click: insert after · Ctrl+click: insert before` : c.name}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                e.currentTarget.blur();
                                const cur = editCursor?.pid === p.id && editCursor?.si === si ? editCursor.idx : null;
                                if (cur === null) {
                                  logGuess(p.id, si, c.name);
                                } else if (e.shiftKey) {
                                  setSession(prev => {
                                    const cell = prev[p.id]?.[si] ?? { guesses: [], dnf: false };
                                    const newGuesses = [...cell.guesses.slice(0, cur+1), { color: c.name, ts: Date.now() }, ...cell.guesses.slice(cur+1)];
                                    return { ...prev, [p.id]: { ...(prev[p.id]??{}), [si]: { ...cell, guesses: newGuesses, dnf: false } } };
                                  });
                                  setEditCursor({ pid: p.id, si, idx: cur + 1 });
                                } else if (e.ctrlKey || e.metaKey) {
                                  setSession(prev => {
                                    const cell = prev[p.id]?.[si] ?? { guesses: [], dnf: false };
                                    const newGuesses = [...cell.guesses.slice(0, cur), { color: c.name, ts: Date.now() }, ...cell.guesses.slice(cur)];
                                    return { ...prev, [p.id]: { ...(prev[p.id]??{}), [si]: { ...cell, guesses: newGuesses, dnf: false } } };
                                  });
                                } else {
                                  setSession(prev => {
                                    const cell = prev[p.id]?.[si] ?? { guesses: [], dnf: false };
                                    const newGuesses = cell.guesses.map((g, i) => i === cur ? { color: c.name, ts: Date.now() } : g);
                                    return { ...prev, [p.id]: { ...(prev[p.id]??{}), [si]: { ...cell, guesses: newGuesses, dnf: false } } };
                                  });
                                }
                              }}
                              style={{ minWidth: category==="Numbers" ? "30px" : "26px", height: category==="Numbers" ? "32px" : "26px", borderRadius: "6px", background: "#20202e", border: "1px solid " + c.hex + "88", cursor: "pointer", flexShrink: 0, transition: "transform 0.08s, border-color 0.08s, background 0.08s", padding: category==="Numbers" ? "2px 4px" : 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1px", lineHeight: 1 }}
                              onMouseEnter={e => { e.currentTarget.style.transform="scale(1.2)"; e.currentTarget.style.background=c.hex+"33"; e.currentTarget.style.borderColor=c.hex; }}
                              onMouseLeave={e => { e.currentTarget.style.transform="scale(1)"; e.currentTarget.style.background="#20202e"; e.currentTarget.style.borderColor=c.hex+"88"; }}
                            >
                              <span style={{ fontSize: "0.9rem" }}>{c.symbol}</span>
                              {category==="Numbers" && <span style={{ fontSize: "0.45rem", color: c.hex, letterSpacing: "0.05em" }}>{c.name}</span>}
                            </button>
                          ))}
                          <button onClick={() => { if (editCursor?.pid === p.id && editCursor?.si === si) { truncateFrom(p.id, si, editCursor.idx); } else { markDNF(p.id, si); } }} title={editCursor?.pid === p.id && editCursor?.si === si ? `Truncate from index ${editCursor.idx} onward` : "Skip / DNF"} style={{ width: "22px", height: "22px", borderRadius: "50%", background: "#222232", border: "2px solid #2e2e3e", cursor: "pointer", fontSize: "0.55rem", color: "#555", flexShrink: 0, padding: 0, fontFamily: "inherit" }}>—</button>
                        </div>
                      )}
                      {isActive && p.active && resolved && <div style={{ fontSize: "0.55rem", color: "#252535", fontStyle: "italic" }}>hover dot to remove</div>}
                    </div>
                  );
                })}

                <div style={{ width: `${SUMM_W}px`, minWidth: `${SUMM_W}px`, background: "#181824", borderRadius: "5px", padding: "8px 10px", display: "flex", flexDirection: "column", justifyContent: "center", gap: "4px" }}>
                  {summ.avgAcc !== null ? <>
                    <div style={{ fontSize: "0.65rem", color: summ.avgAcc >= 70 ? "#22c55e" : summ.avgAcc >= 40 ? "#eab308" : "#ef4444" }}>Avg Acc {summ.avgAcc}%</div>
                    {summ.avgProx !== null && <div style={{ fontSize: "0.62rem", color: "#7070aa" }}>Avg Prox {summ.avgProx}%</div>}
                    {summ.avgTime !== null && <div style={{ fontSize: "0.62rem", color: "#6060a0" }}>Avg Time {fmt(summ.avgTime)}</div>}
                  </> : <div style={{ fontSize: "0.6rem", color: "#252535" }}>—</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ─── SHARED ─────────────────────────────────────────── */
function SLabel({ children, centered }) {
  return <div style={{ fontSize: "0.72rem", color: "#8080aa", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "10px", textAlign: centered ? "center" : "left", fontWeight: 500 }}>{children}</div>;
}
function GhostBtn({ children, onClick, small, danger, disabled, tabIndex }) {
  return (
    <button onClick={onClick} disabled={disabled} tabIndex={tabIndex} style={{ background: "transparent", border: `1px solid ${danger ? "#ef444466" : "#252530"}`, borderRadius: "6px", color: danger ? "#ef4444" : disabled ? "#2a2a3a" : "#f0ece4", padding: small ? "5px 11px" : "9px 18px", fontSize: small ? "0.78rem" : "0.88rem", fontFamily: "inherit", cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.4 : 1, transition: "opacity 0.12s" }}>
      {children}
    </button>
  );
}

/* ─── DISPLAY MODE ──────────────────────────────────── */
function DisplayMode() {
  const [card, setCard] = useState(null);

  useEffect(() => {
    const channel = new BroadcastChannel("mindsight-display");
    channel.onmessage = (e) => {
      if (e.data?.type === "card") setCard(e.data.card);
      if (e.data?.type === "clear") setCard(null);
    };
    channel.postMessage({ type: "request" });
    return () => channel.close();
  }, []);

  const isNumbers = card?.category === "Numbers";
  const isShapes  = card?.category === "Shapes";
  const isColors  = card?.category === "Colors";
  const bg = isColors && card ? card.hex : "#111118";

  return (
    <div style={{ width: "100vw", height: "100vh", background: bg, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "16px", transition: "background 0.4s", fontFamily: "'Georgia', serif", overflow: "hidden" }}>
      {!card && <div style={{ color: "rgba(255,255,255,0.15)", fontSize: "1rem", letterSpacing: "0.3em", textTransform: "uppercase" }}>Waiting for session...</div>}
      {card && isNumbers && (() => {
        const numMap = {"One":"1","Two":"2","Three":"3","Four":"4","Five":"5","Six":"6"};
        return (
          <>
            <div style={{ fontSize: "10vw", fontWeight: 700, color: "white", fontFamily: "Cormorant Garamond, Georgia, serif", letterSpacing: "0.2em", textTransform: "uppercase", textShadow: `0 0 60px ${card.hex}88` }}>{card.name}</div>
            <div style={{ fontSize: "40vw", lineHeight: 0.85, color: card.hex, filter: `drop-shadow(0 0 80px ${card.hex}aa)` }}>{card.symbol}</div>
            <div style={{ fontSize: "20vw", fontWeight: 900, color: "white", fontFamily: "Cormorant Garamond, Georgia, serif", lineHeight: 1, textShadow: `0 0 80px ${card.hex}` }}>{numMap[card.name]}</div>
          </>
        );
      })()}
      {card && isShapes && (
        <>
          <div style={{ fontSize: "45vw", lineHeight: 0.85, color: card.hex, filter: `drop-shadow(0 0 80px ${card.hex}aa)` }}>{card.symbol}</div>
          <div style={{ fontSize: "10vw", fontWeight: 700, color: "white", fontFamily: "Cormorant Garamond, Georgia, serif", letterSpacing: "0.2em", textTransform: "uppercase", textShadow: `0 0 60px ${card.hex}` }}>{card.name}</div>
        </>
      )}
      {card && isColors && (
        <div style={{ fontSize: "18vw", fontWeight: 700, color: "rgba(255,255,255,0.15)", fontFamily: "Cormorant Garamond, Georgia, serif", letterSpacing: "0.3em", textTransform: "uppercase" }}>{card.name}</div>
      )}
    </div>
  );
}

/* ─── ROOT ───────────────────────────────────────────── */
export default function App() {
  if (typeof window !== "undefined" && window.location.hash === "#display") {
    return <DisplayMode />;
  }

  const [screen, setScreen]           = useState("setup");
  const [sessionData, setData]        = useState(null);
  const [micDeviceId, setMicDeviceId] = useState(null);

  const start          = (data) => { setData(data); setScreen(data.appMode === "individual" ? "micsetup" : "session"); };
  const goTraining     = (devId) => { setMicDeviceId(devId); setScreen("training"); };
  const goInstructions = () => setScreen("micsetup");
  const goResults      = (r) => { setData(prev => ({ ...prev, soloResults: r })); setScreen("soloResults"); };
  const end            = () => { setData(null); setMicDeviceId(null); setScreen("setup"); };

  if (screen === "session"     && sessionData) return <Session {...sessionData} onEnd={end} />;
  if (screen === "micsetup"    && sessionData) return <Instructions category={sessionData.category} activeItems={sessionData.colors} onContinue={goTraining} onBack={end} />;
  if (screen === "training"    && sessionData) return <TrainingRoom items={sessionData.colors} slots={sessionData.slots} category={sessionData.category} name={sessionData.name} micDeviceId={micDeviceId} onBack={end} onInstructions={goInstructions} onFinish={goResults} />;
  if (screen === "soloResults" && sessionData?.soloResults) return <SoloResults data={sessionData.soloResults} onRestart={end} onRedo={() => setScreen("training")} />;
  return <Setup onStart={start} />;
}

/* ─── INDIVIDUAL TRAINING ────────────────────────────── */
function speak(text) {
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 0.95; u.pitch = 1;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}

function Instructions({ category, activeItems, onContinue, onBack }) {
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

function TrainingRoom({ items, slots, category, name, micDeviceId, onBack, onInstructions, onFinish }) {
  const [phase, setPhase]     = useState("training");
  const [bgItem, setBgItem]   = useState(items[0]);
  const [itemIdx, setItemIdx] = useState(0);
  const itemIdxRef            = useRef(0);
  const doneRef               = useRef(false);
  const resultsRef            = useRef([]);
  const [slotIdx, setSlotIdx] = useState(0);
  const [guesses, setGuesses] = useState([]);
  const [results, setResults] = useState([]);
  const [done, setDone]       = useState(false);
  const cardStartTime         = useRef(null);
  const itemLookup            = itemMap(items);
  const latest                = useRef({});
  const isColors              = category === "Colors";
  const target                = slots ? slots[slotIdx] : null;
  latest.current = { phase, slotIdx, guesses, results, target, itemIdx };
  doneRef.current = done;

  useEffect(() => {
    if (phase === "test" && target) {
      const ordinals = ["First","Second","Third","Fourth","Fifth","Sixth","Seventh","Eighth","Ninth","Tenth","Eleventh","Twelfth","Thirteenth","Fourteenth","Fifteenth","Sixteenth","Seventeenth","Eighteenth","Nineteenth","Twentieth"];
      cardStartTime.current = Date.now();
      setTimeout(() => speak((ordinals[slotIdx] || ("Card " + (slotIdx + 1))) + " card. Find " + target.name + "."), 300);
    }
  }, [slotIdx, phase]);

  useEffect(() => {
    setBgItem(items[itemIdx]);
    itemIdxRef.current = itemIdx;
  }, [itemIdx]);

  useEffect(() => {
    const ords = ["First","Second","Third","Fourth","Fifth","Sixth","Seventh","Eighth","Ninth","Tenth"];

    const handler = (e) => {
      const { phase, slotIdx, guesses, results, target, itemIdx } = latest.current;

      if (e.key.toLowerCase() === "a") {
        e.preventDefault();
        setItemIdx(prev => {
          const next = prev === 0 ? items.length - 1 : prev - 1;
          phase === "test" ? speak(ords[next] || String(next + 1)) : speak(items[next].name);
          return next;
        });
        return;
      }
      if (e.key.toLowerCase() === "d") {
        e.preventDefault();
        setItemIdx(prev => {
          const next = prev === items.length - 1 ? 0 : prev + 1;
          phase === "test" ? speak(ords[next] || String(next + 1)) : speak(items[next].name);
          return next;
        });
        return;
      }
      if (e.key.toLowerCase() === "s") {
        e.preventDefault();
        phase === "test"
          ? speak((slotIdx + 1) + " of " + slots.length + " cards.")
          : speak((itemIdx + 1) + " of " + items.length + " items.");
        return;
      }
      if (e.key.toLowerCase() === "x" && phase === "test" && !doneRef.current) {
        e.preventDefault();
        if (!target) return;
        const slotResult = { target: target.name, guesses: guesses.map(g => g.color), acc: 0, prox: null, pattern: null, skipped: true };
        const newResults = [...results, slotResult];
        setResults(newResults);
        resultsRef.current = newResults;
        speak("Skipped.");
        if (slotIdx + 1 >= slots.length) {
          setDone(true); doneRef.current = true;
          setTimeout(() => speak("Test finished. Press space to go to results."), 600);
        } else {
          setTimeout(() => { setSlotIdx(i => i + 1); setGuesses([]); setItemIdx(0); }, 800);
        }
        return;
      }
      if (e.code === "Space") {
        e.preventDefault();
        if (phase === "training") { setPhase("test"); speak("First card."); return; }
        if (doneRef.current) { onFinish({ name, results: resultsRef.current, colors: items, category }); return; }
        if (!target) return;
        const guessName = items[itemIdxRef.current].name;
        if (guesses.length > 0 && guesses[guesses.length - 1].color === target.name) return;
        const now = Date.now();
        const newGuesses = [...guesses, { color: guessName, ts: now }];
        setGuesses(newGuesses);
        if (guessName === target.name) {
          speak("Correct!");
          const slotResult = {
            target: target.name,
            guesses: newGuesses.map(g => g.color),
            acc: accuracyScore(newGuesses.length),
            prox: isColors ? proximityScore(newGuesses[0].color, target.name) : null,
            pattern: isColors ? patternLabel(newGuesses.map(g => g.color), target.name) : null,
            timeToFirst: cardStartTime.current ? newGuesses[0].ts - cardStartTime.current : null,
            guessDeltas: newGuesses.slice(1).map((g, i) => g.ts - newGuesses[i].ts),
          };
          const newResults = [...results, slotResult];
          setResults(newResults);
          resultsRef.current = newResults;
          if (slotIdx + 1 >= slots.length) {
            setDone(true); doneRef.current = true;
            setTimeout(() => speak("Test finished. Press space to go to results."), 600);
          } else {
            setTimeout(() => { setSlotIdx(i => i + 1); setGuesses([]); setItemIdx(0); }, 1000);
          }
        } else {
          speak("Different.");
        }
        return;
      }
      if (e.code === "Enter") {
        e.preventDefault();
        if (phase === "training") { setPhase("test"); speak("First card."); return; }
        if (doneRef.current) { onFinish({ name, results: resultsRef.current, colors: items, category }); return; }
      }
      if ((e.code === "ShiftLeft" || e.code === "ShiftRight") && phase === "test" && target) {
        e.preventDefault();
        speak("Find " + target.name + ".");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const isNumbers  = category === "Numbers";
  const isShapes   = category === "Shapes";
  const bg         = (isNumbers || isShapes) ? "#1a1a2a" : (bgItem?.hex ?? "#111118");
  const targetItem = target ? itemLookup[target.name] : null;

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", fontFamily: "'Georgia', serif", background: bg, transition: "background 0.25s" }}>
      <div style={{ background: "#141420", padding: "14px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #1c1c28" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: "10px" }}>
          <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontSize: "1.2rem", fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", background: "linear-gradient(120deg, #93c5fd 0%, #a78bfa 40%, #e879f9 70%, #f9a8d4 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
            {phase === "training" ? "Training Room" : "Test Phase"}
          </div>
          {phase === "test" && <div style={{ fontSize: "0.7rem", color: "#6060a0" }}>Card {slotIdx + 1} / {slots.length} · {name}</div>}
        </div>
        <button onClick={onBack} style={{ background: "linear-gradient(120deg, #3b82f6 0%, #7c3aed 50%, #db2777 100%)", border: "none", borderRadius: "8px", color: "white", padding: "8px 20px", cursor: "pointer", fontFamily: "Cormorant Garamond, Georgia, serif", fontSize: "0.82rem", letterSpacing: "0.12em", textTransform: "uppercase", boxShadow: "0 2px 16px #7c3aed55" }}>← Setup</button>
      </div>

      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "16px" }}>
        {isNumbers && bgItem && (() => {
          const numMap = {"One":"1","Two":"2","Three":"3","Four":"4","Five":"5","Six":"6"};
          return (
            <>
              <div style={{ fontSize: "5rem", fontWeight: 700, color: "white", fontFamily: "Cormorant Garamond, Georgia, serif", letterSpacing: "0.2em", textTransform: "uppercase", textShadow: `0 0 30px ${bgItem.hex}88` }}>{bgItem.name}</div>
              <div style={{ fontSize: "16rem", lineHeight: 0.9, color: bgItem.hex, filter: `drop-shadow(0 0 40px ${bgItem.hex}88)` }}>{bgItem.symbol}</div>
              <div style={{ fontSize: "8rem", fontWeight: 900, color: "white", fontFamily: "Cormorant Garamond, Georgia, serif", lineHeight: 1, textShadow: `0 0 50px ${bgItem.hex}` }}>{numMap[bgItem.name]}</div>
            </>
          );
        })()}
        {isShapes && bgItem && (
          <>
            <div style={{ fontSize: "18rem", lineHeight: 0.9, color: bgItem.hex, filter: `drop-shadow(0 0 50px ${bgItem.hex}aa)` }}>{bgItem.symbol}</div>
            <div style={{ fontSize: "5rem", fontWeight: 700, color: "white", fontFamily: "Cormorant Garamond, Georgia, serif", letterSpacing: "0.2em", textTransform: "uppercase", textShadow: `0 0 30px ${bgItem.hex}` }}>{bgItem.name}</div>
          </>
        )}
      </div>

      <div style={{ background: "#141420", padding: "20px 24px", borderTop: "1px solid #1c1c28", display: "flex", flexDirection: "column", gap: "12px" }}>
        <div style={{ minHeight: "28px", display: "flex", gap: "4px", flexWrap: "wrap", justifyContent: "center", alignItems: "center" }}>
          {phase === "test" && guesses.length > 0 && (<>
            {guesses.map((g, i) => {
              const gc = itemLookup[g.color];
              const isCorrect = g.color === target?.name;
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: "3px" }}>
                  {i > 0 && <span style={{ color: "rgba(255,255,255,0.2)", fontSize: "0.55rem" }}>→</span>}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px", padding: "4px 8px", borderRadius: "8px", background: isCorrect ? gc?.hex + "44" : gc?.hex + "22", border: `1px solid ${isCorrect ? gc?.hex : gc?.hex + "66"}`, color: gc?.hex }}>
                    <span style={{ fontSize: "0.95rem", lineHeight: 1, color: isCorrect ? gc?.hex : "#ffffff" }}>{gc?.symbol}</span>
                    <span style={{ fontSize: "0.65rem", lineHeight: 1 }}>{g.color}{isCorrect ? " ✓" : ""}</span>
                  </div>
                </div>
              );
            })}
          </>)}
        </div>

        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", justifyContent: "center" }}>
          {items.map((c, i) => {
            const isActive = i === itemIdx;
            return (
              <button key={c.name} onClick={() => { setItemIdx(i); const ords = ["First","Second","Third","Fourth","Fifth","Sixth","Seventh","Eighth","Ninth","Tenth"]; phase === "test" ? speak(ords[i] || String(i+1)) : speak(c.name); }} style={{ display: "flex", alignItems: "center", gap: "5px", padding: "5px 10px", borderRadius: "6px", background: isActive ? c.hex + "44" : "#252535", border: `1px solid ${isActive ? c.hex : "#3a3a55"}`, transition: "all 0.15s", cursor: "pointer", fontFamily: "inherit", outline: "none" }}>
                <span style={{ fontSize: "0.85rem", color: isActive ? c.hex : "#ffffff", filter: isActive ? `drop-shadow(0 0 4px ${c.hex})` : "none" }}>{c.symbol}</span>
                <span style={{ fontSize: "0.72rem", color: isActive ? "white" : "rgba(255,255,255,0.8)" }}>{c.name}</span>
              </button>
            );
          })}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: "8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {phase === "training" && <button onClick={onInstructions} style={{ background: "linear-gradient(120deg, #3b82f6 0%, #7c3aed 50%, #db2777 100%)", border: "none", borderRadius: "8px", color: "white", padding: "8px 20px", cursor: "pointer", fontFamily: "Cormorant Garamond, Georgia, serif", fontSize: "0.82rem", letterSpacing: "0.12em", textTransform: "uppercase", boxShadow: "0 2px 16px #7c3aed55" }}>← Instructions</button>}
            {phase === "test" && <button onClick={() => { setPhase("training"); setBgItem(items[0]); setGuesses([]); setSlotIdx(0); setResults([]); resultsRef.current = []; setDone(false); doneRef.current = false; setItemIdx(0); speak("Training room."); }} style={{ background: "linear-gradient(120deg, #3b82f6 0%, #7c3aed 50%, #db2777 100%)", border: "none", borderRadius: "8px", color: "white", padding: "8px 20px", cursor: "pointer", fontFamily: "Cormorant Garamond, Georgia, serif", fontSize: "0.82rem", letterSpacing: "0.12em", textTransform: "uppercase", boxShadow: "0 2px 16px #7c3aed55" }}>← Training</button>}
          </div>

          <div style={{ display: "flex", justifyContent: "center" }}>
            {phase === "test" && targetItem && (
              <button onClick={() => speak("Find " + targetItem.name + ".")} title="Click or press Shift to repeat" style={{ display: "flex", alignItems: "center", gap: "8px", background: "#252535", border: `1px solid ${targetItem.hex}99`, borderRadius: "8px", padding: "8px 16px", cursor: "pointer", fontFamily: "inherit" }}>
                <span style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.35)", letterSpacing: "0.1em", textTransform: "uppercase" }}>Find</span>
                <span style={{ fontSize: "1.1rem", color: "#ffffff" }}>{targetItem.symbol}</span>
                <span style={{ fontSize: "0.9rem", color: targetItem.hex, fontWeight: 600 }}>{targetItem.name}</span>
                <span style={{ fontSize: "0.55rem", color: "rgba(255,255,255,0.25)", marginLeft: "4px", letterSpacing: "0.06em" }}>Shift</span>
              </button>
            )}
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "4px", flexWrap: "wrap", alignItems: "center" }}>
            {phase === "training" && <button onClick={() => { setPhase("test"); speak("First card."); }} style={{ background: "linear-gradient(120deg, #3b82f6 0%, #7c3aed 50%, #db2777 100%)", border: "none", borderRadius: "8px", color: "white", padding: "9px 24px", fontSize: "0.82rem", fontFamily: "Cormorant Garamond, Georgia, serif", letterSpacing: "0.15em", textTransform: "uppercase", cursor: "pointer" }}>Begin Test →</button>}
            {done && <button onClick={() => onFinish({ name, results, colors: items, category })} style={{ background: "linear-gradient(120deg, #3b82f6 0%, #7c3aed 50%, #db2777 100%)", border: "none", borderRadius: "8px", color: "white", padding: "9px 24px", fontSize: "0.82rem", fontFamily: "Cormorant Garamond, Georgia, serif", letterSpacing: "0.15em", textTransform: "uppercase", cursor: "pointer", boxShadow: "0 2px 20px #7c3aed88", animation: "pulse 1.5s ease-in-out infinite" }}>Results →</button>}
          </div>
        </div>
      </div>
    </div>
  );
}

function SoloResults({ data, onRestart, onRedo }) {
  const { name, results, colors, category } = data;
  const isColors = category === "Colors";
  const avgAcc  = results.length ? Math.round(results.reduce((a,r) => a + r.acc, 0) / results.length) : 0;
  const proxArr = results.filter(r => r.prox !== null).map(r => r.prox);
  const avgProx = proxArr.length ? Math.round(proxArr.reduce((a,b) => a+b,0) / proxArr.length) : null;

  const [csvText, setCsvText] = useState(null);

  const exportCSV = () => {
    const sessionId = new Date().toISOString().replace(/[:.]/g, "-");
    const now = new Date();
    const dateStr = now.toLocaleDateString("en-CA"); // YYYY-MM-DD
    const timeStr = now.toLocaleTimeString("en-GB"); // HH:MM:SS

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
        sessionId,
        dateStr,
        timeStr,
        name,
        category,
        i + 1,
        results.length,
        r.target,
        r.guesses.join("|"),
        r.skipped ? 0 : r.guesses.length,
        r.acc,
        r.prox ?? "",
        r.pattern ?? "",
        r.skipped ? "false" : (r.guesses[0] === r.target ? "true" : "false"),
        timeToFirst,
        guessDeltas,
        cardTotal,
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

function StatCard({ label, value, color }) {
  return (
    <div style={{ background: "#181825", borderRadius: "10px", padding: "14px 20px", textAlign: "center", minWidth: "100px" }}>
      <div style={{ fontSize: "0.6rem", color: "#4a4a6a", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "6px" }}>{label}</div>
      <div style={{ fontSize: "1.6rem", fontWeight: 600, color, fontFamily: "Cormorant Garamond, Georgia, serif" }}>{value}</div>
    </div>
  );
}