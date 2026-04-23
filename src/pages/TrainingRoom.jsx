import { useState, useEffect, useRef, useMemo } from "react";
import { itemMap, accuracyScore, proximityScore, patternLabel } from '../utils.js';
import { buildSoloSessionPayload } from '../soloSessionPayload.js';
import { createSessionId, GUESS_POLICIES, SESSION_MODES } from '../sessionModel.js';
import { speak } from '../tts.js';
import { isSpeechRecognitionSupported, startContinuousListening } from '../speechRecognition.js';
import { matchTranscriptToCommand, matchTranscriptToItems } from '../speechMatcher.js';
import { persistInterruptedSession } from '../sessionRecovery.js';

const nowMs = () => Date.now();
const CARD_ORDINALS = [
  "First","Second","Third","Fourth","Fifth","Sixth","Seventh","Eighth","Ninth","Tenth",
  "Eleventh","Twelfth","Thirteenth","Fourteenth","Fifteenth","Sixteenth","Seventeenth","Eighteenth","Nineteenth","Twentieth",
  "Twenty first","Twenty second","Twenty third","Twenty fourth","Twenty fifth","Twenty sixth","Twenty seventh","Twenty eighth","Twenty ninth","Thirtieth",
  "Thirty first","Thirty second","Thirty third","Thirty fourth","Thirty fifth","Thirty sixth"
];
const FIRST_TEST_CARD_ANNOUNCE_DELAY_MS = 1800;
const CARD_ANNOUNCE_DELAY_MS = 300;
const RESULTS_ANNOUNCE_DELAY_MS = 1400;
const HOTLINE_VOICE = "bm_lewis";
const TEST_VOICE = "af_heart";
export function TrainingRoom({ items, slots, category, name, appMode = SESSION_MODES.SOLO, shareCode = null, guessPolicy, deckPolicy, onBack, onInstructions, onFinish }) {
  const [phase, setPhase]     = useState("training");
  const [itemIdx, setItemIdx] = useState(0);
  const itemIdxRef            = useRef(0);
  const doneRef               = useRef(false);
  const resultsRef            = useRef([]);
  const [slotIdx, setSlotIdx] = useState(0);
  const [guesses, setGuesses] = useState([]);
  const [results, setResults] = useState([]);
  const [done, setDone]       = useState(false);
  const [isHotlineOpen, setIsHotlineOpen] = useState(false);
  const isHotlineOpenRef = useRef(false);
  const hotlineToggleBlockUntilRef = useRef(0);
  const [micState, setMicState] = useState("off");
  const [heardPhrase, setHeardPhrase] = useState("");
  const [heardMatchInfo, setHeardMatchInfo] = useState(null);
  const [lastMatchInfo, setLastMatchInfo] = useState(null);
  const [pendingConfirmation, setPendingConfirmation] = useState(null);
  const advanceTimeoutRef     = useRef(null);
  const recognitionRef        = useRef(null);
  const pendingConfirmationRef = useRef(null);
  const cardStartTime         = useRef(null);
  const sessionIdRef          = useRef(createSessionId());
  const sessionStartRef       = useRef(null);
  const testStartBlockUntilRef = useRef(0);
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
    isHotlineOpenRef.current = isHotlineOpen;
  }, [isHotlineOpen]);

  useEffect(() => {
    pendingConfirmationRef.current = pendingConfirmation;
  }, [pendingConfirmation]);

  useEffect(() => {
    finishMetaRef.current = {
      name,
      items,
      category,
      onFinish,
      isColors,
      slotCount: slots.length,
      appMode,
      shareCode,
      guessPolicy,
      deckPolicy,
    };
  }, [name, items, category, onFinish, isColors, slots.length, appMode, shareCode, guessPolicy, deckPolicy]);

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

  useEffect(() => {
    document.body.classList.add("mindsight-fullbleed");
    return () => document.body.classList.remove("mindsight-fullbleed");
  }, []);

  useEffect(() => {
    const onPageHide = () => recordInterruption("pagehide");
    const onBeforeUnload = () => recordInterruption("beforeunload");
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, []);

  function stopListening() {
    recognitionRef.current?.stop?.();
    recognitionRef.current = null;
  }

  function beginTestPhase() {
    pendingConfirmationRef.current = null;
    setPendingConfirmation(null);
    setHeardPhrase("");
    setHeardMatchInfo(null);
    setIsHotlineOpen(false);
    setGuesses([]);
    setDone(false);
    setSlotIdx(0);
    setItemIdx(0);
    cardStartTime.current = null;
    sessionIdRef.current = createSessionId();
    sessionStartRef.current = new Date().toISOString();
    testStartBlockUntilRef.current = nowMs() + 250;
    setPhase("test");
    speak("Test started.");
  }

  function toggleHotline(nextValue) {
    const now = nowMs();
    if (now < hotlineToggleBlockUntilRef.current) {
      return;
    }

    hotlineToggleBlockUntilRef.current = now + 350;

    const resolvedNext = typeof nextValue === "boolean" ? nextValue : !isHotlineOpenRef.current;
    setIsHotlineOpen(resolvedNext);

    if (resolvedNext) {
      speak("Training room.", { voice: HOTLINE_VOICE });
    } else {
      speak("Test resumed.", { voice: TEST_VOICE });
    }
  }

  function finishSession() {
    const { name, category, items, appMode, shareCode, guessPolicy, deckPolicy, onFinish } = finishMetaRef.current;
    onFinish(buildSoloSessionPayload({
      name,
      category,
      activeOptions: items,
      appMode,
      shareCode,
      sessionId: sessionIdRef.current,
      guessPolicy,
      deckPolicy,
      completedResults: resultsRef.current,
      startedAt: sessionStartRef.current,
      endedAt: new Date().toISOString(),
    }));
  }

  function recordInterruption(reason = "interrupted") {
    const { phase, slotIdx } = latest.current;
    const { name, items, category, appMode, shareCode, guessPolicy, deckPolicy } = finishMetaRef.current;

    if (phase !== "test") {
      return;
    }

    const startedAt = sessionStartRef.current;
    if (!startedAt) {
      return;
    }

    const completedResults = resultsRef.current || [];
    const hasProgress = completedResults.length > 0 || slotIdx > 0;
    if (!hasProgress) {
      return;
    }

    persistInterruptedSession({
      version: 1,
      reason,
      sessionId: sessionIdRef.current,
      startedAt,
      endedAt: new Date().toISOString(),
      name,
      category,
      activeOptions: items,
      appMode,
      shareCode,
      guessPolicy,
      deckPolicy,
      completedResults,
      slotIdx,
      totalSlots: slots?.length ?? null,
    });
  }

  function handleBackToSetup() {
    recordInterruption("backToSetup");
    onBack?.();
  }

function advanceToNextCard(currentSlotIdx, slotCount, delayMs) {
    if (currentSlotIdx + 1 >= slotCount) {
      setDone(true);
      const finishedAnnouncementDelay = Math.max(delayMs ?? 0, RESULTS_ANNOUNCE_DELAY_MS);
      window.setTimeout(() => speak("Test finished. Press space or say results to go to the results page."), finishedAnnouncementDelay);
      return;
    }

    advanceTimeoutRef.current = window.setTimeout(() => {
      setSlotIdx(i => i + 1);
      setGuesses([]);
      setItemIdx(0);
      setHeardPhrase("");
      setHeardMatch("");
    }, delayMs);
  }

  function focusTrainingItem(itemName) {
    const matchedIdx = displayItemsRef.current.findIndex((item) => item.name === itemName);
    if (matchedIdx < 0) {
      return;
    }

    setItemIdx(matchedIdx);
    speak(itemName, { voice: isHotlineOpenRef.current ? HOTLINE_VOICE : undefined });
  }

  function finalizeCardResult(newGuesses, options = {}) {
    const { slotIdx, results, target } = latest.current;
    const { isColors, slotCount } = finishMetaRef.current;

    if (!target) {
      return;
    }

    const guessNames = newGuesses.map((guess) => guess.color);
    const isResolved = guessNames[guessNames.length - 1] === target.name;
    const firstGuess = guessNames[0] ?? null;
    const slotResult = {
      target: target.name,
      guesses: guessNames,
      acc: isResolved ? accuracyScore(guessNames.length) : 0,
      prox: firstGuess && isColors ? proximityScore(firstGuess, target.name) : null,
      pattern: firstGuess && isColors ? patternLabel(guessNames, target.name) : null,
      timeToFirst: cardStartTime.current && newGuesses[0]?.ts ? newGuesses[0].ts - cardStartTime.current : null,
      guessDeltas: newGuesses.slice(1).map((guess, index) => guess.ts - newGuesses[index].ts),
      skipped: options.skipped === true,
    };

    const nextResults = [...results, slotResult];
    setResults(nextResults);
    resultsRef.current = nextResults;
    pendingConfirmationRef.current = null;
    setPendingConfirmation(null);
    setHeardPhrase("");
    setHeardMatchInfo(null);

    if (options.feedbackLine) {
      speak(options.feedbackLine);
    }

    advanceToNextCard(slotIdx, slotCount, options.advanceDelayMs ?? 1000);
  }

  function submitGuess(guessName) {
    const { phase, guesses, target } = latest.current;
    const { guessPolicy } = finishMetaRef.current;

    if (phase !== "test" || doneRef.current || !target) return;
    if (isHotlineOpenRef.current) return;
    if (nowMs() < testStartBlockUntilRef.current) return;
    if (guesses.length > 0 && guesses[guesses.length - 1].color === target.name) return;
    if (guessPolicy === GUESS_POLICIES.ONE_SHOT && guesses.length > 0) return;

    const selectedIdx = displayItemsRef.current.findIndex(item => item.name === guessName);
    if (selectedIdx >= 0) {
      setItemIdx(selectedIdx);
    }

    const now = nowMs();
    const newGuesses = [...guesses, { color: guessName, ts: now }];
    setGuesses(newGuesses);

    if (guessPolicy === GUESS_POLICIES.ONE_SHOT) {
      const feedbackLine = guessName === target.name ? "Correct!" : `Different. The answer was ${target.name}.`;
      finalizeCardResult(newGuesses, {
        feedbackLine,
        advanceDelayMs: guessName === target.name ? 1000 : 3000,
      });
      return;
    }

    if (guessName === target.name) {
      finalizeCardResult(newGuesses, {
        feedbackLine: "Correct!",
        advanceDelayMs: 1000,
      });
      return;
    }

    pendingConfirmationRef.current = null;
    setPendingConfirmation(null);
    speak("Different.");
  }

  useEffect(() => {
    if (!isSpeechRecognitionSupported()) {
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

        const commandMatch = matchTranscriptToCommand(raw);
        if (commandMatch.command === "trainingRoom" && phase === "test") {
          pendingConfirmationRef.current = null;
          setPendingConfirmation(null);
          setHeardMatchInfo(null);
          toggleHotline(true);
          return;
        }

        if (commandMatch.command === "resumeTest" && phase === "test" && isHotlineOpenRef.current) {
          pendingConfirmationRef.current = null;
          setPendingConfirmation(null);
          setHeardMatchInfo(null);
          toggleHotline(false);
          return;
        }

        if (commandMatch.command === "beginTest" && phase === "training") {
          beginTestPhase();
          return;
        }

        if (commandMatch.command === "results" && doneRef.current) {
          finishSession();
          return;
        }

        const lowered = raw.toLowerCase();
        if (pendingConfirmationRef.current) {
          if (["yes", "yeah", "yep", "correct"].includes(lowered)) {
            const confirmedGuess = pendingConfirmationRef.current;
            pendingConfirmationRef.current = null;
            setPendingConfirmation(null);
            if (phase === "training") {
              focusTrainingItem(confirmedGuess);
            } else {
              submitGuess(confirmedGuess);
            }
            return;
          }

          const repeatedMatch = matchTranscriptToItems(raw, displayItemsRef.current);
          if (repeatedMatch.match === pendingConfirmationRef.current && repeatedMatch.score >= 0.88 && !repeatedMatch.ambiguous) {
            const confirmedGuess = pendingConfirmationRef.current;
            pendingConfirmationRef.current = null;
            setPendingConfirmation(null);
            if (phase === "training") {
              focusTrainingItem(confirmedGuess);
            } else {
              submitGuess(confirmedGuess);
            }
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
          setHeardMatchInfo({ status: "ambiguous" });
          setLastMatchInfo({ status: "ambiguous" });
        } else if (match.match) {
          setHeardMatchInfo({ status: "match", name: match.match, score: match.score });
          setLastMatchInfo({ status: "match", name: match.match, score: match.score });
        } else {
          setHeardMatchInfo({ status: "none", score: match.score });
          setLastMatchInfo({ status: "none", score: match.score });
        }

        if (match.ambiguous) {
          pendingConfirmationRef.current = null;
          setPendingConfirmation(null);
          speak("Say one choice only.");
          return;
        }
        if (!match.match) return;

        if (match.score >= 0.88) {
          if (phase === "training") {
            focusTrainingItem(match.match);
            return;
          }

          if (isHotlineOpenRef.current) {
            focusTrainingItem(match.match);
            return;
          }

          const matchedIdx = displayItemsRef.current.findIndex(item => item.name === match.match);
          if (matchedIdx >= 0) {
            setItemIdx(matchedIdx);
          }

          submitGuess(match.match);
          return;
        }

        if (phase === "training" && displayItemsRef.current[itemIdxRef.current]?.name === match.match) {
          focusTrainingItem(match.match);
          return;
        }

        if (isHotlineOpenRef.current) {
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
      const { onFinish, slotCount } = finishMetaRef.current;

      if ((e.code === "ControlLeft" || e.code === "ControlRight") && phase === "test") {
        if (e.repeat) return;
        e.preventDefault();
        toggleHotline();
        return;
      }

      if (e.key.toLowerCase() === "a") {
        e.preventDefault();
        setItemIdx(prev => {
          const deck = displayItemsRef.current;
          const next = prev === 0 ? deck.length - 1 : prev - 1;
          speak(deck[next].name, { voice: isHotlineOpenRef.current ? HOTLINE_VOICE : undefined });
          return next;
        });
        return;
      }
      if (e.key.toLowerCase() === "d") {
        e.preventDefault();
        setItemIdx(prev => {
          const deck = displayItemsRef.current;
          const next = prev === deck.length - 1 ? 0 : prev + 1;
          speak(deck[next].name, { voice: isHotlineOpenRef.current ? HOTLINE_VOICE : undefined });
          return next;
        });
        return;
      }
      if (e.key.toLowerCase() === "s") {
        e.preventDefault();
        const currentItem = displayItemsRef.current[itemIdxRef.current];
        if (currentItem) speak(currentItem.name, { voice: isHotlineOpenRef.current ? HOTLINE_VOICE : undefined });
        return;
      }
      if (e.key.toLowerCase() === "x" && phase === "test" && !doneRef.current && !isHotlineOpenRef.current) {
        e.preventDefault();
        if (!target) return;
        finalizeCardResult(guesses, {
          skipped: true,
          feedbackLine: "Skipped.",
          advanceDelayMs: 800,
        });
        return;
      }
      if (e.code === "Space") {
        e.preventDefault();
        if (e.repeat) return;
        if (phase === "test" && isHotlineOpenRef.current) {
          return;
        }
        if (phase === "training") { beginTestPhase(); return; }
        if (doneRef.current) { finishSession(); return; }
        if (!target) return;
        const guessName = displayItemsRef.current[itemIdxRef.current].name;
        submitGuess(guessName);
        return;
      }
      if (e.code === "Enter") {
        e.preventDefault();
        if (phase === "test" && isHotlineOpenRef.current) {
          return;
        }
        if (phase === "training") { beginTestPhase(); return; }
        if (doneRef.current) { finishSession(); return; }
      }
      if ((e.code === "ShiftLeft" || e.code === "ShiftRight") && phase === "test" && target) {
        e.preventDefault();
        if (isHotlineOpenRef.current) {
          const currentItem = displayItemsRef.current[itemIdxRef.current];
          if (currentItem) speak(currentItem.name, { voice: HOTLINE_VOICE });
          return;
        }
        speak((CARD_ORDINALS[slotIdx] || ("Card " + (slotIdx + 1))) + " card.");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const targetItem = target ? lookup[target.name] : null;
  const bgItem = phase === "test"
    ? (isHotlineOpen ? (displayItems[itemIdx] ?? items[0]) : targetItem)
    : (displayItems[itemIdx] ?? items[0]);
  const bg = (isNumbers || isShapes) ? "#1a1a2a" : (bgItem?.hex ?? "#111118");
  const isOval = bgItem?.name === "Oval";
  const stageBackground = isColors
    ? (bgItem?.hex ?? "#111118")
    : `linear-gradient(90deg, ${bgItem?.hex ?? "#1a1a2a"}66 0%, ${bgItem?.hex ?? "#1a1a2a"}2e 18%, #1a1a2a 50%, ${bgItem?.hex ?? "#1a1a2a"}2e 82%, ${bgItem?.hex ?? "#1a1a2a"}66 100%)`;
  const guessTrayMinWidth = "14ch";
  const showVoiceDebug = Boolean(heardPhrase || heardMatchInfo || pendingConfirmation);
  const micStatusLabel = micState === "retrying" ? "listening" : micState;
  const micStatusColor = micStatusLabel === "listening" ? "#f472b6" : "rgba(255,255,255,0.45)";
  const micIsListening = micStatusLabel === "listening";
  const shownMatchName = pendingConfirmation || heardMatchInfo?.name || null;
  const shownMatchItem = shownMatchName ? lookup[shownMatchName] : null;
  const shownMatchPercent = heardMatchInfo?.score != null ? Math.round(heardMatchInfo.score * 100) : null;
  const displayMatch = lastMatchInfo?.status === "match"
    ? { name: lastMatchInfo.name, scorePercent: lastMatchInfo.score != null ? Math.round(lastMatchInfo.score * 100) : null }
    : null;
  const displayMatchItem = displayMatch?.name ? lookup[displayMatch.name] : null;
  const displayMatchPercent = displayMatch?.scorePercent ?? null;
  const detectedMatch = (() => {
    if (pendingConfirmation) {
      return { status: "confirm", name: pendingConfirmation, scorePercent: shownMatchPercent };
    }
    if (heardMatchInfo?.status === "match") {
      return { status: "match", name: heardMatchInfo.name, scorePercent: shownMatchPercent };
    }
    if (heardMatchInfo?.status === "ambiguous") {
      return { status: "ambiguous" };
    }
    if (heardMatchInfo?.status === "none") {
      return { status: "none" };
    }
    if (displayMatchItem) {
      return { status: "match", name: displayMatch.name, scorePercent: displayMatchPercent };
    }
    if (lastMatchInfo?.status === "ambiguous") {
      return { status: "ambiguous" };
    }
    if (lastMatchInfo?.status === "none") {
      return { status: "none" };
    }
    return null;
  })();
  const detectedMatchItem = detectedMatch?.name ? lookup[detectedMatch.name] : null;
  const detectedMatchPercent = detectedMatch?.scorePercent ?? null;
  const detectedMatchPercentColor =
    detectedMatchPercent == null ? "rgba(255,255,255,0.4)"
      : detectedMatchPercent >= 95 ? "#22c55e"
      : detectedMatchPercent >= 80 ? "#eab308"
      : detectedMatchPercent >= 65 ? "#f97316"
      : "#ef4444";
  const displayMatchPercentColor =
    displayMatchPercent == null ? "rgba(255,255,255,0.4)"
      : displayMatchPercent >= 95 ? "#22c55e"
      : displayMatchPercent >= 80 ? "#eab308"
      : displayMatchPercent >= 65 ? "#f97316"
      : "#ef4444";
  const matchPercentColor =
    shownMatchPercent == null ? "rgba(255,255,255,0.4)"
      : shownMatchPercent >= 95 ? "#22c55e"
      : shownMatchPercent >= 80 ? "#eab308"
      : shownMatchPercent >= 65 ? "#f97316"
      : "#ef4444";

  const renderGuessTray = () => (
    <div style={{ display: "flex", justifyContent: "center", width: "100%" }}>
      <div style={{ minHeight: "40px", maxHeight: "40px", minWidth: guessTrayMinWidth, maxWidth: "100%", overflowX: "auto", overflowY: "hidden", padding: "6px 10px", borderRadius: "10px", background: "#1f1f2d", border: "1px solid #303048", boxSizing: "border-box" }}>
        <div style={{ minWidth: "100%", width: "max-content", display: "flex", gap: "4px", flexWrap: "nowrap", justifyContent: "center", alignItems: "center", margin: "0 auto" }}>
          {(isHotlineOpen || guesses.length === 0) && (
            <span style={{ fontSize: "0.68rem", color: "rgba(255,255,255,0.28)", letterSpacing: "0.08em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
              {isHotlineOpen ? "Guessing disabled" : "Guess Path"}
            </span>
          )}
          {!isHotlineOpen && guesses.length > 0 && (
            <>
              {guesses.map((g, i) => {
                const gc = lookup[g.color];
                const isCorrect = g.color === target?.name;
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: "3px" }}>
                    {i > 0 && <span style={{ color: "rgba(255,255,255,0.18)", fontSize: "0.55rem" }}>{">"}</span>}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "4px 7px", borderRadius: "8px", background: isCorrect ? gc?.hex + "44" : gc?.hex + "22", border: `1px solid ${isCorrect ? gc?.hex : gc?.hex + "66"}`, color: gc?.hex, whiteSpace: "nowrap", minWidth: "30px" }}>
                      <span style={{ fontSize: g.color === "Oval" ? "0.6rem" : "0.74rem", lineHeight: 1, color: isCorrect ? gc?.hex : "#ffffff", filter: isCorrect ? `drop-shadow(0 0 4px ${gc?.hex})` : "none" }}>{gc?.symbol}</span>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", fontFamily: "'Georgia', serif", background: bg, transition: "background 0.25s", overflowX: "hidden", position: "relative" }}>
      <div style={{ background: "#141420", padding: "14px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #1c1c28" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: "10px" }}>
          <div style={{ fontFamily: "Cormorant Garamond, Georgia, serif", fontSize: "1.2rem", fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", background: "linear-gradient(120deg, #93c5fd 0%, #a78bfa 40%, #e879f9 70%, #f9a8d4 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
            Mindsight
          </div>
          {phase === "test" && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.82rem", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#c9c3e5", background: "#111118", border: "1px solid #3a3a55", borderRadius: "999px", padding: "5px", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)" }}>
              <button
                onClick={() => toggleHotline(false)}
                style={{ background: !isHotlineOpen ? "#2b2b44" : "transparent", border: "1px solid " + (!isHotlineOpen ? "#93c5fd66" : "transparent"), borderRadius: "999px", padding: "7px 14px", cursor: "pointer", color: !isHotlineOpen ? "#f0ece4" : "rgba(201,195,229,0.65)", fontFamily: "inherit", letterSpacing: "0.14em", textTransform: "uppercase", boxShadow: !isHotlineOpen ? "0 0 0 1px rgba(147,197,253,0.10), 0 8px 18px rgba(59,130,246,0.10)" : "none" }}
              >
                Test
              </button>
              <button
                onClick={() => toggleHotline(true)}
                style={{ background: isHotlineOpen ? "#3b2a06" : "transparent", border: "1px solid " + (isHotlineOpen ? "#fbbf24aa" : "transparent"), borderRadius: "999px", padding: "7px 14px", cursor: "pointer", color: isHotlineOpen ? "#fde68a" : "rgba(201,195,229,0.65)", fontFamily: "inherit", letterSpacing: "0.14em", textTransform: "uppercase", boxShadow: isHotlineOpen ? "0 0 0 1px rgba(251,191,36,0.18), 0 8px 18px rgba(245,158,11,0.10)" : "none" }}
              >
                Training
              </button>
            </div>
          )}
          {phase === "test" && <div style={{ fontSize: "0.7rem", color: "#6060a0" }}>{name}</div>}
        </div>
        <button onClick={handleBackToSetup} style={{ background: "linear-gradient(120deg, #3b82f6 0%, #7c3aed 50%, #db2777 100%)", border: "none", borderRadius: "8px", color: "white", padding: "8px 20px", cursor: "pointer", fontFamily: "Cormorant Garamond, Georgia, serif", fontSize: "0.82rem", letterSpacing: "0.12em", textTransform: "uppercase", boxShadow: "0 2px 16px #7c3aed55" }}>← Setup</button>
      </div>

      <div style={{ flex: 1, display: "flex", alignItems: "stretch", justifyContent: "center", width: "100%" }}>
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "16px", width: "100%", background: stageBackground, transition: "background 0.25s", padding: "32px 0", boxSizing: "border-box" }}>
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
      </div>

      <div style={{ background: stageBackground, padding: "16px 24px 18px", display: "flex", flexDirection: "column", gap: "8px", position: "sticky", bottom: 0, zIndex: 30, transition: "background 0.25s" }}>
        {false && phase === "test" && <div style={{ display: "flex", justifyContent: "center" }}>
          <div style={{ minHeight: "40px", maxHeight: "40px", minWidth: guessTrayMinWidth, maxWidth: "100%", overflowX: "auto", overflowY: "hidden", padding: "6px 10px", borderRadius: "10px", background: "#1f1f2d", border: "1px solid #303048", boxSizing: "border-box" }}>
            <div style={{ minWidth: "100%", width: "max-content", display: "flex", gap: "4px", flexWrap: "nowrap", justifyContent: "center", alignItems: "center", margin: "0 auto" }}>
            {phase === "test" && (isHotlineOpen || guesses.length === 0) && (
              <span style={{ fontSize: "0.68rem", color: "rgba(255,255,255,0.28)", letterSpacing: "0.08em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
                {isHotlineOpen ? "Guessing disabled" : "Guess Path"}
              </span>
            )}
            {phase === "test" && !isHotlineOpen && guesses.length > 0 && (
              <>
                {guesses.map((g, i) => {
                  const gc = lookup[g.color];
                  const isCorrect = g.color === target?.name;
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: "3px" }}>
                      {i > 0 && <span style={{ color: "rgba(255,255,255,0.2)", fontSize: "0.55rem" }}>→</span>}
                      <div style={{ display: "flex", alignItems: "center", gap: "5px", padding: "5px 10px", borderRadius: "8px", background: isCorrect ? gc?.hex + "44" : gc?.hex + "22", border: `1px solid ${isCorrect ? gc?.hex : gc?.hex + "66"}`, color: gc?.hex, whiteSpace: "nowrap" }}>
                        <span style={{ fontSize: g.color === "Oval" ? "0.72rem" : "0.85rem", lineHeight: 1, color: isCorrect ? gc?.hex : "#ffffff", filter: isCorrect ? `drop-shadow(0 0 4px ${gc?.hex})` : "none" }}>{gc?.symbol}</span>
                        <span style={{ fontSize: "0.65rem", lineHeight: 1 }}>{g.color}{isCorrect ? " ✓" : ""}</span>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
            </div>
          </div>
        </div>}

        <div style={{ width: "100%", display: "flex", justifyContent: "center" }}>
          <div style={{ width: "fit-content", maxWidth: "980px", overflowX: "auto", borderRadius: "16px", border: "1px solid rgba(255,255,255,0.18)", background: "rgba(17,17,24,0.92)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)", padding: "6px" }}>
            <div style={{ display: "flex", flexWrap: "nowrap", width: "max-content", gap: "6px" }}>
              {displayItems.map((c, i) => {
                const isActive = i === itemIdx;
                const activeBg = "rgba(255,255,255,0.08)";
                const inactiveBg = "rgba(255,255,255,0.03)";

                return (
                  <button
                    key={c.name}
                    onClick={() => {
                      setItemIdx(i);
                      speak(c.name);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "9px 14px",
                      borderRadius: "12px",
                      background: isActive ? activeBg : inactiveBg,
                      border: isActive ? "1px solid rgba(255,255,255,0.26)" : "1px solid rgba(255,255,255,0.14)",
                      cursor: "pointer",
                      fontFamily: "inherit",
                      outline: "none",
                      whiteSpace: "nowrap",
                      transition: "background 0.15s, border-color 0.15s",
                    }}
                  >
                    <span style={{ fontSize: c.name === "Oval" ? "0.78rem" : "0.92rem", lineHeight: 1, color: "#ffffff", filter: isActive ? `drop-shadow(0 0 4px ${c.hex}aa)` : "none" }}>
                      {c.symbol}
                    </span>
                    <span style={{ fontSize: "0.82rem", color: "#ffffff", opacity: isActive ? 1 : 0.78, fontWeight: isActive ? 700 : 500, letterSpacing: "0.04em" }}>
                      {c.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: "8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {phase === "training" && (
              <button onClick={onInstructions} style={{ background: "linear-gradient(120deg, #3b82f6 0%, #7c3aed 50%, #db2777 100%)", border: "none", borderRadius: "8px", color: "white", padding: "8px 20px", cursor: "pointer", fontFamily: "Cormorant Garamond, Georgia, serif", fontSize: "0.82rem", letterSpacing: "0.12em", textTransform: "uppercase", boxShadow: "0 2px 16px #7c3aed55" }}>← Instructions</button>
            )}
          </div>

          <div style={{ display: "flex", justifyContent: "center" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", background: "#252535", border: "1px solid #3a3a55", borderRadius: "10px", padding: "10px 16px", fontFamily: "inherit", minWidth: "320px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", width: "100%" }}>
              <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", color: micStatusColor, width: "28px", height: "28px", borderRadius: "999px", background: micIsListening ? "#f472b61a" : "transparent", boxShadow: micIsListening ? "0 0 0 2px #f472b633, 0 0 18px #f472b644" : "none", animation: micIsListening ? "mindsightMicPulse 1.2s ease-in-out infinite" : "none", flexShrink: 0 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 15a3 3 0 0 0 3-3V7a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Zm5-3a1 1 0 1 1 2 0 7 7 0 0 1-6 6.93V21h3a1 1 0 1 1 0 2H8a1 1 0 1 1 0-2h3v-2.07A7 7 0 0 1 5 12a1 1 0 1 1 2 0 5 5 0 1 0 10 0Z"/>
                </svg>
              </span>
              <div
                style={{
                  minWidth: 0,
                  flex: 1,
                  background: "#1f1f2d",
                  border: "1px solid #3a3a55",
                  borderRadius: "10px",
                  padding: "8px 10px",
                  color: heardPhrase ? "#f0ece4" : "rgba(255,255,255,0.40)",
                  fontSize: "0.72rem",
                  lineHeight: 1.2,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
                }}
              >
                {heardPhrase || "..."}
              </div>
              {phase === "test" && (
                <>
                  <span style={{ width: "2px", height: "18px", background: "rgba(255,255,255,0.4)", margin: "0 4px" }} />
                  <span style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.35)", letterSpacing: "0.1em", textTransform: "uppercase" }}>Card</span>
                  <span style={{ fontSize: "0.9rem", color: "#ffffff", fontWeight: 600, filter: isHotlineOpen ? "blur(3px)" : "none", opacity: isHotlineOpen ? 0.6 : 1 }}>{slotIdx + 1} of {slots.length}</span>
                  <span style={{ width: "2px", height: "18px", background: "rgba(255,255,255,0.4)", margin: "0 4px" }} />
                  {detectedMatch?.status === "ambiguous" ? (
                    <span style={{ fontSize: "0.68rem", color: "rgba(255,255,255,0.55)", letterSpacing: "0.08em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
                      Ambiguous
                    </span>
                  ) : detectedMatchItem ? (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", whiteSpace: "nowrap" }}>
                      <span style={{ fontSize: detectedMatchItem.name === "Oval" ? "0.78rem" : "0.95rem", lineHeight: 1, color: "#f5f7fb", filter: `drop-shadow(0 0 6px ${detectedMatchItem.hex}55)` }}>
                        {detectedMatchItem.symbol}
                      </span>
                      <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#ffffff", letterSpacing: "0.04em" }}>
                        {detectedMatchItem.name}
                      </span>
                      {detectedMatchPercent != null && (
                        <span style={{ fontSize: "0.72rem", fontWeight: 900, color: detectedMatchPercentColor, letterSpacing: "0.02em" }}>
                          {detectedMatchPercent}%
                        </span>
                      )}
                    </span>
                  ) : heardPhrase ? (
                    <span style={{ fontSize: "0.68rem", color: "rgba(255,255,255,0.55)", letterSpacing: "0.08em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
                      No match
                    </span>
                  ) : (
                    <span style={{ fontSize: "0.68rem", color: "rgba(255,255,255,0.28)", letterSpacing: "0.08em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
                      Ready
                    </span>
                  )}
                </>
              )}
              </div>

              {phase === "test" ? (
                renderGuessTray()
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: "10px", minHeight: "20px" }}>
                  {shownMatchItem ? (
                    <>
                      <span style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.5)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                        {pendingConfirmation ? "Is it this" : "Match"}
                      </span>
                      <span style={{ fontSize: shownMatchName === "Oval" ? "0.82rem" : "1rem", lineHeight: 1, color: "#f5f7fb", filter: `drop-shadow(0 0 6px ${shownMatchItem.hex}55)` }}>
                        {shownMatchItem.symbol}
                      </span>
                      {shownMatchPercent != null && (
                        <span style={{ fontSize: "0.82rem", fontWeight: 800, color: matchPercentColor, letterSpacing: "0.02em" }}>
                          {shownMatchPercent}%
                        </span>
                      )}
                    </>
                  ) : heardMatchInfo?.status === "ambiguous" ? (
                    <span style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.55)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Ambiguous</span>
                  ) : heardPhrase ? (
                    <span style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.55)", letterSpacing: "0.08em", textTransform: "uppercase" }}>No match</span>
                  ) : (
                    <span style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.28)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Ready</span>
                  )}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "4px", flexWrap: "wrap", alignItems: "center" }}>
            {phase === "training" && (
              <button onClick={beginTestPhase} style={{ background: "linear-gradient(120deg, #3b82f6 0%, #7c3aed 50%, #db2777 100%)", border: "none", borderRadius: "8px", color: "white", padding: "9px 24px", fontSize: "0.82rem", fontFamily: "Cormorant Garamond, Georgia, serif", letterSpacing: "0.15em", textTransform: "uppercase", cursor: "pointer" }}>Begin Test →</button>
            )}
            {done && (
              <button onClick={finishSession} style={{ background: "linear-gradient(120deg, #3b82f6 0%, #7c3aed 50%, #db2777 100%)", border: "none", borderRadius: "8px", color: "white", padding: "9px 24px", fontSize: "0.82rem", fontFamily: "Cormorant Garamond, Georgia, serif", letterSpacing: "0.15em", textTransform: "uppercase", cursor: "pointer", boxShadow: "0 2px 20px #7c3aed88", animation: "pulse 1.5s ease-in-out infinite" }}>Results →</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
