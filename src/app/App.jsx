import { useEffect, useState } from "react";
import { DisplayMode } from '../pages/DisplayMode.jsx';
import { Setup } from '../pages/Setup.jsx';
import { Session } from '../pages/Session.jsx';
import { Instructions } from '../pages/Instructions.jsx';
import { CalibrationRoom } from '../pages/TrainingRoom.jsx';
import { SoloResults } from '../pages/SoloResults.jsx';
import { GroupInstructions } from '../pages/GroupInstructions.jsx';
import { GroupResults } from '../pages/GroupResults.jsx';
import { VoiceAsrTest } from '../pages/VoiceAsrTest.jsx';
import { parseGroupResultsCsv, parseSoloResultsCsv } from '../lib/csv.js';
import { requestGoogleAccessToken, revokeGoogleAccessToken } from '../lib/googleAuth.js';
import { clearGoogleAuthSession, getEmptyGoogleAuthState, persistGoogleAuthSession, restoreGoogleAuthSession } from '../lib/googleAuthSession.js';
import { clearGoogleSheetSession, getEmptyGoogleSheetState, persistGoogleSheetSession, restoreGoogleSheetSession } from '../lib/googleSheetSession.js';
import { appendSoloTrials, createMindsightSpreadsheet, readTrialsSheetRows } from '../lib/googleSheets.js';
import { pickExistingSpreadsheet } from '../lib/googlePicker.js';
import { buildSoloHistoryFromGoogleSheetRows } from '../lib/googleSheetHistory.js';
import { clearInterruptedSession, restoreInterruptedSession } from '../lib/sessionRecovery.js';
import { buildSoloSessionPayload } from '../lib/soloSessionPayload.js';

function getGoogleAccountKey(googleAuth) {
  return googleAuth?.accountId || googleAuth?.accountEmail || "";
}

