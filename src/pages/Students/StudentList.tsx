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

// 📅 Tarih formatı dönüşümleri.
// DEPOLAMA standardı: GG.AA.YYYY (örn. 09.06.2026) — tüm raporlar bunu bekler (".2026" filtresi vb.)
// <input type="date"> ise YYYY-AA-GG (ISO) ister. Bu ikisini güvenle çeviriyoruz.
const toInputDate = (s: string): string => {
  if (!s) return "";
  if (s.includes(".")) { const [d, m, y] = s.split("."); return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`; }
  return s; // zaten ISO
};
const toStoredDate = (s: string): string => {
  if (!s) return "";
  if (s.includes("-")) { const [y, m, d] = s.split("-"); return `${d.padStart(2, "0")}.${m.padStart(2, "0")}.${y}`; }
  return s; // zaten GG.AA.YYYY
};

// 🎯 Hafızadaki Tam Yetki ve Sınıf Yapısı (Bileşen dışına taşındı)
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

// 🤝 ORTAK MEFKURE GRUBU: LGS + PLUS + VİP tek listede toplanır
const MEFKURE_KEYS = ["mefkureyks", "mefkurelgs"];
const MEFKURE_GROUP = {
  branches: ["Mefkure LGS", "Mefkure PLUS", "Mefkure VİP"],
  grades: ["5", "6", "7", "8", "9", "10", "11", "12", "Mezun", "Mood"]
};

export default function StudentList() {
  const { user } = useAuth();
  const [firebaseRecords, setFirebaseRecords] = useState<any[]>([]);
  const [editingStudent, setEditingStudent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState(""); // 🔍 Arama state'i
  const [branchFilter, setBranchFilter] = useState("all"); // 🗂️ Grup başlığı süzgeci


  const userSettings = useMemo(() => {
    const userBranchKey = user?.branchId ? normalize(user.branchId) : "";
    // Mefkure kullanıcıları (LGS/YKS) ortak Mefkure listesini görür
    if (MEFKURE_KEYS.includes(userBranchKey)) return MEFKURE_GROUP;
    return hierarchy[userBranchKey] || { branches: [], grades: [] };
  }, [user]);

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
    const parseDate = (dateStr: string) => {
      if (!dateStr) return 0;
      if (dateStr.includes('.')) {
        // Assume DD.MM.YYYY
        const [d, m, y] = dateStr.split('.');
        return new Date(`${y}-${m}-${d}`).getTime() || 0;
      }
      // Assume YYYY-MM-DD
      return new Date(dateStr).getTime() || 0;
    };

    const list = firebaseRecords.filter(r => {
      // Sadece manuel kayıtlar
      if (r.source !== "manual") return false;
      
      // Yetki Kontrolü
      const isAuthorized = user?.role?.toLowerCase() === 'admin' || 
                          userSettings.branches.some((mb: string) => normalize(mb) === normalize(r.Okul || ""));
      
      if (!isAuthorized) return false;

      // 🗂️ Grup başlığı süzgeci (örn. sadece Mefkure PLUS)
      if (branchFilter !== "all" && normalize(r.Okul || "") !== normalize(branchFilter)) return false;

      // 🔍 Arama Filtresi (öğrenci adı VEYA gittiği okul)
      if (searchTerm) {
        const q = normalize(searchTerm);
        return normalize(r.studentName).includes(q) || normalize(r.GittigiOkul || "").includes(q);
      }

      return true;
    });

    // 🚀 SIRALAMA: En yeni eklenenden eskiye doğru
    return list.sort((a, b) => {
      const dateA = parseDate(a.SözleşmeTarihi);
      const dateB = parseDate(b.SözleşmeTarihi);
      return dateB - dateA;
    });
  }, [firebaseRecords, user, userSettings, searchTerm, branchFilter]);

  // Yardımcı: Tarihi kullanıcıya güzel formatta göster (DD.MM.YYYY)
  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return "-";
    if (dateStr.includes('-')) {
      const [y, m, d] = dateStr.split('-');
      return `${d}.${m}.${y}`;
    }
    return dateStr;
  };

  const handleUpdate = async (e: any) => {
    e.preventDefault();
    try {
      const ref = doc(db, "records", editingStudent.id);
      const isMefkure = (editingStudent.Okul || "").toLocaleLowerCase('tr-TR').includes("mefkure");
      await updateDoc(ref, {
        studentName: editingStudent.studentName,
        // 🛡️ Tarihi DAİMA GG.AA.YYYY olarak yaz — aksi halde raporların ".2026" sayımından düşer
        SözleşmeTarihi: toStoredDate(editingStudent.SözleşmeTarihi),
        Okul: editingStudent.Okul,
        Sınıf: editingStudent.Sınıf,
        SonTutar: Number(editingStudent.SonTutar),
        // 🏫 Sadece Mefkure kayıtlarında gittiği okulu güncelle (boş string Firestore'da geçerli)
        ...(isMefkure ? { GittigiOkul: editingStudent.GittigiOkul || "" } : {})
      });
      setEditingStudent(null);
      alert("Kayıt başarıyla güncellendi!");
    } catch (err) {
      alert("Hata oluştu.");
    }
  };

  if (loading) return <div className="page" style={{ textAlign: "center", paddingTop: "var(--sp-7)", color: "var(--text-2)" }}>📡 Yükleniyor...</div>;

  return (
    <div className="page rise" style={{ maxWidth: 800 }}>
      <header style={{ marginBottom: "20px", borderLeft: "4px solid var(--accent)", paddingLeft: "15px" }}>
        <h2 style={{ fontSize: "1.3rem", fontWeight: 800 }}>✍️ Manüel Kayıt Yönetimi</h2>
      </header>

      {/* 🔍 ARAMA + 🗂️ GRUP SÜZGECİ */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "15px", flexWrap: "wrap" }}>
        <input
          type="text"
          placeholder="Öğrenci adı veya okul ile ara..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ ...searchInputStyle, flex: 1, minWidth: "180px" }}
        />
        {userSettings.branches.length > 1 && (
          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            style={{ ...searchInputStyle, width: "auto", minWidth: "150px", cursor: "pointer" }}
          >
            <option value="all">🗂️ Tüm Gruplar</option>
            {userSettings.branches.map((b: string) => <option key={b} value={b}>{b}</option>)}
          </select>
        )}
      </div>
      
      <div style={{ display: "grid", gap: "10px" }}>
        {filteredList.map((s) => (
          <div key={s.id} style={cardStyle}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ fontWeight: 700 }}>{s.studentName}</div>
                <span style={dateBadge}>{formatDateDisplay(s.SözleşmeTarihi)}</span>
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-2)", marginTop: "4px" }}>
                📍 {s.Okul} | 🎓 Sınıf: {s.Sınıf} | 💰 {s.SonTutar?.toLocaleString("tr-TR")} TL
              </div>
              {s.GittigiOkul && (
                <div style={{ fontSize: "0.75rem", color: "var(--accent)", marginTop: "2px" }}>
                  🏫 Gittiği Okul: {s.GittigiOkul}
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={() => setEditingStudent({ ...s, SözleşmeTarihi: toInputDate(s.SözleşmeTarihi) })} style={btnEdit}>Düzenle</button>
              <button onClick={() => { if(window.confirm("Siliyorum?")) deleteDoc(doc(db, "records", s.id))}} style={btnDel}>Sil</button>
            </div>
          </div>
        ))}
        {filteredList.length === 0 && (
          <div style={{ textAlign: "center", padding: "20px", color: "var(--text-3)" }}>Kayıt bulunamadı.</div>
        )}
      </div>

      {editingStudent && (
        <div style={modalOverlay}>
          <div style={modalContent}>
            <h3 style={{ color: "var(--accent)", marginBottom: "20px" }}>Kaydı Düzenle</h3>
            
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

            {(editingStudent.Okul || "").toLocaleLowerCase('tr-TR').includes("mefkure") && (
              <>
                <label style={labelStyle}>Gittiği Okul (opsiyonel)</label>
                <input
                  style={inputStyle}
                  value={editingStudent.GittigiOkul || ""}
                  placeholder="Öğrencinin gittiği okul"
                  onChange={e => setEditingStudent({ ...editingStudent, GittigiOkul: e.target.value })}
                />
              </>
            )}

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
const searchInputStyle: any = { width: "100%", padding: "12px", background: "var(--line)", border: "1px solid var(--line-strong)", color: "white", borderRadius: "var(--r-md)", fontSize: "1rem", outline: "none", boxSizing: "border-box" };
const cardStyle: any = { background: "var(--surface)", padding: "15px", borderRadius: "var(--r-md)", border: "1px solid var(--line)", display: "flex", alignItems: "center", gap: "10px" };
const dateBadge: any = { background: "rgba(56, 189, 248, 0.1)", color: "var(--accent)", padding: "2px 8px", borderRadius: "var(--r-sm)", fontSize: "0.65rem", fontWeight: 700 };
const btnEdit: any = { background: "var(--accent)", color: "var(--accent-ink)", border: "none", padding: "8px 14px", borderRadius: "var(--r-sm)", cursor: "pointer", fontWeight: 600 };
const btnDel: any = { background: "rgba(239, 68, 68, 0.1)", color: "var(--danger)", border: "1px solid var(--danger)", padding: "8px 14px", borderRadius: "var(--r-sm)", cursor: "pointer" };
const modalOverlay: any = { position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(2, 6, 23, 0.95)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000, backdropFilter: "blur(4px)" };
const modalContent: any = { background: "var(--surface)", padding: "25px", borderRadius: "var(--r-xl)", width: "95%", maxWidth: "450px", border: "1px solid var(--line)" };
const inputStyle: any = { width: "100%", padding: "12px", background: "var(--line)", border: "1px solid var(--line-strong)", color: "white", borderRadius: "var(--r-md)", marginBottom: "12px", boxSizing: "border-box" };
const labelStyle: any = { fontSize: "0.7rem", color: "var(--text-3)", marginBottom: "5px", display: "block" };
const saveBtn: any = { flex: 1, background: "var(--success)", color: "white", border: "none", padding: "14px", borderRadius: "var(--r-md)", fontWeight: 700 };
const cancelBtn: any = { flex: 1, background: "var(--line-strong)", color: "white", border: "none", padding: "14px", borderRadius: "var(--r-md)" };