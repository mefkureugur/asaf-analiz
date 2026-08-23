import { useState, useMemo, useEffect } from "react";
import { collection, onSnapshot, query } from "firebase/firestore";
import { db } from "../../firebase"; 
import { useAuth } from "../../store/AuthContext";
import asafRecordsRaw from "../../data/excel2json-1769487741734.json"; 

const strictNormalize = (s: any): string => {
  if (!s) return "";
  return String(s).toLocaleLowerCase('tr-TR').trim()
    .replace(/ı/g, "i").replace(/ğ/g, "g").replace(/ü/g, "u")
    .replace(/ş/g, "s").replace(/ö/g, "o").replace(/ç/g, "c")
    .replace(/[^a-z0-9]/g, ""); 
};

export default function RegistrationAnalysis() {
  const { user } = useAuth();
  const [firebaseRecords, setFirebaseRecords] = useState<any[]>([]);

  const institutionGroups: Record<string, string[]> = {
    "Mefkure LGS": ["Mefkure LGS"],
    "Mefkure Plus": ["Mefkure Plus"],
    "Mefkure Vip": ["Mefkure VIP", "MEFKURE Vip"],
    "Altınküre İlköğretim": ["Altınküre İlkokul", "Altınküre Ortaokul", "Altınküre Anaokulu"],
    "Altınküre Lise": ["Altınküre Fen Lisesi", "Altınküre Anadolu Lisesi", "Altınküre Akademi"],
    "Altınküre Teknokent": ["Altınküre Teknokent"]
  };

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, "records")), (snap) => {
      setFirebaseRecords(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  const stats = useMemo(() => {
    const jsonRecords = Array.isArray(asafRecordsRaw) ? asafRecordsRaw : [];
    const combined = [...jsonRecords, ...firebaseRecords];
    
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
  }, [firebaseRecords, asafRecordsRaw]);

  return (
    <div style={{ padding: "15px", color: "white", maxWidth: "1000px", margin: "0 auto", fontFamily: "sans-serif" }}>
      <header style={{ marginBottom: "20px", borderLeft: "4px solid var(--accent)", paddingLeft: "15px" }}>
        <h2 style={{ fontSize: "1.3rem", fontWeight: 800 }}>🧑‍🎓 Kayıt Analizi (Sistem Otomatik)</h2>
        <p style={{ color: "#64748b", fontSize: "0.8rem" }}>{stats.poolSize} eski öğrenci üzerinden eşleştirme yapıldı.</p>
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
    <div style={{ background: "#111827", borderRadius: "16px", padding: "18px", border: "1px solid #1f2937" }}>
      <div style={{ fontSize: "0.9rem", fontWeight: 800, marginBottom: "15px", color: "#f8fafc" }}>{title}</div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
        <span style={{ color: "#22c55e", fontSize: "0.8rem", fontWeight: 700 }}>🟢 YENİ KAYIT</span>
        <div style={{ textAlign: "right" }}>
          <span style={{ fontWeight: 800, fontSize: "1rem" }}>{data?.yeni || 0}</span>
          <span style={{ color: "#64748b", fontSize: "0.7rem", marginLeft: "5px" }}>(%{newRatio})</span>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px" }}>
        <span style={{ color: "#38bdf8", fontSize: "0.8rem", fontWeight: 700 }}>🔵 YENİLEME</span>
        <span style={{ fontWeight: 800, fontSize: "1rem" }}>{data?.yenileme || 0}</span>
      </div>
      <div style={{ borderTop: "1px solid var(--line)", paddingTop: "10px", display: "flex", justifyContent: "flex-end", alignItems: "center" }}>
        <div style={{ fontSize: "1.1rem", fontWeight: 900 }}>{data?.total || 0}</div>
      </div>
    </div>
  );
}