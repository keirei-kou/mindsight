import { useState } from "react";
import { DisplayMode } from './pages/DisplayMode.jsx';
import { Setup } from './pages/Setup.jsx';
import { Session } from './pages/Session.jsx';
import { Instructions } from './pages/Instructions.jsx';
import { TrainingRoom } from './pages/TrainingRoom.jsx';
import { SoloResults } from './pages/SoloResults.jsx';
import { GroupInstructions } from './pages/GroupInstructions.jsx';

export default function App() {
  const isDisplayMode = typeof window !== "undefined" && window.location.hash === "#display";
  const [screen, setScreen]    = useState("setup");
  const [sessionData, setData] = useState(null);

  const start          = (data) => { setData(data); setScreen(data.appMode === "individual" ? "micsetup" : "groupInstructions"); };
  const goTraining     = () => setScreen("training");
  const goInstructions = () => setScreen("micsetup");
  const goResults      = (r) => { setData(prev => ({ ...prev, soloResults: r })); setScreen("soloResults"); };
  const end            = () => { setData(null); setScreen("setup"); };
  const goSession      = () => setScreen("session");

  if (isDisplayMode) return <DisplayMode />;
  if (screen === "session"          && sessionData) return <Session {...sessionData} onEnd={end} />;
  if (screen === "groupInstructions" && sessionData)
    return <GroupInstructions category={sessionData.category} activeItems={sessionData.colors} onContinue={goSession} onBack={end} />;
  if (screen === "micsetup"         && sessionData) return <Instructions category={sessionData.category} activeItems={sessionData.colors} onContinue={goTraining} onBack={end} />;
  if (screen === "training"    && sessionData) return <TrainingRoom items={sessionData.colors} slots={sessionData.slots} category={sessionData.category} name={sessionData.name} onBack={end} onInstructions={goInstructions} onFinish={goResults} />;
  if (screen === "soloResults" && sessionData?.soloResults) return <SoloResults data={sessionData.soloResults} onRestart={end} onRedo={() => setScreen("training")} />;
  return <Setup onStart={start} />;
}
