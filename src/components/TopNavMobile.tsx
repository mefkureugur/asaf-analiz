import { useState } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../store/AuthContext";

interface MobileProps {
  isAdmin?: boolean;
}

export default function TopNavMobile({ isAdmin }: MobileProps) {
  const [open, setOpen] = useState(false);
  const { user, logout } = useAuth();

  const closeMenu = () => setOpen(false);

  // 🛡️ Admin yetkisi kontrolü (Masaüstü ile aynı mantık)
  const showAdminMenu = isAdmin || user?.role === 'admin' || user?.email === 'ugur@asaf.com';

  return (
    <div className="mobileNavWrapper" style={wrapperStyle}>
      {/* ÜST BAR */}
      <div className="mobileTopBar" style={topBarStyle}>
        <div className="mobileLogo" style={logoStyle}>
          ASAF <span style={{ color: "#38bdf8" }}>ANALİZ</span>
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

      {/* AÇILIR MENÜ */}
      {open && (
        <nav className="mobileMenu" style={menuStyle}>
          <NavLink to="/dashboard" onClick={closeMenu} style={({ isActive }) => isActive ? activeNavLinkStyle : navLinkStyle}>
            📊 Dashboard
          </NavLink>

          <NavLink to="/daily" onClick={closeMenu} style={({ isActive }) => isActive ? activeNavLinkStyle : navLinkStyle}>
            ✍️ Günlük Giriş
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

          {/* 📋 ANALİZ VE YÖNETİM AYRIMI (MOBİL) */}
          <NavLink to="/students" onClick={closeMenu} style={({ isActive }) => isActive ? activeNavLinkStyle : navLinkStyle}>
            🧑‍🎓 Kayıt Analizi
          </NavLink>

          {/* 🛡️ KRİTİK DEĞİŞİKLİK: Kayıt Listesi Admin'e gözükmez, müdürlere özeldir */}
          {!showAdminMenu && (
            <NavLink to="/ogrenci-listesi" onClick={closeMenu} style={({ isActive }) => isActive ? activeNavLinkStyle : navLinkStyle}>
              ✍️ Kayıt Listesi (Yönetim)
            </NavLink>
          )}

          <NavLink to="/finance/view" onClick={closeMenu} style={({ isActive }) => isActive ? activeNavLinkStyle : navLinkStyle}>
            💰 Finans Analizi
          </NavLink>

          {showAdminMenu && (
            <>
              <div style={{ height: "1px", background: "#1e293b", margin: "8px 12px" }} />
              
              <NavLink to="/import" onClick={closeMenu} style={({ isActive }) => isActive ? activeNavLinkStyle : navLinkStyle}>
                📥 Veri Aktarımı
              </NavLink>

              <NavLink to="/user-management" onClick={closeMenu} style={({ isActive }) => isActive ? { ...activeNavLinkStyle, color: "#38bdf8" } : { ...navLinkStyle, color: "#38bdf8" }}>
                🛡️ Yetki Yönetimi
              </NavLink>
            </>
          )}

          <div style={{ height: "1px", background: "#1e293b", margin: "8px 12px" }} />
          
          <div style={{ padding: "12px 16px", fontSize: "0.75rem", color: "#64748b", display: "flex", justifyContent: "space-between" }}>
              <span>{user?.displayName}</span>
              <span style={{ color: "#38bdf8" }}>{user?.branchId}</span>
          </div>

          <div 
            onClick={() => { logout(); closeMenu(); }} 
            style={{ ...navLinkStyle, color: "#f87171", borderBottom: "none" }}
          >
            🚪 Çıkış Yap
          </div>
        </nav>
      )}
    </div>
  );
}

// STİLLER (Aynı kalıyor)
const wrapperStyle: React.CSSProperties = { position: "sticky", top: 0, zIndex: 1000, background: "#020617" };
const topBarStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 16px", borderBottom: "1px solid #1e293b", height: "60px" };
const logoStyle: React.CSSProperties = { fontWeight: 900, color: "#f8fafc", fontSize: "1.2rem", letterSpacing: "1px" };
const buttonStyle: React.CSSProperties = { background: "#111827", border: "1px solid #1f2937", color: "white", padding: "8px 14px", borderRadius: 10, cursor: "pointer", display: "flex", alignItems: "center" };
const menuStyle: React.CSSProperties = { display: "flex", flexDirection: "column", background: "#020617", padding: "10px 0", borderBottom: "2px solid #38bdf8", position: "absolute", width: "100%", boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.7)", maxHeight: "80vh", overflowY: "auto" };
const navLinkStyle: React.CSSProperties = { padding: "16px 20px", textDecoration: "none", color: "#94a3b8", fontSize: "0.95rem", borderBottom: "1px solid #0f172a", transition: "all 0.2s" };
const activeNavLinkStyle: React.CSSProperties = { ...navLinkStyle, color: "white", background: "#0f172a", borderLeft: "4px solid #38bdf8" };