import { useState, useMemo, useEffect, useCallback } from "react";
import { collection, onSnapshot, query } from "firebase/firestore";
import { db } from "../../firebase"; 
import { useAuth } from "../../store/AuthContext";
import FilterBar from "../../components/FilterBar";
import asafRecordsRaw from "../../data/excel2json-1769487741734.json";
import { useIsMobile } from "../../hooks/useMediaQuery";

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
      Okul: r.Okul || r.branch || r.subeAd || "Bilinmeyen",
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

    const cAvg = cC > 0 ? cT / cC : 0;
    const lAvg = lC > 0 ? lT / lC : 0;
    const avgDiff = lAvg > 0 ? ((cAvg - lAvg) / lAvg) * 100 : 0;

    return { cC, cT, countDiff: lC > 0 ? ((cC - lC) / lC) * 100 : 0, totalDiff: lT > 0 ? ((cT - lT) / lT) * 100 : 0, avgDiff, lC, lT };
  }, [allRecords, year, viewMode, branch, classTypes, myAllowedNames, targetDay, targetMonth]);

  const getYearlyData = useCallback((tY: number) => {
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
  }, [allRecords, branch, myAllowedNames]);

  const data2025 = useMemo(() => getYearlyData(2025), [getYearlyData]);
  const data2026 = useMemo(() => getYearlyData(2026), [getYearlyData]);

  // window.innerWidth'i render sırasında okumak yerine izliyoruz:
  // cihaz döndürüldüğünde düzen artık gerçekten güncelleniyor.
  const isMobile = useIsMobile();

  return (
    <div className="page">
      {/* Filtre çubuğu: içerik altından akan, üstte duran materyal katman (§12) */}
      <div
        style={{
          display: "flex",
          flexDirection: isMobile ? "column" : "row",
          gap: "var(--sp-3)",
          marginBottom: "var(--sp-5)",
          alignItems: "stretch",
        }}
      >
        <div style={{ display: "flex", gap: "var(--sp-3)", flex: 1 }}>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} style={{ flex: 1 }}>
            <option value={2025}>2025 Dönemi</option>
            <option value={2026}>2026 Dönemi</option>
          </select>
          <select value={viewMode} onChange={(e) => setViewMode(e.target.value as any)} style={{ flex: 1 }}>
            <option value="today">Bugün ({targetDay} {new Intl.DateTimeFormat("tr-TR", { month: "short" }).format(now)})</option>
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

      {/* Kartlar kademeli girer: göz yukarıdan aşağı taşınır, hiyerarşi
          hareketle de anlatılır */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit, minmax(300px, 1fr))",
          gap: "var(--sp-4)",
        }}
      >
        <SmartCard className="rise rise-1" title="ÖĞRENCİ SAYISI" value={stats.cC} compareValue={stats.lC} diff={stats.countDiff} showCompare={year === 2026} />
        <SmartCard className="rise rise-2" title="TOPLAM CİRO" value={`₺${stats.cT.toLocaleString("tr-TR")}`} compareValue={`₺${stats.lT.toLocaleString("tr-TR")}`} diff={stats.totalDiff} showCompare={year === 2026} />
        <SmartCard className="rise rise-3" title="ORTALAMA KAYIT" value={`₺${Math.round(stats.cC > 0 ? stats.cT / stats.cC : 0).toLocaleString("tr-TR")}`} compareValue={`₺${Math.round(stats.lC > 0 ? stats.lT / stats.lC : 0).toLocaleString("tr-TR")}`} diff={stats.avgDiff} showCompare={year === 2026} />
      </div>

      <div className="rise rise-4" style={{ marginTop: "var(--sp-6)", display: "flex", flexDirection: "column", gap: "var(--sp-5)" }}>
        <MonthGrid title="2025 AY DETAYLARI" data={data2025} compareData={data2026} is2026={false} isMobile={isMobile} />
        <MonthGrid title="2026 AY DETAYLARI" data={data2026} compareData={data2025} is2026={true} isMobile={isMobile} />
      </div>

      <div className="caption" style={{ marginTop: "var(--sp-6)", padding: "var(--sp-3)", background: "var(--surface)", borderRadius: "var(--r-sm)", border: "1px solid var(--line)", opacity: 0.6, wordBreak: "break-all" }}>
        Yetki: {user?.branchId} | Süzülen: {myAllowedNames?.join(", ") || "Tümü"}
      </div>
    </div>
  );
}

