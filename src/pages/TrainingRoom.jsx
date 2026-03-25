import { useState, useEffect, useRef, useMemo } from "react";
import { itemMap, accuracyScore, proximityScore, patternLabel } from '../utils.js';
import { speak } from '../tts.js';
import { isSpeechRecognitionSupported, startContinuousListening } from '../speechRecognition.js';
import { matchTranscriptToItems } from '../speechMatcher.js';

const nowMs = () => Date.now();
const CARD_ORDINALS = ["First","Second","Third","Fourth","Fifth","Sixth","Seventh","Eighth","Ninth","Tenth","Eleventh","Twelfth","Thirteenth","Fourteenth","Fifteenth","Sixteenth","Seventeenth","Eighteenth","Nineteenth","Twentieth"];
const FIRST_TEST_CARD_ANNOUNCE_DELAY_MS = 1800;
const CARD_ANNOUNCE_DELAY_MS = 300;
const TEST_FINISHED_ANNOUNCE_DELAY_MS = 1400;
export function TrainingRoom({ items, slots, category, name, onBack, onInstructions, onFinish }) {
  const [phase, setPhase]     = useState("training");
  const [itemIdx, setItemIdx] = useState(0);
  const itemIdxRef            = useRef(0);
  const doneRef               = useRef(false);
  const resultsRef            = useRef([]);
  const [slotIdx, setSlotIdx] = useState(0);
  const [guesses, setGuesses] = useState([]);
  const [results, setResults] = useState([]);
  const [done, setDone]       = useState(false);
  const [micState, setMicState] = useState("off");
  const [heardPhrase, setHeardPhrase] = useState("");
  const [pendingConfirmation, setPendingConfirmation] = useState(null);
  const advanceTimeoutRef     = useRef(null);
  const recognitionRef        = useRef(null);
  const pendingConfirmationRef = useRef(null);
  const cardStartTime         = useRef(null);
  const lookup                = itemMap(items);
  const latest                = useRef({});
  const finishMetaRef         = useRef({});
  const displayItems          = useMemo(() => items, [items]);
  const displayItemsRef = useRef(items);
  const isColors              = category === "Colors";
  const isNumbers             = category === "Numbers";
  const isShapes              = category === "Shapes";
  const target                = slots ? slots[slotIdx] : null;

  useEffect(() => {
    displayItemsRef.current = displayItems;
  }, [displayItems]);

  useEffect(() => {
    latest.current = { phase, slotIdx, guesses, results, target, itemIdx };
  }, [phase, slotIdx, guesses, results, target, itemIdx]);

  useEffect(() => {
    doneRef.current = done;
  }, [done]);

  useEffect(() => {
    pendingConfirmationRef.current = pendingConfirmation;
  }, [pendingConfirmation]);

  useEffect(() => {
    finishMetaRef.current = { name, items, category, onFinish, isColors, slotCount: slots.length };
  }, [name, items, category, onFinish, isColors, slots.length]);

  useEffect(() => {
    if (phase === "test" && target) {
      cardStartTime.current = nowMs();
      const announceDelay = slotIdx === 0 ? FIRST_TEST_CARD_ANNOUNCE_DELAY_MS : CARD_ANNOUNCE_DELAY_MS;
      const announceId = window.setTimeout(() => speak((CARD_ORDINALS[slotIdx] || ("Card " + (slotIdx + 1))) + " card."), announceDelay);
      return () => window.clearTimeout(announceId);
    }
  }, [slotIdx, phase, target]);

  useEffect(() => {
    itemIdxRef.current = itemIdx;
  }, [itemIdx]);

  useEffect(() => {
    return () => window.clearTimeout(advanceTimeoutRef.current);
  }, []);

  function stopListening() {
    recognitionRef.current?.stop?.();
    recognitionRef.current = null;
  }

  function submitGuess(guessName) {
    const { phase, slotIdx, guesses, results, target } = latest.current;
    const { isColors, slotCount } = finishMetaRef.current;

    if (phase !== "test" || doneRef.current || !target) return;
    if (guesses.length > 0 && guesses[guesses.length - 1].color === target.name) return;

    const selectedIdx = displayItemsRef.current.findIndex(item => item.name === guessName);
    if (selectedIdx >= 0) {
      setItemIdx(selectedIdx);
    }

    const now = nowMs();
    const newGuesses = [...guesses, { color: guessName, ts: now }];
    setGuesses(newGuesses);

    if (guessName === target.name) {
      speak("Correct!");
      pendingConfirmationRef.current = null;
      setPendingConfirmation(null);
      setHeardPhrase("");
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
      if (slotIdx + 1 >= slotCount) {
        setDone(true);
        window.setTimeout(() => speak("Test finished. Press space to go to results."), TEST_FINISHED_ANNOUNCE_DELAY_MS);
      } else {
        advanceTimeoutRef.current = window.setTimeout(() => { setSlotIdx(i => i + 1); setGuesses([]); setItemIdx(0); setHeardPhrase(""); }, 1000);
      }
      return;
    }

    pendingConfirmationRef.current = null;
    setPendingConfirmation(null);
    speak("Different.");
  }

  useEffect(() => {
    if (phase !== "test" || done || !isSpeechRecognitionSupported()) {
      stopListening();
      return;
    }

    recognitionRef.current = startContinuousListening({
      onStateChange: (state) => setMicState(state),
      onError: () => setMicState("error"),
      onResult: ({ transcript }) => {
        const raw = String(transcript ?? "").trim();
        if (!raw) return;

        setHeardPhrase(raw);

        const lowered = raw.toLowerCase();
        if (pendingConfirmationRef.current) {
          if (["yes", "yeah", "yep", "correct"].includes(lowered)) {
            const confirmedGuess = pendingConfirmationRef.current;
            pendingConfirmationRef.current = null;
            setPendingConfirmation(null);
            submitGuess(confirmedGuess);
            return;
          }

          if (["no", "nope", "nah"].includes(lowered)) {
            pendingConfirmationRef.current = null;
            setPendingConfirmation(null);
            speak("Say it again.");
          }
          return;
        }

        const match = matchTranscriptToItems(raw, displayItemsRef.current);
        if (match.ambiguous) {
          pendingConfirmationRef.current = null;
          setPendingConfirmation(null);
          speak("Say one choice only.");
          return;
        }
        if (!match.match) return;

        const matchedIdx = displayItemsRef.current.findIndex(item => item.name === match.match);
        if (matchedIdx >= 0) {
          setItemIdx(matchedIdx);
        }

        if (match.score >= 0.88) {
          submitGuess(match.match);
          return;
        }

        pendingConfirmationRef.current = match.match;
        setPendingConfirmation(match.match);
        speak(`Did you say ${match.match}?`);
      },
    });

    return () => stopListening();
  }, [phase, done]);

  useEffect(() => {
    const handler = (e) => {
      const { phase, slotIdx, guesses, results, target } = latest.current;
      const { name, items, category, onFinish, slotCount } = finishMetaRef.current;
      if (e.key.toLowerCase() === "a") {
        e.preventDefault();
        setItemIdx(prev => {
          const deck = displayItemsRef.current;
          const next = prev === 0 ? deck.length - 1 : prev - 1;
          speak(deck[next].name);
          return next;
        });
        return;
      }
      if (e.key.toLowerCase() === "d") {
        e.preventDefault();
        setItemIdx(prev => {
          const deck = displayItemsRef.current;
          const next = prev === deck.length - 1 ? 0 : prev + 1;
          speak(deck[next].name);
          return next;
        });
        return;
      }
      if (e.key.toLowerCase() === "s") {
        e.preventDefault();
        const currentItem = displayItemsRef.current[itemIdxRef.current];
        if (currentItem) speak(currentItem.name);
        return;
      }
      if (e.key.toLowerCase() === "x" && phase === "test" && !doneRef.current) {
        e.preventDefault();
        if (!target) return;
        const slotResult = { target: target.name, guesses: guesses.map(g => g.color), acc: 0, prox: null, pattern: null, skipped: true };
        const newResults = [...results, slotResult];
        setResults(newResults);
        resultsRef.current = newResults;
        pendingConfirmationRef.current = null;
        setPendingConfirmation(null);
        setHeardPhrase("");
        speak("Skipped.");
        if (slotIdx + 1 >= slotCount) {
          setDone(true);
          setTimeout(() => speak("Test finished. Press space to go to results."), TEST_FINISHED_ANNOUNCE_DELAY_MS);
        } else {
          advanceTimeoutRef.current = window.setTimeout(() => { setSlotIdx(i => i + 1); setGuesses([]); setItemIdx(0); setHeardPhrase(""); }, 800);
        }
        return;
      }
      if (e.code === "Space") {
        e.preventDefault();
        if (phase === "training") { pendingConfirmationRef.current = null; setPendingConfirmation(null); setHeardPhrase(""); setPhase("test"); setItemIdx(0); speak("Test started."); return; }
        if (doneRef.current) { onFinish({ name, results: resultsRef.current, colors: items, category }); return; }
        if (!target) return;
        const guessName = displayItemsRef.current[itemIdxRef.current].name;
        submitGuess(guessName);
        return;
      }
      if (e.code === "Enter") {
        e.preventDefault();
        if (phase === "training") { pendingConfirmationRef.current = null; setPendingConfirmation(null); setHeardPhrase(""); setPhase("test"); setItemIdx(0); speak("Test started."); return; }
        if (doneRef.current) { onFinish({ name, results: resultsRef.current, colors: items, category }); return; }
      }
      if ((e.code === "ShiftLeft" || e.code === "ShiftRight") && phase === "test" && target) {
        e.preventDefault();
        speak((CARD_ORDINALS[slotIdx] || ("Card " + (slotIdx + 1))) + " card.");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const targetItem = target ? lookup[target.name] : null;
  const bgItem = phase === "test" ? targetItem : (displayItems[itemIdx] ?? items[0]);
  const bg = (isNumbers || isShapes) ? "#1a1a2a" : (bgItem?.hex ?? "#111118");
  const isOval = bgItem?.name === "Oval";

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", fontFamily: "'Georgia', serif", background: bg, transition: "background 0.25s" }}>
      <div style={{ background: "#141420", padding: "14px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #1c1c28" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: "10px" }}>
          <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontSize: "1.2rem", fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", background: "linear-gradient(120deg, #93c5fd 0%, #a78bfa 40%, #e879f9 70%, #f9a8d4 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
            {phase === "training" ? "Training Room" : "Test Phase"}
          </div>
          {phase === "test" && <div style={{ fontSize: "0.7rem", color: "#6060a0" }}>{name}</div>}
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
            {/* Fixed-height wrapper so the word top edge stays aligned across shapes. */}
            <div style={{ height: "20.25rem", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
              <div style={{ fontSize: isOval ? "13.5rem" : "22.5rem", lineHeight: 0.9, color: bgItem.hex, filter: `drop-shadow(0 0 50px ${bgItem.hex}aa)` }}>{bgItem.symbol}</div>
            </div>
            <div style={{ fontSize: "4.2rem", fontWeight: 700, color: "white", fontFamily: "Cormorant Garamond, Georgia, serif", letterSpacing: "0.2em", textTransform: "uppercase", textShadow: `0 0 30px ${bgItem.hex}`, marginTop: "110px" }}>{bgItem.name}</div>
          </>
        )}
      </div>

      <div style={{ background: "#141420", padding: "20px 24px", borderTop: "1px solid #1c1c28", display: "flex", flexDirection: "column", gap: "12px" }}>
        <div style={{ minHeight: "28px", display: "flex", gap: "4px", flexWrap: "wrap", justifyContent: "center", alignItems: "center" }}>
          {phase === "test" && guesses.length > 0 && (
            <>
              {guesses.map((g, i) => {
                const gc = lookup[g.color];
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
            </>
          )}
        </div>

        {phase === "test" && (
          <div style={{ minHeight: "18px", display: "flex", justifyContent: "center", gap: "10px", flexWrap: "wrap", fontSize: "0.68rem", color: "rgba(255,255,255,0.6)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
            <span>Mic: {micState}</span>
            {heardPhrase && <span>Heard: {heardPhrase}</span>}
            {pendingConfirmation && <span>Confirming: {pendingConfirmation}</span>}
          </div>
        )}

        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", justifyContent: "center" }}>
          {displayItems.map((c, i) => {
            const isActive = i === itemIdx;
            return (
              <button key={c.name} onClick={() => {
                setItemIdx(i);
                speak(c.name);
              }} style={{ display: "flex", alignItems: "center", gap: "5px", padding: "5px 10px", borderRadius: "6px", background: isActive ? c.hex + "44" : "#252535", border: `1px solid ${isActive ? c.hex : "#3a3a55"}`, transition: "all 0.15s", cursor: "pointer", fontFamily: "inherit", outline: "none" }}>
                <span style={{ fontSize: c.name === "Oval" ? "0.72rem" : "0.85rem", lineHeight: 1, color: isActive ? c.hex : "#ffffff", filter: isActive ? `drop-shadow(0 0 4px ${c.hex})` : "none" }}>{c.symbol}</span>
                <span style={{ fontSize: "0.72rem", color: isActive ? "white" : "rgba(255,255,255,0.8)" }}>{c.name}</span>
              </button>
            );
          })}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: "8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {phase === "training" && (
              <button onClick={onInstructions} style={{ background: "linear-gradient(120deg, #3b82f6 0%, #7c3aed 50%, #db2777 100%)", border: "none", borderRadius: "8px", color: "white", padding: "8px 20px", cursor: "pointer", fontFamily: "Cormorant Garamond, Georgia, serif", fontSize: "0.82rem", letterSpacing: "0.12em", textTransform: "uppercase", boxShadow: "0 2px 16px #7c3aed55" }}>← Instructions</button>
            )}
            {phase === "test" && (
              <button onClick={() => { pendingConfirmationRef.current = null; setPendingConfirmation(null); setHeardPhrase(""); setPhase("training"); setGuesses([]); setSlotIdx(0); setResults([]); resultsRef.current = []; setDone(false); setItemIdx(0); speak("Training room."); }} style={{ background: "linear-gradient(120deg, #3b82f6 0%, #7c3aed 50%, #db2777 100%)", border: "none", borderRadius: "8px", color: "white", padding: "8px 20px", cursor: "pointer", fontFamily: "Cormorant Garamond, Georgia, serif", fontSize: "0.82rem", letterSpacing: "0.12em", textTransform: "uppercase", boxShadow: "0 2px 16px #7c3aed55" }}>← Training</button>
            )}
          </div>

          <div style={{ display: "flex", justifyContent: "center" }}>
            {phase === "test" && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "#252535", border: "1px solid #3a3a55", borderRadius: "8px", padding: "8px 16px", fontFamily: "inherit" }}>
                <span style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.35)", letterSpacing: "0.1em", textTransform: "uppercase" }}>Card</span>
                <span style={{ fontSize: "0.9rem", color: "#ffffff", fontWeight: 600 }}>{slotIdx + 1} of {slots.length}</span>
              </div>
            )}
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "4px", flexWrap: "wrap", alignItems: "center" }}>
            {phase === "training" && (
              <button onClick={() => { pendingConfirmationRef.current = null; setPendingConfirmation(null); setHeardPhrase(""); setPhase("test"); setItemIdx(0); speak("Test started."); }} style={{ background: "linear-gradient(120deg, #3b82f6 0%, #7c3aed 50%, #db2777 100%)", border: "none", borderRadius: "8px", color: "white", padding: "9px 24px", fontSize: "0.82rem", fontFamily: "Cormorant Garamond, Georgia, serif", letterSpacing: "0.15em", textTransform: "uppercase", cursor: "pointer" }}>Begin Test →</button>
            )}
            {done && (
              <button onClick={() => onFinish({ name, results, colors: items, category })} style={{ background: "linear-gradient(120deg, #3b82f6 0%, #7c3aed 50%, #db2777 100%)", border: "none", borderRadius: "8px", color: "white", padding: "9px 24px", fontSize: "0.82rem", fontFamily: "Cormorant Garamond, Georgia, serif", letterSpacing: "0.15em", textTransform: "uppercase", cursor: "pointer", boxShadow: "0 2px 20px #7c3aed88", animation: "pulse 1.5s ease-in-out infinite" }}>Results →</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
