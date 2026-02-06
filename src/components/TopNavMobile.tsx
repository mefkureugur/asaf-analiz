import { useState } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../store/AuthContext";
import { updatePassword } from "firebase/auth"; 
import { auth } from "../firebase"; 

interface MobileProps {
  isAdmin?: boolean;
}

export default function TopNavMobile({ isAdmin }: MobileProps) {
  const [open, setOpen] = useState(false);
  const { user, logout } = useAuth();
  
  const [clickCount, setClickCount] = useState(0);
  const [showPassModal, setShowPassModal] = useState(false);
  const [pass1, setPass1] = useState(""); 
  const [pass2, setPass2] = useState(""); 

  const closeMenu = () => {
    setOpen(false);
    setClickCount(0);
  };

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

  const showAdminMenu = isAdmin || user?.role === 'admin' || user?.email === 'ugur@asaf.com';

  return (
    <div className="mobileNavWrapper" style={wrapperStyle}>
      <div className="mobileTopBar" style={topBarStyle}>
        <div 
          className="mobileLogo" 
          onClick={handleLogoClick} 
          style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", userSelect: "none" }}
        >
          <img 
            src="/logo512.png" 
            alt="ASAF" 
            style={{ height: "30px", width: "30px", borderRadius: "6px", objectFit: "cover" }} 
          />
          <div style={{ fontWeight: 900, color: "#f8fafc", fontSize: "1.1rem", letterSpacing: "1px" }}>
            ASAF <span style={{ color: "#38bdf8" }}>ANALİZ</span>
          </div>
        </div>

        <button
          className="hamburgerBtn"
          aria-label="Menü"
          onClick={() => setOpen((v) => !v)}
          style={buttonStyle}
        >
          {open ? "✕" : "☰"} <span style={{ marginLeft: 6, fontSize: "0.85rem", fontWeight: 600 }}>Menü</span>
        </button>
      </div>

      {open && (
        <nav className="mobileMenu" style={menuStyle}>
          <NavLink to="/dashboard" onClick={closeMenu} style={({ isActive }) => isActive ? activeNavLinkStyle : navLinkStyle}>
            🏠 Ana Sayfa
          </NavLink>
          
          <NavLink to="/compare" onClick={closeMenu} style={({ isActive }) => isActive ? activeNavLinkStyle : navLinkStyle}>
            ⚖️ Karşılaştırma
          </NavLink>

          {showAdminMenu ? (
            <NavLink to="/targets" onClick={closeMenu} style={({ isActive }) => isActive ? activeNavLinkStyle : navLinkStyle}>
              🎯 Hedef Yönetimi
            </NavLink>
          ) : (
            <NavLink to="/performans" onClick={closeMenu} style={({ isActive }) => isActive ? activeNavLinkStyle : navLinkStyle}>
              🚀 Performans İzleme
            </NavLink>
          )}

          <NavLink to="/students" onClick={closeMenu} style={({ isActive }) => isActive ? activeNavLinkStyle : navLinkStyle}>
            🧑‍🎓 Kayıt Analizi
          </NavLink>

          {!showAdminMenu && (
            <NavLink to="/ogrenci-listesi" onClick={closeMenu} style={({ isActive }) => isActive ? activeNavLinkStyle : navLinkStyle}>
              ✍️ Kayıt Listesi (Yönetim)
            </NavLink>
          )}

          {showAdminMenu && (
            <NavLink to="/finance/view" onClick={closeMenu} style={({ isActive }) => isActive ? activeNavLinkStyle : navLinkStyle}>
              💰 Finans Analizi
            </NavLink>
          )}

          {showAdminMenu && (
            <>
              <div style={{ height: "1px", background: "#1e293b", margin: "8px 12px" }} />
              <NavLink to="/user-management" onClick={closeMenu} style={({ isActive }) => isActive ? { ...activeNavLinkStyle, color: "#38bdf8" } : { ...navLinkStyle, color: "#38bdf8" }}>
                🛡️ Yetki Yönetimi
              </NavLink>
            </>
          )}

          {/* 🚀 OPERASYONEL BUTONLAR: Mobil Menünün En Altına Taşındı */}
          <div style={{ height: "1px", background: "#1e293b", margin: "8px 12px" }} />
          
          <NavLink to="/daily" onClick={closeMenu} style={({ isActive }) => isActive ? activeNavLinkStyle : navLinkStyle}>
            ✍️ Günlük Giriş
          </NavLink>
          
          <NavLink to="/reports/daily" onClick={closeMenu} style={({ isActive }) => isActive ? activeNavLinkStyle : navLinkStyle}>
            📋 Günlük Rapor
          </NavLink>

          <div style={{ height: "1px", background: "#1e293b", margin: "8px 12px" }} />
          
          <div style={{ padding: "12px 16px", fontSize: "0.75rem", color: "#64748b", display: "flex", justifyContent: "space-between" }}>
              <span>{user?.displayName}</span>
              <span style={{ color: "#38bdf8" }}>{user?.branchId}</span>
          </div>

          <div onClick={() => { logout(); closeMenu(); }} style={{ ...navLinkStyle, color: "#f87171", borderBottom: "none" }}>
            🚪 Çıkış Yap
          </div>
        </nav>
      )}

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
    </div>
  );
}

const modalOverlay: React.CSSProperties = { position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.9)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 9999 };
const modalContent: React.CSSProperties = { background: "#0f172a", padding: "20px", borderRadius: "12px", border: "1px solid #1e293b", width: "80%", maxWidth: "300px" };
const modalInput: React.CSSProperties = { width: "100%", padding: "10px", borderRadius: "8px", background: "#1e293b", border: "1px solid #334155", color: "white", outline: "none" };
const modalBtnSave: React.CSSProperties = { flex: 1, padding: "10px", borderRadius: "8px", background: "#38bdf8", color: "#020617", fontWeight: 800, border: "none" };
const modalBtnCancel: React.CSSProperties = { flex: 1, padding: "10px", borderRadius: "8px", background: "#1e293b", color: "#64748b", border: "none" };
const wrapperStyle: React.CSSProperties = { position: "sticky", top: 0, zIndex: 1000, background: "#020617" };
const topBarStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 16px", borderBottom: "1px solid #1e293b", height: "60px" };
const buttonStyle: React.CSSProperties = { background: "#111827", border: "1px solid #1f2937", color: "white", padding: "8px 14px", borderRadius: 10, cursor: "pointer", display: "flex", alignItems: "center" };
const menuStyle: React.CSSProperties = { display: "flex", flexDirection: "column", background: "#020617", padding: "10px 0", borderBottom: "2px solid #38bdf8", position: "absolute", width: "100%", boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.7)", maxHeight: "80vh", overflowY: "auto" };
const navLinkStyle: React.CSSProperties = { padding: "16px 20px", textDecoration: "none", color: "#94a3b8", fontSize: "0.95rem", borderBottom: "1px solid #0f172a", transition: "all 0.2s" };
const activeNavLinkStyle: React.CSSProperties = { ...navLinkStyle, color: "white", background: "#0f172a", borderLeft: "4px solid #38bdf8" };