import { useState, useRef, useEffect } from "react";
import { CATEGORIES } from '../constants.js';
import { buildSessionDeck, buildSharedSessionDeck } from '../deck.js';
import { parseResultsCsvSummary } from '../csv.js';
import { createShareCode, DECK_POLICIES, GUESS_POLICIES, SESSION_MODES } from '../sessionModel.js';
import { CsvImportButton } from '../components/CsvImportButton.jsx';
import { GhostBtn } from '../components/GhostBtn.jsx';
import { SLabel } from '../components/SLabel.jsx';
import { SlotPicker } from '../components/SlotPicker.jsx';
import { isSpeechRecognitionSupported, startContinuousListening } from '../speechRecognition.js';
import { matchTranscriptToItems } from '../speechMatcher.js';

export function Setup({ onStart, onImportResults }) {
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
  const canStart = (
    appMode === SESSION_MODES.SOLO
      ? soloName.trim()
      : appMode === SESSION_MODES.SHARED
        ? (sharedName.trim() && shareCode.trim())
        : names.some(n => n.trim())
  ) && activeItems.length >= 1;
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
        shareCode: null,
      });
    } else if (appMode === SESSION_MODES.SHARED) {
      onStart({
        appMode: SESSION_MODES.SHARED,
        name: sharedName.trim(),
        shareCode: shareCode.trim().toUpperCase(),
        slots: generated,
        colors: activeItems,
        category,
        guessPolicy,
        deckPolicy,
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
        shareCode: null,
      });
    }
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
      } else {
        setAppMode(SESSION_MODES.GROUP);
        setNames(summary.participantNames.length ? summary.participantNames : ["User 1", "User 2"]);
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
    width: "100%",
    maxWidth: "240px",
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
    setShareCode(value.toUpperCase().replace(/[^A-Z0-9-]/g, ""));
    clearPreviewMemory();
  };

  const generateShareSession = () => {
    setShareCode(createShareCode());
    clearPreviewMemory();
  };

  const clearPreviewMemory = () => {
    setPreview(null);
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
        <section>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <CsvImportButton
              buttonLabel="Import CSV To Setup"
              onSelect={importCsvSummary}
              buttonStyle={{ background: "transparent", border: "1px solid #f59e0b66", borderRadius: "8px", color: "#fbbf24", padding: "12px", fontSize: "0.82rem", fontFamily: "inherit", letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer", transition: "all 0.2s" }}
              statusStyle={{ fontSize: "0.68rem", color: "#d6b06b", letterSpacing: "0.04em", lineHeight: 1.6 }}
            />
            <CsvImportButton
              buttonLabel="Open CSV Results"
              onSelect={importCsvToResults}
              buttonStyle={{ background: "transparent", border: "1px solid #38bdf866", borderRadius: "8px", color: "#7dd3fc", padding: "12px", fontSize: "0.82rem", fontFamily: "inherit", letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer", transition: "all 0.2s" }}
              statusStyle={{ fontSize: "0.68rem", color: "#7dd3fc", letterSpacing: "0.04em", lineHeight: 1.6 }}
            />
            {(importStatus || importError) && (
              <div style={{ fontSize: "0.68rem", color: importError ? "#fca5a5" : "#a7f3d0", letterSpacing: "0.04em", lineHeight: 1.6 }}>
                {importError || importStatus}
              </div>
            )}
          </div>
        </section>
        <section style={sectionCardStyle}>
          <SLabel>Session Mode</SLabel>
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <select value={appMode} onChange={(e) => { setAppMode(e.target.value); clearPreviewMemory(); }} style={modeSelectStyle}>
              <option value={SESSION_MODES.SOLO} style={{ background: "#19142b", color: "#d8ccff" }}>Solo Training</option>
              <option value={SESSION_MODES.SHARED} style={{ background: "#19142b", color: "#d8ccff" }}>Shared Training</option>
              <option value={SESSION_MODES.GROUP} style={{ background: "#19142b", color: "#d8ccff" }}>Group Tracker</option>
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
              <div>
                <SLabel>Session ID</SLabel>
                <input value={shareCode} onChange={e => updateSharedCode(e.target.value)} onClick={e => e.target.select()} placeholder="ABCD-EFGH" style={{ ...inp, width: "100%", boxSizing: "border-box", letterSpacing: "0.14em", textTransform: "uppercase" }} />
              </div>
              <button onClick={generateShareSession} style={{ background: "transparent", border: "1px solid #38bdf866", borderRadius: "8px", color: "#7dd3fc", padding: "12px", fontSize: "0.82rem", fontFamily: "inherit", letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer", transition: "all 0.2s" }}>
                Generate Session ID
              </button>
              <div style={{ fontSize: "0.68rem", color: "#9090bb", letterSpacing: "0.04em", lineHeight: 1.6 }}>
                Everyone who uses the same session ID will get the same card order for this setup.
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

        <section style={sectionCardStyle}>
          <div style={{ fontSize: "0.72rem", color: "#b0b0cc", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "10px", fontWeight: 500 }}>Guess Policy</div>
          <div style={{ display: "flex", gap: "10px", marginBottom: "12px" }}>
            <button onClick={() => setGuessPolicy(GUESS_POLICIES.REPEAT_UNTIL_CORRECT)} style={{ flex: "1 1 0", minWidth: 0, background: guessPolicy===GUESS_POLICIES.REPEAT_UNTIL_CORRECT ? "#1a0f00" : "transparent", border: `2px solid ${guessPolicy===GUESS_POLICIES.REPEAT_UNTIL_CORRECT ? "#f97316" : "#252530"}`, borderRadius: "8px", padding: "10px 12px", cursor: "pointer", color: guessPolicy===GUESS_POLICIES.REPEAT_UNTIL_CORRECT ? "#f97316" : "#444", fontSize: "0.8rem", fontFamily: "inherit", transition: "all 0.12s", textAlign: "center", letterSpacing: "0.02em" }}>Repeat Until Correct</button>
            <button onClick={() => setGuessPolicy(GUESS_POLICIES.ONE_SHOT)} style={{ flex: "1 1 0", minWidth: 0, background: guessPolicy===GUESS_POLICIES.ONE_SHOT ? "#00101a" : "transparent", border: `2px solid ${guessPolicy===GUESS_POLICIES.ONE_SHOT ? "#38bdf8" : "#252530"}`, borderRadius: "8px", padding: "10px 12px", cursor: "pointer", color: guessPolicy===GUESS_POLICIES.ONE_SHOT ? "#38bdf8" : "#444", fontSize: "0.8rem", fontFamily: "inherit", transition: "all 0.12s", textAlign: "center", letterSpacing: "0.02em" }}>One Shot</button>
          </div>

          <div style={{ fontSize: "0.72rem", color: "#b0b0cc", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "10px", fontWeight: 500 }}>Deck Policy</div>
          <div style={{ display: "flex", gap: "10px" }}>
            <button onClick={() => { setDeckPolicy(DECK_POLICIES.BALANCED_DECK); clearPreviewMemory(); }} style={{ flex: "1 1 0", minWidth: 0, background: deckPolicy===DECK_POLICIES.BALANCED_DECK ? "#1a0f00" : "transparent", border: `2px solid ${deckPolicy===DECK_POLICIES.BALANCED_DECK ? "#f97316" : "#252530"}`, borderRadius: "8px", padding: "10px 12px", cursor: "pointer", color: deckPolicy===DECK_POLICIES.BALANCED_DECK ? "#f97316" : "#444", fontSize: "0.8rem", fontFamily: "inherit", transition: "all 0.12s", textAlign: "center", letterSpacing: "0.02em" }}>Balanced Deck</button>
            <button onClick={() => { setDeckPolicy(DECK_POLICIES.INDEPENDENT_DRAWS); clearPreviewMemory(); }} style={{ flex: "1 1 0", minWidth: 0, background: deckPolicy===DECK_POLICIES.INDEPENDENT_DRAWS ? "#00101a" : "transparent", border: `2px solid ${deckPolicy===DECK_POLICIES.INDEPENDENT_DRAWS ? "#38bdf8" : "#252530"}`, borderRadius: "8px", padding: "10px 12px", cursor: "pointer", color: deckPolicy===DECK_POLICIES.INDEPENDENT_DRAWS ? "#38bdf8" : "#444", fontSize: "0.8rem", fontFamily: "inherit", transition: "all 0.12s", textAlign: "center", letterSpacing: "0.02em" }}>Independent Draws</button>
          </div>

          <button onClick={runPreview} disabled={!canStart} style={{ background: canStart ? "#0f1a2e" : "#1c1c28", border: canStart ? "1px solid #3b82f6" : "1px solid #252530", borderRadius: "8px", color: canStart ? "#60a5fa" : "#333", padding: "12px", fontSize: "0.82rem", fontFamily: "inherit", letterSpacing: "0.1em", textTransform: "uppercase", cursor: canStart ? "pointer" : "not-allowed", transition: "all 0.2s" }}>
            {preview ? "🔄 Re-roll Preview" : "🎲 Preview Distribution"}
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

        <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "8px" }}>
          <button onClick={go} disabled={!canStart || !preview} style={{ background: (canStart && preview) ? "linear-gradient(120deg, #3b82f6 0%, #7c3aed 50%, #db2777 100%)" : "#1c1c28", border: (canStart && preview) ? "none" : "1px solid #252530", borderRadius: "8px", color: (canStart && preview) ? "white" : "#333", padding: "15px", fontSize: "0.95rem", fontFamily: "Cormorant Garamond, Georgia, serif", letterSpacing: "0.18em", textTransform: "uppercase", cursor: (canStart && preview) ? "pointer" : "not-allowed", boxShadow: (canStart && preview) ? "0 4px 28px #7c3aed55, 0 0 60px #3b82f622" : "none", transition: "all 0.2s" }}>
            {appMode === SESSION_MODES.GROUP ? "Start Round →" : "Begin Training →"}
          </button>
        </div>
      </div>
    </div>
  );
}
