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

export default function App() {
  const [isDisplayMode, setIsDisplayMode] = useState(() =>
    typeof window !== "undefined" && window.location.hash.startsWith("#display")
  );
  const [screen, setScreen]    = useState("setup");
  const [sessionData, setData] = useState(null);

  useEffect(() => {
    const syncDisplayMode = () => setIsDisplayMode(window.location.hash.startsWith("#display"));
    window.addEventListener("hashchange", syncDisplayMode);
    syncDisplayMode();
    return () => window.removeEventListener("hashchange", syncDisplayMode);
  }, []);

  const start          = (data) => { setData(data); setScreen(data.appMode === "group" ? "groupInstructions" : "micsetup"); };
  const goTraining     = () => setScreen("training");
  const goInstructions = () => setScreen("micsetup");
  const goResults      = (r) => { setData(prev => ({ ...prev, soloResults: r })); setScreen("soloResults"); };
  const goGroupResults = (r) => { setData(prev => ({ ...prev, groupResults: r })); setScreen("groupResults"); };
  const end            = () => { setData(null); setScreen("setup"); };
  const goSession      = () => setScreen("session");
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

  if (isDisplayMode) return <DisplayMode />;
  if (screen === "session"          && sessionData) return <Session {...sessionData} onEnd={goGroupResults} />;
  if (screen === "groupInstructions" && sessionData)
    return <GroupInstructions category={sessionData.category} activeItems={sessionData.colors} onContinue={goSession} onBack={end} />;
  if (screen === "micsetup"         && sessionData) return <Instructions category={sessionData.category} activeItems={sessionData.colors} onContinue={goTraining} onBack={end} />;
  if (screen === "training"    && sessionData) return <TrainingRoom items={sessionData.colors} slots={sessionData.slots} category={sessionData.category} name={sessionData.name} appMode={sessionData.appMode} shareCode={sessionData.shareCode} guessPolicy={sessionData.guessPolicy} deckPolicy={sessionData.deckPolicy} onBack={end} onInstructions={goInstructions} onFinish={goResults} />;
  if (screen === "soloResults" && sessionData?.soloResults) return <SoloResults data={sessionData.soloResults} onRestart={end} onRedo={() => setScreen("training")} />;
  if (screen === "groupResults" && sessionData?.groupResults) return <GroupResults data={sessionData.groupResults} onRestart={end} onBack={() => setScreen("session")} />;
  return <Setup onStart={start} onImportResults={importResults} />;
}
