import { useState, useMemo, useEffect } from "react";
import { collection, onSnapshot, query } from "firebase/firestore";
import { db } from "../../firebase"; 
import { useAuth } from "../../store/AuthContext";
// ✅ Dashboard ile aynı veri kaynağını kilitliyoruz
import asafRecordsRaw from "../../data/excel2json-1769487741734.json"; 

const normalize = (s: any): string => {
  if (!s) return "";
  return String(s)
    .toLocaleLowerCase('tr-TR')
    .trim()
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/ okulu$/, " okul")
    .replace(/ anaokulu$/, " anaokul");
};

export default function ComparePage() {
  const { user } = useAuth();
  const [firebaseRecords, setFirebaseRecords] = useState<any[]>([]);
  
  // 🕒 27 Ocak kilidini kaldırıp, sayfanın her zaman o günün tarihinde açılmasını sağladık
  const [cutoff, setCutoff] = useState(new Date().toISOString().split('T')[0]);

  // 🛡️ KURUM VE ŞUBE HARİTASI (Normalize Edilmiş Liste İçin)
  const institutionGroups: Record<string, string[]> = {
    "Altınküre İlköğretim": ["Altınküre İlkokul", "Altınküre Ortaokul", "Altınküre Anaokulu"],
    "Altınküre Lise": ["Altınküre Fen Lisesi", "Altınküre Anadolu Lisesi", "Altınküre Akademi"],
    "Altınküre Teknokent": ["Altınküre Teknokent"],
    "Mefkure LGS": ["Mefkure LGS"],
    "Mefkure YKS": ["Mefkure Plus", "Mefkure VIP"] // ✅ VIP'yi burada tek isme indirdik
  };

  const [selectedInstitution, setSelectedInstitution] = useState("GENEL");
  const [selectedSubBranch, setSelectedSubBranch] = useState("HEPSİ");

  useEffect(() => {
    if (user && user.role !== 'admin') {
      setSelectedInstitution(user.branchId || "");
    }
  }, [user]);

  useEffect(() => {
    const q = query(collection(db, "records"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setFirebaseRecords(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => console.warn("Firebase hatası:", err));
    return () => unsubscribe();
  }, []);

  const allRecords = useMemo(() => {
    const jsonRecords = Array.isArray(asafRecordsRaw) ? asafRecordsRaw : [];
    return [...jsonRecords, ...firebaseRecords].map((r: any) => ({
      ...r,
      Okul: r.Okul || r.subeAd || "Bilinmeyen",
      SonTutar: Number(r.SonTutar || r.amount || 0),
      SözleşmeTarihi: String(r.SözleşmeTarihi || "")
    }));
  }, [firebaseRecords]);

  const stats = useMemo(() => {
    const [selY, selM, selD] = cutoff.split("-").map(Number);
    
    // Filtreleme listesini belirle
    let activeList: string[] | null = null;
    if (selectedSubBranch !== "HEPSİ") {
      activeList = [selectedSubBranch];
    } else if (selectedInstitution !== "GENEL") {
      activeList = institutionGroups[selectedInstitution] || [selectedInstitution];
    }

    const getStats = (targetYear: number) => {
      const filtered = allRecords.filter(r => {
        const rb = normalize(r.Okul);
        // Yetki Kontrolü: Normalize isimler üzerinden karşılaştırma yapıyoruz
        if (activeList && !activeList.map(n => normalize(n)).includes(rb)) return false;
        
        const p = r.SözleşmeTarihi.split(".");
        if (p.length < 3) return false;
        const rD = parseInt(p[0]); const rM = parseInt(p[1]); const rY = parseInt(p[2]);
        
        if (rY !== targetYear) return false;
        if (rM < selM) return true;
        if (rM === selM && rD <= selD) return true;
        return false;
      });

      return {
        count: filtered.length,
        total: filtered.reduce((acc, curr) => acc + curr.SonTutar, 0)
      };
    };

    return { curr: getStats(selY), prev: getStats(selY - 1) };
  }, [allRecords, cutoff, selectedInstitution, selectedSubBranch]);

  const formatTL = (n: number) => `₺${n.toLocaleString("tr-TR")}`;

  return (
    <div style={{ padding: 25, color: "white", maxWidth: 1200, margin: "0 auto", fontFamily: "sans-serif" }}>
      <header style={{ marginBottom: 30, display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 20 }}>
        <div>
           <h2 style={{ fontSize: "1.8rem", fontWeight: 800, marginBottom: 10 }}>⚖️ Yıl Karşılaştırması</h2>
           <p style={{ color: "#38bdf8" }}>{selectedSubBranch !== "HEPSİ" ? selectedSubBranch : selectedInstitution} Analizi</p>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {user?.role === 'admin' && (
            <div style={filterBox}>
              <label style={labelStyle}>Kurum Seçin:</label>
              <select value={selectedInstitution} onChange={(e) => { setSelectedInstitution(e.target.value); setSelectedSubBranch("HEPSİ"); }} style={selectStyle}>
                <option value="GENEL" style={optStyle}>Tüm Kurumlar (GENEL)</option>
                {Object.keys(institutionGroups).map(name => <option key={name} value={name} style={optStyle}>{name}</option>)}
              </select>
            </div>
          )}

          {selectedInstitution !== "GENEL" && institutionGroups[selectedInstitution]?.length > 1 && (
            <div style={filterBox}>
              <label style={labelStyle}>Şube Seçin:</label>
              <select value={selectedSubBranch} onChange={(e) => setSelectedSubBranch(e.target.value)} style={selectStyle}>
                <option value="HEPSİ" style={optStyle}>Tüm Şubeler</option>
                {/* ✅ VIP isminin çiftlenmesini buradaki map ile engelliyoruz */}
                {institutionGroups[selectedInstitution].map(sub => <option key={sub} value={sub} style={optStyle}>{sub}</option>)}
              </select>
            </div>
          )}

          <div style={filterBox}>
            <label style={labelStyle}>Kıyas Günü:</label>
            <input type="date" value={cutoff} onChange={(e) => setCutoff(e.target.value)} style={selectStyle} />
          </div>
        </div>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20 }}>
        {/* ✅ TS Hataları (v:any) şeklinde giderildi */}
        <ResultCard title="ÖĞRENCİ SAYISI" curr={stats.curr.count} prev={stats.prev.count} format={(v: any) => v} />
        <ResultCard title="TOPLAM CİRO" curr={stats.curr.total} prev={stats.prev.total} format={formatTL} />
        <ResultCard title="ORTALAMA KAYIT" 
          curr={stats.curr.count > 0 ? stats.curr.total / stats.curr.count : 0} 
          prev={stats.prev.count > 0 ? stats.prev.total / stats.prev.count : 0} 
          format={formatTL} 
        />
      </div>
    </div>
  );
}

