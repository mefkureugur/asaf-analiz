import { useState, useEffect, useMemo } from "react";
import { collection, onSnapshot, query } from "firebase/firestore";
import { db } from "../../firebase";
import { useAuth } from "../../store/AuthContext";
import { School, Users, Search } from "lucide-react";

const normalize = (s: any): string => {
  if (!s) return "";
  return String(s).toLocaleLowerCase('tr-TR').trim()
    .replace(/ı/g, "i").replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ş/g, "s").replace(/ö/g, "o").replace(/ç/g, "c")
    .replace(/[^a-z0-9]/g, "");
};

// Mefkure kullanıcıları üç şubenin de okul sayılarını görür
const MEFKURE_KEYS = ["mefkureyks", "mefkurelgs"];
const MEFKURE_BRANCHES = ["Mefkure LGS", "Mefkure PLUS", "Mefkure VİP"];
const BRANCH_ORDER = ["LGS", "PLUS", "VİP"];
const BRANCH_COLORS: Record<string, string> = { "LGS": "#22c55e", "PLUS": "#8b5cf6", "VİP": "#eab308" };

export default function SchoolCounts() {
  const { user } = useAuth();
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const isAdmin = user?.role?.trim().toLowerCase() === 'admin' || user?.email === 'ugur@asaf.com';

  useEffect(() => {
    const q = query(collection(db, "records"));
    const unsub = onSnapshot(q, (snap) => {
      setRecords(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const { rows, totalStudents } = useMemo(() => {
    const userKey = normalize(user?.branchId);
    const isMefkureUser = MEFKURE_KEYS.includes(userKey);
    const allowedBranches = MEFKURE_BRANCHES.map(normalize);

    const groups: Record<string, { name: string; count: number; branches: Record<string, number> }> = {};

    records.forEach((r: any) => {
      if (r.source !== "manual") return;
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

  if (loading) return <div style={{ padding: 100, color: "white", textAlign: "center" }}>📡 Yükleniyor...</div>;

  return (
    <div style={{ padding: "15px", color: "white", maxWidth: "800px", margin: "0 auto" }}>
      <header style={{ marginBottom: "20px", borderLeft: "4px solid #38bdf8", paddingLeft: "15px" }}>
        <h2 style={{ fontSize: "1.3rem", fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}>
          <School size={22} color="#38bdf8" /> Okul Bazlı Öğrenci Sayıları
        </h2>
        <div style={{ fontSize: "0.8rem", color: "#94a3b8", marginTop: 4 }}>
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
        <Search size={16} color="#64748b" style={{ position: "absolute", left: 12, top: 13 }} />
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
          <div style={{ textAlign: "center", padding: "30px", color: "#64748b" }}>
            Henüz gittiği okul girilmiş kayıt bulunmuyor.
          </div>
        )}
      </div>
    </div>
  );
}

// STİLLER
const statCard = (color: string): React.CSSProperties => ({ background: "#0f172a", padding: "16px", borderRadius: "14px", border: `1px solid ${color}40`, borderLeft: `5px solid ${color}`, textAlign: "center" });
const statLabel: React.CSSProperties = { fontSize: "0.7rem", fontWeight: 700, color: "#94a3b8", marginBottom: 5 };
const statValue: React.CSSProperties = { fontSize: "1.8rem", fontWeight: 900 };
const searchInputStyle: React.CSSProperties = { width: "100%", padding: "12px", background: "#1e293b", border: "1px solid #334155", color: "white", borderRadius: "10px", fontSize: "1rem", outline: "none", boxSizing: "border-box" };
const rowStyle: React.CSSProperties = { background: "#111827", padding: "12px 15px", borderRadius: "12px", border: "1px solid #1f2937", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 };
const rankBadge = (idx: number): React.CSSProperties => ({
  width: 28, height: 28, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
  fontWeight: 800, fontSize: "0.8rem",
  background: idx === 0 ? "#eab30820" : idx === 1 ? "#94a3b820" : idx === 2 ? "#b4530920" : "#1e293b",
  color: idx === 0 ? "#eab308" : idx === 1 ? "#cbd5e1" : idx === 2 ? "#f97316" : "#64748b",
  border: `1px solid ${idx < 3 ? "transparent" : "#334155"}`,
});
const countBadge: React.CSSProperties = { display: "flex", alignItems: "center", gap: 6, background: "rgba(56, 189, 248, 0.1)", color: "#38bdf8", padding: "6px 12px", borderRadius: "8px", fontSize: "0.8rem", fontWeight: 700, whiteSpace: "nowrap" };
const branchChip = (label: string): React.CSSProperties => {
  const color = BRANCH_COLORS[label] || "#64748b";
  return { background: `${color}1a`, color, border: `1px solid ${color}40`, padding: "2px 8px", borderRadius: "6px", fontSize: "0.7rem", fontWeight: 700, whiteSpace: "nowrap" };
};
