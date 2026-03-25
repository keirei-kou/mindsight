export const CATEGORIES = {
  Colors: { label: "Colors", items: [
    { name: "Red",    symbol: "🔴", hex: "#ef4444" },
    { name: "Orange", symbol: "🟠", hex: "#f97316" },
    { name: "Yellow", symbol: "🟡", hex: "#eab308" },
    { name: "Green",  symbol: "🟢", hex: "#22c55e" },
    { name: "Blue",   symbol: "🔵", hex: "#3b82f6" },
    { name: "Purple", symbol: "🟣", hex: "#a855f7" },
  ]},
  Numbers: { label: "Numbers", items: [
    { name: "One",   symbol: "⚀", hex: "#f87171" },
    { name: "Two",   symbol: "⚁", hex: "#fb923c" },
    { name: "Three", symbol: "⚂", hex: "#facc15" },
    { name: "Four",  symbol: "⚃", hex: "#4ade80" },
    { name: "Five",  symbol: "⚄", hex: "#60a5fa" },
    { name: "Six",   symbol: "⚅", hex: "#c084fc" },
  ]},
  Shapes: { label: "Shapes", items: [
    { name: "Circle",    symbol: "⬤", hex: "#f87171" },
    { name: "Oval",      symbol: "🥚", hex: "#fb923c" },
    { name: "Square",    symbol: "■", hex: "#facc15" },
    { name: "Rectangle", symbol: "➖", hex: "#4ade80" },
    { name: "Triangle",  symbol: "▲", hex: "#60a5fa" },
    { name: "Diamond",   symbol: "◆", hex: "#c084fc" },
    { name: "Star",      symbol: "★", hex: "#f9a8d4" },
    { name: "Wavy",      symbol: "≋", hex: "#a78bfa" },
    { name: "Cross",     symbol: "✚", hex: "#f0abfc" },
  ]},
};

export const HUE_ORDER = ["Red","Orange","Yellow","Green","Blue","Purple"];
export const WARM = new Set(["Red","Orange","Yellow"]);
