import { useState, useMemo, useEffect } from "react";
import { collection, onSnapshot, query } from "firebase/firestore";
import { db } from "../../firebase"; 
import { useAuth } from "../../store/AuthContext";
import { Calendar, School, LayoutDashboard, FileText } from "lucide-react";
import asafRecordsRaw from "../../data/excel2json-1769487741734.json"; 

const superNormalize = (s: any): string => {
  if (!s) return "";
  return String(s).toLocaleLowerCase('tr-TR').trim()
    .replace(/ı/g, "i").replace(/ğ/g, "g").replace(/ü/g, "u")
    .replace(/ş/g, "s").replace(/ö/g, "o").replace(/ç/g, "c")
    .replace(/\s+/g, "");
};

export default function DailyEnrollmentReport() {
  const { user } = useAuth();
  const [firebaseRecords, setFirebaseRecords] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    const q = query(collection(db, "records"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setFirebaseRecords(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => {
      unsubscribe();
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const reportData = useMemo(() => {
    const jsonRecords = Array.isArray(asafRecordsRaw) ? asafRecordsRaw : [];
    const all = [...jsonRecords, ...firebaseRecords];
    const [y, m, d] = selectedDate.split("-");
    const pad = (n: string) => n.length < 2 ? "0" + n : n;
    const targetDateShort = `${parseInt(d)}.${parseInt(m)}.${y}`;
    const targetDateFull = `${pad(parseInt(d).toString())}.${pad(parseInt(m).toString())}.${y}`;

    const mapping: Record<string, string[]> = {
      "altinkurelise": ["fen", "anadolu", "akademi"],
      "mefkureyks": ["plus", "vip"],
      "altinkureilkogretim": ["ilkokul", "ortaokul", "anaokulu"],
      "altinkureteknokent": ["teknokent"],
      "mefkurelgs": ["lgs"]
    };

    const userKey = superNormalize(user?.branchId);
    const allowedKeywords = mapping[userKey] || [userKey];
    const branchGroups: Record<string, { dailyTotal: number, overallTotal: number, rows: any[] }> = {};

    all.forEach((r: any) => {
      const bNameHam = (r.Okul || r.subeAd || "").trim();
      const bNameNorm = superNormalize(bNameHam);
      const cDate = String(r.SözleşmeTarihi || "");
      let rawCls = String(r.Sınıf || r.classType || "Belirsiz").replace(".0", "").trim();
      let cls = /^\d+$/.test(rawCls) ? parseInt(rawCls, 10).toString() : rawCls;

      if (!cDate.includes(".2026")) return;
      let isAllowed = user?.role === 'admin' || allowedKeywords.some(key => bNameNorm.includes(key));
      if (!isAllowed) return;

      const isToday = cDate.includes(targetDateShort) || cDate.includes(targetDateFull);
      const groupKey = user?.role === 'admin' ? bNameHam : user?.branchId;
      
      if (!branchGroups[groupKey]) branchGroups[groupKey] = { dailyTotal: 0, overallTotal: 0, rows: [] };
      let existingRow = branchGroups[groupKey].rows.find(row => row.sube === bNameHam && row.sinif === cls);
      
      if (existingRow) {
        existingRow.overall++;
        if (isToday) existingRow.daily++;
      } else {
        branchGroups[groupKey].rows.push({ sube: bNameHam, sinif: cls, daily: isToday ? 1 : 0, overall: 1 });
      }
      branchGroups[groupKey].overallTotal++;
      if (isToday) branchGroups[groupKey].dailyTotal++;
    });

    Object.values(branchGroups).forEach(group => {
      group.rows.sort((a, b) => {
        if (a.sube !== b.sube) return a.sube.localeCompare(b.sube);
        return (parseInt(a.sinif) || 99) - (parseInt(b.sinif) || 99);
      });
    });

    return { 
      branches: Object.entries(branchGroups).sort((a, b) => b[1].dailyTotal - a[1].dailyTotal),
      grandDaily: Object.values(branchGroups).reduce((a, b) => a + b.dailyTotal, 0),
      grandOverall: Object.values(branchGroups).reduce((a, b) => a + b.overallTotal, 0)
    };
  }, [firebaseRecords, selectedDate, user]);

  return (
    <div style={{ padding: isMobile ? "10px" : "20px", color: "white", maxWidth: 1100, margin: "0 auto", backgroundColor: "#020617", minHeight: "100vh" }}>
      
      <div style={headerCard}>
        <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", justifyContent: "space-between", gap: 15 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <LayoutDashboard size={24} color="#38bdf8" />
            <div style={{ fontSize: "1.1rem", fontWeight: 800 }}>GÜNLÜK KAYIT RAPORU</div>
          </div>
          <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} style={dateInputStyle} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 15, marginBottom: 20 }}>
        <div style={statCard("#0ea5e9")}>
          <div style={statLabel}>BUGÜNKÜ</div>
          <div style={statValue}>{reportData.grandDaily}</div>
        </div>
        <div style={statCard("#8b5cf6")}>
          <div style={statLabel}>2026 TOPLAM</div>
          <div style={statValue}>{reportData.grandOverall}</div>
        </div>
      </div>

      {reportData.branches.map(([groupName, bData]) => (
        <div key={groupName} style={branchContainer}>
          <div style={branchTitle}><School size={18} /> {groupName}</div>
          <div style={{ overflowX: "auto" }}>
            <table style={tableStyle}>
              <thead>
                <tr style={tableHeaderRow}>
                  <th style={thLeft}>ŞUBE</th>
                  <th style={thLeft}>SINIF</th>
                  <th style={thCenter}>GÜNLÜK</th>
                  <th style={thRight}>TOPLAM</th>
                </tr>
              </thead>
              <tbody>
                {bData.rows.map((row, idx) => {
                  // 🚀 KRİTİK SADELEŞTİRME: Aynı şube ismi üst üste gelirse gösterme
                  const isFirstOfBranch = idx === 0 || bData.rows[idx - 1].sube !== row.sube;
                  
                  return (
                    <tr key={`${row.sube}-${row.sinif}`} style={tableRow(row.daily > 0)}>
                      <td style={{ ...tdLeftSub, opacity: isFirstOfBranch ? 1 : 0 }}>
                        {isFirstOfBranch ? row.sube : ""}
                      </td>
                      <td style={tdLeft}>{row.sinif}. Sınıf</td>
                      <td style={tdCenter(row.daily > 0)}>{row.daily}</td>
                      <td style={tdRight}>{row.overall}</td>
                    </tr>
                  );
                })}
                <tr style={footerRow}>
                  <td colSpan={2} style={tdLeftFooter}>GRUP TOPLAMI</td>
                  <td style={tdCenter(false)}>{bData.dailyTotal}</td>
                  <td style={tdRight}>{bData.overallTotal}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

// STİLLER (Korundu)
const headerCard = { background: "#0f172a", padding: "20px", borderRadius: "16px", border: "1px solid #1e293b", marginBottom: 20 };
const dateInputStyle = { background: "#1e293b", border: "1px solid #334155", color: "white", padding: "10px", borderRadius: "10px", outline: "none" };
const statCard = (color: string) => ({ background: "#0f172a", padding: "20px", borderRadius: "16px", border: `1px solid ${color}40`, borderLeft: `5px solid ${color}`, textAlign: "center" as const });
const statLabel = { fontSize: "0.7rem", fontWeight: 700, color: "#94a3b8", marginBottom: 5 };
const statValue = { fontSize: "2rem", fontWeight: 900 };
const branchContainer = { background: "#0f172a", borderRadius: "16px", border: "1px solid #1e293b", marginBottom: 25, overflow: "hidden" };
const branchTitle = { padding: "12px 20px", background: "#1e293b50", borderBottom: "1px solid #1e293b", fontWeight: 800, color: "#38bdf8", display: "flex", alignItems: "center", gap: 10, fontSize: "0.9rem" };
const tableStyle = { width: "100%", borderCollapse: "collapse" as const };
const tableHeaderRow = { background: "#020617" };
const thStyle = { padding: "12px 20px", fontSize: "0.7rem", color: "#64748b", fontWeight: 800 };
const thLeft = { ...thStyle, textAlign: "left" as const };
const thCenter = { ...thStyle, textAlign: "center" as const };
const thRight = { ...thStyle, textAlign: "right" as const };
const tableRow = (hasDaily: boolean) => ({ borderBottom: "1px solid #1e293b50", background: hasDaily ? "#38bdf808" : "transparent" });
const tdStyle = { padding: "12px 20px", fontSize: "0.8rem", fontWeight: 600 };
const tdLeft = { ...tdStyle, textAlign: "left" as const, color: "#f8fafc" };
const tdLeftSub = { ...tdStyle, textAlign: "left" as const, color: "#38bdf8", fontWeight: 800, borderRight: "1px solid #1e293b" };
const tdCenter = (active: boolean) => ({ ...tdStyle, textAlign: "center" as const, color: active ? "#38bdf8" : "#f8fafc" });
const tdRight = { ...tdStyle, textAlign: "right" as const, color: "#f8fafc" };
const footerRow = { background: "#1e293b40" };
const tdLeftFooter = { ...tdStyle, textAlign: "left" as const, color: "#38bdf8", fontWeight: 900 };