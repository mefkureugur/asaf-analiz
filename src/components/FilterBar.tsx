import React, { useMemo } from "react";

const ALL_BRANCHES = [
  "Mefkure LGS", "MEFKURE Vip", "Mefkure Plus", "Altınküre İlkokul", 
  "Altınküre Ortaokul", "Altınküre Anaokulu", "Altınküre Fen Lisesi", 
  "Altınküre Anadolu Lisesi", "Altınküre Akademi", "Altınküre Teknokent"
];

type Props = {
  branch: string; setBranch: (b: string) => void;
  classTypes: string[]; setClassTypes: React.Dispatch<React.SetStateAction<string[]>>;
  allowedBranches: string[] | null; 
};

export default function FilterBar({ branch, setBranch, classTypes, setClassTypes, allowedBranches }: Props) {
  
  // 🛡️ Yetkili Şubeler (Dropdown listesi)
  const visibleBranches = useMemo(() => {
    if (!allowedBranches) return ALL_BRANCHES;
    const normalizedAllowed = allowedBranches.map(b => b.toLowerCase().trim());
    return ALL_BRANCHES.filter(b => normalizedAllowed.includes(b.toLowerCase().trim()));
  }, [allowedBranches]);

  // 🚀 KESİN SINIF FİLTRESİ (Yetkiye Göre Kilitleme)
  const filteredClasses = useMemo(() => {
    // 1. Kullanıcının ana yetki grubunu bul (admin değilse)
    // allowedBranches null ise admin'dir, her şeyi görür.
    if (!allowedBranches) {
      return ["Ana Sınıfı", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "Mezun", "Akademi", "MOOD"];
    }

    // Yetki metnini tek bir string yapıp içinde anahtar kelime arıyoruz
    const totalPower = allowedBranches.join(" ").toLowerCase();

    // 🟢 ALTINKÜRE İLKÖĞRETİM YETKİSİ
    if (totalPower.includes("ilkokul") || totalPower.includes("ortaokul") || totalPower.includes("ilköğretim")) {
      return ["Ana Sınıfı", "1", "2", "3", "4", "5", "6", "7", "8"];
    }
    
    // 🔵 ALTINKÜRE LİSE YETKİSİ (Hakan Bey Burası)
    if (totalPower.includes("lise") || totalPower.includes("fen lisesi") || totalPower.includes("anadolu lisesi")) {
      return ["9", "10", "11", "12", "Mezun", "Akademi"];
    }

    // 🔴 MEFKURE YKS / VIP / PLUS YETKİSİ
    if (totalPower.includes("vip") || totalPower.includes("plus")) {
      return ["9", "10", "11", "12", "Mezun", "MOOD"];
    }

    // 🟠 MEFKURE LGS YETKİSİ
    if (totalPower.includes("lgs")) {
      return ["5", "6", "7", "8"];
    }

    // 🟣 TEKNOKENT YETKİSİ
    if (totalPower.includes("teknokent")) {
      return ["9", "10", "11", "12"];
    }

    return ["9", "10", "11", "12", "Mezun", "Akademi", "MOOD"]; // Default lise (güvenlik için)
  }, [allowedBranches]);

  const toggleClass = (c: string) => {
    setClassTypes(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
  };

  return (
    <div style={{ display: "flex", gap: 10, flex: 1 }}>
      <select value={branch} onChange={(e) => { setBranch(e.target.value); setClassTypes([]); }} style={sel}>
        <option value="">{allowedBranches ? "Tüm Yetkili Şubeler" : "Tüm Kurumlar"}</option>
        {visibleBranches.map((b) => (
          <option key={b} value={b}>{b}</option>
        ))}
      </select>

      <details style={det}>
        <summary style={{ cursor: "pointer", fontSize: "0.85rem", color: "#f8fafc" }}>
          Sınıf {classTypes.length > 0 && `(${classTypes.length})`}
        </summary>
        <div style={drop}>
          {filteredClasses.map((c) => (
            <label key={c} style={row}>
              <input type="checkbox" checked={classTypes.includes(c)} onChange={() => toggleClass(c)} />
              <span style={{ whiteSpace: 'nowrap' }}>{isNaN(Number(c)) ? c : `${c}. Sınıf`}</span>
            </label>
          ))}
        </div>
      </details>
    </div>
  );
}

const sel = { background: "#020617", border: "1px solid #1e293b", color: "white", padding: "8px 12px", borderRadius: 8, cursor: "pointer", fontSize: "0.85rem", flex: 1 };
const det = { background: "#020617", border: "1px solid #1e293b", borderRadius: 8, padding: "8px 12px", position: "relative" as const, minWidth: "140px" };
const drop = { position: "absolute" as const, top: "110%", left: 0, background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8, padding: 12, width: 240, zIndex: 100, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, boxShadow: "0 10px 20px rgba(0,0,0,0.5)" };
const row = { display: "flex", gap: 8, alignItems: "center", color: "#94a3b8", fontSize: "0.8rem", cursor: "pointer" };