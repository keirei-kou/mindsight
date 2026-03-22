export function GhostBtn({ children, onClick, small, danger, disabled, tabIndex }) {
  return (
    <button onClick={onClick} disabled={disabled} tabIndex={tabIndex} style={{ background: "transparent", border: `1px solid ${danger ? "#ef444466" : "#252530"}`, borderRadius: "6px", color: danger ? "#ef4444" : disabled ? "#2a2a3a" : "#f0ece4", padding: small ? "5px 11px" : "9px 18px", fontSize: small ? "0.78rem" : "0.88rem", fontFamily: "inherit", cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.4 : 1, transition: "opacity 0.12s" }}>
      {children}
    </button>
  );
}