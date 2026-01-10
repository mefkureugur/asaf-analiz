import { Link, useLocation } from "react-router-dom";

export default function TopNav() {
  const { pathname } = useLocation();

  // 🔥 prefix destekli aktif kontrol (alt sayfaları da kapsar)
  const linkStyle = (path: string): React.CSSProperties => {
    const isActive =
      pathname === path || pathname.startsWith(path + "/");

    return {
      padding: "8px 12px",
      borderRadius: 8,
      textDecoration: "none",
      color: "#fff",
      background: isActive ? "#ffffff22" : "transparent",
      fontWeight: isActive ? 600 : 500,
      whiteSpace: "nowrap",
      transition: "background 0.15s ease",
    };
  };

  return (
    <nav
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 20px",
        background: "#020617",
        borderBottom: "1px solid #ffffff22",
        overflowX: "auto",
      }}
    >
      {/* LOGO */}
      <div
        style={{
          fontWeight: 700,
          marginRight: 20,
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

      {/* 💰 FİNANS */}
      <Link to="/finance/view" style={linkStyle("/finance")}>
        💰 Finans
      </Link>
    </nav>
  );
}
