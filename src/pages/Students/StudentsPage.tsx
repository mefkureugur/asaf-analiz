import { useMemo } from "react";
import { useAuth } from "../../store/AuthContext";
import { useRecords } from "../../hooks/useRecords";

const strictNormalize = (s: any): string => {
  if (!s) return "";
  return String(s).toLocaleLowerCase('tr-TR').trim()
    .replace(/ı/g, "i").replace(/ğ/g, "g").replace(/ü/g, "u")
    .replace(/ş/g, "s").replace(/ö/g, "o").replace(/ç/g, "c")
    .replace(/[^a-z0-9]/g, ""); 
};

export default function RegistrationAnalysis() {
  const { user } = useAuth();
  // Iptal edilen kayitlar bu listeye gelmez
  const { records: allRecords } = useRecords();

  const institutionGroups: Record<string, string[]> = {
    "Mefkure LGS": ["Mefkure LGS"],
    "Mefkure Plus": ["Mefkure Plus"],
    "Mefkure Vip": ["Mefkure VIP", "MEFKURE Vip"],
    "Altınküre İlköğretim": ["Altınküre İlkokul", "Altınküre Ortaokul", "Altınküre Anaokulu"],
    "Altınküre Lise": ["Altınküre Fen Lisesi", "Altınküre Anadolu Lisesi", "Altınküre Akademi"],
    "Altınküre Teknokent": ["Altınküre Teknokent"]
  };

  const stats = useMemo(() => {
    const combined = allRecords;
    
    const pool2025 = new Set();
    combined.forEach(r => {
      const dateVal = String(r.SözleşmeTarihi || r.contractDate || r["Sözleşme Tarihi"] || "");
      if (dateVal.includes("2025")) {
        const name = r.ÖğrenciAdSoyad || r.studentName || r["Ad Soyad"] || r["Öğrenci Ad Soyad"];
        if (name) pool2025.add(strictNormalize(name));
      }
    });

    const results: any = {};
    Object.entries(institutionGroups).forEach(([instName, branches]) => {
      const normBranches = branches.map(b => strictNormalize(b));
      const recs2026 = combined.filter(r => {
        const dateVal = String(r.SözleşmeTarihi || r.contractDate || r["Sözleşme Tarihi"] || "");
        const branchVal = strictNormalize(r.Okul || r.branch || r.subeAd);
        return dateVal.includes("2026") && normBranches.some(nb => branchVal.includes(nb));
      });

      let yeni = 0; let yenileme = 0;
      recs2026.forEach(r => {
        const name = r.ÖğrenciAdSoyad || r.studentName || r["Ad Soyad"] || r["Öğrenci Ad Soyad"];
        const nameKey = strictNormalize(name);
        if (nameKey && pool2025.has(nameKey)) yenileme++;
        else yeni++;
      });
      results[instName] = { yeni, yenileme, total: yeni + yenileme };
    });

    return { results, poolSize: pool2025.size };
  }, [allRecords]);

  return (
    <div className="page rise" style={{ maxWidth: 1000 }}>
      <header style={{ marginBottom: "20px", borderLeft: "4px solid var(--accent)", paddingLeft: "15px" }}>
        <h2 style={{ fontSize: "1.3rem", fontWeight: 800 }}>🧑‍🎓 Kayıt Analizi (Sistem Otomatik)</h2>
        <p style={{ color: "var(--text-3)", fontSize: "0.8rem" }}>{stats.poolSize} eski öğrenci üzerinden eşleştirme yapıldı.</p>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "15px" }}>
        {Object.keys(institutionGroups).map(inst => (
          <AnalysisCard key={inst} title={inst} data={stats.results[inst]} />
        ))}
      </div>
    </div>
  );
}

function AnalysisCard({ title, data }: any) {
  // ✅ Yeni Kayıt Oranı Hesaplama
  const newRatio = data?.total > 0 ? Math.round((data.yeni / data.total) * 100) : 0;

  return (
    <div style={{ background: "var(--surface)", borderRadius: "var(--r-lg)", padding: "18px", border: "1px solid var(--line)" }}>
      <div style={{ fontSize: "0.9rem", fontWeight: 800, marginBottom: "15px", color: "var(--text)" }}>{title}</div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
        <span style={{ color: "var(--success)", fontSize: "0.8rem", fontWeight: 700 }}>🟢 YENİ KAYIT</span>
        <div style={{ textAlign: "right" }}>
          <span style={{ fontWeight: 800, fontSize: "1rem" }}>{data?.yeni || 0}</span>
          <span style={{ color: "var(--text-3)", fontSize: "0.7rem", marginLeft: "5px" }}>(%{newRatio})</span>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px" }}>
        <span style={{ color: "var(--accent)", fontSize: "0.8rem", fontWeight: 700 }}>🔵 YENİLEME</span>
        <span style={{ fontWeight: 800, fontSize: "1rem" }}>{data?.yenileme || 0}</span>
      </div>
      <div style={{ borderTop: "1px solid var(--line)", paddingTop: "10px", display: "flex", justifyContent: "flex-end", alignItems: "center" }}>
        <div style={{ fontSize: "1.1rem", fontWeight: 900 }}>{data?.total || 0}</div>
      </div>
    </div>
  );
}