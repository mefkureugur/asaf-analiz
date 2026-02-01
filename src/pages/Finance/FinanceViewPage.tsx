import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from "recharts";
import { Landmark, TrendingUp, Calculator, ChevronDown, BarChart3, Database, ListFilter, LayoutGrid } from "lucide-react";
import asafFinansRaw from "../../data/finans.json"; 
import FinanceAnalysisPage from "./FinanceComparisonPage"; 

interface FinansRecord {
  Kurum: string; Alan: string; Dönem: string;
  [key: string]: any; 
}

export default function FinanceViewPage() {
  const navigate = useNavigate();
  const [selectedKurum, setSelectedKurum] = useState<string>("Tüm Kurumlar");
  const [selectedCategory, setSelectedCategory] = useState<string>("Toplam Giderler");
  const [selectedDonem, setSelectedDonem] = useState<string>("2025-2026");
  const [activePage, setActivePage] = useState<number>(1);
  const [firebaseData, setFirebaseData] = useState<any[]>([]);

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const rawData = asafFinansRaw as FinansRecord[];
  const BRANCH_LIST = ["Mefkure YKS", "Mefkure LGS", "Altınküre Lise", "Altınküre İlköğretim", "Altınküre Teknokent"];
  const CATEGORIES = ["Toplam Giderler", "Maaşlar", "SGK"];

  useEffect(() => {
    const targetYear = parseInt(selectedDonem.split('-')[1]);
    const q = query(collection(db, "financeSnapshots"), where("year", "==", targetYear));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setFirebaseData(data);
    });
    return () => unsubscribe();
  }, [selectedDonem]);

  const parseAmount = (val: any): number => {
    if (typeof val === 'number') return val;
    return parseInt(String(val || '0').replace(/,/g, '')) || 0;
  };

  const formatCurrency = (val: any) => {
    const num = typeof val === 'number' ? val : 0;
    return `₺${Math.round(num).toLocaleString("tr-TR")}`;
  };

  const { chartData, avgGider, tahminiYilSonu } = useMemo(() => {
    const ayFull = ["Ağustos", "Eylül", "Ekim", "Kasım", "Aralık", "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz"];
    
    const processed = ayFull.map((ay, index) => {
      let ayToplam = 0;
      if (index <= 4) {
        const jsonEntries = rawData.filter(item => 
          item.Dönem === selectedDonem && item.Alan === selectedCategory && 
          (selectedKurum === "Tüm Kurumlar" ? true : item.Kurum === selectedKurum)
        );
        ayToplam = jsonEntries.reduce((acc, curr) => acc + parseAmount(curr[ay]), 0);
      } 
      else {
        const fbEntries = firebaseData.filter(d => 
          (selectedKurum === "Tüm Kurumlar" ? true : d.unit === selectedKurum) &&
          (d.category === selectedCategory)
        );
        fbEntries.forEach(d => {
          if (d.filledMonths && d.filledMonths.includes(index)) {
             ayToplam += (Number(d.expenseRealSoFar || 0) / d.filledMonths.length);
          }
        });
      }
      // 🛡️ İsimler artık tam ve eksiksiz yazılacak
      return { name: ay, tutar: Math.round(ayToplam), label: ayToplam > 0 ? `₺${(ayToplam / 1000000).toFixed(1)}M` : "" };
    });

    const doluAylar = processed.filter(d => d.tutar > 0);
    const ortalama = doluAylar.length > 0 ? doluAylar.reduce((a, b) => a + b.tutar, 0) / doluAylar.length : 0;
    return { chartData: processed, avgGider: ortalama, tahminiYilSonu: ortalama * 12 };
  }, [firebaseData, selectedKurum, selectedCategory, selectedDonem, rawData]);

  return (
    <div style={{ padding: isMobile ? "10px" : "15px 25px", color: "white", maxWidth: 1200, margin: "0 auto", backgroundColor: "#020617", minHeight: "100vh" }}>
      
      {/* 🛡️ ÜST NAVİGASYON */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", minWidth: isMobile ? "100%" : 220, flex: 1 }}>
          <select value={selectedKurum} onChange={(e) => setSelectedKurum(e.target.value)} style={mainSel}>
            <option>Tüm Kurumlar</option>
            {BRANCH_LIST.map(k => <option key={k} value={k}>{k}</option>)}
          </select>
          <div style={chevronPos}><ChevronDown size={14} color="#64748b" /></div>
        </div>

        <div style={{ position: "relative", minWidth: isMobile ? "100%" : 140, flex: isMobile ? "none" : 0 }}>
          <select value={selectedDonem} onChange={(e) => setSelectedDonem(e.target.value)} style={mainSel}>
            {["2024-2025", "2025-2026"].map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <div style={chevronPos}><ChevronDown size={14} color="#64748b" /></div>
        </div>

        <div style={{ display: "flex", gap: 6, width: isMobile ? "100%" : "auto" }}>
          <NavButton id={1} active={activePage} onClick={setActivePage} icon={<BarChart3 size={14} />} label="Analiz" isMobile={isMobile} />
          <NavButton id={3} active={activePage} onClick={setActivePage} icon={<LayoutGrid size={14} />} label="Stratejik Analiz" isMobile={isMobile} />
          <button onClick={() => navigate("/finance/input")} style={{ ...veriGirisStyle, flex: isMobile ? 1 : "none", justifyContent: "center" }}>
            <Database size={14} /> <span>{isMobile ? "Giriş" : "Veri Girişi"}</span>
          </button>
        </div>
      </div>

      {activePage === 3 ? (
        <FinanceAnalysisPage selectedKurum={selectedKurum} selectedDonem={selectedDonem} />
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: isMobile ? 10 : 15, marginBottom: 25 }}>
            <SmartCard title={`${selectedCategory.toUpperCase()} ORT.`} value={formatCurrency(avgGider)} icon={<Calculator size={18} />} color="#3b82f6" isMobile={isMobile} />
            <SmartCard title="TAHMİNİ YIL SONU" value={formatCurrency(tahminiYilSonu)} icon={<TrendingUp size={18} />} color="#a855f7" isMobile={isMobile} />
          </div>

          <div style={{ ...containerStyle, padding: isMobile ? "15px" : "20px" }}>
            <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", justifyContent: "space-between", alignItems: isMobile ? "flex-start" : "center", marginBottom: 25, gap: isMobile ? 12 : 0 }}>
              <div style={headerStyle}><Landmark size={14} style={{ color: "#3b82f6" }} /> {selectedCategory.toUpperCase()} ANALİZİ</div>
              <div style={{ position: "relative", minWidth: isMobile ? "100%" : 180 }}>
                <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} style={categorySel}>
                  {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
                <div style={chevronPos}><ListFilter size={12} color="#3b82f6" /></div>
              </div>
            </div>

            {/* 🛡️ GRAFİK: AYLARIN TAM YAZILMASI İÇİN GENİŞLETİLDİ */}
            <div style={{ height: isMobile ? 450 : 500 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart 
                  data={chartData} 
                  layout="vertical" 
                  margin={{ 
                    top: 5, 
                    right: isMobile ? 60 : 85, 
                    left: isMobile ? 20 : 40, // 👈 İsimlerin sığması için sol boşluk artırıldı
                    bottom: 5 
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis type="number" hide />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    stroke="#94a3b8" 
                    fontSize={isMobile ? 10 : 12} 
                    width={isMobile ? 65 : 80} // 👈 Ay isimlerinin tam sığması için genişlik artırıldı
                    tickLine={false} 
                    axisLine={false} 
                  />
                  
                  <Tooltip 
                    cursor={{fill: '#1e293b', opacity: 0.4}} 
                    contentStyle={{ background: '#020617', border: '1px solid #1e2937', borderRadius: '8px' }}
                    itemStyle={{ color: '#f8fafc', fontSize: '12px', fontWeight: 600 }}
                    formatter={(value: any) => [formatCurrency(value), "Tutar"]}
                  />

                  <Bar dataKey="tutar" radius={[0, 4, 4, 0]} barSize={isMobile ? 18 : 22}>
                    <LabelList 
                      dataKey="label" 
                      position="right" 
                      fill="#f8fafc" 
                      fontSize={isMobile ? 9 : 10} 
                      fontWeight={800} 
                      offset={12} 
                    />
                    {chartData.map((entry, index) => (
                      <Cell key={index} fill={entry.tutar === 0 ? "#1e293b" : (entry.tutar <= avgGider ? "#22c55e" : "#ef4444")} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// STİLLER AYNI KALDI
const mainSel = { background: "#020617", border: "1px solid #1e2937", color: "white", padding: "10px 35px 10px 15px", borderRadius: 10, width: "100%", outline: 'none', appearance: 'none' as const, WebkitAppearance: 'none' as const, fontWeight: 700, fontSize: "0.85rem" };
const categorySel = { background: "#1e293b", border: "1px solid #334155", color: "#3b82f6", padding: "8px 30px 8px 12px", borderRadius: 8, width: "100%", outline: 'none', appearance: 'none' as const, fontSize: "0.75rem", fontWeight: 700, cursor: "pointer" };
const chevronPos = { position: "absolute" as const, right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" as const, display: "flex", alignItems: "center" };
const veriGirisStyle = { background: "#0f172a", border: "1px solid #1e2937", color: "#94a3b8", padding: "8px 15px", borderRadius: 8, fontSize: "0.75rem", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 };
const headerStyle = { fontSize: "0.75rem", fontWeight: 800, color: "white", display: "flex", alignItems: "center", gap: 8 };
const containerStyle = { background: "#0f172a", border: "1px solid #1e2937", borderRadius: 12, padding: "20px" };

function NavButton({ id, active, onClick, icon, label, isMobile }: any) {
  const isActive = active === id;
  return (
    <button onClick={() => onClick(id)} style={{ background: isActive ? "#3b82f6" : "#0f172a", border: `1px solid ${isActive ? "#3b82f6" : "#1e2937"}`, color: isActive ? "white" : "#94a3b8", padding: "8px 12px", borderRadius: 8, fontSize: "0.7rem", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, flex: isMobile ? 1 : "none", justifyContent: "center" }}>{icon} <span className={isMobile ? "inline" : "hidden md:inline"}>{isMobile ? label.split(' ')[0] : label}</span></button>
  );
}

function SmartCard({ title, value, icon, color, isMobile }: any) {
  return (
    <div style={{ background: "#0f172a", border: `1px solid ${color}30`, borderLeft: `4px solid ${color}`, borderRadius: 12, padding: isMobile ? "12px 15px" : "18px 22px" }}>
      <div style={{ color: "#94a3b8", fontSize: isMobile ? "0.55rem" : "0.6rem", fontWeight: 700, marginBottom: 8, letterSpacing: "0.1em", display: "flex", justifyContent: "space-between" }}>{title} <span>{icon}</span></div>
      <div style={{ fontSize: isMobile ? "1rem" : "1.7rem", fontWeight: 900, color: "#f8fafc" }}>{value}</div>
    </div>
  );
}