import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../store/AuthContext";

interface TopNavProps {
  isAdmin?: boolean;
}

export default function TopNav({ isAdmin }: TopNavProps) {
  const { pathname } = useLocation();
  const { user, logout } = useAuth();

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

  // 🛡️ Admin yetkisi kontrolü
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
      }}
    >
      <div style={{ fontWeight: 800, marginRight: 24, color: "#f8fafc", whiteSpace: "nowrap", fontSize: "1.1rem", letterSpacing: "0.5px" }}>
        ASAF <span style={{ color: "#38bdf8" }}>ANALİZ</span>
      </div>

      <div style={{ display: "flex", gap: 8, flex: 1 }}>
        <Link to="/dashboard" style={linkStyle("/dashboard")}>📊 Dashboard</Link>
        <Link to="/daily" style={linkStyle("/daily")}>✍️ Günlük Giriş</Link>
        <Link to="/compare" style={linkStyle("/compare")}>⚖️ Karşılaştırma</Link>
        
        {showAdminMenu ? (
          <Link to="/targets" style={linkStyle("/targets")}>🎯 Hedef Girişi</Link>
        ) : (
          <Link to="/performans" style={linkStyle("/performans")}>🚀 Performans İzleme</Link>
        )}

        {/* 📋 ANALİZ VE YÖNETİM AYRIMI */}
        <Link to="/students" style={linkStyle("/students")}>🧑‍🎓 Kayıt Analizi</Link>
        
        {/* 🛡️ KRİTİK DEĞİŞİKLİK: Kayıt Listesi Admin'e gözükmez, sadece müdürlere gözükür */}
        {!showAdminMenu && (
          <Link to="/ogrenci-listesi" style={linkStyle("/ogrenci-listesi")}>✍️ Kayıt Listesi</Link>
        )}
        
        <Link to="/finance/view" style={linkStyle("/finance")}>💰 Finans</Link>
        
        {showAdminMenu && (
          <>
            <Link to="/import" style={linkStyle("/import")}>📥 Veri Aktar</Link>
            <Link to="/user-management" style={{ 
                ...linkStyle("/user-management"), 
                color: "#38bdf8", 
                border: pathname === "/user-management" ? "1px solid #38bdf8" : "1px solid transparent" 
              }}>
              🛡️ Yetki Yönetimi
            </Link>
          </>
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
    </nav>
  );
}