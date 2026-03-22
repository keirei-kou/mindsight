import { useState, useEffect } from "react";

export function DisplayMode() {
  const [card, setCard] = useState(null);

  useEffect(() => {
    const channel = new BroadcastChannel("mindsight-display");
    channel.onmessage = (e) => {
      if (e.data?.type === "card") setCard(e.data.card);
      if (e.data?.type === "clear") setCard(null);
    };
    channel.postMessage({ type: "request" });
    return () => channel.close();
  }, []);

  const isNumbers = card?.category === "Numbers";
  const isShapes  = card?.category === "Shapes";
  const isColors  = card?.category === "Colors";
  const bg = isColors && card ? card.hex : "#111118";

  return (
    <div style={{ width: "100vw", height: "100vh", background: bg, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "16px", transition: "background 0.4s", fontFamily: "'Georgia', serif", overflow: "hidden" }}>
      {!card && <div style={{ color: "rgba(255,255,255,0.15)", fontSize: "1rem", letterSpacing: "0.3em", textTransform: "uppercase" }}>Waiting for session...</div>}
      {card && isNumbers && (() => {
        const numMap = {"One":"1","Two":"2","Three":"3","Four":"4","Five":"5","Six":"6"};
        return (
          <>
            <div style={{ fontSize: "10vw", fontWeight: 700, color: "white", fontFamily: "Cormorant Garamond, Georgia, serif", letterSpacing: "0.2em", textTransform: "uppercase", textShadow: `0 0 60px ${card.hex}88` }}>{card.name}</div>
            <div style={{ fontSize: "40vw", lineHeight: 0.85, color: card.hex, filter: `drop-shadow(0 0 80px ${card.hex}aa)` }}>{card.symbol}</div>
            <div style={{ fontSize: "20vw", fontWeight: 900, color: "white", fontFamily: "Cormorant Garamond, Georgia, serif", lineHeight: 1, textShadow: `0 0 80px ${card.hex}` }}>{numMap[card.name]}</div>
          </>
        );
      })()}
      {card && isShapes && (
        <>
          <div style={{ fontSize: "45vw", lineHeight: 0.85, color: card.hex, filter: `drop-shadow(0 0 80px ${card.hex}aa)` }}>{card.symbol}</div>
          <div style={{ fontSize: "10vw", fontWeight: 700, color: "white", fontFamily: "Cormorant Garamond, Georgia, serif", letterSpacing: "0.2em", textTransform: "uppercase", textShadow: `0 0 60px ${card.hex}` }}>{card.name}</div>
        </>
      )}
      {card && isColors && (
        <div style={{ fontSize: "18vw", fontWeight: 700, color: "rgba(255,255,255,0.15)", fontFamily: "Cormorant Garamond, Georgia, serif", letterSpacing: "0.3em", textTransform: "uppercase" }}>{card.name}</div>
      )}
    </div>
  );
}