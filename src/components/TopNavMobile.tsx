import { useState, useCallback } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../store/AuthContext";
import { updatePassword } from "firebase/auth";
import { auth } from "../firebase";
import Sheet from "./ui/Sheet";
import Modal from "./ui/Modal";

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
  const [passError, setPassError] = useState("");
  const [passBusy, setPassBusy] = useState(false);

  const closeMenu = useCallback(() => {
    setOpen(false);
    setClickCount(0);
  }, []);

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
    // Doğrulama satır içinde ve anında (§16) — gönderimde alert ile değil.
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

  const showAdminMenu = isAdmin || user?.role === "admin" || user?.email === "ugur@asaf.com";
  const isMefkureManager = (user?.branchId || "").toLocaleLowerCase("tr-TR").includes("mefkure");

  return (
    <div style={wrapperStyle}>
      <div className="material-nav" style={topBarStyle}>
        <div
          className="mobileLogo press"
          onClick={handleLogoClick}
          style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)", cursor: "pointer", userSelect: "none" }}
        >
          <img src="/logo512.png" alt="" style={{ height: 30, width: 30, borderRadius: 7, objectFit: "cover" }} />
          <div>ASAF <span>ANALİZ</span></div>
        </div>

        <button
          className="press"
          aria-label={open ? "Menüyü kapat" : "Menüyü aç"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          style={hamburgerStyle}
        >
          {/* İkon değil, durum: çizgiler X'e dönüşürken aynı yoldan gider (§7) */}
          <span style={{ position: "relative", width: 16, height: 12, display: "inline-block" }}>
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                style={{
                  position: "absolute",
                  left: 0,
                  width: 16,
                  height: 2,
                  borderRadius: 2,
                  background: "var(--text)",
                  transition: "transform var(--dur-med) var(--ease-out), opacity var(--dur-fast) var(--ease-out)",
                  top: open ? 5 : i * 5,
                  transform: open
                    ? i === 0 ? "rotate(45deg)" : i === 2 ? "rotate(-45deg)" : "none"
                    : "none",
                  opacity: open && i === 1 ? 0 : 1,
                }}
              />
            ))}
          </span>
          <span style={{ fontSize: "0.8rem", fontWeight: 600 }}>Menü</span>
        </button>
      </div>

      <Sheet open={open} onClose={closeMenu}>
        <SheetLink to="/dashboard" onClick={closeMenu}>🏠 Ana Sayfa</SheetLink>
        <SheetLink to="/compare" onClick={closeMenu}>⚖️ Karşılaştırma</SheetLink>

        {showAdminMenu ? (
          <SheetLink to="/targets" onClick={closeMenu}>🎯 Hedef Yönetimi</SheetLink>
        ) : (
          <SheetLink to="/performans" onClick={closeMenu}>🚀 Performans İzleme</SheetLink>
        )}

        {!showAdminMenu && (
          <SheetLink to="/ogrenci-listesi" onClick={closeMenu}>✍️ Kayıt Listesi</SheetLink>
        )}

        {isMefkureManager && (
          <SheetLink to="/reports/okul-sayilari" onClick={closeMenu}>🏫 Okul Sayıları</SheetLink>
        )}

        {showAdminMenu && <SheetLink to="/finance/view" onClick={closeMenu}>💰 Finans Analizi</SheetLink>}
        {showAdminMenu && <SheetLink to="/scenarios" onClick={closeMenu}>📊 Senaryo Hesap</SheetLink>}

        {showAdminMenu && (
          <>
            <Divider />
            <SheetLink to="/user-management" onClick={closeMenu} accent>🛡️ Yetki Yönetimi</SheetLink>
          </>
        )}

        <Divider />
        <SheetLink to="/daily" onClick={closeMenu}>✍️ Günlük Giriş</SheetLink>
        <SheetLink to="/reports/daily" onClick={closeMenu}>📋 Günlük Rapor</SheetLink>

        <Divider />
        <div style={{ padding: "var(--sp-3) var(--sp-5)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span className="caption">{user?.displayName}</span>
          <span className="caption" style={{ color: "var(--accent)" }}>{user?.branchId}</span>
        </div>

        <button
          className="press"
          onClick={() => { logout(); closeMenu(); }}
          style={{
            ...sheetItemBase,
            color: "var(--danger)",
            background: "none",
            border: "none",
            width: "100%",
            textAlign: "left",
            font: "inherit",
          }}
        >
          🚪 Çıkış Yap
        </button>
      </Sheet>

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
    </div>
  );
}

/* ---- Sheet içi bağlantı ---- */
function SheetLink({ to, onClick, children, accent }: { to: string; onClick: () => void; children: React.ReactNode; accent?: boolean }) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className="press"
      style={({ isActive }) => ({
        ...sheetItemBase,
        color: accent ? "var(--accent)" : isActive ? "var(--text)" : "var(--text-2)",
        background: isActive ? "var(--surface-raised)" : "transparent",
        // Aktif olan sola dayalı bir işaretle vurgulanır; renk tek başına
        // ayırt edici değildir (renk körlüğü)
        boxShadow: isActive ? "inset 3px 0 0 var(--accent)" : "none",
        fontWeight: isActive ? 600 : 500,
      })}
    >
      {children}
    </NavLink>
  );
}

function Divider() {
  return <div style={{ height: 1, background: "var(--line)", margin: "var(--sp-2) var(--sp-5)" }} />;
}

const sheetItemBase: React.CSSProperties = {
  display: "block",
  padding: "var(--sp-4) var(--sp-5)",
  textDecoration: "none",
  fontSize: "var(--t-body-size)",
  cursor: "pointer",
};

const wrapperStyle: React.CSSProperties = {
  position: "sticky",
  top: 0,
  zIndex: 1000,
};

const topBarStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  // Yatay boşluk güvenli alandan az olamaz (yatay modda çentik yanda kalır).
  paddingLeft: "max(var(--sp-4), var(--safe-left))",
  paddingRight: "max(var(--sp-4), var(--safe-right))",
  // Yükseklik güvenli alanı DA kapsar: materyal durum çubuğunun arkasına
  // uzanır, içerik ise onun altında ortalanır.
  height: "var(--nav-total)",
  paddingTop: "var(--safe-top)",
  boxSizing: "border-box",
};

const hamburgerStyle: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--line-strong)",
  color: "var(--text)",
  padding: "var(--sp-2) var(--sp-4)",
  borderRadius: "var(--r-md)",
  display: "flex",
  alignItems: "center",
  gap: "var(--sp-2)",
};

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