export default function App() {
  const [isDisplayMode, setIsDisplayMode] = useState(() =>
    typeof window !== "undefined" && window.location.hash.startsWith("#display")
  );
  const [isVoiceAsrTest, setIsVoiceAsrTest] = useState(() =>
    typeof window !== "undefined" && window.location.hash.startsWith("#voice-asr-test")
  );
  const [screen, setScreen]    = useState("setup");
  const [sessionData, setData] = useState(null);
  const [googleAuth, setGoogleAuth] = useState(() => restoreGoogleAuthSession());
  const [googleSheet, setGoogleSheet] = useState(() => restoreGoogleSheetSession());
  const [googleSheetWriteStatus, setGoogleSheetWriteStatus] = useState("");
  const [googleSheetReadStatus, setGoogleSheetReadStatus] = useState("");
  const [interruptedSession, setInterruptedSession] = useState(() => restoreInterruptedSession());

  useEffect(() => {
    const syncHashModes = () => {
      setIsDisplayMode(window.location.hash.startsWith("#display"));
      setIsVoiceAsrTest(window.location.hash.startsWith("#voice-asr-test"));
    };
    window.addEventListener("hashchange", syncHashModes);
    syncHashModes();
    return () => window.removeEventListener("hashchange", syncHashModes);
  }, []);

  useEffect(() => {
    persistGoogleAuthSession(googleAuth);
  }, [googleAuth]);

  useEffect(() => {
    const accountKey = getGoogleAccountKey(googleAuth);
    if (googleAuth.status !== "connected" || !accountKey || googleSheet.status !== "selected") {
      return;
    }

    persistGoogleSheetSession(googleSheet, accountKey);
  }, [googleAuth, googleSheet]);

  useEffect(() => {
    console.log("CURRENT SHEET", googleSheet.spreadsheetId);
  }, [googleSheet.spreadsheetId]);

  useEffect(() => {
    setInterruptedSession(restoreInterruptedSession());
  }, [screen]);

  const setSelectedGoogleSheet = (sheet) => {
    const spreadsheetName = sheet.spreadsheetName || sheet.title || sheet.name || "Mindsight Trials";
    const selectedSheet = {
      status: "selected",
      error: "",
      ...sheet,
      spreadsheetName,
      title: spreadsheetName,
    };

    console.log("SET SHEET", selectedSheet.spreadsheetId);
    persistGoogleSheetSession(selectedSheet, getGoogleAccountKey(googleAuth));
    setGoogleSheet(selectedSheet);
  };

  const start          = (data) => { setData(data); setScreen(data.appMode === "group" ? "groupInstructions" : "micsetup"); };
  const goTraining     = () => setScreen("training");
  const goInstructions = () => setScreen("micsetup");
  const goResults      = async (r) => {
    setData(prev => ({ ...prev, soloResults: r }));
    setScreen("soloResults");

    if (
      googleAuth.status === "connected"
      && googleAuth.accessToken
      && googleSheet.status === "selected"
      && googleSheet.spreadsheetId
      && (r.appMode === "solo" || r.appMode === "shared")
    ) {
      try {
        const appendResult = await appendSoloTrials(googleAuth.accessToken, googleSheet.spreadsheetId, r);
        setGoogleSheetWriteStatus(`Saved ${appendResult.appendedRowCount} trial rows to Google Sheets.`);
      } catch (error) {
        setGoogleSheetWriteStatus(error instanceof Error ? error.message : "Unable to save trials to Google Sheets.");
      }
    }
  };
  const goGroupResults = (r) => { setData(prev => ({ ...prev, groupResults: r })); setScreen("groupResults"); };
  const end            = () => { setData(null); setScreen("setup"); };
  const goSession      = () => setScreen("session");
  const connectGoogle = async ({ forceAccountSelection = false } = {}) => {
    setGoogleAuth(prev => ({ ...prev, status: "connecting", error: "" }));

    try {
      const tokenState = await requestGoogleAccessToken({
        prompt: forceAccountSelection ? "select_account consent" : "consent",
      });
      const savedSheet = restoreGoogleSheetSession(getGoogleAccountKey(tokenState));

      setGoogleAuth({
        status: "connected",
        error: "",
        ...tokenState,
      });
      if (savedSheet.status === "selected") {
        setSelectedGoogleSheet(savedSheet);
      } else {
        setGoogleSheet(savedSheet);
      }
    } catch (error) {
      clearGoogleAuthSession();
      setGoogleAuth(getEmptyGoogleAuthState(error instanceof Error ? error.message : "Unable to connect to Google."));
    }
  };
  const switchGoogleAccount = () => connectGoogle({ forceAccountSelection: true });
  const disconnectGoogle = async () => {
    const accessToken = googleAuth.accessToken;
    setGoogleAuth(prev => ({ ...prev, status: "disconnecting", error: "" }));

    try {
      await revokeGoogleAccessToken(accessToken);
      clearGoogleAuthSession();
      clearGoogleSheetSession(getGoogleAccountKey(googleAuth));
      setGoogleAuth(getEmptyGoogleAuthState());
      setGoogleSheet(getEmptyGoogleSheetState());
    } catch (error) {
      setGoogleAuth(prev => ({
        ...prev,
        status: "error",
        error: error instanceof Error ? error.message : "Unable to disconnect from Google.",
      }));
    }
  };
  const createGoogleSheet = async () => {
    if (!googleAuth.accessToken) {
      setGoogleSheet(getEmptyGoogleSheetState("Connect Google before creating a Mindsight sheet."));
      return;
    }

    setGoogleSheet(prev => ({ ...prev, status: "creating", error: "" }));

    try {
      const createdSheet = await createMindsightSpreadsheet(googleAuth.accessToken);
      setSelectedGoogleSheet(createdSheet);
    } catch (error) {
      setGoogleSheet(getEmptyGoogleSheetState(error instanceof Error ? error.message : "Unable to create the Mindsight spreadsheet."));
    }
  };
  const pickGoogleSheet = async () => {
    if (!googleAuth.accessToken) {
      setGoogleSheet(getEmptyGoogleSheetState("Connect Google before choosing a Mindsight sheet."));
      return;
    }

    const scrollY = typeof window !== "undefined" ? window.scrollY : 0;
    const activeElement = typeof document !== "undefined" ? document.activeElement : null;
    let scrollLockInterval = null;

    if (activeElement instanceof HTMLElement) {
      activeElement.blur();
    }

    if (typeof window !== "undefined") {
      scrollLockInterval = window.setInterval(() => {
        window.scrollTo({ top: scrollY, behavior: "auto" });
      }, 50);
    }

    const releaseScrollLock = () => {
      if (scrollLockInterval != null) {
        window.clearInterval(scrollLockInterval);
      }

      window.requestAnimationFrame(() => {
        window.scrollTo({ top: scrollY, behavior: "auto" });
      });
    };

    setGoogleSheet(prev => ({ ...prev, status: "selecting", error: "" }));

    try {
      const selectedSheet = await pickExistingSpreadsheet(googleAuth.accessToken);
      setSelectedGoogleSheet(selectedSheet);
      releaseScrollLock();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unable to choose an existing spreadsheet.";
      setGoogleSheet(prev => prev.spreadsheetId
        ? { ...prev, status: "selected", error: errorMessage }
        : getEmptyGoogleSheetState(errorMessage)
      );
      releaseScrollLock();
    }
  };
  const importResults = ({ kind, text }) => {
    if (kind === "group") {
      const groupResults = parseGroupResultsCsv(text);
      setData({ groupResults });
      setScreen("groupResults");
      return;
    }

    const soloResults = parseSoloResultsCsv(text);
    setData({ soloResults });
    setScreen("soloResults");
  };

  const openInterruptedSession = () => {
    const snapshot = restoreInterruptedSession();
    if (!snapshot) {
      setInterruptedSession(null);
      return;
    }

    const payload = buildSoloSessionPayload({
      appMode: snapshot.appMode,
      shareCode: snapshot.shareCode,
      sessionId: snapshot.sessionId,
      startedAt: snapshot.startedAt,
      endedAt: snapshot.endedAt,
      name: snapshot.name,
      category: snapshot.category,
      activeOptions: snapshot.activeOptions,
      guessPolicy: snapshot.guessPolicy,
      deckPolicy: snapshot.deckPolicy,
      completedResults: snapshot.completedResults ?? [],
    });

    clearInterruptedSession();
    setInterruptedSession(null);
    setData({ soloResults: { ...payload, interruptedFromRecovery: true } });
    setScreen("soloResults");
  };

  const dismissInterruptedSession = () => {
    clearInterruptedSession();
    setInterruptedSession(null);
  };
  const openGoogleResults = async () => {
    if (!googleAuth.accessToken || googleAuth.status !== "connected") {
      setGoogleSheetReadStatus("Connect Google before opening Google results.");
      return;
    }

    if (!googleSheet.spreadsheetId) {
      setGoogleSheetReadStatus("Choose or create a Google sheet before opening results.");
      return;
    }

    try {
      const rows = await readTrialsSheetRows(googleAuth.accessToken, googleSheet.spreadsheetId);
      const sessions = buildSoloHistoryFromGoogleSheetRows(rows);
      const latestSession = sessions.length > 0 ? sessions[sessions.length - 1] : null;

      if (!latestSession) {
        setGoogleSheetReadStatus("No solo or shared trial history was found in the selected Google sheet.");
        return;
      }

      setGoogleSheetReadStatus("");
      setData({ soloResults: { ...latestSession, googleHistory: sessions, openedFromGoogleResults: true } });
      setScreen("soloResults");
    } catch (error) {
      setGoogleSheetReadStatus(error instanceof Error ? error.message : "Unable to open Google Sheets results.");
    }
  };

  if (isDisplayMode) return <DisplayMode />;
  if (isVoiceAsrTest) return <VoiceAsrTest />;
  if (screen === "session"          && sessionData) return <Session {...sessionData} onEnd={goGroupResults} />;
  if (screen === "groupInstructions" && sessionData)
    return <GroupInstructions category={sessionData.category} activeItems={sessionData.colors} onContinue={goSession} onBack={end} />;
  if (screen === "micsetup"         && sessionData) return <Instructions category={sessionData.category} activeItems={sessionData.colors} onContinue={goTraining} onBack={end} />;
  if (screen === "training"    && sessionData) return <CalibrationRoom items={sessionData.colors} slots={sessionData.slots} category={sessionData.category} name={sessionData.name} appMode={sessionData.appMode} shareCode={sessionData.shareCode} guessPolicy={sessionData.guessPolicy} deckPolicy={sessionData.deckPolicy} onBack={end} onInstructions={goInstructions} onFinish={goResults} />;
  if (screen === "soloResults" && sessionData?.soloResults) return <SoloResults data={sessionData.soloResults} onRestart={end} googleAuth={googleAuth} googleSheet={googleSheet} />;
  if (screen === "groupResults" && sessionData?.groupResults) return <GroupResults data={sessionData.groupResults} onRestart={end} onBack={() => setScreen("session")} />;
  return <Setup onStart={start} onImportResults={importResults} googleAuth={googleAuth} onConnectGoogle={connectGoogle} onSwitchGoogleAccount={switchGoogleAccount} onDisconnectGoogle={disconnectGoogle} googleSheet={googleSheet} onCreateGoogleSheet={createGoogleSheet} onPickGoogleSheet={pickGoogleSheet} onOpenGoogleResults={openGoogleResults} googleSheetWriteStatus={googleSheetWriteStatus} googleSheetReadStatus={googleSheetReadStatus} interruptedSession={interruptedSession} onOpenInterruptedSession={openInterruptedSession} onDismissInterruptedSession={dismissInterruptedSession} />;
}
