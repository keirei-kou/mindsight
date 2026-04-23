import { useEffect, useState } from "react";
import { DisplayMode } from './pages/DisplayMode.jsx';
import { Setup } from './pages/Setup.jsx';
import { Session } from './pages/Session.jsx';
import { Instructions } from './pages/Instructions.jsx';
import { TrainingRoom } from './pages/TrainingRoom.jsx';
import { SoloResults } from './pages/SoloResults.jsx';
import { GroupInstructions } from './pages/GroupInstructions.jsx';
import { GroupResults } from './pages/GroupResults.jsx';
import { parseGroupResultsCsv, parseSoloResultsCsv } from './csv.js';
import { requestGoogleAccessToken, revokeGoogleAccessToken } from './googleAuth.js';
import { clearGoogleAuthSession, getEmptyGoogleAuthState, persistGoogleAuthSession, restoreGoogleAuthSession } from './googleAuthSession.js';
import { clearGoogleSheetSession, getEmptyGoogleSheetState, persistGoogleSheetSession, restoreGoogleSheetSession } from './googleSheetSession.js';
import { appendSoloTrials, createMindsightSpreadsheet, readTrialsSheetRows } from './googleSheets.js';
import { pickExistingSpreadsheet } from './googlePicker.js';
import { buildSoloHistoryFromGoogleSheetRows } from './googleSheetHistory.js';
import { clearInterruptedSession, restoreInterruptedSession } from './sessionRecovery.js';
import { buildSoloSessionPayload } from './soloSessionPayload.js';

export default function App() {
  const [isDisplayMode, setIsDisplayMode] = useState(() =>
    typeof window !== "undefined" && window.location.hash.startsWith("#display")
  );
  const [screen, setScreen]    = useState("setup");
  const [sessionData, setData] = useState(null);
  const [googleAuth, setGoogleAuth] = useState(() => restoreGoogleAuthSession());
  const [googleSheet, setGoogleSheet] = useState(() => restoreGoogleSheetSession());
  const [googleSheetWriteStatus, setGoogleSheetWriteStatus] = useState("");
  const [googleSheetReadStatus, setGoogleSheetReadStatus] = useState("");
  const [interruptedSession, setInterruptedSession] = useState(() => restoreInterruptedSession());

  useEffect(() => {
    const syncDisplayMode = () => setIsDisplayMode(window.location.hash.startsWith("#display"));
    window.addEventListener("hashchange", syncDisplayMode);
    syncDisplayMode();
    return () => window.removeEventListener("hashchange", syncDisplayMode);
  }, []);

  useEffect(() => {
    persistGoogleAuthSession(googleAuth);
  }, [googleAuth]);

  useEffect(() => {
    persistGoogleSheetSession(googleSheet);
  }, [googleSheet]);

  useEffect(() => {
    setInterruptedSession(restoreInterruptedSession());
  }, [screen]);

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
  const connectGoogle = async () => {
    setGoogleAuth(prev => ({ ...prev, status: "connecting", error: "" }));

    try {
      const tokenState = await requestGoogleAccessToken();
      setGoogleAuth({
        status: "connected",
        error: "",
        ...tokenState,
      });
    } catch (error) {
      clearGoogleAuthSession();
      setGoogleAuth(getEmptyGoogleAuthState(error instanceof Error ? error.message : "Unable to connect to Google."));
    }
  };
  const disconnectGoogle = async () => {
    const accessToken = googleAuth.accessToken;
    setGoogleAuth(prev => ({ ...prev, status: "disconnecting", error: "" }));

    try {
      await revokeGoogleAccessToken(accessToken);
      clearGoogleAuthSession();
      clearGoogleSheetSession();
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
      setGoogleSheet({
        status: "selected",
        error: "",
        ...createdSheet,
      });
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
      setGoogleSheet({
        status: "selected",
        error: "",
        ...selectedSheet,
      });
      releaseScrollLock();
    } catch (error) {
      setGoogleSheet(getEmptyGoogleSheetState(error instanceof Error ? error.message : "Unable to choose an existing spreadsheet."));
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
  if (screen === "session"          && sessionData) return <Session {...sessionData} onEnd={goGroupResults} />;
  if (screen === "groupInstructions" && sessionData)
    return <GroupInstructions category={sessionData.category} activeItems={sessionData.colors} onContinue={goSession} onBack={end} />;
  if (screen === "micsetup"         && sessionData) return <Instructions category={sessionData.category} activeItems={sessionData.colors} onContinue={goTraining} onBack={end} />;
  if (screen === "training"    && sessionData) return <TrainingRoom items={sessionData.colors} slots={sessionData.slots} category={sessionData.category} name={sessionData.name} appMode={sessionData.appMode} shareCode={sessionData.shareCode} guessPolicy={sessionData.guessPolicy} deckPolicy={sessionData.deckPolicy} onBack={end} onInstructions={goInstructions} onFinish={goResults} />;
  if (screen === "soloResults" && sessionData?.soloResults) return <SoloResults data={sessionData.soloResults} onRestart={end} googleAuth={googleAuth} googleSheet={googleSheet} />;
  if (screen === "groupResults" && sessionData?.groupResults) return <GroupResults data={sessionData.groupResults} onRestart={end} onBack={() => setScreen("session")} />;
  return <Setup onStart={start} onImportResults={importResults} googleAuth={googleAuth} onConnectGoogle={connectGoogle} onDisconnectGoogle={disconnectGoogle} googleSheet={googleSheet} onCreateGoogleSheet={createGoogleSheet} onPickGoogleSheet={pickGoogleSheet} onOpenGoogleResults={openGoogleResults} googleSheetWriteStatus={googleSheetWriteStatus} googleSheetReadStatus={googleSheetReadStatus} interruptedSession={interruptedSession} onOpenInterruptedSession={openInterruptedSession} onDismissInterruptedSession={dismissInterruptedSession} />;
}
