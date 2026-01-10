import { useEffect, useState } from "react";

import { getFinanceSnapshot } from "../../services/financeSnapshot.read";

type Mode = "GENERAL" | "YKS" | "LGS";

export default function FinanceViewPage() {
  const [mode, setMode] = useState<Mode>("GENERAL");

  // 🔑 Firestore snapshot (merkezi hafıza)
  const [snapshot, setSnapshot] = useState<any>(null);

  // 🔄 MODE değiştikçe Firestore’dan oku
  useEffect(() => {
  const year = new Date().getFullYear();
  const unit = mode === "GENERAL" ? "GENERAL" : mode;

  getFinanceSnapshot(year, unit)
    .then(setSnapshot)
    .catch((err) => {
      console.error("getFinanceSnapshot error:", err);
      setSnapshot(null);
    });
}, [mode]);

  /* ================================
     SNAPSHOT → SAYILAR
     (local yerine merkezi)
  ================================ */

  const yearlyIncome = snapshot?.revenueTotal ?? 0;

  // -------------------------
  // 1) RUN-RATE (Ort x 12)
  // -------------------------
  const runRateYearlyExpense = snapshot
    ? (snapshot.expenseRunRate ?? snapshot.expenseEstimated ?? 0)
    : 0;

  const runRateProfit = yearlyIncome - runRateYearlyExpense;
  const runRateMargin =
    yearlyIncome > 0 ? (runRateProfit / yearlyIncome) * 100 : 0;

  // -------------------------
  // 2) SEASONAL
  // -------------------------
  const seasonalYearlyExpense = snapshot?.expenseEstimated ?? 0;
  const seasonalProfit = snapshot?.profitEstimate ?? 0;
  const seasonalMargin = snapshot
    ? snapshot.profitMargin * 100
    : 0;

  const profitColor = (v: number) =>
    v >= 0 ? "#22c55e" : "#ef4444";

  /* ================================
     UI STYLES (AYNEN KORUNDU)
  ================================ */
  const card: React.CSSProperties = {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 18,
    padding: 16,
  };

  const label: React.CSSProperties = {
    fontSize: 13,
    opacity: 0.7,
    marginBottom: 6,
  };

  const value: React.CSSProperties = {
    fontSize: 22,
    fontWeight: 750,
  };

  const sectionTitle: React.CSSProperties = {
    margin: "18px 0 10px",
    fontSize: 14,
    fontWeight: 800,
    opacity: 0.9,
  };

  return (
    <div
      style={{
        color: "white",
        maxWidth: 1200,
        margin: "0 auto",
        padding: "0 16px",
      }}
    >
      {/* HEADER */}
<div
  style={{
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  }}
>
  <h2 style={{ margin: 0 }}>Finans – Durum</h2>
</div>

      {/* MODE SELECTOR */}
      <div
        style={{
          display: "inline-flex",
          padding: 4,
          borderRadius: 14,
          background: "rgba(255,255,255,0.08)",
          border: "1px solid rgba(255,255,255,0.18)",
          marginBottom: 18,
        }}
      >
        {(["GENERAL", "YKS", "LGS"] as Mode[]).map((m) => {
          const active = mode === m;
          const txt = m === "GENERAL" ? "Mefkure Genel" : m;

          return (
            <button
              key={m}
              onClick={() => setMode(m)}
              style={{
                padding: "8px 16px",
                borderRadius: 10,
                border: "none",
                cursor: "pointer",
                background: active
                  ? "linear-gradient(135deg,#3b82f6,#2563eb)"
                  : "transparent",
                color: active ? "white" : "#e5e7eb",
                fontWeight: 800,
              }}
            >
              {txt}
            </button>
          );
        })}
      </div>

      {/* ORTAK ÜST KARTLAR */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 16,
        }}
      >
        <div style={card}>
          <div style={label}>Toplam Ciro (Yıllık)</div>
          <div style={value}>
            {yearlyIncome.toLocaleString("tr-TR")} ₺
          </div>
        </div>

        <div style={card}>
          <div style={label}>Aylık Ortalama Gider</div>
          <div style={value}>
            {((runRateYearlyExpense ?? 0) / 12).toLocaleString("tr-TR")} ₺
          </div>
        </div>
      </div>

      {/* RUN-RATE BLOĞU */}
      <div style={sectionTitle}>
        1) Ortalama’ya Göre Tahmin (Ort × 12)
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 16,
        }}
      >
        <div style={card}>
          <div style={label}>Tahmini Yıllık Gider</div>
          <div style={value}>
            {runRateYearlyExpense.toLocaleString("tr-TR")} ₺
          </div>
        </div>

        <div style={card}>
          <div style={label}>Tahmini Kâr</div>
          <div style={{ ...value, color: profitColor(runRateProfit) }}>
            {runRateProfit.toLocaleString("tr-TR")} ₺
          </div>
        </div>

        <div style={card}>
          <div style={label}>Tahmini Kâr Oranı</div>
          <div style={{ ...value, color: profitColor(runRateProfit) }}>
            %{runRateMargin.toFixed(1)}
          </div>
        </div>
      </div>

      {/* SEASONAL BLOĞU */}
      <div style={sectionTitle}>
        2) Mevsimsel Tahmin (Katsayı ile 12 ay tamamlanır)
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 16,
        }}
      >
        <div style={card}>
          <div style={label}>Mevsimsel 12 Ay Gider Toplamı</div>
          <div style={value}>
            {seasonalYearlyExpense.toLocaleString("tr-TR")} ₺
          </div>
        </div>

        <div style={card}>
          <div style={label}>Mevsimsel Tahmini Kâr</div>
          <div style={{ ...value, color: profitColor(seasonalProfit) }}>
            {seasonalProfit.toLocaleString("tr-TR")} ₺
          </div>
        </div>

        <div style={card}>
          <div style={label}>Mevsimsel Kâr Oranı</div>
          <div style={{ ...value, color: profitColor(seasonalProfit) }}>
            %{seasonalMargin.toFixed(1)}
          </div>
        </div>
      </div>
    </div>
  );
}
