import { useState, useRef, useEffect } from "react";
import { CATEGORIES } from '../constants.js';
import { buildSessionDeck, buildSharedSessionDeck } from '../deck.js';
import { parseResultsCsvSummary } from '../csv.js';
import { isGoogleAuthConfigured } from '../googleAuth.js';
import { isGooglePickerConfigured } from '../googlePicker.js';
import { DECK_POLICIES, GUESS_POLICIES, SESSION_MODES } from '../sessionModel.js';
import { buildSharedSessionPayload, looksLikeSharedSessionPayload, parseSharedSessionPayload } from '../sharedSessionPayload.js';
import { CsvImportButton } from '../components/CsvImportButton.jsx';
import { GhostBtn } from '../components/GhostBtn.jsx';
import { SLabel } from '../components/SLabel.jsx';
import { SlotPicker } from '../components/SlotPicker.jsx';
import { isSpeechRecognitionSupported, startContinuousListening } from '../speechRecognition.js';
import { matchTranscriptToItems } from '../speechMatcher.js';

export function Setup({ onStart, onImportResults, googleAuth, onConnectGoogle, onDisconnectGoogle, googleSheet, onCreateGoogleSheet, onPickGoogleSheet, onOpenGoogleResults, googleSheetWriteStatus, googleSheetReadStatus, interruptedSession, onOpenInterruptedSession, onDismissInterruptedSession }) {
  const [utilitySource, setUtilitySource] = useState("google");
  const [appMode, setAppMode]   = useState(SESSION_MODES.SOLO);
  const [guessPolicy, setGuessPolicy] = useState(GUESS_POLICIES.REPEAT_UNTIL_CORRECT);
  const [soloName, setSoloName] = useState("Keirei");
  const [sharedName, setSharedName] = useState("Keirei");
  const [shareCode, setShareCode] = useState("");
  const [names, setNames]       = useState(["User 1", "User 2"]);
  const defaultEnabled = new Set(["Red", "Blue"]);
  const [slots, setSlots]       = useState(defaultEnabled.size);
  const [category, setCategory] = useState("Colors");
  const [enabled, setEnabled]   = useState(new Set(["Red", "Blue"]));
  const [deckPolicy, setDeckPolicy] = useState(DECK_POLICIES.BALANCED_DECK);
  const [isListening, setIsListening] = useState(false);
  const [voiceTestStatus, setVoiceTestStatus] = useState(null);
  const [voiceTestTranscript, setVoiceTestTranscript] = useState("");
  const [voiceTestMatch, setVoiceTestMatch] = useState("");
  const [importStatus, setImportStatus] = useState("");
  const [importError, setImportError] = useState("");
  const [sharedCodeError, setSharedCodeError] = useState("");
  const [resumeIndex, setResumeIndex] = useState(0);
  const googleConfigured = isGoogleAuthConfigured();
  const googlePickerConfigured = isGooglePickerConfigured();
  const googleStatusMessage = googleAuth?.error || googleSheet?.error || googleSheetWriteStatus || googleSheetReadStatus || "";
  const csvStatusMessage = importError || importStatus || "";
  const googleButtonBaseStyle = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "10px",
    width: "100%",
    padding: "12px 14px",
    minHeight: "50px",
    fontSize: "0.9rem",
    fontFamily: "\"Google Sans\", \"Segoe UI\", Arial, sans-serif",
    letterSpacing: "0.01em",
    borderRadius: "10px",
    transition: "all 0.2s",
    fontWeight: 600
  };
  const listeningRef = useRef(null);
  const slotsUserSet = useRef(false);
  const slotsRef     = useRef(defaultEnabled.size);
  const catMemory = useRef(
    Object.fromEntries(Object.keys(CATEGORIES).map(cat => [
      cat,
      { enabled: cat === "Colors" ? new Set(defaultEnabled) : new Set(CATEGORIES[cat].items.map(c => c.name)), preview: null }
    ]))
  );

  useEffect(() => {
    slotsRef.current = slots;
  }, [slots]);

  useEffect(() => {
    return () => {
      listeningRef.current?.stop?.();
      listeningRef.current = null;
    };
  }, []);

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
    if (!slotsUserSet.current) setSlots(Math.max(2, restoredItems.length));
    setPreview(saved.preview ?? null);
  };

  const toggleItem = (name) => {
    if (enabled.has(name) && enabled.size <= 2) return;
    const s = new Set(enabled); s.has(name) ? s.delete(name) : s.add(name); setEnabled(s);
    const newActiveItems = CATEGORIES[category].items.filter(c => s.has(c.name));
    const effectiveSlots = slotsUserSet.current ? slots : newActiveItems.length;
    if (!slotsUserSet.current) setSlots(newActiveItems.length);
    if (preview) {
      const generated = buildPreviewDeck(newActiveItems, effectiveSlots);
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
  const isResumeSession = resumeIndex > 0;
  const canPreview = activeItems.length >= 1;
  const canStart = (
    appMode === SESSION_MODES.SOLO
      ? soloName.trim()
      : appMode === SESSION_MODES.SHARED
        ? sharedName.trim()
        : names.some(n => n.trim())
  ) && canPreview;
  const [preview, setPreview] = useState(null);

  const buildPreviewDeck = (itemsToUse, slotCount, nextDeckPolicy = deckPolicy, nextShareCode = shareCode) => {
    if (appMode === SESSION_MODES.SHARED) {
      return buildSharedSessionDeck(itemsToUse, slotCount, nextDeckPolicy, nextShareCode);
    }

    return buildSessionDeck(itemsToUse, slotCount, nextDeckPolicy);
  };

  const runPreview = () => {
    const hasAnyPreview = Object.values(catMemory.current).some(m => m.preview !== null);
    if (!hasAnyPreview) {
      Object.keys(CATEGORIES).forEach(cat => {
        const mem = catMemory.current[cat];
        const catEnabled = mem?.enabled ?? new Set(CATEGORIES[cat].items.map(c => c.name));
        const catItems = CATEGORIES[cat].items.filter(c => catEnabled.has(c.name));
        const count = slotsUserSet.current ? slots : catItems.length;
        const g = buildPreviewDeck(catItems, count, deckPolicy, shareCode);
        const ct = {};
        catItems.forEach(c => { ct[c.name] = 0; });
        g.forEach(s => { ct[s.name] = (ct[s.name] || 0) + 1; });
        const p = { generated: g, counts: ct };
        catMemory.current[cat] = { enabled: catEnabled, preview: p };
        if (cat === category) setPreview(p);
      });
    } else {
      const generated = buildPreviewDeck(activeItems, slots);
      const counts = {};
      activeItems.forEach(c => { counts[c.name] = 0; });
      generated.forEach(s => { counts[s.name] = (counts[s.name] || 0) + 1; });
      const newPreview = { generated, counts };
      setPreview(newPreview);
      catMemory.current[category] = { enabled, preview: newPreview };
    }
  };

  const runVoiceTest = () => {
    if (isListening) {
      listeningRef.current?.stop?.();
      listeningRef.current = null;
      setIsListening(false);
      setVoiceTestStatus("Stopped.");
      return;
    }

    setIsListening(true);
    setVoiceTestStatus("Listening...");
    setVoiceTestTranscript("");
    setVoiceTestMatch("");

    try {
      listeningRef.current = startContinuousListening({
        onStateChange: (state) => {
          if (state === "listening") setVoiceTestStatus("Listening...");
          if (state === "retrying") setVoiceTestStatus("Listening...");
          if (state === "stopped") setIsListening(false);
        },
        onResult: (result) => {
          const matched = matchTranscriptToItems(result.transcript, activeItems);
          setVoiceTestTranscript(result.transcript);
          setVoiceTestMatch(matched.match ? `${matched.match} (${Math.round(matched.score * 100)}%)` : "No close match");
          setVoiceTestStatus("Heard:");
        },
        onError: (error) => {
          setVoiceTestStatus(error.message);
          setIsListening(false);
        },
      });
    } catch (error) {
      setVoiceTestStatus(error.message);
      setIsListening(false);
      listeningRef.current = null;
    }
  };

  const go = () => {
    const generated = preview ? preview.generated : buildPreviewDeck(activeItems, slots);
    if (appMode === SESSION_MODES.SOLO) {
      onStart({
        appMode: SESSION_MODES.SOLO,
        name: soloName.trim(),
        slots: generated,
        colors: activeItems,
        category,
        guessPolicy,
        deckPolicy,
        shareCode: shareCode.trim() || null,
        resumeIndex,
      });
    } else if (appMode === SESSION_MODES.SHARED) {
      onStart({
        appMode: SESSION_MODES.SHARED,
        name: sharedName.trim(),
        shareCode: shareCode.trim(),
        slots: generated,
        colors: activeItems,
        category,
        guessPolicy,
        deckPolicy,
        resumeIndex,
      });
    } else {
      const participants = names.filter(n => n.trim()).map((n, i) => ({ id: i, name: n.trim(), active: true }));
      onStart({
        appMode: SESSION_MODES.GROUP,
        participants,
        slots: generated,
        colors: activeItems,
        category,
        guessPolicy,
        deckPolicy,
        shareCode: shareCode.trim() || null,
        resumeIndex,
      });
    }
  };

  const rebuildCurrentPreview = (nextShareCode = shareCode, nextDeckPolicy = deckPolicy) => {
    const generated = buildPreviewDeck(activeItems, slots, nextDeckPolicy, nextShareCode);
    const counts = {};
    activeItems.forEach((item) => {
      counts[item.name] = 0;
    });
    generated.forEach((item) => {
      counts[item.name] = (counts[item.name] || 0) + 1;
    });

    const nextPreview = { generated, counts };
    setPreview(nextPreview);
    catMemory.current[category] = { enabled: new Set(enabled), preview: nextPreview };
  };

  const applySharedSessionPayload = (sharedPayload) => {
    const nextEnabled = new Set(sharedPayload.optionValues);
    const nextPreviewItems = CATEGORIES[sharedPayload.category].items.filter((item) =>
      sharedPayload.deckOrder.includes(item.name)
    );
    const counts = {};
    sharedPayload.optionValues.forEach((optionValue) => {
      counts[optionValue] = 0;
    });

    sharedPayload.deckOrder.forEach((targetValue) => {
      counts[targetValue] = (counts[targetValue] || 0) + 1;
    });

    const generated = sharedPayload.deckOrder
      .map((targetValue) => CATEGORIES[sharedPayload.category].items.find((item) => item.name === targetValue))
      .filter(Boolean);

    const nextPreview = { generated, counts };

    setCategory(sharedPayload.category);
    setEnabled(nextEnabled);
    setSlots(sharedPayload.cardsPerRound);
    slotsUserSet.current = true;
    setGuessPolicy(sharedPayload.guessPolicy);
    setDeckPolicy(sharedPayload.deckPolicy);
    setResumeIndex(sharedPayload.resumeIndex ?? 0);
    setPreview(nextPreview);
    catMemory.current[sharedPayload.category] = { enabled: nextEnabled, preview: nextPreview };
    setSharedCodeError("");
  };

  const importCsvSummary = async (file) => {
    if (!file) return;

    try {
      const text = await file.text();
      const summary = parseResultsCsvSummary(text);

      switchCategory(summary.category);
      slotsUserSet.current = true;
      setSlots(Math.max(1, summary.roundSize || 1));

      if (summary.kind === "solo") {
        setAppMode(summary.appMode === SESSION_MODES.SHARED ? SESSION_MODES.SHARED : SESSION_MODES.SOLO);
        setSoloName(summary.participantNames[0] || "User 1");
        setSharedName(summary.participantNames[0] || "User 1");
        setShareCode(summary.shareCode || "");
        setResumeIndex(0);
      } else {
        setAppMode(SESSION_MODES.GROUP);
        setNames(summary.participantNames.length ? summary.participantNames : ["User 1", "User 2"]);
        setResumeIndex(0);
      }

      setImportStatus(`Loaded ${summary.kind} CSV: ${summary.category}, ${summary.roundSize} cards.`);
      setImportError("");
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Unable to import that CSV.");
      setImportStatus("");
    }
  };

  const importCsvToResults = async (file) => {
    if (!file) return;

    try {
      const text = await file.text();
      const summary = parseResultsCsvSummary(text);
      onImportResults?.({ kind: summary.kind, text });
      setImportStatus(`Opened ${summary.kind} results from ${file.name}.`);
      setImportError("");
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Unable to open that CSV.");
      setImportStatus("");
    }
  };

  const inp = { flex: 1, background: "#1c1c28", border: "1px solid #252530", borderRadius: "6px", color: "#f0ece4", padding: "9px 12px", fontSize: "0.88rem", fontFamily: "inherit", outline: "none" };
  const modeSelectStyle = {
    width: "auto",
    maxWidth: "210px",
    background: "linear-gradient(135deg, #161227 0%, #22153d 55%, #1a1330 100%)",
    border: "1px solid #6d4aff",
    borderRadius: "10px",
    color: "#f0ece4",
    padding: "10px 14px",
    minHeight: "44px",
    fontSize: "1.05rem",
    fontFamily: "'Cormorant Garamond', Georgia, serif",
    letterSpacing: "0.08em",
    textAlign: "center",
    outline: "none",
    boxShadow: "0 0 0 1px rgba(167, 139, 250, 0.18), 0 6px 20px rgba(76, 29, 149, 0.18)",
  };
  const sectionCardStyle = {
    background: "#181825",
    border: "1px solid #2b2b3f",
    borderRadius: "14px",
    padding: "20px 20px",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    boxShadow: "0 10px 24px rgba(0,0,0,0.18)",
  };

  const updateSharedCode = (value) => {
    const nextShareCode = value.trim();
    setShareCode(nextShareCode);

    if (!nextShareCode) {
      setSharedCodeError("");
      setResumeIndex(0);
      clearPreviewMemory();
      return;
    }

    if (looksLikeSharedSessionPayload(nextShareCode)) {
      try {
        const sharedPayload = parseSharedSessionPayload(nextShareCode);
        clearPreviewMemory();
        applySharedSessionPayload(sharedPayload);
      } catch (error) {
        setSharedCodeError(error instanceof Error ? error.message : "Shared session code could not be applied.");
      }
      return;
    }

    setSharedCodeError("");
  };

  const generateShareSession = () => {
    const generatedDeck = preview?.generated ?? buildSessionDeck(activeItems, slots, deckPolicy);
    const sharedPayload = {
      category,
      optionValues: activeItems.map((item) => item.name),
      cardsPerRound: slots,
      resumeIndex: 0,
      guessPolicy,
      deckPolicy,
      deckOrder: generatedDeck.map((item) => item.name),
    };
    const nextShareCode = buildSharedSessionPayload(sharedPayload);

    setShareCode(nextShareCode);
    setSharedCodeError("");
    applySharedSessionPayload(sharedPayload);
  };

  const clearPreviewMemory = () => {
    setPreview(null);
    setResumeIndex(0);
    Object.keys(CATEGORIES).forEach(cat => {
      catMemory.current[cat] = {
        enabled: catMemory.current[cat]?.enabled ?? new Set(CATEGORIES[cat].items.map(c => c.name)),
        preview: null,
      };
    });
  };

  const guessPolicySummary = guessPolicy === GUESS_POLICIES.ONE_SHOT
    ? "One Shot gives exactly one guess per card, then reveals the result and advances."
    : "Repeat Until Correct allows repeated guesses on the same card with immediate feedback.";

  const deckPolicySummary = deckPolicy === DECK_POLICIES.BALANCED_DECK
    ? "Balanced Deck gives every active option equal exposure before the deck is shuffled."
    : "Independent Draws samples each card separately from secure randomness, so repeats and gaps can happen.";

  const recommendedSummary = guessPolicy === GUESS_POLICIES.ONE_SHOT
    ? (deckPolicy === DECK_POLICIES.INDEPENDENT_DRAWS
      ? "Best for rapid testing and clean first-guess statistics."
      : "Best for rapid testing with even exposure to every active option.")
    : (deckPolicy === DECK_POLICIES.BALANCED_DECK
      ? "Best for structured training with repeated feedback and balanced exposure."
      : "Best for exploratory training with repeated feedback under fully independent draws.");

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
      <div style={{ width: "100%", maxWidth: "420px", display: "flex", flexDirection: "column", gap: "32px" }}>
        <section style={{ ...sectionCardStyle, alignItems: "center" }}>
          <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ display: "flex", gap: "8px", width: "100%" }}>
              <button
                onClick={() => setUtilitySource("google")}
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "9px",
                  background: utilitySource === "google" ? "linear-gradient(135deg, #0b2116 0%, #123526 100%)" : "transparent",
                  border: utilitySource === "google" ? "1px solid #34d39988" : "1px solid #252530",
                  borderRadius: "10px",
                  color: utilitySource === "google" ? "#dcfce7" : "#81819b",
                  padding: "10px 12px",
                  minHeight: "44px",
                  fontSize: "0.76rem",
                  fontFamily: "\"Google Sans\", \"Segoe UI\", Arial, sans-serif",
                  letterSpacing: "0.06em",
                  textTransform: "none",
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}
              >
                <span style={{ position: "relative", width: "16px", height: "18px", background: utilitySource === "google" ? "#86efac" : "#4ade80", borderRadius: "2px", boxShadow: utilitySource === "google" ? "0 0 14px rgba(74, 222, 128, 0.28)" : "none", flexShrink: 0 }}>
                  <span style={{ position: "absolute", top: "0", right: "0", width: "6px", height: "6px", background: utilitySource === "google" ? "#bbf7d0" : "#dcfce7", clipPath: "polygon(0 0, 100% 0, 100% 100%)" }} />
                  <span style={{ position: "absolute", left: "3px", top: "6px", width: "10px", height: "2px", background: utilitySource === "google" ? "#14532d" : "#166534", borderRadius: "999px" }} />
                  <span style={{ position: "absolute", left: "3px", top: "10px", width: "10px", height: "2px", background: utilitySource === "google" ? "#14532d" : "#166534", borderRadius: "999px" }} />
                  <span style={{ position: "absolute", left: "3px", top: "14px", width: "7px", height: "2px", background: utilitySource === "google" ? "#14532d" : "#166534", borderRadius: "999px" }} />
                </span>
                Google Sheets
              </button>
              <button
                onClick={() => setUtilitySource("csv")}
                style={{
                  flex: 1,
                  background: utilitySource === "csv" ? "linear-gradient(135deg, #181d27 0%, #243041 100%)" : "transparent",
                  border: utilitySource === "csv" ? "1px solid #93a9c888" : "1px solid #252530",
                  borderRadius: "10px",
                  color: utilitySource === "csv" ? "#e2e8f0" : "#81819b",
                  padding: "10px 12px",
                  minHeight: "44px",
                  fontSize: "0.76rem",
                  fontFamily: "\"Segoe UI\", Arial, sans-serif",
                  letterSpacing: "0.08em",
                  textTransform: "none",
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}
              >
                CSV
              </button>
            </div>

            {utilitySource === "google" ? (
              <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "10px" }}>
                <div style={{ width: "100%", display: "flex", gap: "12px", alignItems: "stretch" }}>
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "8px" }}>
                    {googleAuth?.status === "connected" ? (
                      <>
                        <button onClick={onDisconnectGoogle} style={{ ...googleButtonBaseStyle, background: "linear-gradient(135deg, #f8fafc 0%, #e0ecff 100%)", border: "1px solid #93c5fd", color: "#0f172a", cursor: "pointer", paddingTop: "14px", paddingBottom: "14px" }}>
                          <span style={{ width: "22px", height: "22px", borderRadius: "999px", background: "conic-gradient(from 210deg, #4285f4 0deg 110deg, #34a853 110deg 200deg, #fbbc05 200deg 270deg, #ea4335 270deg 360deg)", display: "inline-flex", alignItems: "center", justifyContent: "center", boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.55)" }}>
                            <span style={{ width: "11px", height: "11px", borderRadius: "999px", background: "#f8fafc" }} />
                          </span>
                          <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", lineHeight: 1.1 }}>
                            <span style={{ fontSize: "0.84rem", letterSpacing: "0.03em", textTransform: "none" }}>Google Connected</span>
                            <span style={{ fontSize: "0.64rem", color: "#475569", letterSpacing: "0.02em", textTransform: "none" }}>Click to disconnect</span>
                          </span>
                        </button>
                        <div style={{ fontSize: "0.66rem", color: "#93c5fd", letterSpacing: "0.04em", lineHeight: 1.6, textAlign: "center" }}>
                          Connected with Google's official popup.
                        </div>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={onConnectGoogle}
                          disabled={!googleConfigured || googleAuth?.status === "connecting"}
                          style={{
                            ...googleButtonBaseStyle,
                            background: googleConfigured ? "#ffffff" : "#1c1c28",
                            border: googleConfigured ? "1px solid #d1d5db" : "1px solid #252530",
                            color: googleConfigured ? "#111827" : "#555",
                            cursor: googleConfigured ? "pointer" : "not-allowed",
                            boxShadow: googleConfigured ? "0 10px 24px rgba(15, 23, 42, 0.14)" : "none"
                          }}
                        >
                          <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "24px", height: "24px", borderRadius: "999px", background: "#fff", border: "1px solid #e5e7eb", fontSize: "1.15rem", fontWeight: 700, fontFamily: "Arial, sans-serif", flexShrink: 0 }}>
                            <span style={{ background: "conic-gradient(from 220deg, #4285f4 0deg 120deg, #34a853 120deg 210deg, #fbbc05 210deg 285deg, #ea4335 285deg 360deg)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", color: "transparent" }}>G</span>
                          </span>
                          <span style={{ textTransform: "none", letterSpacing: "0.02em" }}>
                            {googleAuth?.status === "connecting" ? "Connecting with Google..." : "Connect with Google"}
                          </span>
                        </button>
                        <div style={{ fontSize: "0.66rem", color: googleConfigured ? "#b9b4d8" : "#fca5a5", letterSpacing: "0.04em", lineHeight: 1.6, textAlign: "center" }}>
                          {googleConfigured ? "Uses Google's official sign-in popup. This app never handles your password." : "Add VITE_GOOGLE_CLIENT_ID before enabling Google sign-in."}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {googleAuth?.status === "connected" && (
                  <>
                    {googleSheet?.status === "selected" && (
                      <div style={{ background: "#111118", border: "1px solid #252530", borderRadius: "10px", padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
                        <div style={{ fontSize: "0.68rem", color: "#86efac", letterSpacing: "0.12em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
                          Google Sheet Selected
                        </div>
                        <a
                          href={googleSheet.spreadsheetUrl}
                          target="_blank"
                          rel="noreferrer"
                          style={{ fontSize: "0.76rem", color: "#dbeafe", lineHeight: 1.5, textDecoration: "none", flex: 1, textAlign: "right" }}
                        >
                          {googleSheet.title || "Mindsight Trials"} (Open in Google Sheets)
                        </a>
                      </div>
                    )}

                    <div style={{ display: "flex", gap: "10px" }}>
                      <button
                        onClick={onCreateGoogleSheet}
                        disabled={googleSheet?.status === "creating" || googleSheet?.status === "selecting"}
                        style={{ flex: 0.95, background: googleSheet?.status === "creating" ? "#1c1c28" : "transparent", border: "1px solid #22c55e55", borderRadius: "10px", color: googleSheet?.status === "creating" ? "#6b7280" : "#86efac", padding: "12px", minHeight: "48px", fontSize: "0.75rem", fontFamily: "\"Segoe UI\", Arial, sans-serif", letterSpacing: "0.05em", textTransform: "none", cursor: googleSheet?.status === "creating" ? "wait" : "pointer", transition: "all 0.2s" }}
                      >
                        {googleSheet?.status === "creating" ? "Creating..." : googleSheet?.status === "selected" ? "Create New Sheet" : "Create Mindsight Sheet"}
                      </button>
                      <button
                        onClick={onPickGoogleSheet}
                        disabled={!googlePickerConfigured || googleSheet?.status === "creating" || googleSheet?.status === "selecting"}
                        style={{ flex: 1.05, background: !googlePickerConfigured || googleSheet?.status === "selecting" ? "#1c1c28" : "linear-gradient(135deg, #0f172a 0%, #162033 100%)", border: !googlePickerConfigured ? "1px solid #252530" : "1px solid #60a5fa66", borderRadius: "10px", color: !googlePickerConfigured ? "#555" : googleSheet?.status === "selecting" ? "#6b7280" : "#dbeafe", padding: "12px", minHeight: "48px", fontSize: "0.76rem", fontFamily: "\"Segoe UI\", Arial, sans-serif", letterSpacing: "0.05em", textTransform: "none", cursor: !googlePickerConfigured ? "not-allowed" : googleSheet?.status === "selecting" ? "wait" : "pointer", transition: "all 0.2s", boxShadow: !googlePickerConfigured || googleSheet?.status === "selecting" ? "none" : "0 10px 24px rgba(15, 23, 42, 0.16)" }}
                      >
                        {googleSheet?.status === "selecting" ? "Opening Picker..." : "Choose Existing Sheet"}
                      </button>
                    </div>
                    <button
                      onClick={onOpenGoogleResults}
                      disabled={googleSheet?.status !== "selected"}
                      style={{ background: googleSheet?.status === "selected" ? "linear-gradient(135deg, #26153c 0%, #382355 100%)" : "#1c1c28", border: googleSheet?.status === "selected" ? "1px solid #c084fc66" : "1px solid #252530", borderRadius: "10px", color: googleSheet?.status === "selected" ? "#f3e8ff" : "#555", padding: "12px", minHeight: "48px", fontSize: "0.76rem", fontFamily: "\"Segoe UI\", Arial, sans-serif", letterSpacing: "0.05em", textTransform: "none", cursor: googleSheet?.status === "selected" ? "pointer" : "not-allowed", transition: "all 0.2s", boxShadow: googleSheet?.status === "selected" ? "0 10px 24px rgba(88, 28, 135, 0.18)" : "none" }}
                    >
                      Open Google Results
                    </button>
                    <div style={{ fontSize: "0.66rem", color: googlePickerConfigured ? "#9ca3af" : "#fca5a5", letterSpacing: "0.03em", lineHeight: 1.6 }}>
                      {googlePickerConfigured
                        ? "Choose a sheet you already use, or create a fresh Mindsight sheet for new session history."
                        : "Add VITE_GOOGLE_API_KEY and VITE_GOOGLE_CLOUD_APP_ID to enable Google’s sheet picker."}
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "10px" }}>
                <div style={{ display: "flex", gap: "10px", width: "100%" }}>
                  <div style={{ flex: 1 }}>
                    <CsvImportButton
                      buttonLabel="Import CSV"
                      onSelect={importCsvSummary}
                      buttonStyle={{ width: "100%", background: "linear-gradient(135deg, #151a24 0%, #1d2633 100%)", border: "1px solid #7c8ea866", borderRadius: "10px", color: "#dbe7f5", padding: "12px", minHeight: "48px", fontSize: "0.82rem", fontFamily: "\"Segoe UI\", Arial, sans-serif", letterSpacing: "0.06em", textTransform: "none", cursor: "pointer", transition: "all 0.2s" }}
                      statusStyle={{ display: "none" }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <CsvImportButton
                      buttonLabel="Open CSV Results"
                      onSelect={importCsvToResults}
                      buttonStyle={{ width: "100%", background: "linear-gradient(135deg, #233145 0%, #2f425b 100%)", border: "1px solid #9fb6d488", borderRadius: "10px", color: "#f8fbff", padding: "12px", minHeight: "48px", fontSize: "0.82rem", fontFamily: "\"Segoe UI\", Arial, sans-serif", letterSpacing: "0.05em", textTransform: "none", cursor: "pointer", transition: "all 0.2s", boxShadow: "0 10px 24px rgba(15, 23, 42, 0.16)" }}
                      statusStyle={{ display: "none" }}
                    />
                  </div>
                </div>
              </div>
            )}

            {utilitySource === "google" && googleStatusMessage && (
              <div style={{ width: "100%", fontSize: "0.68rem", color: googleAuth?.error || googleSheet?.error ? "#fca5a5" : "#a7f3d0", letterSpacing: "0.04em", lineHeight: 1.6, textAlign: "center" }}>
                {googleStatusMessage}
              </div>
            )}
            {utilitySource === "csv" && csvStatusMessage && (
              <div style={{ width: "100%", fontSize: "0.68rem", color: importError ? "#fca5a5" : "#a7f3d0", letterSpacing: "0.04em", lineHeight: 1.6, textAlign: "center" }}>
                {csvStatusMessage}
              </div>
            )}

            {interruptedSession && (
              <div style={{ width: "100%", background: "#111118", border: "1px solid #f59e0b55", borderRadius: "12px", padding: "12px 14px", display: "flex", flexDirection: "column", gap: "10px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", flexWrap: "wrap", alignItems: "baseline" }}>
                  <div style={{ fontSize: "0.72rem", color: "#fbbf24", letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 700 }}>
                    Interrupted Test Found
                  </div>
                  <div style={{ fontSize: "0.68rem", color: "#b9b4d8", letterSpacing: "0.06em" }}>
                    {interruptedSession?.endedAt ? `Ended ${new Date(interruptedSession.endedAt).toLocaleString("en-US")}` : "Ended recently"}
                  </div>
                </div>
                <div style={{ fontSize: "0.72rem", color: "#dbeafe", lineHeight: 1.6 }}>
                  {interruptedSession?.name ? `${interruptedSession.name} · ` : ""}
                  {interruptedSession?.category ? `${interruptedSession.category} · ` : ""}
                  {Array.isArray(interruptedSession?.completedResults) ? `${interruptedSession.completedResults.length} cards recorded` : ""}
                </div>
                <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", flexWrap: "wrap" }}>
                  <button
                    onClick={onDismissInterruptedSession}
                    style={{ background: "transparent", border: "1px solid #252530", borderRadius: "10px", color: "#9090bb", padding: "10px 14px", fontSize: "0.76rem", fontFamily: "\"Segoe UI\", Arial, sans-serif", letterSpacing: "0.05em", cursor: "pointer" }}
                  >
                    Dismiss
                  </button>
                  <button
                    onClick={onOpenInterruptedSession}
                    style={{ background: "linear-gradient(135deg, #7c3aed 0%, #db2777 100%)", border: "none", borderRadius: "10px", color: "white", padding: "10px 16px", fontSize: "0.76rem", fontFamily: "\"Segoe UI\", Arial, sans-serif", letterSpacing: "0.05em", cursor: "pointer", boxShadow: "0 10px 24px rgba(124, 58, 237, 0.18)" }}
                  >
                    Open Results
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
        <section style={sectionCardStyle}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "14px", flexWrap: "wrap" }}>
            <div style={{ fontSize: "0.82rem", color: "#efe9ff", letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 700, whiteSpace: "nowrap" }}>
              Session Mode
            </div>
            <select value={appMode} onChange={(e) => { setAppMode(e.target.value); clearPreviewMemory(); }} style={{ ...modeSelectStyle, minWidth: "190px", marginLeft: "auto", flexShrink: 0 }}>
              <option value={SESSION_MODES.SOLO} style={{ background: "#19142b", color: "#d8ccff", textAlign: "center", fontFamily: "'Cormorant Garamond', Georgia, serif" }}>Solo Training</option>
              <option value={SESSION_MODES.SHARED} style={{ background: "#19142b", color: "#d8ccff", textAlign: "center", fontFamily: "'Cormorant Garamond', Georgia, serif" }}>Shared Training</option>
              <option value={SESSION_MODES.GROUP} style={{ background: "#19142b", color: "#d8ccff", textAlign: "center", fontFamily: "'Cormorant Garamond', Georgia, serif" }}>Group Tracker</option>
            </select>
          </div>
          {appMode === SESSION_MODES.SOLO ? (
            <div>
              <SLabel>Your Name</SLabel>
              <input value={soloName} onChange={e => setSoloName(e.target.value)} onClick={e => e.target.select()} placeholder="Your name" style={{ ...inp, width: "100%", boxSizing: "border-box" }} />
            </div>
          ) : appMode === SESSION_MODES.SHARED ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <SLabel>Your Name</SLabel>
                <input value={sharedName} onChange={e => setSharedName(e.target.value)} onClick={e => e.target.select()} placeholder="Your name" style={{ ...inp, width: "100%", boxSizing: "border-box" }} />
              </div>
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

        <section style={sectionCardStyle}>
          <div style={{ fontSize: "0.78rem", color: "#9090bb", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "10px", fontWeight: 500, textAlign: "left" }}>Category</div>
          <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
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
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "8px", marginBottom: "6px" }}>
            <div style={{ fontSize: "0.72rem", color: "#b0b0cc", letterSpacing: "0.15em", textTransform: "uppercase", fontWeight: 500 }}>Active {CATEGORIES[category].label}</div>
            <div style={{ display: "flex", gap: "6px" }}>
              <button onClick={() => {
                const s = new Set(CATEGORIES[category].items.map(c => c.name));
                setEnabled(s);
                const items = CATEGORIES[category].items;
                const effectiveSlots = slotsUserSet.current ? slots : items.length;
                if (!slotsUserSet.current) setSlots(items.length);
                if (preview) {
                  const g = buildPreviewDeck(items, effectiveSlots);
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
                  const g = buildPreviewDeck(pairItems, effectiveSlots);
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
                  <span style={{ fontSize: "1.1rem", lineHeight: 1, color: on ? "white" : "#888", filter: on ? `drop-shadow(0 0 6px ${c.hex}66)` : "none" }}>{c.symbol}</span>
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

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", marginTop: "12px" }}>
            <div style={{ fontSize: "0.82rem", color: "#d8ccff", letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 600, whiteSpace: "nowrap" }}>
              Cards per Round
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", flex: 1 }}>
              <SlotPicker value={slots} onChange={(newSlots) => {
                setSlots(newSlots);
                slotsUserSet.current = true;
                if (catMemory.current[category]?.preview) {
                  const g = buildPreviewDeck(activeItems, newSlots);
                  const ct = {};
                  activeItems.forEach(c => { ct[c.name] = 0; });
                  g.forEach(s => { ct[s.name] = (ct[s.name]||0)+1; });
                  const p = { generated: g, counts: ct };
                  setPreview(p);
                  catMemory.current[category] = { enabled, preview: p };
                }
              }} colorCount={activeItems.length} />
            </div>
          </div>
        </section>

        <section style={{ ...sectionCardStyle, gap: "12px" }}>
          <div style={{ fontSize: "0.72rem", color: "#b0b0cc", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "4px", fontWeight: 500 }}>Guess Policy</div>
          <div style={{ display: "flex", gap: "10px", marginBottom: "6px" }}>
            <button onClick={() => setGuessPolicy(GUESS_POLICIES.REPEAT_UNTIL_CORRECT)} style={{ flex: "1 1 0", minWidth: 0, background: guessPolicy===GUESS_POLICIES.REPEAT_UNTIL_CORRECT ? "#1a0f00" : "transparent", border: `2px solid ${guessPolicy===GUESS_POLICIES.REPEAT_UNTIL_CORRECT ? "#f97316" : "#252530"}`, borderRadius: "8px", padding: "10px 12px", cursor: "pointer", color: guessPolicy===GUESS_POLICIES.REPEAT_UNTIL_CORRECT ? "#f97316" : "#444", fontSize: "0.8rem", fontFamily: "inherit", transition: "all 0.12s", textAlign: "center", letterSpacing: "0.02em" }}>Repeat Until Correct</button>
            <button onClick={() => setGuessPolicy(GUESS_POLICIES.ONE_SHOT)} style={{ flex: "1 1 0", minWidth: 0, background: guessPolicy===GUESS_POLICIES.ONE_SHOT ? "#00101a" : "transparent", border: `2px solid ${guessPolicy===GUESS_POLICIES.ONE_SHOT ? "#38bdf8" : "#252530"}`, borderRadius: "8px", padding: "10px 12px", cursor: "pointer", color: guessPolicy===GUESS_POLICIES.ONE_SHOT ? "#38bdf8" : "#444", fontSize: "0.8rem", fontFamily: "inherit", transition: "all 0.12s", textAlign: "center", letterSpacing: "0.02em" }}>One Shot</button>
          </div>

          <div style={{ fontSize: "0.72rem", color: "#b0b0cc", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "4px", fontWeight: 500 }}>Deck Policy</div>
          <div style={{ display: "flex", gap: "10px" }}>
            <button onClick={() => { setDeckPolicy(DECK_POLICIES.BALANCED_DECK); clearPreviewMemory(); }} style={{ flex: "1 1 0", minWidth: 0, background: deckPolicy===DECK_POLICIES.BALANCED_DECK ? "#1a0f00" : "transparent", border: `2px solid ${deckPolicy===DECK_POLICIES.BALANCED_DECK ? "#f97316" : "#252530"}`, borderRadius: "8px", padding: "10px 12px", cursor: "pointer", color: deckPolicy===DECK_POLICIES.BALANCED_DECK ? "#f97316" : "#444", fontSize: "0.8rem", fontFamily: "inherit", transition: "all 0.12s", textAlign: "center", letterSpacing: "0.02em" }}>Balanced Deck</button>
            <button onClick={() => { setDeckPolicy(DECK_POLICIES.INDEPENDENT_DRAWS); clearPreviewMemory(); }} style={{ flex: "1 1 0", minWidth: 0, background: deckPolicy===DECK_POLICIES.INDEPENDENT_DRAWS ? "#00101a" : "transparent", border: `2px solid ${deckPolicy===DECK_POLICIES.INDEPENDENT_DRAWS ? "#38bdf8" : "#252530"}`, borderRadius: "8px", padding: "10px 12px", cursor: "pointer", color: deckPolicy===DECK_POLICIES.INDEPENDENT_DRAWS ? "#38bdf8" : "#444", fontSize: "0.8rem", fontFamily: "inherit", transition: "all 0.12s", textAlign: "center", letterSpacing: "0.02em" }}>Independent Draws</button>
          </div>

          <button onClick={runPreview} disabled={!canPreview} style={{ marginTop: "10px", background: canPreview ? "#0f1a2e" : "#1c1c28", border: canPreview ? "1px solid #3b82f6" : "1px solid #252530", borderRadius: "8px", color: canPreview ? "#60a5fa" : "#333", padding: "12px", fontSize: "0.82rem", fontFamily: "inherit", letterSpacing: "0.1em", textTransform: "uppercase", cursor: canPreview ? "pointer" : "not-allowed", transition: "all 0.2s" }}>
            {preview ? "Re-roll Deck" : "Preview Deck"}
          </button>
          <div style={{ fontSize: "0.68rem", color: "#6060a0", letterSpacing: "0.04em", lineHeight: 1.6 }}>
            {deckPolicy === DECK_POLICIES.BALANCED_DECK
              ? "Balanced Deck: every active option appears as evenly as possible, then the deck order is shuffled by secure randomness."
              : "Independent Draws: each card target is drawn separately from secure randomness, so repeats and missing options can happen naturally."}
            {preview && <span style={{ color: "#7070aa" }}> · {slots} cards locked in.</span>}
          </div>
          <div style={{ background: "#141420", border: "1px solid #252530", borderLeft: "3px solid #7c3aed", borderRadius: "10px", padding: "12px 14px", display: "flex", flexDirection: "column", gap: "8px" }}>
            <div style={{ fontSize: "0.68rem", color: "#b9b4d8", letterSpacing: "0.12em", textTransform: "uppercase" }}>Mode Summary</div>
            <div style={{ fontSize: "0.76rem", color: "#f0ece4", lineHeight: 1.6 }}>{guessPolicySummary}</div>
            <div style={{ fontSize: "0.76rem", color: "#c4b5fd", lineHeight: 1.6 }}>{deckPolicySummary}</div>
            <div style={{ fontSize: "0.72rem", color: "#9090bb", lineHeight: 1.6 }}>{recommendedSummary}</div>
          </div>
        </section>

        <section style={{ ...sectionCardStyle, gap: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "14px", flexWrap: "wrap" }}>
            <div style={{ fontSize: "0.78rem", color: "#b9b4d8", letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 600 }}>
              Session ID
            </div>
            {resumeIndex > 0 && (
              <div style={{ fontSize: "0.68rem", color: "#93c5fd", letterSpacing: "0.04em", lineHeight: 1.6 }}>
                Resume from card {resumeIndex + 1}
              </div>
            )}
          </div>
          <input value={shareCode} onChange={e => updateSharedCode(e.target.value)} onClick={e => e.target.select()} placeholder="Paste or generate a session code" style={{ ...inp, width: "100%", boxSizing: "border-box", letterSpacing: "0.03em", textTransform: "none" }} />
          <button onClick={generateShareSession} disabled={!preview} style={{ background: preview ? "transparent" : "#1c1c28", border: preview ? "1px solid #38bdf866" : "1px solid #252530", borderRadius: "8px", color: preview ? "#7dd3fc" : "#555", padding: "12px", fontSize: "0.82rem", fontFamily: "inherit", letterSpacing: "0.1em", textTransform: "uppercase", cursor: preview ? "pointer" : "not-allowed", transition: "all 0.2s" }}>
            Generate Session ID
          </button>
          {sharedCodeError && (
            <div style={{ fontSize: "0.68rem", color: "#fca5a5", letterSpacing: "0.04em", lineHeight: 1.6 }}>
              {sharedCodeError}
            </div>
          )}
          <div style={{ fontSize: "0.68rem", color: "#9090bb", letterSpacing: "0.04em", lineHeight: 1.6 }}>
            This session code can restore the current setup and deck across solo training, shared training, and group tracker.
          </div>
        </section>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "8px" }}>
            <button onClick={go} disabled={!canStart || !preview} style={{ background: (canStart && preview) ? "linear-gradient(120deg, #3b82f6 0%, #7c3aed 50%, #db2777 100%)" : "#1c1c28", border: (canStart && preview) ? "none" : "1px solid #252530", borderRadius: "8px", color: (canStart && preview) ? "white" : "#333", padding: "15px", fontSize: "0.95rem", fontFamily: "Cormorant Garamond, Georgia, serif", letterSpacing: "0.18em", textTransform: "uppercase", cursor: (canStart && preview) ? "pointer" : "not-allowed", boxShadow: (canStart && preview) ? "0 4px 28px #7c3aed55, 0 0 60px #3b82f622" : "none", transition: "all 0.2s" }}>
              {appMode === SESSION_MODES.GROUP ? "Start Round →" : isResumeSession ? "Resume Training →" : "Begin Training →"}
            </button>
          </div>
      </div>
    </div>
  );
}
