export function SLabel({ children, centered }) {
  return (
    <div style={{ fontSize: "0.72rem", color: "#8080aa", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "10px", textAlign: centered ? "center" : "left", fontWeight: 500 }}>
      {children}
    </div>
  );
}