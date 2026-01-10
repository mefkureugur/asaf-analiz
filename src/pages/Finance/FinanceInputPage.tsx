import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { loadFinance, saveFinance } from "../../store/FinanceStore";
import type { Branch, FinanceState } from "../../store/FinanceStore";

import { calculateFinance } from "../../services/financeCalculator";
import { saveFinanceSnapshot } from "../../services/financeSnapshot.service"; // 🧠 HAFIZA
import { getFinanceSnapshot } from "../../services/financeSnapshot.read"; // 🔥 PRELOAD

const MONTHS = [
  "Ağustos",
  "Eylül",
  "Ekim",
  "Kasım",
  "Aralık",
  "Ocak",
  "Şubat",
  "Mart",
  "Nisan",
  "Mayıs",
  "Haziran",
  "Temmuz",
];

export default function FinanceInputPage() {
  const navigate = useNavigate();

  const [branch, setBranch] = useState<Branch>("YKS");
  const [finance, setFinance] = useState<FinanceState>(() => loadFinance());
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const data = finance[branch];
  const calc = calculateFinance(data);

  /* ======================================================
     🔥 PRELOAD: SAYFA AÇILINCA FIRESTORE → FORM
     ====================================================== */
  useEffect(() => {
    const year = new Date().getFullYear();

    Promise.all([
      getFinanceSnapshot(year, "YKS"),
      getFinanceSnapshot(year, "LGS"),
    ])
      .then(([yksSnap, lgsSnap]) => {
        setFinance((prev) => ({
          YKS: yksSnap
            ? {
                income: {
                  student: yksSnap.revenueTotal ?? prev.YKS.income.student,
                  food: prev.YKS.income.food,
                  other: prev.YKS.income.other,
                },
                expenses: [...prev.YKS.expenses], // giderler korunur
              }
            : prev.YKS,

          LGS: lgsSnap
            ? {
                income: {
                  student: lgsSnap.revenueTotal ?? prev.LGS.income.student,
                  food: prev.LGS.income.food,
                  other: prev.LGS.income.other,
                },
                expenses: [...prev.LGS.expenses],
              }
            : prev.LGS,
        }));
      })
      .catch((err) => {
        console.error("Finance preload error:", err);
      });
  }, []);

  /* 🔒 Otomatik local kayıt (arka plan) */
  useEffect(() => {
    saveFinance(finance);
    setSaved(false);
  }, [finance]);

  function setIncome(key: keyof typeof data.income, value: number) {
    setFinance((prev) => ({
      ...prev,
      [branch]: {
        ...prev[branch],
        income: { ...prev[branch].income, [key]: Math.max(0, value) },
      },
    }));
  }

  function setExpense(i: number, value: number) {
    const next = [...data.expenses];
    next[i] = Math.max(0, value);

    setFinance((prev) => ({
      ...prev,
      [branch]: { ...prev[branch], expenses: next },
    }));
  }

  /* 💾 KAYDET = local + Firestore snapshot (YKS + LGS + GENERAL) */
  async function handleSave() {
    try {
      setSaving(true);

      const year = new Date().getFullYear();

      // 1️⃣ Local kayıt (mevcut davranış KORUNDU)
      saveFinance(finance);

      // 2️⃣ Firestore snapshot – YKS
      await saveFinanceSnapshot(year, "YKS", finance.YKS);

      // 3️⃣ Firestore snapshot – LGS
      await saveFinanceSnapshot(year, "LGS", finance.LGS);

      // 4️⃣ Firestore snapshot – GENERAL (YKS + LGS BİRLEŞİMİ)
      const generalInput = {
        income: {
          student:
            finance.YKS.income.student + finance.LGS.income.student,
          food:
            finance.YKS.income.food + finance.LGS.income.food,
          other:
            finance.YKS.income.other + finance.LGS.income.other,
        },
        expenses: finance.YKS.expenses.map(
          (v, i) => v + finance.LGS.expenses[i]
        ),
      };

      await saveFinanceSnapshot(year, "GENERAL", generalInput);

      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error("Finance snapshot error:", err);
      // 🔒 fail-safe: local kayıt zaten yapıldı
    } finally {
      setSaving(false);
    }
  }

  /* ================================
     STYLES
  ================================ */

  const cardStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(255,255,255,0.08)",
    color: "white",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    opacity: 0.8,
    marginBottom: 6,
  };

  /* ================================
     RENDER
  ================================ */

  return (
    <div
      style={{
        color: "white",
        maxWidth: 1100,
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
        <h2 style={{ margin: 0 }}>
          Finans – Veri Girişi ({branch})
        </h2>

        <button
          onClick={() => navigate("/finance/view")}
          style={{
            padding: "6px 12px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.25)",
            background: "rgba(255,255,255,0.06)",
            color: "white",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          ← Finans’a Dön
        </button>
      </div>

      {/* ŞUBE SEÇİCİ */}
      <div
        style={{
          display: "inline-flex",
          padding: 4,
          borderRadius: 14,
          background: "rgba(255,255,255,0.08)",
          border: "1px solid rgba(255,255,255,0.18)",
          marginBottom: 24,
        }}
      >
        {(["YKS", "LGS"] as const).map((b) => {
          const active = branch === b;

          return (
            <button
              key={b}
              onClick={() => setBranch(b)}
              style={{
                padding: "8px 20px",
                borderRadius: 10,
                border: "none",
                cursor: "pointer",
                background: active
                  ? "linear-gradient(135deg, #22c55e, #16a34a)"
                  : "transparent",
                color: active ? "#052e16" : "white",
                fontWeight: 700,
              }}
            >
              {b}
            </button>
          );
        })}
      </div>

      {/* GELİRLER */}
      <div style={cardStyle}>
        <h3 style={{ marginTop: 0 }}>Gelirler (Yıllık)</h3>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 16,
          }}
        >
          {(["student", "food", "other"] as const).map((k) => (
            <div key={k}>
              <div style={labelStyle}>
                {k === "student"
                  ? "Öğrenci Geliri"
                  : k === "food"
                  ? "Yemek Geliri"
                  : "Diğer Gelirler"}{" "}
                (Yıllık)
              </div>
              <input
                style={inputStyle}
                type="number"
                value={data.income[k]}
                onChange={(e) => setIncome(k, +e.target.value)}
              />
            </div>
          ))}
        </div>

        <div style={{ marginTop: 12, fontWeight: 600 }}>
          Yıllık Toplam Gelir:{" "}
          {calc.income.toLocaleString("tr-TR")} ₺
        </div>
      </div>

      {/* GİDERLER */}
      <div style={cardStyle}>
        <h3 style={{ marginTop: 0 }}>Giderler (Aylık)</h3>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
            gap: 12,
          }}
        >
          {MONTHS.map((m, i) => (
            <div key={i}>
              <div style={labelStyle}>{m}</div>
              <input
                style={inputStyle}
                type="number"
                value={data.expenses[i]}
                onChange={(e) => setExpense(i, +e.target.value)}
              />
            </div>
          ))}
        </div>

        <div style={{ marginTop: 12, opacity: 0.85 }}>
          Girilen ay sayısı: {calc.months} <br />
          Ortalama Aylık Gider:{" "}
          {calc.avgExpense.toLocaleString("tr-TR")} ₺
        </div>
      </div>

      {/* KAYDET */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: "10px 18px",
            borderRadius: 12,
            border: "none",
            background: saving
              ? "linear-gradient(135deg,#64748b,#475569)"
              : "linear-gradient(135deg,#3b82f6,#2563eb)",
            color: "white",
            fontWeight: 700,
            cursor: saving ? "not-allowed" : "pointer",
          }}
        >
          {saving ? "⏳ Kaydediliyor…" : "💾 Kaydet"}
        </button>

        {saved && (
          <span style={{ color: "#22c55e", fontWeight: 600 }}>
            ✔ Kaydedildi
          </span>
        )}
      </div>
    </div>
  );
}