function ResultCard({ title, curr, prev, format }: any) {
  const diff = prev > 0 ? ((curr - prev) / prev) * 100 : 0;
  const isUp = diff >= 0;
  return (
    <div style={{ background: "linear-gradient(145deg, #0f172a, #020617)", border: "1px solid #1e293b", borderRadius: 16, padding: 25 }}>
      <div style={{ color: "#94a3b8", fontSize: "0.75rem", fontWeight: 700, marginBottom: 20, letterSpacing: 1 }}>{title}</div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
        <span style={{ color: "#64748b" }}>2025:</span>
        <span style={{ fontWeight: 600 }}>{format(prev)}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ color: "#38bdf8", fontWeight: 600 }}>2026:</span>
        <span style={{ fontWeight: 800, fontSize: "1.5rem" }}>{format(curr)}</span>
      </div>
      <div style={{ marginTop: 20, padding: "12px", borderRadius: 10, background: isUp ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)", color: isUp ? "#22c55e" : "#ef4444", textAlign: "center", fontWeight: 700 }}>
        {isUp ? "▲" : "▼"} %{Math.abs(diff).toFixed(1)} {isUp ? "Gelişim" : "Düşüş"}
      </div>
    </div>
  );
}

const filterBox = { background: "#0f172a", padding: "10px 15px", borderRadius: 12, border: "1px solid #1e293b", minWidth: "160px" };
const labelStyle = { fontSize: "0.7rem", color: "#94a3b8", display: "block", marginBottom: 5, fontWeight: 700 };
const selectStyle = { background: "transparent", border: "none", color: "white", outline: "none", cursor: "pointer", fontSize: "0.9rem", width: "100%", colorScheme: "dark" };
const optStyle = { background: "#0f172a", color: "white" };