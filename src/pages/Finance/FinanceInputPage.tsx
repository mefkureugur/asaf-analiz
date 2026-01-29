import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { loadFinance, saveFinance } from "../../store/FinanceStore";
import type { Branch, FinanceState } from "../../store/FinanceStore";

import { calculateFinance } from "../../services/financeCalculator";
import { saveFinanceSnapshot } from "../../services/financeSnapshot.service"; 
import { getFinanceSnapshot } from "../../services/financeSnapshot.read";

// ASAF Şube Listesi
const BRANCH_LIST: Branch[] = [
  "Mefkure LGS",
  "Mefkure VİP",
  "Mefkure PLUS",
  "Altınküre İlköğretim",
  "Altınküre Lise",
  "Altınküre Teknokent"
];

const MONTHS = [
  "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık", "Ocak",
  "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz",
];

export default function FinanceInputPage() {
  const navigate = useNavigate();

  // Varsayılan şubeyi Mefkure LGS yapalım
  const [branch, setBranch] = useState<Branch>("Mefkure LGS");
  const [finance, setFinance] = useState<FinanceState>(() => loadFinance());
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const data = finance[branch] || { income: { student: 0, food: 0, other: 0 }, expenses: Array(12).fill(0) };
  const calc = calculateFinance(data);

  /* ======================================================
     🔥 PRELOAD: TÜM ŞUBELERİ FIRESTORE'DAN ÇEK
     ====================================================== */
  useEffect(() => {
    const year = new Date().getFullYear();

    // Dinamik olarak tüm şubelerin verilerini çekiyoruz
    const fetchAllSnapshots = async () => {
      const updatedFinance = { ...finance };
      
      for (const b of BRANCH_LIST) {
        try {
          const snap = await getFinanceSnapshot(year, b);
          if (snap) {
            updatedFinance[b] = {
              income: {
                student: snap.revenueTotal ?? updatedFinance[b].income.student,
                food: updatedFinance[b].income.food,
                other: updatedFinance[b].income.other,
              },
              expenses: [...updatedFinance[b].expenses],
            };
          }
        } catch (e) {
          console.error(`${b} verisi çekilemedi:`, e);
        }
      }
      setFinance(updatedFinance);
    };

    fetchAllSnapshots();
  }, []);

  /* 🔒 Otomatik local kayıt */
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

  /* 💾 KAYDET = Mevcut şube + GENEL Toplam */
  async function handleSave() {
    try {
      setSaving(true);
      const year = new Date().getFullYear();

      saveFinance(finance);

      // 1️⃣ Aktif şubeyi buluta gönder
      await saveFinanceSnapshot(year, branch, finance[branch]);

      // 2️⃣ GENERAL (Tüm Şubelerin Toplamı) Hesapla ve Gönder
      const generalInput = BRANCH_LIST.reduce((acc, b) => {
        const bData = finance[b];
        return {
          income: {
            student: acc.income.student + bData.income.student,
            food: acc.income.food + bData.income.food,
            other: acc.income.other + bData.income.other,
          },
          expenses: acc.expenses.map((v, i) => v + bData.expenses[i])
        };
      }, { income: { student: 0, food: 0, other: 0 }, expenses: Array(12).fill(0) });

      await saveFinanceSnapshot(year, "GENERAL", generalInput);

      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error("Finans kayıt hatası:", err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ color: "white", maxWidth: 1100, margin: "0 auto", padding: "24px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <h2 style={{ margin: 0 }}>💰 Finans Veri Girişi</h2>
        <button onClick={() => navigate("/finance/view")} style={navButtonStyle}>← Finans Özetine Dön</button>
      </div>

      {/* ŞUBE SEÇİCİ - 6 ŞUBELİ YAPI */}
      <div style={branchSelectorWrapper}>
        {BRANCH_LIST.map((b) => {
          const active = branch === b;
          return (
            <button key={b} onClick={() => setBranch(b)} style={active ? activeTabStyle : tabStyle}>
              {b}
            </button>
          );
        })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* GELİRLER */}
        <div style={cardStyle}>
          <h3 style={{ marginTop: 0, color: "#22c55e" }}>📈 Gelirler (Yıllık Tahmin)</h3>
          {(["student", "food", "other"] as const).map((k) => (
            <div key={k} style={{ marginBottom: 12 }}>
              <div style={labelStyle}>{k === "student" ? "Eğitim" : k === "food" ? "Yemek" : "Diğer"} Geliri</div>
              <input style={inputStyle} type="number" value={data.income[k]} onChange={(e) => setIncome(k, +e.target.value)} />
            </div>
          ))}
          <div style={totalHighlight}>Toplam: {calc.income.toLocaleString("tr-TR")} ₺</div>
        </div>

        {/* ÖZET DURUM */}
        <div style={cardStyle}>
          <h3 style={{ marginTop: 0, color: "#38bdf8" }}>📊 Finansal Özet</h3>
          <div style={summaryRow}><span>Tahmini Ciro:</span> <strong>{calc.income.toLocaleString("tr-TR")} ₺</strong></div>
          <div style={summaryRow}><span>Aylık Ort. Gider:</span> <strong>{calc.avgExpense.toLocaleString("tr-TR")} ₺</strong></div>
          <div style={{ ...summaryRow, borderTop: "1px solid #334155", paddingTop: 10, marginTop: 10 }}>
            <span>Yıllık Tahmini Kar:</span> 
            <strong style={{ color: calc.income - (calc.avgExpense * 12) > 0 ? "#22c55e" : "#ef4444" }}>
              {(calc.income - (calc.avgExpense * 12)).toLocaleString("tr-TR")} ₺
            </strong>
          </div>
        </div>
      </div>

      {/* GİDERLER (AYLIK) */}
      <div style={{ ...cardStyle, marginTop: 20 }}>
        <h3 style={{ marginTop: 0, color: "#f87171" }}>📉 Aylık Gider Girişi</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          {MONTHS.map((m, i) => (
            <div key={i}>
              <div style={labelStyle}>{m}</div>
              <input style={inputStyle} type="number" value={data.expenses[i]} onChange={(e) => setExpense(i, +e.target.value)} />
            </div>
          ))}
        </div>
      </div>

      {/* KAYDET BUTONU */}
      <div style={{ marginTop: 24, display: "flex", alignItems: "center", gap: 15 }}>
        <button onClick={handleSave} disabled={saving} style={saveButtonStyle}>
          {saving ? "⏳ Kaydediliyor..." : "💾 Verileri Sisteme İşle"}
        </button>
        {saved && <span style={{ color: "#22c55e", fontWeight: 700 }}>✔ Şube ve Genel Toplam Güncellendi!</span>}
      </div>
    </div>
  );
}

/* ================================ STYLES ================================ */
const cardStyle: React.CSSProperties = { background: "#0f172a", border: "1px solid #1e293b", borderRadius: 16, padding: 20 };
const inputStyle: React.CSSProperties = { width: "100%", padding: "10px", borderRadius: 8, border: "1px solid #334155", background: "#020617", color: "white" };
const labelStyle: React.CSSProperties = { fontSize: 12, color: "#94a3b8", marginBottom: 4 };
const totalHighlight: React.CSSProperties = { marginTop: 15, fontSize: 18, fontWeight: 700, color: "#22c55e", textAlign: "right" };
const summaryRow: React.CSSProperties = { display: "flex", justifyContent: "space-between", marginBottom: 8, color: "#e2e8f0" };
const branchSelectorWrapper: React.CSSProperties = { display: "flex", gap: 8, marginBottom: 20, overflowX: "auto", paddingBottom: 10 };
const tabStyle: React.CSSProperties = { padding: "8px 16px", borderRadius: 8, border: "1px solid #1e293b", background: "transparent", color: "#94a3b8", cursor: "pointer", whiteSpace: "nowrap" };
const activeTabStyle: React.CSSProperties = { ...tabStyle, background: "#3b82f6", color: "white", borderColor: "#3b82f6", fontWeight: 700 };
const saveButtonStyle: React.CSSProperties = { padding: "12px 24px", borderRadius: 12, border: "none", background: "linear-gradient(135deg,#3b82f6,#2563eb)", color: "white", fontWeight: 700, cursor: "pointer" };
const navButtonStyle: React.CSSProperties = { padding: "8px 16px", borderRadius: 10, border: "1px solid #334155", background: "#1e293b", color: "white", cursor: "pointer" };