import { useState, useEffect } from "react";
import { GhostBtn } from '../components/GhostBtn.jsx';
import { useSlotTimers } from '../hooks/useSlotTimers.js';
import { itemMap, accuracyScore, proximityScore, patternLabel, fmt } from '../utils.js';

const nowMs = () => Date.now();

export function Session({ participants: initP, slots, colors, category, onEnd }) {
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
    const now = nowMs();
    setSession(prev => {
      const cell = prev[pid]?.[si] ?? { guesses: [], dnf: false, slotStart: now };
      const newCell = { ...cell, guesses: [...cell.guesses, { color: colorName, ts: now }], dnf: false };
      return { ...prev, [pid]: { ...(prev[pid]??{}), [si]: newCell } };
    });
  };

  const markDNF = (pid, si) => {
    setSession(prev => ({ ...prev, [pid]: { ...(prev[pid]??{}), [si]: { guesses: [], dnf: true, slotStart: prev[pid]?.[si]?.slotStart ?? nowMs() } } }));
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
  }, [activeSlot, category, slots]);

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
                  title={si === activeSlot ? "" : isSlotLocked(activeSlot) ? "🚫 Cannot select card while current card is in session" : activeSlot === null ? "Click this card to edit guesses" : allResolved(activeSlot) ? "Click this card to edit guesses" : ""}
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
                              <div
                                onClick={(e) => {
                                  e.preventDefault();
                                  if (!p.active || si !== activeSlot) return;
                                  if (e.shiftKey) { removeDot(p.id, si, gi); }
                                  else if (e.ctrlKey || e.metaKey) { truncateFrom(p.id, si, gi); }
                                  else { selectDot(p.id, si, gi); }
                                }}
                                title={si === activeSlot ? (editCursor?.pid === p.id && editCursor?.si === si && editCursor?.idx === gi ? "Selected · Scroll to cycle · Backspace/Del to remove · click again to deselect" : `${g.color}${isCorr?" ✓":""} · click to select · Shift+click to remove · Ctrl+click to truncate from here`) : isSlotLocked(activeSlot) ? "🚫 Cannot make edits to this guess while current card is in session" : "Click card first to edit this guess"}
                                style={{ width: isCorr?"20px":"17px", height: category==="Numbers" ? (isCorr?"24px":"20px") : (isCorr?"20px":"17px"), borderRadius: "4px", background: isCorr ? gc?.hex+"33" : "#20202e", border: isCorr ? `2px solid ${gc?.hex}` : `1px solid ${gc?.hex}66`, boxShadow: (editCursor?.pid === p.id && editCursor?.si === si && editCursor?.idx === gi) ? `0 0 0 2px white, 0 0 10px ${gc?.hex}` : isCorr ? `0 0 8px ${gc?.hex}88` : "none", cursor: (p.active && si === activeSlot) ? "pointer" : "not-allowed", flexShrink: 0, transition: "transform 0.08s", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", lineHeight: 1, gap: "1px", padding: "1px" }}
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
                                    const newGuesses = [...cell.guesses.slice(0, cur+1), { color: c.name, ts: nowMs() }, ...cell.guesses.slice(cur+1)];
                                    return { ...prev, [p.id]: { ...(prev[p.id]??{}), [si]: { ...cell, guesses: newGuesses, dnf: false } } };
                                  });
                                  setEditCursor({ pid: p.id, si, idx: cur + 1 });
                                } else if (e.ctrlKey || e.metaKey) {
                                  setSession(prev => {
                                    const cell = prev[p.id]?.[si] ?? { guesses: [], dnf: false };
                                    const newGuesses = [...cell.guesses.slice(0, cur), { color: c.name, ts: nowMs() }, ...cell.guesses.slice(cur)];
                                    return { ...prev, [p.id]: { ...(prev[p.id]??{}), [si]: { ...cell, guesses: newGuesses, dnf: false } } };
                                  });
                                } else {
                                  setSession(prev => {
                                    const cell = prev[p.id]?.[si] ?? { guesses: [], dnf: false };
                                    const newGuesses = cell.guesses.map((g, i) => i === cur ? { color: c.name, ts: nowMs() } : g);
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
