import { useState, useEffect, useRef } from "react";

const nowMs = () => Date.now();

export function useSlotTimers(slotCount) {
  const [timers, setTimers] = useState(() => Array.from({ length: slotCount }, () => ({ startMs: null, endMs: null })));
  const [now, setNow]       = useState(0);
  const raf                 = useRef(null);

  useEffect(() => {
    const tick = () => { setNow(nowMs()); raf.current = requestAnimationFrame(tick); };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, []);

  const startSlot = (si) => setTimers(prev => {
    const next = [...prev];
    if (!next[si].startMs) next[si] = { ...next[si], startMs: nowMs(), endMs: null };
    return next;
  });

  const endSlot = (si) => setTimers(prev => {
    const next = [...prev];
    if (next[si].startMs && !next[si].endMs) next[si] = { ...next[si], endMs: nowMs() };
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
