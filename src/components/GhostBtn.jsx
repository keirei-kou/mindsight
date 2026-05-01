export function GhostBtn({ children, onClick, small, danger, disabled, tabIndex }) {
  return (
    <button onClick={onClick} disabled={disabled} tabIndex={tabIndex} style={{ background: "transparent", border: `1px solid ${danger ? "rgba(169, 68, 66, 0.4)" : "var(--color-border, #E6E2D9)"}`, borderRadius: "6px", color: danger ? "var(--color-error, #A94442)" : disabled ? "#B8B1A5" : "var(--color-text, #1F1F1F)", padding: small ? "5px 11px" : "9px 18px", fontSize: small ? "0.78rem" : "0.88rem", fontFamily: "inherit", cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1, transition: "opacity 0.12s, border-color 0.12s, color 0.12s" }}>
      {children}
    </button>
  );
}
