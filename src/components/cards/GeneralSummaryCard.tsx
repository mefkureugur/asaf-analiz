export default function GeneralSummaryCard() {
  return (
    <div
      style={{
        background: "#020617",
        border: "1px solid #1e293b",
        borderRadius: 12,
        padding: 16,
        marginTop: 16,
      }}
    >
      <h3 style={{ marginBottom: 12 }}>📊 Genel Toplam</h3>

      <MetricRow label="Ciro" value="+%18,4" color="green" />
      <MetricRow label="Öğrenci" value="-%4,2" color="red" />
      <MetricRow label="Ortalama" value="+%22,1" color="green" />
    </div>
  );
}

function MetricRow({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: "green" | "red";
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        marginBottom: 8,
      }}
    >
      <span>{label}</span>
      <span style={{ color }}>{value}</span>
    </div>
  );
}
