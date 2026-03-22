import { useState, useEffect, useRef } from "react";

export function useSlotTimers(slotCount) {
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