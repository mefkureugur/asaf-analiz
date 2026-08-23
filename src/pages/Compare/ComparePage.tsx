import { useState, useMemo } from "react";
import { useAuth } from "../../store/AuthContext";
import { useRecords } from "../../hooks/useRecords";
// ✅ Dashboard ile aynı veri kaynağını kilitliyoruz

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

// 🛡️ KURUM VE ŞUBE HARİTASI (Bileşen dışına taşındı)
const institutionGroups: Record<string, string[]> = {
  "Altınküre İlköğretim": ["Altınküre İlkokul", "Altınküre Ortaokul", "Altınküre Anaokulu"],
  "Altınküre Lise": ["Altınküre Fen Lisesi", "Altınküre Anadolu Lisesi", "Altınküre Akademi"],
  "Altınküre Teknokent": ["Altınküre Teknokent"],
  "Mefkure LGS": ["Mefkure LGS"],
  "Mefkure YKS": ["Mefkure Plus", "Mefkure VIP"]
};

export default function ComparePage() {
  const { user } = useAuth();
  
  // 🕒 27 Ocak kilidini kaldırıp, sayfanın her zaman o günün tarihinde açılmasını sağladık
  const [cutoff, setCutoff] = useState(new Date().toISOString().split('T')[0]);

  const [selectedInstitution, setSelectedInstitution] = useState("GENEL");
  const [selectedSubBranch, setSelectedSubBranch] = useState("HEPSİ");

  // 🛡️ Yetki bazlı kurum kilitlenmesi (Efekt yerine türetilmiş değer)
  const effectiveInstitution = useMemo(() => {
    if (user && user.role !== 'admin') return user.branchId || "";
    return selectedInstitution;
  }, [user, selectedInstitution]);



  // Tek veri kaynagi: JSON/Firestore birlestirmesi ve iptal suzgeci
  // useRecords icinde yapiliyor. Iptal edilen kayitlar buraya gelmez.
  const { records: allRecords } = useRecords();

  const stats = useMemo(() => {
    const [selY, selM, selD] = cutoff.split("-").map(Number);
    
    // Filtreleme listesini belirle
    let activeList: string[] | null = null;
    if (selectedSubBranch !== "HEPSİ") {
      activeList = [selectedSubBranch];
    } else if (effectiveInstitution !== "GENEL") {
      activeList = institutionGroups[effectiveInstitution] || [effectiveInstitution];
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
  }, [allRecords, cutoff, effectiveInstitution, selectedSubBranch]);

  const formatTL = (n: number) => `₺${Math.round(n).toLocaleString("tr-TR")}`;

  return (
    <div className="page rise" style={{ maxWidth: 1200 }}>
      <header style={{ marginBottom: 30, display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 20 }}>
        <div>
           <h2 style={{ fontSize: "1.8rem", fontWeight: 800, marginBottom: 10 }}>⚖️ Yıl Karşılaştırması</h2>
           <p style={{ color: "var(--accent)" }}>{selectedSubBranch !== "HEPSİ" ? selectedSubBranch : effectiveInstitution} Analizi</p>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {user?.role === 'admin' && (
            <div style={filterBox}>
              <label style={labelStyle}>Kurum Seçin:</label>
              <select value={effectiveInstitution} onChange={(e) => { setSelectedInstitution(e.target.value); setSelectedSubBranch("HEPSİ"); }} style={selectStyle}>
                <option value="GENEL" style={optStyle}>Tüm Kurumlar (GENEL)</option>
                {Object.keys(institutionGroups).map(name => <option key={name} value={name} style={optStyle}>{name}</option>)}
              </select>
            </div>
          )}

          {effectiveInstitution !== "GENEL" && institutionGroups[effectiveInstitution]?.length > 1 && (
            <div style={filterBox}>
              <label style={labelStyle}>Şube Seçin:</label>
              <select value={selectedSubBranch} onChange={(e) => setSelectedSubBranch(e.target.value)} style={selectStyle}>
                <option value="HEPSİ" style={optStyle}>Tüm Şubeler</option>
                {/* ✅ VIP isminin çiftlenmesini buradaki map ile engelliyoruz */}
                {institutionGroups[effectiveInstitution].map(sub => <option key={sub} value={sub} style={optStyle}>{sub}</option>)}
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
    <div style={{ background: "linear-gradient(145deg, var(--surface), var(--bg))", border: "1px solid var(--line)", borderRadius: "var(--r-lg)", padding: 25 }}>
      <div style={{ color: "var(--text-2)", fontSize: "0.75rem", fontWeight: 700, marginBottom: 20, letterSpacing: 1 }}>{title}</div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
        <span style={{ color: "var(--text-3)" }}>2025:</span>
        <span style={{ fontWeight: 600 }}>{format(prev)}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ color: "var(--accent)", fontWeight: 600 }}>2026:</span>
        <span style={{ fontWeight: 800, fontSize: "1.5rem" }}>{format(curr)}</span>
      </div>
      <div style={{ marginTop: 20, padding: "12px", borderRadius: "var(--r-md)", background: isUp ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)", color: isUp ? "var(--success)" : "var(--danger)", textAlign: "center", fontWeight: 700 }}>
        {isUp ? "▲" : "▼"} %{Math.abs(diff).toFixed(1)} {isUp ? "Gelişim" : "Düşüş"}
      </div>
    </div>
  );
}

const filterBox = { background: "var(--surface)", padding: "10px 15px", borderRadius: "var(--r-md)", border: "1px solid var(--line)", minWidth: "160px" };
const labelStyle = { fontSize: "0.7rem", color: "var(--text-2)", display: "block", marginBottom: 5, fontWeight: 700 };
const selectStyle = { background: "transparent", border: "none", color: "var(--text)", outline: "none", cursor: "pointer", fontSize: "0.9rem", width: "100%", colorScheme: "dark" };
const optStyle = { background: "var(--surface)", color: "var(--text)" };