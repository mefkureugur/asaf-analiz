import { useState, useEffect, useMemo } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase";
import { useAuth } from "../../store/AuthContext";
import confetti from 'canvas-confetti';
import Swal from 'sweetalert2'; // 🚀 Modern uyarı motoru eklendi

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
  const [studentSchool, setStudentSchool] = useState(""); // 🏫 Sadece Mefkure: gittiği okul
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

  // 🏫 Sadece Mefkure şubelerinde "Gittiği Okul" alanı gösterilir
  const isMefkure = useMemo(() => branch.toLocaleLowerCase('tr-TR').includes("mefkure"), [branch]);

  useEffect(() => {
    if (!isAdmin && availableBranches.length === 1) {
      setBranch(availableBranches[0]);
    }
  }, [availableBranches, isAdmin]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!studentName || !classType || !branch || !amount) {
      Swal.fire({
        icon: 'warning',
        title: 'Eksik Alan!',
        text: 'Lütfen tüm alanları doldurun.',
        background: 'var(--surface)',
        color: '#fff',
        confirmButtonColor: 'var(--accent)'
      });
      return;
    }

    try {
      setSaving(true);
      const formattedDate = date.split('-').reverse().join('.');
      
      const payload = {
        studentName: studentName.trim(),
        Sınıf: classType,
        Okul: branch,
        SonTutar: Number(amount),
        SözleşmeTarihi: formattedDate,
        source: "manual",
        createdAt: serverTimestamp(),
        addedBy: user?.email || "unknown",
        addedByName: user?.displayName || "Bilinmeyen",
        // 🏫 Sadece Mefkure ve doluysa ekle (Firestore undefined hatası olmasın diye koşullu)
        ...(isMefkure && studentSchool.trim() ? { GittigiOkul: studentSchool.trim() } : {})
      };

      await addDoc(collection(db, "records"), payload);

      // 🎆 EFEKTLERİ TETİKLE (Pencereyi beklemeden başlar)
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        zIndex: 9999,
        colors: ['var(--accent)', 'var(--success)', '#ffffff']
      });

      const audio = new Audio('/sounds/alkis.mp3');
      audio.volume = 0.5;
      audio.play().catch(e => console.warn("Ses engellendi:", e));

      // 📱 MODERN UYARI PENCERESİ
      Swal.fire({
        title: 'Kayıt Başarılı!',
        text: 'Kayıt mermi gibi eklendi! 🚀',
        icon: 'success',
        background: 'var(--surface)',
        color: '#ffffff',
        confirmButtonColor: 'var(--success)',
        confirmButtonText: 'Tamam',
        timer: 3500, // 3.5 saniye sonra kendi kapanır
        timerProgressBar: true
      });

      setStudentName("");
      setAmount("");
      setClassType("");
      setStudentSchool("");
      if (isAdmin || availableBranches.length > 1) setBranch("");
      
    } catch (err: any) {
      Swal.fire({
        icon: 'error',
        title: 'Hata!',
        text: 'Kayıt sırasında bir hata oluştu: ' + err.message,
        background: 'var(--surface)',
        color: '#ffffff'
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page rise" style={{ maxWidth: 520 }}>
      <h2 style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>✍️ Kayıt Girişi</h2>
      
      <div style={infoBoxStyle}>
        Kullanıcı: <span style={{color: "var(--accent)"}}>{user?.displayName}</span> 
        {!isAdmin && <span> | Grup: <span style={{color: "var(--success)"}}>{user?.branchId}</span></span>}
      </div>

      <form onSubmit={handleSubmit} style={formContainerStyle}>
        <label style={labelStyle}>Sözleşme Tarihi
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inputStyle} />
        </label>

        <label style={labelStyle}>Öğrenci Adı Soyadı
          <input value={studentName} onChange={(e) => setStudentName(e.target.value)} placeholder="Ad Soyad" style={inputStyle} />
        </label>

        <label style={labelStyle}>Kurum / Şube
          <select value={branch} onChange={(e) => { setBranch(e.target.value); setClassType(""); setStudentSchool(""); }} style={inputStyle}>
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

        {isMefkure && (
          <label style={labelStyle}>Gittiği Okul <span style={{ color: "var(--text-3)", fontWeight: 400 }}>(opsiyonel)</span>
            <input value={studentSchool} onChange={(e) => setStudentSchool(e.target.value)} placeholder="Öğrencinin gittiği okul" style={inputStyle} />
          </label>
        )}

        <label style={labelStyle}>Tutar (₺)
          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Tutar girin" style={inputStyle} />
        </label>

        <button type="submit" disabled={saving} style={{ ...buttonStyle, background: saving ? "var(--text-3)" : "var(--success)" }}>
          {saving ? "Kaydediliyor..." : "Kaydı Onayla"}
        </button>
      </form>
    </div>
  );
}

// Stil Nesneleri
const infoBoxStyle: React.CSSProperties = { background: "rgba(30, 41, 59, 0.5)", padding: "10px 15px", borderRadius: "var(--r-sm)", marginBottom: "15px", fontSize: "0.85rem", border: "1px solid var(--line)" };
const formContainerStyle: React.CSSProperties = { display: "grid", gap: 16, background: "var(--surface)", padding: 20, borderRadius: "var(--r-md)", border: "1px solid var(--line)", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" };
const labelStyle: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 4, fontSize: "0.9rem", color: "var(--text-2)" };
const inputStyle: React.CSSProperties = { width: "100%", padding: "10px 12px", background: "var(--bg)", border: "1px solid var(--line-strong)", borderRadius: "var(--r-sm)", color: "var(--text)", fontSize: "1rem", outline: "none" };
// Renkli zemin uzerinde: metin iki temada da beyaz
const buttonStyle: React.CSSProperties = { marginTop: 10, padding: "12px", color: "#ffffff", border: "none", borderRadius: "var(--r-sm)", cursor: "pointer", fontWeight: 600 };