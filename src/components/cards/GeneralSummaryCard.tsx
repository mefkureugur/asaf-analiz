import React from "react";

// Props yapısını isteğe bağlı (optional) yaptık ki hata vermesin
interface GeneralSummaryCardProps {
  currentCiro?: string; 
  currentOgrenci?: string; 
  currentOrtalama?: string;
}

export default function GeneralSummaryCard({
  currentCiro = "+%0,0", // Veri yoksa 0 gösterir
  currentOgrenci = "+%0,0",
  currentOrtalama = "+%0,0",
}: GeneralSummaryCardProps) {
  
  const getColor = (val: string) => {
    if (val.startsWith("+")) return "var(--success)"; 
    if (val.startsWith("-")) return "var(--danger)"; 
    return "var(--text-2)"; 
  };

  return (
    <div
      style={{
        background: "var(--bg)",
        border: "1px solid var(--line)",
        borderRadius: "var(--r-md)",
        padding: 16,
        marginTop: 16,
      }}
    >
      <h3 style={{ marginBottom: 16, fontSize: "1.1rem", color: "var(--text)" }}>
        📊 Geçen Yıla Göre Durum
      </h3>

      <MetricRow 
        label="Ciro Değişimi" 
        value={currentCiro} 
        color={getColor(currentCiro)} 
      />
      <MetricRow 
        label="Öğrenci Sayısı" 
        value={currentOgrenci} 
        color={getColor(currentOgrenci)} 
      />
      <MetricRow 
        label="Ortalama Kayıt" 
        value={currentOrtalama} 
        color={getColor(currentOrtalama)} 
      />
      
      <div style={{ 
        marginTop: 12, 
        paddingTop: 8, 
        borderTop: "1px solid var(--line)", 
        fontSize: "0.75rem", 
        color: "var(--text-3)",
        textAlign: "center"
      }}>
        * Bugünün tarihi ile geçen yılın aynı günü kıyaslanmaktadır.
      </div>
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
  color: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 10,
      }}
    >
      <span style={{ color: "var(--text-2)", fontSize: "0.9rem" }}>{label}</span>
      <span style={{ 
        color: color, 
        fontWeight: "bold", 
        fontSize: "1rem",
        fontFamily: "monospace" 
      }}>{value}</span>
    </div>
  );
}