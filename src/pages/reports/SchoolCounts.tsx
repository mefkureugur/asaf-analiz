import { useState, useMemo } from "react";
import { useAuth } from "../../store/AuthContext";
import { useRecords } from "../../hooks/useRecords";
import { School, Users, Search } from "lucide-react";

const normalize = (s: any): string => {
  if (!s) return "";
  return String(s).toLocaleLowerCase('tr-TR').trim()
    .replace(/ı/g, "i").replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ş/g, "s").replace(/ö/g, "o").replace(/ç/g, "c")
    .replace(/[^a-z0-9]/g, "");
};

// Her Mefkure müdürü YALNIZCA kendi şubesinin okul sayılarını görür.
// (Ana Sayfa'daki yetki mantığıyla aynı olacak şekilde daraltıldı.)
const MEFKURE_YETKI: Record<string, string[]> = {
  "mefkurelgs":  ["Mefkure LGS"],
  "mefkureyks":  ["Mefkure PLUS", "Mefkure VİP"],
  "mefkureplus": ["Mefkure PLUS"],
};
const BRANCH_ORDER = ["LGS", "PLUS", "VİP"];
// DİKKAT: bu değerler aşağıda `${color}40` gibi alfa eki alıyor.
// Alfa eki yalnızca hex ile çalışır — buraya var(--token) YAZILMAMALI.
const BRANCH_COLORS: Record<string, string> = { "LGS": "#22c55e", "PLUS": "#8b5cf6", "VİP": "#eab308" };

export default function SchoolCounts() {
  const { user } = useAuth();
  // Iptal edilen kayitlar sayima girmez
  const { records, loading } = useRecords();
  const [searchTerm, setSearchTerm] = useState("");

  const isAdmin = user?.role?.trim().toLowerCase() === 'admin' || user?.email === 'ugur@asaf.com';

  const { rows, totalStudents } = useMemo(() => {
    const userKey = normalize(user?.branchId);
    const kendiSubeleri = MEFKURE_YETKI[userKey] || [];
    const isMefkureUser = kendiSubeleri.length > 0;
    const allowedBranches = kendiSubeleri.map(normalize);

    const groups: Record<string, { name: string; count: number; branches: Record<string, number> }> = {};

    records.forEach((r: any) => {
      if (r.kaynak !== "manual") return;
      const okul = String(r.GittigiOkul || "").trim();
      if (!okul) return; // sadece gittiği okulu girilmiş Mefkure kayıtları

      // Yetki: admin hepsini; Mefkure kullanıcısı Mefkure şubelerini görür
      const branchNorm = normalize(r.Okul || "");
      const authorized = isAdmin || (isMefkureUser && allowedBranches.includes(branchNorm));
      if (!authorized) return;

      const key = normalize(okul);
      if (!groups[key]) groups[key] = { name: okul, count: 0, branches: {} };
      groups[key].count++;

      // Mefkure şubesini kısa etikete çevir: "Mefkure VİP" -> "VİP"
      const branchLabel = String(r.Okul || "").replace(/^mefkure\s*/i, "").trim() || "Diğer";
      groups[key].branches[branchLabel] = (groups[key].branches[branchLabel] || 0) + 1;
    });

    let list = Object.values(groups);
    if (searchTerm) {
      const q = normalize(searchTerm);
      list = list.filter(g => normalize(g.name).includes(q));
    }
    list.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "tr"));

    const total = Object.values(groups).reduce((acc, g) => acc + g.count, 0);
    return { rows: list, totalStudents: total };
  }, [records, user, isAdmin, searchTerm]);

  if (loading) return <div className="page" style={{ textAlign: "center", paddingTop: "var(--sp-7)", color: "var(--text-2)" }}>📡 Yükleniyor...</div>;

  return (
    <div className="page rise" style={{ maxWidth: 800 }}>
      <header style={{ marginBottom: "20px", borderLeft: "4px solid var(--accent)", paddingLeft: "15px" }}>
        <h2 style={{ fontSize: "1.3rem", fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}>
          <School size={22} color="var(--accent)" /> Okul Bazlı Öğrenci Sayıları
        </h2>
        <div style={{ fontSize: "0.8rem", color: "var(--text-2)", marginTop: 4 }}>
          Mefkure öğrencilerinin geldiği okullar — çoktan aza
        </div>
      </header>

      {/* Özet kartları */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 18 }}>
        <div style={statCard("#38bdf8")}>
          <div style={statLabel}>OKUL SAYISI</div>
          <div style={statValue}>{rows.length}</div>
        </div>
        <div style={statCard("#22c55e")}>
          <div style={statLabel}>TOPLAM ÖĞRENCİ</div>
          <div style={statValue}>{totalStudents}</div>
        </div>
      </div>

      {/* Arama */}
      <div style={{ position: "relative", marginBottom: 15 }}>
        <Search size={16} color="var(--text-3)" style={{ position: "absolute", left: 12, top: 13 }} />
        <input
          type="text"
          placeholder="Okul ara..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ ...searchInputStyle, paddingLeft: 36 }}
        />
      </div>

      <div style={{ display: "grid", gap: "8px" }}>
        {rows.map((row, idx) => {
          const orderedBranches = [
            ...BRANCH_ORDER.filter(b => row.branches[b]),
            ...Object.keys(row.branches).filter(b => !BRANCH_ORDER.includes(b)),
          ];
          return (
            <div key={row.name} style={rowStyle}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
                <div style={rankBadge(idx)}>{idx + 1}</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>{row.name}</div>
                  <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                    {orderedBranches.map(b => (
                      <span key={b} style={branchChip(b)}>{b}: {row.branches[b]}</span>
                    ))}
                  </div>
                </div>
              </div>
              <div style={countBadge}>
                <Users size={14} /> {row.count} öğrenci
              </div>
            </div>
          );
        })}
        {rows.length === 0 && (
          <div style={{ textAlign: "center", padding: "30px", color: "var(--text-3)" }}>
            Henüz gittiği okul girilmiş kayıt bulunmuyor.
          </div>
        )}
      </div>
    </div>
  );
}

