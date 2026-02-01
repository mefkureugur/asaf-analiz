import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { TrendingUp, Calculator, ChevronDown, Save, ArrowLeft, Database, Edit3 } from "lucide-react";
import { saveFinanceSnapshot } from "../../services/financeSnapshot.service";
import { loadFinance, saveFinance } from "../../store/FinanceStore";

interface FinanceInput {
  income: { student: number; food: number; other: number; }; 
  expenses: number[];
}

interface FinanceState { 
  [branch: string]: {
    [category: string]: FinanceInput;
  };
}

const BRANCH_LIST = ["Mefkure YKS", "Mefkure LGS", "Altınküre Lise", "Altınküre İlköğretim", "Altınküre Teknokent"];
const DONEM_LIST = ["2024-2025", "2025-2026"];
const EXPENSE_TYPES = ["Toplam Giderler", "Maaşlar", "SGK"];
const ALL_MONTHS = ["Ağustos", "Eylül", "Ekim", "Kasım", "Aralık", "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz"];
const ENTRY_MONTHS = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz"];

export default function FinanceInputPage() {
  const navigate = useNavigate();
  const [incomeBranch, setIncomeBranch] = useState("Mefkure YKS");
  const [incomeDonem, setIncomeDonem] = useState("2025-2026"); 
  const [expenseBranch, setExpenseBranch] = useState("Mefkure YKS");
  const [expenseType, setExpenseType] = useState("Toplam Giderler");
  const [finance, setFinance] = useState<FinanceState>(() => loadFinance() as any);
  const [saving, setSaving] = useState(false);

  // 📱 MOBİL GÖZLEMCİ
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const formatCurrency = (val: number) => {
    return `₺${Math.round(val).toLocaleString("tr-TR")}`;
  };

  const currentExpenseEntry = useMemo(() => 
    finance[expenseBranch]?.[expenseType] || { income: { student: 0, food: 0, other: 0 }, expenses: Array(12).fill(0) },
  [finance, expenseBranch, expenseType]);

  const currentIncomeEntry = useMemo(() => 
    finance[incomeBranch]?.["Ciro"] || { income: { student: 0, food: 0, other: 0 }, expenses: Array(12).fill(0) },
  [finance, incomeBranch]);

  const handleAction = async (targetUnit: string, targetData: FinanceInput, category: string, isRevision: boolean = false) => {
    try {
      setSaving(true);
      saveFinance(finance as any); 
      const targetYear = parseInt(incomeDonem.split('-')[1]); 
      const dbCategory = category === "Ciro Yönetimi" ? "Ciro" : category;
      await saveFinanceSnapshot(targetYear, targetUnit, {
          ...targetData,
          category: dbCategory, 
          updatedAt: new Date().toISOString()
      } as any); 
      alert(`${targetUnit} - ${dbCategory} (${targetYear}) verileri Firebase'e hatasız mühürlendi!`);
    } catch (err) { console.error(err); } finally { setSaving(false); }
  };

  return (
    <div style={{ padding: isMobile ? "10px" : "20px", color: "white", maxWidth: 1200, margin: "0 auto", backgroundColor: "#020617", minHeight: "100vh" }}>
      <button onClick={() => navigate("/finance/view")} style={backBtn}>
        <ArrowLeft size={14}/> Analize Dön
      </button>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : (window.innerWidth < 1024 ? "1fr" : "400px 1fr"), gap: 20, marginTop: 20 }}>
        
        {/* 🛡️ SOL PANEL: CİRO YÖNETİMİ - MOBİL DENGELENDİ */}
        <div style={{ ...cardStyle, padding: isMobile ? "20px 15px" : "24px" }}>
          <div style={{ ...headerStyle, marginBottom: 20 }}><TrendingUp size={16} color="#3b82f6"/> CİRO YÖNETİMİ</div>
          
          <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 10, marginBottom: 15 }}>
            <div style={{ flex: 2 }}>
              <div style={labelStyle}>KURUM</div>
              <div style={{ position: "relative" }}>
                <select value={incomeBranch} onChange={(e) => setIncomeBranch(e.target.value)} style={mainSel}>
                  {BRANCH_LIST.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
                <ChevronDown style={chevronStyle} size={14} />
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={labelStyle}>DÖNEM</div>
              <div style={{ position: "relative" }}>
                <select value={incomeDonem} onChange={(e) => setIncomeDonem(e.target.value)} style={mainSel}>
                  {DONEM_LIST.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <ChevronDown style={chevronStyle} size={14} />
              </div>
            </div>
          </div>

          <div style={{ marginBottom: 25 }}>
            <div style={labelStyle}>NET CİRO GİRİŞİ ({formatCurrency(currentIncomeEntry.income.student)})</div>
            <input 
              type="number" 
              value={currentIncomeEntry.income.student} 
              onChange={e => setFinance(prev => ({
                  ...prev, [incomeBranch]: { ...(prev[incomeBranch] || {}), ["Ciro"]: { ...currentIncomeEntry, income: { ...currentIncomeEntry.income, student: +e.target.value } } }
              }))} 
              style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} 
            />
          </div>
          
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button onClick={() => handleAction(incomeBranch, currentIncomeEntry, "Ciro Yönetimi")} disabled={saving} style={saveBtnStyle}>
              <Save size={16}/> GELİRİ KAYDET
            </button>
            <button onClick={() => handleAction(incomeBranch, currentIncomeEntry, "Ciro Yönetimi", true)} disabled={saving} style={revizeBtnStyle}>
              <Edit3 size={14}/> VERİYİ REVİZE ET
            </button>
          </div>
        </div>

        {/* 🛡️ SAĞ PANEL: GİDERLER - MOBİL DENGELENDİ */}
        <div style={{ ...cardStyle, padding: isMobile ? "20px 15px" : "24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: isMobile ? "flex-start" : "center", marginBottom: 20, flexDirection: isMobile ? "column" : "row", gap: 15 }}>
            <div style={headerStyle}><Calculator size={16} color="#ef4444"/> GİDER GİRİŞİ</div>
            <div style={{ display: "flex", gap: 8, width: isMobile ? "100%" : "auto" }}>
                <div style={{ position: "relative", flex: 1 }}>
                    <select value={expenseType} onChange={(e) => setExpenseType(e.target.value)} style={typeSel}>
                        {EXPENSE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <ChevronDown style={chevronStyle} size={12} color="#3b82f6" />
                </div>
                <div style={{ position: "relative", flex: 1.2 }}>
                    <select value={expenseBranch} onChange={(e) => setExpenseBranch(e.target.value)} style={mainSel}>
                        {BRANCH_LIST.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                    <ChevronDown style={chevronStyle} size={14} />
                </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(auto-fill, minmax(130px, 1fr))", gap: 10, marginBottom: 25 }}>
            {ENTRY_MONTHS.map((m) => {
              const monthIdx = ALL_MONTHS.indexOf(m);
              const val = currentExpenseEntry.expenses[monthIdx] || 0;
              return (
                <div key={m} style={monthBoxStyle}>
                  <div style={labelStyle}>{m.toUpperCase()} ({val > 0 ? formatCurrency(val) : "₺0"})</div>
                  <input 
                    type="number" 
                    value={currentExpenseEntry.expenses[monthIdx] || ""} 
                    onChange={e => {
                      const nextExp = [...currentExpenseEntry.expenses];
                      nextExp[monthIdx] = +e.target.value;
                      setFinance(prev => ({ ...prev, [expenseBranch]: { ...(prev[expenseBranch] || {}), [expenseType]: { ...currentExpenseEntry, expenses: nextExp } } }));
                    }} 
                    style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} 
                  />
                </div>
              );
            })}
          </div>
          
          <div style={{ display: "flex", gap: 12, flexDirection: isMobile ? "column" : "row" }}>
            <button onClick={() => handleAction(expenseBranch, currentExpenseEntry, expenseType)} disabled={saving} style={{ ...saveBtnStyle, flex: 2, background: "#ef4444" }}>
              <Database size={16}/> GİDERLERİ KAYDET
            </button>
            <button onClick={() => handleAction(expenseBranch, currentExpenseEntry, expenseType, true)} disabled={saving} style={{ ...revizeBtnStyle, padding: "14px" }}>
              <Edit3 size={14}/> REVİZE ET
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// 🛡️ TASARIM PARAMETRELERİ (Maksimum Uyumluluk İçin Sabitlendi)
const cardStyle = { background: "#0f172a", border: "1px solid #1e2937", borderRadius: 16, boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.4)" };
const inputStyle = { background: "#020617", border: "1px solid #334155", borderRadius: 10, padding: "12px", color: "white", outline: "none", fontSize: "0.9rem" };
const mainSel = { background: "#020617", border: "1px solid #1e2937", color: "white", padding: "10px 35px 10px 15px", borderRadius: 10, outline: 'none', appearance: 'none' as const, WebkitAppearance: 'none' as const, fontWeight: 700, width: '100%', fontSize: "0.8rem", cursor: "pointer" };
const typeSel = { background: "#1e293b", border: "1px solid #334155", color: "#3b82f6", padding: "10px 35px 10px 15px", borderRadius: 10, outline: 'none', appearance: 'none' as const, WebkitAppearance: 'none' as const, fontWeight: 800, fontSize: "0.75rem", cursor: "pointer", width: '100%' };
const chevronStyle = { position: "absolute" as const, right: 12, top: "50%", transform: "translateY(-50%)", color: "#64748b", pointerEvents: "none" as const };
const labelStyle = { fontSize: "0.65rem", fontWeight: 700, color: "#64748b", marginBottom: 6, letterSpacing: "0.05em" };
const headerStyle = { fontSize: "0.8rem", fontWeight: 800, color: "white", display: "flex", alignItems: "center", gap: 8, letterSpacing: "0.05em" };
const saveBtnStyle = { background: "#3b82f6", color: "white", border: "none", width: "100%", padding: "14px", borderRadius: 12, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 };
const revizeBtnStyle = { background: "transparent", border: "1px solid #334155", color: "#94a3b8", flex: 1, padding: "12px", borderRadius: 12, fontWeight: 700, cursor: "pointer", fontSize: "0.7rem", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 };
const backBtn = { background: "transparent", border: "1px solid #334155", color: "#94a3b8", padding: "10px 18px", borderRadius: 10, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, fontSize: "0.75rem", fontWeight: 600 };
const monthBoxStyle = { background: "#1e293b30", padding: "12px", borderRadius: 12, border: "1px solid #1e2937" };