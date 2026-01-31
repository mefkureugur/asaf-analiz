import { useState, useMemo, useEffect } from "react";
import { collection, onSnapshot, query } from "firebase/firestore";
import { db } from "../../firebase"; 
import { useAuth } from "../../store/AuthContext";
import FilterBar from "../../components/FilterBar";
import asafRecordsRaw from "../../data/excel2json-1769487741734.json"; 

// 🛡️ Zırh 1: Normalizasyon fonksiyonunu memoize ederek işlemci yükünü azaltıyoruz
const normalize = (s: any): string => {
  if (!s) return "";
  return String(s).toLocaleLowerCase('tr-TR').trim()
    .replace(/ı/g, "i").replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ş/g, "s").replace(/ö/g, "o").replace(/ç/g, "c")
    .replace(/ okulu$/, " okul").replace(/ anaokulu$/, " anaokul");
};

export default function DashboardPage() {
  const { user } = useAuth();
  const [firebaseRecords, setFirebaseRecords] = useState<any[]>([]);

  // 🛡️ Zırh 2: Tarih objesini her renderda yeniden oluşturmuyoruz (Sonsuz döngü engeli)
  const { targetDay, targetMonth, now } = useMemo(() => {
    const d = new Date();
    return {
      targetDay: d.getDate(),
      targetMonth: d.getMonth() + 1,
      now: d
    };
  }, []);

  const [year, setYear] = useState<number>(2026); 
  const [viewMode, setViewMode] = useState<"today" | "all">("today"); 
  const [branch, setBranch] = useState<string>("");
  const [classTypes, setClassTypes] = useState<string[]>([]);

  useEffect(() => {
    const q = query(collection(db, "records"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setFirebaseRecords(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => console.warn("Firebase hatası:", err));
    return () => unsubscribe();
  }, []);

  // 🛡️ Zırh 3: Veri birleştirme mantığını optimize ettik
  const allRecords = useMemo(() => {
    const jsonRecords = Array.isArray(asafRecordsRaw) ? asafRecordsRaw : [];
    return [...jsonRecords, ...firebaseRecords].map((r: any) => ({
      ...r,
      Okul: r.Okul || r.subeAd || "Bilinmeyen",
      SonTutar: Number(r.SonTutar || r.amount || 0),
      Sınıf: String(r.Sınıf || r.classType || "").replace(".0", "").trim(),
      SözleşmeTarihi: String(r.SözleşmeTarihi || "")
    }));
  }, [firebaseRecords]);

  const myAllowedNames = useMemo(() => {
    if (!user) return [];
    if (user.role === 'admin') return null;
    
    const uB = normalize(user.branchId || "");
    const mapping: Record<string, string[]> = {
      "altinkure ilkogretim": ["Altınküre İlkokul", "Altınküre Ortaokul", "Altınküre Anaokulu"],
      "altinkure lise": ["Altınküre Fen Lisesi", "Altınküre Anadolu Lisesi", "Altınküre Akademi"],
      "altinkure teknokent": ["Altınküre Teknokent"],
      "mefkure lgs": ["Mefkure LGS"],
      "mefkure yks": ["Mefkure PLUS", "Mefkure PLUS", "Mefkure VIP", "Mefkure VIP"]
    };
    return mapping[uB] || [user.branchId];
  }, [user]);

  // 🛡️ Zırh 4: İstatistik hesaplama motorunu stabilizese ettik
  const stats = useMemo(() => {
    const allowedNorm = myAllowedNames?.map((n: string) => normalize(n));
    
    const filterLogic = (r: any, tY: number) => {
      const rb = normalize(r.Okul);
      if (allowedNorm && !allowedNorm.includes(rb)) return false;
      if (branch !== "" && rb !== normalize(branch)) return false;
      if (classTypes.length > 0 && !classTypes.includes(r.Sınıf)) return false;
      
      const p = r.SözleşmeTarihi.split(".");
      if (p.length < 3) return false;
      const rD = parseInt(p[0]); const rM = parseInt(p[1]); const rY = parseInt(p[2]);
      
      if (rY !== tY) return false;
      if (viewMode === "today") {
        if (rM < targetMonth) return true;
        if (rM === targetMonth && rD <= targetDay) return true;
        return false;
      }
      return true;
    };

    const currentData = allRecords.filter((r: any) => filterLogic(r, year));
    const lastYearData = allRecords.filter((r: any) => filterLogic(r, 2025));

    const cC = currentData.length;
    const cT = currentData.reduce((acc, curr) => acc + curr.SonTutar, 0);
    const lC = lastYearData.length;
    const lT = lastYearData.reduce((acc, curr) => acc + curr.SonTutar, 0);

    return { cC, cT, countDiff: lC > 0 ? ((cC - lC) / lC) * 100 : 0, totalDiff: lT > 0 ? ((cT - lT) / lT) * 100 : 0, lC, lT };
  }, [allRecords, year, viewMode, branch, classTypes, myAllowedNames, targetDay, targetMonth]);

  const getYearlyData = (tY: number) => {
    const allowedNorm = myAllowedNames?.map((n: string) => normalize(n));
    const counts = Array(12).fill(0);
    allRecords.forEach((r: any) => {
      const rb = normalize(r.Okul);
      if (allowedNorm && !allowedNorm.includes(rb)) return;
      if (branch !== "" && rb !== normalize(branch)) return;

      const p = r.SözleşmeTarihi.split(".");
      if (p.length === 3 && parseInt(p[2]) === tY) {
        const m = parseInt(p[1]) - 1;
        if (m >= 0 && m < 12) counts[m]++;
      }
    });
    return counts;
  };

  const data2025 = useMemo(() => getYearlyData(2025), [allRecords, branch, myAllowedNames]);
  const data2026 = useMemo(() => getYearlyData(2026), [allRecords, branch, myAllowedNames]);

  return (
    <div style={{ padding: "10px 15px", color: "white", maxWidth: 1200, margin: "0 auto", fontFamily: "sans-serif" }}>
      <div style={{ 
        display: "flex", 
        flexDirection: window.innerWidth < 768 ? "column" : "row", 
        gap: 10, 
        marginBottom: 20, 
        alignItems: "stretch" 
      }}>
        <div style={{ display: "flex", gap: 10, flex: 1 }}>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} style={{...mainSel, flex: 1}}>
            <option value={2025}>2025 Dönemi</option>
            <option value={2026}>2026 Dönemi</option>
          </select>
          <select value={viewMode} onChange={(e) => setViewMode(e.target.value as any)} style={{...mainSel, flex: 1}}>
            <option value="today">Bugün ({targetDay} {new Intl.DateTimeFormat('tr-TR', {month: 'short'}).format(now)})</option>
            <option value="all">Tüm Yıl</option>
          </select>
        </div>
        <div style={{ flex: 2 }}>
          <FilterBar 
            branch={branch} setBranch={setBranch} 
            classTypes={classTypes} setClassTypes={setClassTypes} 
            allowedBranches={myAllowedNames} 
          />
        </div>
      </div>

      <div style={{ 
        display: "grid", 
        gridTemplateColumns: window.innerWidth < 768 ? "1fr" : "repeat(auto-fit, minmax(320px, 1fr))", 
        gap: 15 
      }}>
        <SmartCard title="ÖĞRENCİ SAYISI" value={stats.cC} compareValue={stats.lC} diff={stats.countDiff} showCompare={year === 2026} />
        <SmartCard title="TOPLAM CİRO" value={`₺${stats.cT.toLocaleString("tr-TR")}`} compareValue={`₺${stats.lT.toLocaleString("tr-TR")}`} diff={stats.totalDiff} showCompare={year === 2026} />
        <SmartCard title="ORTALAMA KAYIT" value={`₺${Math.round(stats.cC > 0 ? stats.cT / stats.cC : 0).toLocaleString("tr-TR")}`} compareValue={`₺${Math.round(stats.lC > 0 ? stats.lT / stats.lC : 0).toLocaleString("tr-TR")}`} diff={stats.totalDiff - stats.countDiff} showCompare={year === 2026} />
      </div>

      <div style={{ marginTop: 25 }}>
        <MonthGrid title="2025 AY DETAYLARI" data={data2025} compareData={data2026} is2026={false} />
        <div style={{ height: 20 }} />
        <MonthGrid title="2026 AY DETAYLARI" data={data2026} compareData={data2025} is2026={true} />
      </div>

      <div style={{ marginTop: 30, padding: 10, background: "#1e293b", borderRadius: 8, fontSize: "0.65rem", opacity: 0.5, wordBreak: "break-all" }}>
        Yetki: {user?.branchId} | Süzülen: {myAllowedNames?.join(", ") || "Tümü"}
      </div>
    </div>
  );
}

// Alt bileşenler (SmartCard, MonthGrid) senin kodundaki haliyle korunmuştur...
function SmartCard({ title, value, compareValue, diff, showCompare }: any) {
  const isDown = diff < 0;
  const statusColor = isDown ? "#ef4444" : "#22c55e"; 
  return (
    <div style={{ background: "#0f172a", border: `1px solid ${statusColor}30`, borderLeft: `4px solid ${statusColor}`, borderRadius: 12, padding: "15px 20px" }}>
      <div style={{ color: "#94a3b8", fontSize: "0.7rem", fontWeight: 700, marginBottom: 8, letterSpacing: "0.05em" }}>{title}</div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#f8fafc" }}>{value}</div>
        {showCompare && (
          <div style={{ background: `${statusColor}10`, border: `1px solid ${statusColor}20`, padding: "4px 8px", borderRadius: "8px", textAlign: "right" }}>
            <div style={{ fontSize: "0.55rem", color: "#94a3b8" }}>GEÇEN YIL</div>
            <div style={{ fontSize: "0.8rem", fontWeight: 700, color: statusColor }}>{isDown ? "📉" : "📈"} %{Math.abs(diff).toFixed(1)}</div>
            <div style={{ fontSize: "0.6rem", color: "#64748b" }}>{compareValue}</div>
          </div>
        )}
      </div>
    </div>
  );
}

function MonthGrid({ title, data, compareData, is2026 }: any) {
  const names = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
  const isMobile = window.innerWidth < 768;

  return (
    <div>
      <div style={{ fontSize: "0.7rem", color: "#64748b", marginBottom: 8, fontWeight: 700 }}>{title}</div>
      <div style={{ 
        display: "grid", 
        gridTemplateColumns: isMobile ? "repeat(6, 1fr)" : "repeat(12, 1fr)", 
        gap: 4 
      }}>
        {names.map((n, i) => {
          const val = data[i];
          const otherVal = compareData ? compareData[i] : 0;
          let textColor = "#334155";
          if (val > 0) {
            if (is2026) {
              textColor = val >= otherVal ? "#22c55e" : "#ef4444";
            } else {
              textColor = "white";
            }
          }

          return (
            <div key={n} style={{ 
              padding: "6px 2px", 
              borderRadius: 6, 
              border: "1px solid #1e2937", 
              textAlign: "center", 
              background: (is2026 && i > 0 && val === 0) ? "transparent" : "#020617",
              opacity: (is2026 && i > 0 && val === 0) ? 0.3 : 1
            }}>
              <div style={{ fontSize: "0.5rem", color: "#64748b" }}>{n}</div>
              <div style={{ fontSize: "0.75rem", fontWeight: 800, color: textColor }}>
                {(is2026 && i > 0 && val === 0) ? "-" : val}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const mainSel = { background: "#020617", border: "1px solid #1e2937", color: "white", padding: "10px", borderRadius: 10, fontSize: "0.8rem", cursor: "pointer", outline: 'none' };