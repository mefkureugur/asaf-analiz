import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../store/AuthContext";
import { updatePassword } from "firebase/auth"; 
import { auth } from "../firebase"; 

interface TopNavProps {
  isAdmin?: boolean;
}

export default function TopNav({ isAdmin }: TopNavProps) {
  const { pathname } = useLocation();
  const { user, logout } = useAuth();

  const [clickCount, setClickCount] = useState(0);
  const [showPassModal, setShowPassModal] = useState(false);
  const [pass1, setPass1] = useState(""); 
  const [pass2, setPass2] = useState(""); 

  const handleLogoClick = () => {
    const newCount = clickCount + 1;
    if (newCount === 5) {
      setShowPassModal(true);
      setClickCount(0);
    } else {
      setClickCount(newCount);
      setTimeout(() => setClickCount(0), 2500); 
    }
  };

  const handleUpdatePassword = async () => {
    if (pass1 !== pass2) return alert("Şifreler birbiriyle eşleşmiyor!");
    if (pass1.length < 6) return alert("Şifre en az 6 karakter olmalı!");
    
    try {
      if (auth.currentUser) {
        await updatePassword(auth.currentUser, pass1);
        alert("Şifre Başarıyla Mühürlendi!");
        setShowPassModal(false);
        setPass1(""); setPass2("");
      }
    } catch (error: any) {
      alert("Güvenlik Hatası: Lütfen çıkış yapıp tekrar girerek deneyin.");
    }
  };

  const linkStyle = (path: string): React.CSSProperties => {
    const isActive = pathname === path || pathname.startsWith(path + "/");
    return {
      padding: "8px 12px",
      borderRadius: 8,
      textDecoration: "none",
      color: "#fff",
      background: isActive ? "#334155" : "transparent",
      fontWeight: isActive ? 600 : 500,
      whiteSpace: "nowrap",
      transition: "all 0.15s ease",
      border: isActive ? "1px solid #475569" : "1px solid transparent",
    };
  };

  const showAdminMenu = isAdmin || user?.role === 'admin' || user?.email === 'ugur@asaf.com';

  return (
    <nav
      style={{
        display: "flex",
        alignItems: "center",
        padding: "12px 20px",
        background: "#020617",
        borderBottom: "1px solid #1e293b",
        overflowX: "auto",
        scrollbarWidth: "none",
        position: "relative" 
      }}
    >
      {/* 🚀 LOGO VE İSİM BÖLÜMÜ - logo512.png EKLENDİ */}
      <div 
        onClick={handleLogoClick}
        style={{ 
          display: "flex", 
          alignItems: "center", 
          gap: "12px", 
          marginRight: 24, 
          cursor: "pointer", 
          userSelect: "none" 
        }}
      >
        <img 
          src="/logo512.png" 
          alt="ASAF" 
          style={{ height: "35px", width: "35px", borderRadius: "8px", objectFit: "cover" }} 
        />
        <div style={{ fontWeight: 800, color: "#f8fafc", fontSize: "1.1rem", letterSpacing: "0.5px" }}>
          ASAF <span style={{ color: "#38bdf8" }}>ANALİZ</span>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flex: 1 }}>
        {/* 🏠 DASHBOARD -> ANA SAYFA OLDU */}
        <Link to="/dashboard" style={linkStyle("/dashboard")}>🏠 Ana Sayfa</Link>
        <Link to="/daily" style={linkStyle("/daily")}>✍️ Günlük Giriş</Link>
        <Link to="/compare" style={linkStyle("/compare")}>⚖️ Karşılaştırma</Link>
        
        {showAdminMenu ? (
          <Link to="/targets" style={linkStyle("/targets")}>🎯 Hedef Girişi</Link>
        ) : (
          <Link to="/performans" style={linkStyle("/performans")}>🚀 Performans İzleme</Link>
        )}

        <Link to="/students" style={linkStyle("/students")}>🧑‍🎓 Kayıt Analizi</Link>
        
        {!showAdminMenu && (
          <Link to="/ogrenci-listesi" style={linkStyle("/ogrenci-listesi")}>✍️ Kayıt Listesi</Link>
        )}
        
        {showAdminMenu && (
          <Link to="/finance/view" style={linkStyle("/finance")}>💰 Finans</Link>
        )}
        
        {showAdminMenu && (
          <Link to="/user-management" style={{ 
              ...linkStyle("/user-management"), 
              color: "#38bdf8", 
              border: pathname === "/user-management" ? "1px solid #38bdf8" : "1px solid transparent" 
            }}>
            🛡️ Yetki Yönetimi
          </Link>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 15 }}>
        <div style={{ textAlign: "right", marginRight: 10 }}>
          <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "white" }}>{user?.displayName}</div>
          <div style={{ fontSize: "0.7rem", color: "#94a3b8" }}>{user?.branchId}</div>
        </div>
        <button 
          onClick={logout}
          style={{ background: "none", border: "1px solid #334155", color: "#f87171", padding: "8px 12px", borderRadius: "8px", cursor: "pointer", fontWeight: 600, whiteSpace: "nowrap" }}
        >
          🚪 Çıkış
        </button>
      </div>

      {showPassModal && (
        <div style={modalOverlay}>
          <div style={modalContent}>
            <h4 style={{ color: "white", marginBottom: 15, fontSize: "0.9rem" }}>Gizli Şifre Paneli</h4>
            
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <input 
                type="text" 
                placeholder="Yeni Şifre" 
                value={pass1}
                onChange={(e) => setPass1(e.target.value)}
                style={modalInput}
              />
              <input 
                type="text" 
                placeholder="Yeni Şifre (Tekrar)" 
                value={pass2}
                onChange={(e) => setPass2(e.target.value)}
                style={modalInput}
              />
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button onClick={handleUpdatePassword} style={modalBtnSave}>Mühürle</button>
              <button onClick={() => { setShowPassModal(false); setPass1(""); setPass2(""); }} style={modalBtnCancel}>Kapat</button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}

const modalOverlay: React.CSSProperties = { position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.8)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 9999 };
const modalContent: React.CSSProperties = { background: "#0f172a", padding: "25px", borderRadius: "16px", border: "1px solid #1e293b", width: "350px" };
const modalInput: React.CSSProperties = { width: "100%", padding: "10px", borderRadius: "8px", background: "#1e293b", border: "1px solid #334155", color: "white", outline: "none" };
const modalBtnSave: React.CSSProperties = { flex: 1, padding: "10px", borderRadius: "8px", background: "#38bdf8", color: "#020617", fontWeight: 800, border: "none", cursor: "pointer" };
const modalBtnCancel: React.CSSProperties = { flex: 1, padding: "10px", borderRadius: "8px", background: "#1e293b", color: "#64748b", border: "none", cursor: "pointer" };