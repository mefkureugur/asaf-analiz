import { useState, useEffect, useMemo } from "react";
import { collection, onSnapshot, query, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "../../firebase"; 
import { useAuth } from "../../store/AuthContext";

const normalize = (s: any): string => {
  if (!s) return "";
  return String(s).toLocaleLowerCase('tr-TR').trim()
    .replace(/ı/g, "i").replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ş/g, "s").replace(/ö/g, "o").replace(/ç/g, "c")
    .replace(/[^a-z0-9]/g, ""); 
};

export default function StudentList() {
  const { user } = useAuth();
  const [firebaseRecords, setFirebaseRecords] = useState<any[]>([]);
  const [editingStudent, setEditingStudent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState(""); // 🔍 Arama state'i

  // 🎯 Hafızadaki Tam Yetki ve Sınıf Yapısı
  const hierarchy: any = {
    "mefkureyks": {
      branches: ["Mefkure PLUS", "Mefkure VIP"],
      grades: ["11", "12", "Mezun", "Mood"]
    },
    "mefkurelgs": {
      branches: ["Mefkure LGS"],
      grades: ["5", "6", "7", "8"]
    },
    "altinkureilkogretim": {
      branches: ["Altınküre Anaokulu", "Altınküre İlkokul", "Altınküre Ortaokul"],
      grades: ["Ana Sınıfı", "1", "2", "3", "4", "5", "6", "7", "8"]
    },
    "altinkurelise": {
      branches: ["Altınküre Fen Lisesi", "Altınküre Anadolu Lisesi", "Altınküre Akademi"],
      grades: ["9", "10", "11", "12", "Mezun", "Akademi"]
    },
    "altinkureteknokent": {
      branches: ["Altınküre Teknokent"],
      grades: ["9", "10", "11", "12"]
    }
  };

  const userBranchKey = user?.branchId ? normalize(user.branchId) : "";
  const userSettings = hierarchy[userBranchKey] || { branches: [], grades: [] };

  useEffect(() => {
    const q = query(collection(db, "records"));
    const unsub = onSnapshot(q, (snap) => {
      setFirebaseRecords(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // 🛡️ SIRALAMA VE FİLTRELEME MOTORU
  const filteredList = useMemo(() => {
    let list = firebaseRecords.filter(r => {
      // Sadece manuel kayıtlar
      if (r.source !== "manual") return false;
      
      // Yetki Kontrolü
      const isAuthorized = user?.role?.toLowerCase() === 'admin' || 
                          userSettings.branches.some((mb: string) => normalize(mb) === normalize(r.Okul || ""));
      
      if (!isAuthorized) return false;

      // 🔍 Arama Filtresi
      if (searchTerm) {
        return normalize(r.studentName).includes(normalize(searchTerm));
      }

      return true;
    });

    // 🚀 SIRALAMA: En yeni eklenenden eskiye doğru
    return list.sort((a, b) => {
      const dateA = new Date(a.SözleşmeTarihi?.split('.').reverse().join('-')).getTime() || 0;
      const dateB = new Date(b.SözleşmeTarihi?.split('.').reverse().join('-')).getTime() || 0;
      return dateB - dateA; 
    });
  }, [firebaseRecords, user, userSettings, searchTerm]);

  const handleUpdate = async (e: any) => {
    e.preventDefault();
    try {
      const ref = doc(db, "records", editingStudent.id);
      await updateDoc(ref, { 
        studentName: editingStudent.studentName,
        SözleşmeTarihi: editingStudent.SözleşmeTarihi,
        Okul: editingStudent.Okul,
        Sınıf: editingStudent.Sınıf,
        SonTutar: Number(editingStudent.SonTutar)
      });
      setEditingStudent(null);
      alert("Kayıt başarıyla güncellendi!");
    } catch (err) {
      alert("Hata oluştu.");
    }
  };

  if (loading) return <div style={{ padding: 100, color: "white", textAlign: "center" }}>📡 Yükleniyor...</div>;

  return (
    <div style={{ padding: "15px", color: "white", maxWidth: "800px", margin: "0 auto" }}>
      <header style={{ marginBottom: "20px", borderLeft: "4px solid #38bdf8", paddingLeft: "15px" }}>
        <h2 style={{ fontSize: "1.3rem", fontWeight: 800 }}>✍️ Manüel Kayıt Yönetimi</h2>
      </header>

      {/* 🔍 ARAMA INPUTU */}
      <div style={{ marginBottom: "15px" }}>
        <input
          type="text"
          placeholder="Öğrenci adı ile ara..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={searchInputStyle}
        />
      </div>
      
      <div style={{ display: "grid", gap: "10px" }}>
        {filteredList.map((s) => (
          <div key={s.id} style={cardStyle}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ fontWeight: 700 }}>{s.studentName}</div>
                <span style={dateBadge}>{s.SözleşmeTarihi}</span>
              </div>
              <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "4px" }}>
                📍 {s.Okul} | 🎓 Sınıf: {s.Sınıf} | 💰 {s.SonTutar?.toLocaleString("tr-TR")} TL
              </div>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={() => setEditingStudent(s)} style={btnEdit}>Düzenle</button>
              <button onClick={() => { if(window.confirm("Siliyorum?")) deleteDoc(doc(db, "records", s.id))}} style={btnDel}>Sil</button>
            </div>
          </div>
        ))}
        {filteredList.length === 0 && (
          <div style={{ textAlign: "center", padding: "20px", color: "#64748b" }}>Kayıt bulunamadı.</div>
        )}
      </div>

      {editingStudent && (
        <div style={modalOverlay}>
          <div style={modalContent}>
            <h3 style={{ color: "#38bdf8", marginBottom: "20px" }}>Kaydı Düzenle</h3>
            
            <label style={labelStyle}>Öğrenci Adı</label>
            <input style={inputStyle} value={editingStudent.studentName || ""} onChange={e => setEditingStudent({...editingStudent, studentName: e.target.value})} />
            
            <div style={{ display: "flex", gap: "10px" }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Okul / Şube</label>
                <select 
                  style={inputStyle} 
                  value={editingStudent.Okul || ""} 
                  onChange={e => setEditingStudent({...editingStudent, Okul: e.target.value})}
                >
                  <option value="">Seçiniz...</option>
                  {userSettings.branches.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>
              <div style={{ width: "110px" }}>
                <label style={labelStyle}>Sınıf</label>
                <select 
                  style={inputStyle} 
                  value={editingStudent.Sınıf || ""} 
                  onChange={e => setEditingStudent({...editingStudent, Sınıf: e.target.value})}
                >
                  <option value="">Seç...</option>
                  {userSettings.grades.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Sözleşme Tarihi</label>
                <input type="date" style={inputStyle} value={editingStudent.SözleşmeTarihi || ""} onChange={e => setEditingStudent({...editingStudent, SözleşmeTarihi: e.target.value})} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Tutar (TL)</label>
                <input type="number" style={inputStyle} value={editingStudent.SonTutar || ""} onChange={e => setEditingStudent({...editingStudent, SonTutar: e.target.value})} />
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: "10px" }}>
              <button onClick={handleUpdate} style={saveBtn}>Kaydet</button>
              <button onClick={() => setEditingStudent(null)} style={cancelBtn}>Kapat</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// STİLLER
const searchInputStyle: any = { width: "100%", padding: "12px", background: "#1e293b", border: "1px solid #334155", color: "white", borderRadius: "10px", fontSize: "1rem", outline: "none", boxSizing: "border-box" };
const cardStyle: any = { background: "#111827", padding: "15px", borderRadius: "12px", border: "1px solid #1f2937", display: "flex", alignItems: "center", gap: "10px" };
const dateBadge: any = { background: "rgba(56, 189, 248, 0.1)", color: "#38bdf8", padding: "2px 8px", borderRadius: "6px", fontSize: "0.65rem", fontWeight: 700 };
const btnEdit: any = { background: "#3b82f6", color: "white", border: "none", padding: "8px 14px", borderRadius: "8px", cursor: "pointer", fontWeight: 600 };
const btnDel: any = { background: "rgba(239, 68, 68, 0.1)", color: "#ef4444", border: "1px solid #ef4444", padding: "8px 14px", borderRadius: "8px", cursor: "pointer" };
const modalOverlay: any = { position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(2, 6, 23, 0.95)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000, backdropFilter: "blur(4px)" };
const modalContent: any = { background: "#0f172a", padding: "25px", borderRadius: "20px", width: "95%", maxWidth: "450px", border: "1px solid #1e293b" };
const inputStyle: any = { width: "100%", padding: "12px", background: "#1e293b", border: "1px solid #334155", color: "white", borderRadius: "10px", marginBottom: "12px", boxSizing: "border-box" };
const labelStyle: any = { fontSize: "0.7rem", color: "#64748b", marginBottom: "5px", display: "block" };
const saveBtn: any = { flex: 1, background: "#22c55e", color: "white", border: "none", padding: "14px", borderRadius: "10px", fontWeight: 700 };
const cancelBtn: any = { flex: 1, background: "#334155", color: "white", border: "none", padding: "14px", borderRadius: "10px" };