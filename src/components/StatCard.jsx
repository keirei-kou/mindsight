export function StatCard({ label, value, color }) {
  return (
    <div style={{ background: "var(--color-surface, #FFFFFF)", border: "1px solid var(--color-border, #E6E2D9)", borderRadius: "10px", padding: "14px 20px", textAlign: "center", minWidth: "100px", boxShadow: "0 10px 24px rgba(31, 31, 31, 0.06)" }}>
      <div style={{ fontSize: "0.6rem", color: "var(--color-subtext, #6B6B6B)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "6px" }}>{label}</div>
      <div style={{ fontSize: "1.6rem", fontWeight: 600, color, fontFamily: "Cormorant Garamond, Georgia, serif" }}>{value}</div>
    </div>
  );
}
