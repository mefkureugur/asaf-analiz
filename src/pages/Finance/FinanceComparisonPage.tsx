import { useState, useMemo, useEffect } from "react";
import { collection, query, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LabelList } from "recharts";
import { TrendingUp, ArrowUpRight, ArrowDownRight, Calculator, Users, ChevronDown } from "lucide-react";
import asafFinansRaw from "../../data/finans.json"; 

interface FinansRecord { Kurum: string; Alan: string; Dönem: string; [key: string]: any; }

export default function FinanceComparisonPage({ selectedKurum }: { selectedKurum: string; selectedDonem: string }) {
  const [firebaseData, setFirebaseData] = useState<any[]>([]);
  const [activeCategory, setActiveCategory] = useState("Toplam Giderler"); 
  const rawData = asafFinansRaw as FinansRecord[];

  useEffect(() => {
    const q = query(collection(db, "financeSnapshots"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setFirebaseData(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  const parseVal = (val: any) => parseInt(String(val || '0').replace(/,/g, '')) || 0;
  const formatCurrency = (val: number) => `₺${Math.round(val).toLocaleString("tr-TR")}`;
  
  const comparison = useMemo(() => {
    const ayFull = ["Ağustos", "Eylül", "Ekim", "Kasım", "Aralık", "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz"];
    
    // 🛡️ KRİTİK DÜZELTME: d25/d26 isimleri data2025/data2026 olarak senkronize edildi
    const getMetrics = (yearNum: number, is2025: boolean) => {
      const fbFilter = (d: any) => (selectedKurum === "Tüm Kurumlar" ? true : d.unit === selectedKurum) && d.year === yearNum;
      
      const getAvg = (alan: string) => {
        let total = 0; let count = 0;
        ayFull.forEach((ay, idx) => {
          if (is2025) { // 2025 JSON
            const val = rawData.filter(d => (selectedKurum === "Tüm Kurumlar" ? true : d.Kurum === selectedKurum) && d.Dönem === "2024-2025" && d.Alan === alan).reduce((acc, curr) => acc + parseVal(curr[ay]), 0);
            if (val > 0) { total += val; count++; }
          } else { // 2026 Hibrit
            if (idx <= 4) {
              const val = rawData.filter(d => (selectedKurum === "Tüm Kurumlar" ? true : d.Kurum === selectedKurum) && d.Dönem === "2025-2026" && d.Alan === alan).reduce((acc, curr) => acc + parseVal(curr[ay]), 0);
              if (val > 0) { total += val; count++; }
            } else {
              const fb = firebaseData.find(d => fbFilter(d) && d.category === alan);
              if (fb) { total += (fb.expenseRealSoFar / (fb.filledMonths?.length || 7)); count++; }
            }
          }
        });
        return count > 0 ? total / count : 0;
      };

      const ciro = firebaseData.filter(d => fbFilter(d) && d.category === "Ciro").reduce((acc, curr) => acc + (curr.revenueTotal || 0), 0);
      return { ciro, giderAvg: getAvg("Toplam Giderler"), maasAvg: getAvg("Maaşlar"), sgkAvg: getAvg("SGK") };
    };

    const chart = ayFull.map((ay, idx) => {
      const getSum = (is2025: boolean) => {
        if (is2025) return rawData.filter(d => (selectedKurum === "Tüm Kurumlar" ? true : d.Kurum === selectedKurum) && d.Dönem === "2024-2025" && d.Alan === activeCategory).reduce((acc, curr) => acc + parseVal(curr[ay]), 0);
        if (idx <= 4) return rawData.filter(d => (selectedKurum === "Tüm Kurumlar" ? true : d.Kurum === selectedKurum) && d.Dönem === "2025-2026" && d.Alan === activeCategory).reduce((acc, curr) => acc + parseVal(curr[ay]), 0);
        const fb = firebaseData.find(d => (selectedKurum === "Tüm Kurumlar" ? true : d.unit === selectedKurum) && d.year === 2026 && d.category === activeCategory);
        return fb?.filledMonths?.includes(idx) ? (fb.expenseRealSoFar / fb.filledMonths.length) : 0;
      };
      return { name: ay.substring(0, 3), "2025": Math.round(getSum(true)), "2026": Math.round(getSum(false)) };
    });

    return { data2025: getMetrics(2025, true), data2026: getMetrics(2026, false), chart };
  }, [firebaseData, selectedKurum, activeCategory]);

  const activeStats = useMemo(() => {
    const v1 = activeCategory === "Toplam Giderler" ? comparison.data2025.giderAvg : activeCategory === "Maaşlar" ? comparison.data2025.maasAvg : comparison.data2025.sgkAvg;
    const v2 = activeCategory === "Toplam Giderler" ? comparison.data2026.giderAvg : activeCategory === "Maaşlar" ? comparison.data2026.maasAvg : comparison.data2026.sgkAvg;
    const diff = v1 === 0 ? 0 : ((v2 - v1) / v1) * 100;
    return { v1, v2, diff };
  }, [comparison, activeCategory]);

  return (
    <div style={{ marginTop: 10 }}>
      {/* 📊 ÜST ÖZET KARTLARI */}
      <div style={grid3}>
        <CompCard title="CİRO KIYASLAMA" v1={comparison.data2025.ciro} v2={comparison.data2026.ciro} icon={<TrendingUp size={16}/>} color="#22c55e" format={formatCurrency} />
        <CompCard title="TOPLAM GİDER (ORT)" v1={comparison.data2025.giderAvg} v2={comparison.data2026.giderAvg} icon={<Calculator size={16}/>} color="#ef4444" format={formatCurrency} />
        <CompCard title="PERSONEL YÜKÜ (ORT)" v1={comparison.data2025.maasAvg + comparison.data2025.sgkAvg} v2={comparison.data2026.maasAvg + comparison.data2026.sgkAvg} icon={<Users size={16}/>} color="#3b82f6" format={formatCurrency} />
      </div>

      {/* 📉 GRAFİK ALANI */}
      <div style={chartWrapper}>
        <div style={headerLayout}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={headerStyle}>{activeCategory.toUpperCase()} KIYASLAMASI</div>
            <div style={headerSummaryBox}>
              <span style={summaryItem}>{formatCurrency(activeStats.v1)} <small>2025 Ort.</small></span>
              <div style={summaryDivider} />
              <span style={{ ...summaryItem, color: '#f8fafc' }}>{formatCurrency(activeStats.v2)} <small>2026 Ort.</small></span>
              <div style={{ ...miniBadge, background: activeStats.diff > 0 ? "#ef444420" : "#22c55e20", color: activeStats.diff > 0 ? "#ef4444" : "#22c55e" }}>
                {activeStats.diff > 0 ? <ArrowUpRight size={12}/> : <ArrowDownRight size={12}/>} %{Math.abs(activeStats.diff).toFixed(1)}
              </div>
            </div>
          </div>
          
          <div style={{ position: "relative", minWidth: 220 }}>
            <select value={activeCategory} onChange={(e) => setActiveCategory(e.target.value)} style={selectStyle}>
              {["Toplam Giderler", "Maaşlar", "SGK"].map(cat => (
                <option key={cat} value={cat}>{cat.toUpperCase()}</option>
              ))}
            </select>
            <ChevronDown size={14} style={chevronStyle} />
          </div>
        </div>

        <div style={{ height: 380 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={comparison.chart} margin={{ top: 30, right: 10, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
              <YAxis hide />
              <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: '#f8fafc', fontSize: '12px', fontWeight: 600 }} formatter={(v: any) => [formatCurrency(v), "Tutar"]} />
              <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ paddingBottom: 20, fontSize: '11px' }} />
              
              <Bar name="2025" dataKey="2025" fill="#334155" radius={[4, 4, 0, 0]}>
                 <LabelList dataKey="2025" position="top" content={(props) => <CustomLabel {...props} />} />
              </Bar>
              <Bar name="2026" dataKey="2026" fill="#3b82f6" radius={[4, 4, 0, 0]}>
                 <LabelList dataKey="2026" position="top" content={(props) => <CustomLabel {...props} />} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function CustomLabel({ x, y, value, width }: any) {
  if (!value || value === 0) return null;
  return (
    <text x={x + (width || 0) / 2} y={(y || 0) - 10} fill="#94a3b8" fontSize={10} fontWeight={800} textAnchor="middle">
      {`₺${(value / 1000000).toFixed(1)}M`}
    </text>
  );
}

function CompCard({ title, v1, v2, icon, color, format }: any) {
  const diff = v1 === 0 ? 0 : ((v2 - v1) / v1) * 100;
  return (
    <div style={cardStyle}>
      <div style={cardHeader}>{icon} {title}</div>
      <div style={valRow}>
        <div style={oldVal}>{format(v1)} <small>2025</small></div>
        <div style={newVal}>{format(v2)} <small>2026</small></div>
      </div>
      <div style={{ ...diffBadge, background: diff > 0 ? `${color}20` : "#22c55e20", color: diff > 0 ? color : "#22c55e" }}>
        {diff > 0 ? <ArrowUpRight size={14}/> : <ArrowDownRight size={14}/>} %{Math.abs(diff).toFixed(1)}
      </div>
    </div>
  );
}

const headerLayout = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 25, gap: 20 };
const headerSummaryBox = { display: 'flex', alignItems: 'center', gap: 15, background: '#1e293b50', padding: '8px 15px', borderRadius: '10px', border: '1px solid #1e2937' };
const summaryItem = { fontSize: '0.8rem', fontWeight: 800, color: '#94a3b8', display: 'flex', flexDirection: 'column' as const };
const summaryDivider = { width: 1, height: 25, background: '#1e2937' };
const miniBadge = { padding: '4px 8px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: 3 };
const selectStyle = { background: "#1e293b", border: "1px solid #334155", color: "#3b82f6", padding: "10px 40px 10px 15px", borderRadius: "10px", appearance: "none" as const, fontSize: "0.75rem", fontWeight: 800, cursor: "pointer", width: "100%", outline: "none" };
const chevronStyle = { position: "absolute" as const, right: 15, top: "50%", transform: "translateY(-50%)", color: "#3b82f6", pointerEvents: "none" as const };
const chartWrapper = { background: "#0f172a", border: "1px solid #1e2937", borderRadius: 16, padding: "25px" };
const headerStyle = { fontSize: "0.75rem", fontWeight: 800, color: "#64748b", letterSpacing: "0.05em" };
const tooltipStyle = { background: "#020617", border: "1px solid #1e2937", borderRadius: "8px" };
const grid3 = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))", gap: 20, marginBottom: 25 };
const cardStyle = { background: "#0f172a", border: "1px solid #1e2937", borderRadius: 16, padding: "20px", display: "flex", flexDirection: "column" as const, gap: 12 };
const cardHeader = { fontSize: "0.65rem", fontWeight: 800, color: "#64748b", display: "flex", alignItems: "center", gap: 8 };
const valRow = { display: "flex", justifyContent: "space-between", alignItems: "center" };
const oldVal = { fontSize: "0.95rem", color: "#475569", fontWeight: 600, display: "flex", flexDirection: "column" as const };
const newVal = { fontSize: "1.45rem", color: "#f8fafc", fontWeight: 900, display: "flex", flexDirection: "column" as const, textAlign: "right" as const };
const diffBadge = { alignSelf: "flex-start", padding: "4px 10px", borderRadius: "8px", fontSize: "0.8rem", fontWeight: 800, display: "flex", alignItems: "center", gap: 4 };