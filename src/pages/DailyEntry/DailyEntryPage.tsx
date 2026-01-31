import { useState, useEffect, useMemo } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase";
import { useAuth } from "../../store/AuthContext";

// Sabitler aynı kalıyor...
const CLASS_OPTIONS: { [key: string]: string[] } = {
  "İlköğretim": ["Ana Sınıfı", "1", "2", "3", "4", "5", "6", "7", "8"],
  "LGS": ["5", "6", "7", "8"],
  "Lise": ["9", "10", "11", "12", "Mezun", "Akademi"],
  "YKS": ["9", "10", "11", "12", "Mezun", "MOOD"],
  "Teknokent": ["9", "10", "11", "12"]
};

const BRANCH_TO_GROUP: { [key: string]: string } = {
  "Altınküre Anaokulu": "İlköğretim", "Altınküre İlkokul": "İlköğretim", "Altınküre Ortaokul": "İlköğretim",
  "Altınküre Fen Lisesi": "Lise", "AltınKüre Anadolu Lisesi": "Lise", "Altınküre Akademi": "Lise",
  "Altınküre Teknokent": "Teknokent", "Mefkure LGS": "LGS", "Mefkure PLUS": "YKS", "Mefkure VİP": "YKS"
};

const BRANCH_MAPPING: { [key: string]: string[] } = {
  "Mefkure LGS": ["Mefkure LGS"], "Mefkure YKS": ["Mefkure PLUS", "Mefkure VİP"],
  "Altınküre İlköğretim": ["Altınküre İlkokul", "Altınküre Ortaokul", "Altınküre Anaokulu"],
  "Altınküre Lise": ["Altınküre Fen Lisesi", "AltınKüre Anadolu Lisesi", "Altınküre Akademi"],
  "Altınküre Teknokent": ["Altınküre Teknokent"]
};

const ALL_SUB_BRANCHES = Object.values(BRANCH_MAPPING).flat();

export default function DailyEntryPage() {
  const { user } = useAuth();
  const today = new Date().toISOString().slice(0, 10);

  const [date, setDate] = useState(today);
  const [studentName, setStudentName] = useState("");
  const [classType, setClassType] = useState("");
  const [branch, setBranch] = useState("");
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);

  const isAdmin = user?.role === 'admin' || user?.email === 'ugur@asaf.com';

  const availableBranches = useMemo(() => {
    return isAdmin ? ALL_SUB_BRANCHES : (BRANCH_MAPPING[user?.branchId || ""] || []);
  }, [isAdmin, user]);

  const availableClasses = useMemo(() => {
    if (!branch) return [];
    const groupKey = BRANCH_TO_GROUP[branch];
    return CLASS_OPTIONS[groupKey] || [];
  }, [branch]);

  useEffect(() => {
    if (!isAdmin && availableBranches.length === 1) {
      setBranch(availableBranches[0]);
    }
  }, [availableBranches, isAdmin]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Eksik alan kontrolü
    if (!studentName || !classType || !branch || !amount) {
      alert("Lütfen tüm alanları eksiksiz doldurun.");
      return;
    }

    try {
      setSaving(true);
      console.log("Kayıt veritabanına gönderiliyor...");

      const formattedDate = date.split('-').reverse().join('.');
      
      const payload = {
        studentName: studentName.trim(),
        Sınıf: classType,
        Okul: branch,
        SonTutar: Number(amount),
        SözleşmeTarihi: formattedDate,
        source: "manual", // StudentList'te görünmesi için kritik
        createdAt: serverTimestamp(),
        addedBy: user?.email || "unknown",
        addedByName: user?.displayName || "Bilinmeyen"
      };

      const docRef = await addDoc(collection(db, "records"), payload);
      console.log("Kayıt Başarılı! ID:", docRef.id);

      alert("Kayıt mermi gibi eklendi!");
      setStudentName("");
      setAmount("");
      setClassType("");
      if (isAdmin || availableBranches.length > 1) setBranch("");
      
    } catch (err: any) {
      console.error("Firebase Hatası Detayı:", err);
      alert("Kayıt sırasında bir hata oluştu: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: 24, color: "white", maxWidth: 520, margin: "0 auto" }}>
      <h2 style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>✍️ Kayıt Girişi</h2>
      
      <div style={infoBoxStyle}>
        Kullanıcı: <span style={{color: "#38bdf8"}}>{user?.displayName}</span> 
        {!isAdmin && <span> | Grup: <span style={{color: "#22c55e"}}>{user?.branchId}</span></span>}
      </div>

      <form onSubmit={handleSubmit} style={formContainerStyle}>
        <label style={labelStyle}>Sözleşme Tarihi
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inputStyle} />
        </label>

        <label style={labelStyle}>Öğrenci Adı Soyadı
          <input value={studentName} onChange={(e) => setStudentName(e.target.value)} placeholder="Ad Soyad" style={inputStyle} />
        </label>

        <label style={labelStyle}>Kurum / Şube
          <select value={branch} onChange={(e) => { setBranch(e.target.value); setClassType(""); }} style={inputStyle}>
            <option value="">{availableBranches.length > 1 ? "Şube Seçiniz" : "Şube Atandı"}</option>
            {availableBranches.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </label>

        <label style={labelStyle}>Sınıf Kademesi
          <select value={classType} onChange={(e) => setClassType(e.target.value)} disabled={!branch} style={{...inputStyle, opacity: !branch ? 0.5 : 1}}>
            <option value="">{!branch ? "Önce Şube Seçin" : "Sınıf Seçiniz"}</option>
            {availableClasses.map((c) => <option key={c} value={c}>{c === "Ana Sınıfı" || isNaN(Number(c)) ? c : `${c}. Sınıf`}</option>)}
          </select>
        </label>

        <label style={labelStyle}>Tutar (₺)
          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Tutar girin" style={inputStyle} />
        </label>

        <button type="submit" disabled={saving} style={{ ...buttonStyle, background: saving ? "#1e40af" : "#22c55e" }}>
          {saving ? "Kaydediliyor..." : "Kaydı Onayla"}
        </button>
      </form>
    </div>
  );
}

// Stil Nesneleri
const infoBoxStyle: React.CSSProperties = { background: "rgba(30, 41, 59, 0.5)", padding: "10px 15px", borderRadius: "8px", marginBottom: "15px", fontSize: "0.85rem", border: "1px solid #1e293b" };
// 🛠️ DÜZELTİLEN KISIM: 'shadow' yerine 'boxShadow' kullanıldı
const formContainerStyle: React.CSSProperties = { display: "grid", gap: 16, background: "#0f172a", padding: 20, borderRadius: 12, border: "1px solid #1e293b", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" };
const labelStyle: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 4, fontSize: "0.9rem", color: "#94a3b8" };
const inputStyle: React.CSSProperties = { width: "100%", padding: "10px 12px", background: "#020617", border: "1px solid #334155", borderRadius: 8, color: "white", fontSize: "1rem", outline: "none" };
const buttonStyle: React.CSSProperties = { marginTop: 10, padding: "12px", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600 };