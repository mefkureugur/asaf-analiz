import { Link, useLocation } from "react-router-dom";

export default function TopNav() {
  const { pathname } = useLocation();

  const linkStyle = (path: string): React.CSSProperties => ({
    padding: "8px 12px",
    borderRadius: 6,
    textDecoration: "none",
    color: "#fff",
    background: pathname === path ? "#ffffff22" : "transparent",
    fontWeight: 500,
    whiteSpace: "nowrap",
  });

  return (
    <nav
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 16px",
        background: "#020617",
        borderBottom: "1px solid #ffffff22",
        overflowX: "auto",
      }}
    >
      {/* LOGO / BAŞLIK */}
      <div
        style={{
          fontWeight: 600,
          marginRight: 16,
          color: "#e5e7eb",
          whiteSpace: "nowrap",
        }}
      >
        Mefkure Kayıt Sayfası
      </div>

      <Link to="/dashboard" style={linkStyle("/dashboard")}>
        🏠 Anasayfa
      </Link>

      <Link to="/import" style={linkStyle("/import")}>
        📥 Import
      </Link>

      <Link to="/daily" style={linkStyle("/daily")}>
        ✍️ Günlük Kayıt Girişi
      </Link>

      <Link to="/compare" style={linkStyle("/compare")}>
        ⚖️ Karşılaştırma
      </Link>

      <Link to="/targets" style={linkStyle("/targets")}>
        🎯 Hedefler
      </Link>

      <Link to="/students" style={linkStyle("/students")}>
        🧑‍🎓 Yeni Kayıt / Kayıt Yenileme
      </Link>
    </nav>
  );
}