// STİLLER
// `color` burada hex OLMALI: aşağıda `${color}40` şeklinde alfa eki alıyor.
const statCard = (color: string): React.CSSProperties => ({ background: "var(--surface)", padding: "16px", borderRadius: "var(--r-md)", border: `1px solid ${color}40`, borderLeft: `5px solid ${color}`, textAlign: "center" });
const statLabel: React.CSSProperties = { fontSize: "0.7rem", fontWeight: 700, color: "var(--text-2)", marginBottom: 5 };
const statValue: React.CSSProperties = { fontSize: "1.8rem", fontWeight: 900 };
const searchInputStyle: React.CSSProperties = { width: "100%", padding: "12px", background: "var(--line)", border: "1px solid var(--line-strong)", color: "white", borderRadius: "var(--r-md)", fontSize: "1rem", outline: "none", boxSizing: "border-box" };
const rowStyle: React.CSSProperties = { background: "var(--surface)", padding: "12px 15px", borderRadius: "var(--r-md)", border: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 };
const rankBadge = (idx: number): React.CSSProperties => ({
  width: 28, height: 28, borderRadius: "var(--r-sm)", display: "flex", alignItems: "center", justifyContent: "center",
  fontWeight: 800, fontSize: "0.8rem",
  background: idx === 0 ? "#eab30820" : idx === 1 ? "#94a3b820" : idx === 2 ? "#b4530920" : "var(--line)",
  color: idx === 0 ? "#eab308" : idx === 1 ? "#cbd5e1" : idx === 2 ? "#f97316" : "var(--text-3)",
  border: `1px solid ${idx < 3 ? "transparent" : "var(--line-strong)"}`,
});
const countBadge: React.CSSProperties = { display: "flex", alignItems: "center", gap: 6, background: "rgba(56, 189, 248, 0.1)", color: "var(--accent)", padding: "6px 12px", borderRadius: "var(--r-sm)", fontSize: "0.8rem", fontWeight: 700, whiteSpace: "nowrap" };
const branchChip = (label: string): React.CSSProperties => {
  const color = BRANCH_COLORS[label] || "#64748b";
  return { background: `${color}1a`, color, border: `1px solid ${color}40`, padding: "2px 8px", borderRadius: "var(--r-sm)", fontSize: "0.7rem", fontWeight: 700, whiteSpace: "nowrap" };
};
