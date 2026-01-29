import { useEffect, useState } from "react";
import { getFinanceSnapshot } from "../../services/financeSnapshot.read";

// ASAF Şube Yapısı
type Mode = "GENERAL" | "Mefkure LGS" | "Mefkure VİP" | "Mefkure PLUS" | "Altınküre İlköğretim" | "Altınküre Lise" | "Altınküre Teknokent";

const MODES: Mode[] = [
  "GENERAL",
  "Mefkure LGS",
  "Mefkure VİP",
  "Mefkure PLUS",
  "Altınküre İlköğretim",
  "Altınküre Lise",
  "Altınküre Teknokent"
];

export default function FinanceViewPage() {
  const [mode, setMode] = useState<Mode>("GENERAL");
  const [snapshot, setSnapshot] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    const year = new Date().getFullYear();
    
    getFinanceSnapshot(year, mode)
      .then((data) => {
        setSnapshot(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Finans verisi okuma hatası:", err);
        setSnapshot(null);
        setLoading(false);
      });
  }, [mode]);

  // Veri Hesaplamaları
  const yearlyIncome = snapshot?.revenueTotal ?? 0;
  const runRateYearlyExpense = snapshot?.expenseRunRate ?? snapshot?.expenseEstimated ?? 0;
  const runRateProfit = yearlyIncome - runRateYearlyExpense;
  const runRateMargin = yearlyIncome > 0 ? (runRateProfit / yearlyIncome) * 100 : 0;

  const seasonalYearlyExpense = snapshot?.expenseEstimated ?? 0;
  const seasonalProfit = snapshot?.profitEstimate ?? 0;
  const seasonalMargin = snapshot?.profitMargin ? snapshot.profitMargin * 100 : 0;

  const profitColor = (v: number) => v >= 0 ? "#22c55e" : "#ef4444";

  return (
    <div style={{ color: "white", maxWidth: 1200, margin: "0 auto", padding: "24px 16px" }}>
      
      {/* BAŞLIK VE ŞUBE SEÇİCİ */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ marginBottom: 16, fontSize: "1.8rem", fontWeight: 800 }}>
          💰 Finansal Analiz Paneli
        </h2>
        
        <div style={selectorWrapper}>
          {MODES.map((m) => {
            const active = mode === m;
            return (
              <button
                key={m}
                onClick={() => setMode(m)}
                style={{
                  ...tabStyle,
                  background: active ? "linear-gradient(135deg,#3b82f6,#2563eb)" : "rgba(255,255,255,0.05)",
                  color: active ? "white" : "#94a3b8",
                  borderColor: active ? "#3b82f6" : "rgba(255,255,255,0.1)",
                }}
              >
                {m === "GENERAL" ? "⭐ KURUM GENEL" : m}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 50, color: "#38bdf8" }}>Veriler analiz ediliyor...</div>
      ) : (
        <>
          {/* ANA ÖZET KARTLARI */}
          <div style={grid3}>
            <div style={card}>
              <div style={label}>Toplam Tahmini Ciro</div>
              <div style={{ ...value, color: "#38bdf8" }}>{yearlyIncome.toLocaleString("tr-TR")} ₺</div>
            </div>
            <div style={card}>
              <div style={label}>Gerçekleşen Aylık Ort. Gider</div>
              <div style={value}>{((runRateYearlyExpense || 0) / 12).toLocaleString("tr-TR")} ₺</div>
            </div>
            <div style={card}>
              <div style={label}>Seçili Kurum</div>
              <div style={{ ...value, fontSize: 16 }}>{mode === "GENERAL" ? "Tüm ASAF Şubeleri" : mode}</div>
            </div>
          </div>

          {/* ANALİZ MODELLERİ */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginTop: 24 }}>
            
            {/* MODEL 1: RUN-RATE */}
            <div style={modelSection}>
              <h4 style={sectionHeader}>📈 Model 1: Mevcut Ortalamaya Göre</h4>
              <p style={sectionDesc}>Yılın geri kalanı mevcut gider ortalamasıyla biterse:</p>
              <div style={statRow}><span>Yıllık Gider:</span> <strong>{runRateYearlyExpense.toLocaleString("tr-TR")} ₺</strong></div>
              <div style={statRow}><span>Net Kâr:</span> <strong style={{ color: profitColor(runRateProfit) }}>{runRateProfit.toLocaleString("tr-TR")} ₺</strong></div>
              <div style={statRow}><span>Kâr Oranı:</span> <strong style={{ color: profitColor(runRateProfit) }}>%{runRateMargin.toFixed(1)}</strong></div>
            </div>

            {/* MODEL 2: SEASONAL */}
            <div style={modelSection}>
              <h4 style={sectionHeader}>🍂 Model 2: Mevsimsel Tahmin</h4>
              <p style={sectionDesc}>Sektörel katsayılar ve geçmiş harcama eğilimlerine göre:</p>
              <div style={statRow}><span>Yıllık Gider:</span> <strong>{seasonalYearlyExpense.toLocaleString("tr-TR")} ₺</strong></div>
              <div style={statRow}><span>Net Kâr:</span> <strong style={{ color: profitColor(seasonalProfit) }}>{seasonalProfit.toLocaleString("tr-TR")} ₺</strong></div>
              <div style={statRow}><span>Kâr Oranı:</span> <strong style={{ color: profitColor(seasonalProfit) }}>%{seasonalMargin.toFixed(1)}</strong></div>
            </div>

          </div>
        </>
      )}
    </div>
  );
}

/* ================================ STYLES ================================ */
const selectorWrapper: React.CSSProperties = { display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 };
const tabStyle: React.CSSProperties = { padding: "10px 16px", borderRadius: 12, border: "1px solid", cursor: "pointer", fontWeight: 700, fontSize: "0.85rem", transition: "all 0.2s" };
const grid3: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 };
const card: React.CSSProperties = { background: "#0f172a", border: "1px solid #1e293b", borderRadius: 20, padding: 20 };
const label: React.CSSProperties = { fontSize: 13, color: "#94a3b8", marginBottom: 8 };
const value: React.CSSProperties = { fontSize: 24, fontWeight: 800 };
const modelSection: React.CSSProperties = { background: "#020617", border: "1px solid #1e293b", borderRadius: 24, padding: 24 };
const sectionHeader: React.CSSProperties = { margin: 0, fontSize: "1.1rem", color: "#f8fafc" };
const sectionDesc: React.CSSProperties = { fontSize: "0.85rem", color: "#64748b", margin: "8px 0 20px" };
const statRow: React.CSSProperties = { display: "flex", justifyContent: "space-between", marginBottom: 12, fontSize: "1.05rem" };