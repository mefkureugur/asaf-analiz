import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../store/AuthContext";
import { updatePassword } from "firebase/auth";
import { auth } from "../firebase";
import Modal from "./ui/Modal";

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
  const [passError, setPassError] = useState("");
  const [passBusy, setPassBusy] = useState(false);

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
    if (pass1 !== pass2) { setPassError("Şifreler birbiriyle eşleşmiyor."); return; }
    if (pass1.length < 6) { setPassError("Şifre en az 6 karakter olmalı."); return; }

    setPassBusy(true);
    setPassError("");
    try {
      if (auth.currentUser) {
        await updatePassword(auth.currentUser, pass1);
        setShowPassModal(false);
        setPass1(""); setPass2("");
      }
    } catch {
      setPassError("Güvenlik doğrulaması gerekli. Çıkış yapıp tekrar girin.");
    } finally {
      setPassBusy(false);
    }
  };

  const linkStyle = (path: string): React.CSSProperties => {
    const isActive = pathname === path || pathname.startsWith(path + "/");
    return {
      padding: "var(--sp-2) var(--sp-3)",
      borderRadius: "var(--r-sm)",
      textDecoration: "none",
      color: isActive ? "var(--text)" : "var(--text-2)",
      background: isActive ? "var(--surface-raised)" : "transparent",
      fontWeight: isActive ? 600 : 500,
      fontSize: "0.88rem",
      whiteSpace: "nowrap",
      border: isActive ? "1px solid var(--line-strong)" : "1px solid transparent",
    };
  };

  const showAdminMenu = isAdmin || user?.role === "admin" || user?.email === "ugur@asaf.com";
  const isMefkureManager = (user?.branchId || "").toLocaleLowerCase("tr-TR").includes("mefkure");

  return (
    <nav
      className="material-nav"
      style={{
        display: "flex",
        alignItems: "center",
        padding: "var(--sp-3) var(--sp-5)",
        paddingTop: "calc(var(--sp-3) + var(--safe-top))",
        paddingLeft: "max(var(--sp-5), var(--safe-left))",
        paddingRight: "max(var(--sp-5), var(--safe-right))",
        position: "sticky",
        top: 0,
        zIndex: 1000,
        gap: "var(--sp-5)",
      }}
    >
      {/* Marka */}
      <div
        onClick={handleLogoClick}
        className="press"
        style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)", cursor: "pointer", userSelect: "none", flexShrink: 0 }}
      >
        <img src="/logo512.png" alt="" style={{ height: 34, width: 34, borderRadius: "var(--r-sm)", objectFit: "cover" }} />
        <div style={{ fontWeight: 800, color: "var(--text)", fontSize: "1.05rem", letterSpacing: "-0.01em" }}>
          ASAF <span style={{ color: "var(--accent)" }}>ANALİZ</span>
        </div>
      </div>

      {/* Gezinme — kenarları yumuşak maskeli yatay kaydırma (§12) */}
      <div className="scroll-x" style={{ display: "flex", gap: "var(--sp-2)", flex: 1, alignItems: "center" }}>
        <Link to="/dashboard" className="press" style={linkStyle("/dashboard")}>🏠 Ana Sayfa</Link>
        <Link to="/compare" className="press" style={linkStyle("/compare")}>⚖️ Karşılaştırma</Link>

        {showAdminMenu ? (
          <Link to="/targets" className="press" style={linkStyle("/targets")}>🎯 Hedef Girişi</Link>
        ) : (
          <Link to="/performans" className="press" style={linkStyle("/performans")}>🚀 Performans İzleme</Link>
        )}

        {!showAdminMenu && (
          <Link to="/ogrenci-listesi" className="press" style={linkStyle("/ogrenci-listesi")}>✍️ Kayıt Listesi</Link>
        )}

        {isMefkureManager && (
          <Link to="/reports/okul-sayilari" className="press" style={linkStyle("/reports/okul-sayilari")}>🏫 Okul Sayıları</Link>
        )}

        {showAdminMenu && (
          <Link to="/finance/view" className="press" style={linkStyle("/finance")}>💰 Finans</Link>
        )}

        {showAdminMenu && (
          <Link to="/scenarios" className="press" style={linkStyle("/scenarios")}>📊 Senaryo Hesap</Link>
        )}

        {showAdminMenu && (
          <Link
            to="/user-management"
            className="press"
            style={{ ...linkStyle("/user-management"), color: "var(--accent)" }}
          >
            🛡️ Yetki Yönetimi
          </Link>
        )}

        {/* Operasyonel butonlar sağa yaslı */}
        <div style={{ marginLeft: "auto", display: "flex", gap: "var(--sp-2)" }}>
          <Link to="/daily" className="press" style={linkStyle("/daily")}>✍️ Günlük Giriş</Link>
          <Link to="/reports/daily" className="press" style={linkStyle("/reports/daily")}>📋 Günlük Rapor</Link>
        </div>
      </div>

      {/* Kullanıcı */}
      <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-4)", flexShrink: 0 }}>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text)" }}>{user?.displayName}</div>
          <div className="caption">{user?.branchId}</div>
        </div>
        <button
          onClick={logout}
          className="press"
          style={{
            background: "transparent",
            border: "1px solid var(--line-strong)",
            color: "var(--danger)",
            padding: "var(--sp-2) var(--sp-3)",
            borderRadius: "var(--r-sm)",
            fontWeight: 600,
            fontSize: "0.85rem",
            whiteSpace: "nowrap",
          }}
        >
          🚪 Çıkış
        </button>
      </div>

      <Modal
        open={showPassModal}
        onClose={() => { setShowPassModal(false); setPass1(""); setPass2(""); setPassError(""); }}
        title="Şifre Değiştir"
        footer={
          <>
            <button className="press" onClick={handleUpdatePassword} disabled={passBusy} style={btnPrimary}>
              {passBusy ? "Kaydediliyor…" : "Kaydet"}
            </button>
            <button className="press" onClick={() => { setShowPassModal(false); setPass1(""); setPass2(""); setPassError(""); }} style={btnGhost}>
              Vazgeç
            </button>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
          <input type="password" placeholder="Yeni şifre" value={pass1}
            onChange={(e) => { setPass1(e.target.value); setPassError(""); }} />
          <input type="password" placeholder="Yeni şifre (tekrar)" value={pass2}
            onChange={(e) => { setPass2(e.target.value); setPassError(""); }} />
          {passError && (
            <div role="alert" style={{ color: "var(--danger)", fontSize: "var(--t-caption-size)" }}>
              {passError}
            </div>
          )}
        </div>
      </Modal>
    </nav>
  );
}

const btnPrimary: React.CSSProperties = {
  flex: 1,
  padding: "var(--sp-3)",
  borderRadius: "var(--r-sm)",
  background: "var(--accent)",
  color: "var(--accent-ink)",
  fontWeight: 700,
  border: "none",
};

const btnGhost: React.CSSProperties = {
  flex: 1,
  padding: "var(--sp-3)",
  borderRadius: "var(--r-sm)",
  background: "var(--surface-raised)",
  color: "var(--text-2)",
  border: "1px solid var(--line)",
  fontWeight: 600,
};