/* =====================================================================
   KPI KARTI
   Değer en büyük ve en parlak öğe; etiket ve kıyas ondan bir kademe geride.
   Hiyerarşi boyut + ağırlık + renk ile birlikte kuruluyor (§15).
   ===================================================================== */
function SmartCard({ title, value, compareValue, diff, showCompare, className }: any) {
  const isDown = diff < 0;
  const statusColor = isDown ? "var(--danger)" : "var(--success)";

  return (
    <div
      className={`card ${className || ""}`}
      style={{
        padding: "var(--sp-4) var(--sp-5)",
        // Durum rengi yalnızca ince bir kenar olarak: kart zemini sakin kalır,
        // gözü asıl değere bırakır
        borderLeft: `3px solid ${statusColor}`,
      }}
    >
      <div className="label" style={{ marginBottom: "var(--sp-2)" }}>{title}</div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "var(--sp-3)" }}>
        <div
          className="num"
          style={{
            fontSize: "1.6rem",
            fontWeight: 800,
            color: "var(--text)",
            letterSpacing: "-0.02em",
            lineHeight: 1.1,
          }}
        >
          {value}
        </div>

        {showCompare && (
          <div
            style={{
              background: "var(--surface-raised)",
              border: `1px solid ${statusColor}`,
              padding: "var(--sp-1) var(--sp-2)",
              borderRadius: "var(--r-sm)",
              textAlign: "right",
              flexShrink: 0,
            }}
          >
            <div className="caption" style={{ fontSize: "0.55rem" }}>GEÇEN YIL</div>
            <div className="num" style={{ fontSize: "0.82rem", fontWeight: 700, color: statusColor }}>
              {isDown ? "▼" : "▲"} %{Math.abs(diff).toFixed(1)}
            </div>
            <div className="caption num" style={{ fontSize: "0.6rem" }}>{compareValue}</div>
          </div>
        )}
      </div>
    </div>
  );
}

/* =====================================================================
   AY IZGARASI
   ===================================================================== */
function MonthGrid({ title, data, compareData, is2026, isMobile }: any) {
  const names = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

  return (
    <div>
      <div className="label" style={{ marginBottom: "var(--sp-2)", color: "var(--text-3)" }}>{title}</div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "repeat(6, 1fr)" : "repeat(12, 1fr)",
          gap: "var(--sp-1)",
        }}
      >
        {names.map((n, i) => {
          const val = data[i];
          const otherVal = compareData ? compareData[i] : 0;
          const isEmpty = is2026 && i > 0 && val === 0;

          let textColor = "var(--text-3)";
          if (val > 0) {
            if (is2026) textColor = val >= otherVal ? "var(--success)" : "var(--danger)";
            else textColor = "var(--text)";
          }

          return (
            <div
              key={n}
              style={{
                padding: "var(--sp-2) var(--sp-1)",
                borderRadius: "var(--r-sm)",
                border: "1px solid var(--line)",
                textAlign: "center",
                background: isEmpty ? "transparent" : "var(--surface)",
                opacity: isEmpty ? 0.35 : 1,
              }}
            >
              <div className="caption" style={{ fontSize: "0.55rem" }}>{n}</div>
              <div className="num" style={{ fontSize: "0.8rem", fontWeight: 700, color: textColor }}>
                {isEmpty ? "–" : val}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
