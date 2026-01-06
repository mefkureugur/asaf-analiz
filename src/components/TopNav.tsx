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
  });

  return (
    <nav
      style={{
        display: "flex",
        gap: 12,
        padding: "12px 16px",
        background: "#020617",
        borderBottom: "1px solid #ffffff22",
      }}
    >
      <Link to="/dashboard" style={linkStyle("/dashboard")}>
        📊 Dashboard
      </Link>

      <Link to="/import" style={linkStyle("/import")}>
        📥 Excel Yükle
      </Link>

      <Link to="/daily" style={linkStyle("/daily")}>
        ✍️ Günlük Giriş
      </Link>

      <Link to="/compare" style={linkStyle("/compare")}>
        ⚖️ Karşılaştırma
      </Link>

      <Link to="/targets" style={linkStyle("/targets")}>
        🎯 Hedefler
      </Link>

      {/* ✅ YENİ – SADECE EKLENDİ */}
      <Link to="/students" style={linkStyle("/students")}>
        🧑‍🎓 Yeni Kayıt – Kayıt Yenileme
      </Link>
    </nav>
  );
}
