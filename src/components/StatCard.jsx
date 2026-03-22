export function StatCard({ label, value, color }) {
  return (
    <div style={{ background: "#181825", borderRadius: "10px", padding: "14px 20px", textAlign: "center", minWidth: "100px" }}>
      <div style={{ fontSize: "0.6rem", color: "#4a4a6a", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "6px" }}>{label}</div>
      <div style={{ fontSize: "1.6rem", fontWeight: 600, color, fontFamily: "Cormorant Garamond, Georgia, serif" }}>{value}</div>
    </div>
  );
}