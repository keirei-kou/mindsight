import { LocalVadPanel } from "../components/LocalVadPanel.jsx";

export function VoiceAsrTest() {
  const localAsrEnabled = import.meta.env.DEV || import.meta.env.VITE_ENABLE_LOCAL_ASR === "true";

  if (!localAsrEnabled) {
    return (
      <main style={{ minHeight: "100vh", background: "var(--color-bg)", color: "var(--color-text)", padding: "32px" }}>
        <h1 style={{ fontSize: "1.6rem", margin: 0 }}>Voice Engine Lab</h1>
        <p style={{ color: "var(--color-subtext)" }}>Set `VITE_ENABLE_LOCAL_ASR=true` to enable this lab outside dev.</p>
      </main>
    );
  }

  return (
    <main style={{ minHeight: "100vh", background: "var(--color-bg)", color: "var(--color-text)", padding: "32px", fontFamily: "Inter, system-ui, sans-serif" }}>
      <section style={{ maxWidth: "1120px", margin: "0 auto", display: "grid", gap: "24px" }}>
        <header style={{ display: "grid", gap: "8px", textAlign: "left" }}>
          <h1 style={{ fontSize: "1.9rem", margin: 0, color: "var(--color-text)", fontWeight: 850, letterSpacing: 0 }}>Voice Engine Lab</h1>
          <p style={{ margin: 0, color: "var(--color-subtext)", lineHeight: 1.55, maxWidth: "760px" }}>
            Capture local speech segments, transcribe them, label expected commands, and build benchmark samples.
          </p>
        </header>

        <LocalVadPanel />
      </section>
    </main>
  );
}
