import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../store/AuthContext";
import { updatePassword } from "firebase/auth";
import { auth } from "../firebase";
import Modal from "./ui/Modal";
import { TemaIkonu } from "./ui/TemaSecici";

/* =====================================================================
   MASAÜSTÜ GEZİNMESİ — SOL KENAR ÇUBUĞU

   Menü daha önce üstte yatay bir şeritti ve maskeli kaydırma gerektirdi:
   ekran genişledikçe bağlantı sayısı arttı, sığmayanlar kaydırmanın
   arkasında kaldı — bir bağlantının var olduğunu görmek için kaydırmak
   gerekiyordu.

   Dikey listede hepsi aynı anda görünür ve okuma yönü doğal. Bölümler
   ayırıcılarla gruplanır: gezinme, operasyon, yönetim.

   Mobilde bu bileşen hiç çizilmez; orada TopNavMobile ve Sheet var.
   ===================================================================== */

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

  const showAdminMenu = isAdmin || user?.role === "admin" || user?.email === "ugur@asaf.com";
  const isMefkureManager = (user?.branchId || "").toLocaleLowerCase("tr-TR").includes("mefkure");

  return (
    <nav className="material-nav side-nav" style={kenarCubugu} aria-label="Ana gezinme">
      {/* Marka — beş tık şifre değiştirme kapısını açar */}
      <div
        onClick={handleLogoClick}
        className="press"
        style={marka}
      >
        <img src="/logo512.png" alt="" style={{ height: 34, width: 34, borderRadius: "var(--r-sm)", objectFit: "cover", flexShrink: 0 }} />
        <div style={{ fontWeight: 800, color: "var(--text)", fontSize: "1.05rem", letterSpacing: "-0.01em" }}>
          ASAF <span style={{ color: "var(--accent)" }}>ANALİZ</span>
        </div>
      </div>

      {/* Bağlantılar — uzun listede kendi içinde kayar, marka ve kullanıcı sabit kalır */}
      <div style={liste}>
        <Baglanti to="/dashboard" pathname={pathname}>🏠 Ana Sayfa</Baglanti>
        <Baglanti to="/compare" pathname={pathname}>⚖️ Karşılaştırma</Baglanti>

        {showAdminMenu ? (
          <Baglanti to="/targets" pathname={pathname}>🎯 Hedef Girişi</Baglanti>
        ) : (
          <Baglanti to="/performans" pathname={pathname}>🚀 Performans İzleme</Baglanti>
        )}

        {/* Kayıt Listesi yalnızca kurum müdürlerinde */}
        {!showAdminMenu && (
          <Baglanti to="/ogrenci-listesi" pathname={pathname}>✍️ Kayıt Listesi</Baglanti>
        )}

        {isMefkureManager && (
          <Baglanti to="/reports/okul-sayilari" pathname={pathname}>🏫 Okul Sayıları</Baglanti>
        )}

        {showAdminMenu && (
          <Baglanti to="/finance/view" eslesen="/finance" pathname={pathname}>💰 Finans</Baglanti>
        )}

        {/* Senaryo modülü herkese açık; müdür yalnızca kendi kurumunu görür */}
        <Baglanti to="/scenarios" pathname={pathname}>📊 Senaryo Hesap</Baglanti>

        {/* Kâr Hesabı ve Kurs Hedefleri: kurucular + Mefkure müdürleri (YKS / LGS) */}
        {(showAdminMenu || isMefkureManager) && (
          <>
            <Baglanti to="/kar-hesabi" pathname={pathname}>📊 Kâr Hesabı</Baglanti>
            <Baglanti to="/kurs-hedefleri" pathname={pathname}>🏁 Kurs Hedefleri</Baglanti>
          </>
        )}

        <Ayirici etiket="Operasyon" />
        <Baglanti to="/daily" pathname={pathname}>✍️ Günlük Giriş</Baglanti>
        <Baglanti to="/reports/daily" pathname={pathname}>📋 Günlük Rapor</Baglanti>

        {showAdminMenu && (
          <>
            <Ayirici etiket="Yönetim" />
            <Baglanti to="/veri-aktarim" pathname={pathname}>📥 Veri Aktarımı</Baglanti>
            <Baglanti to="/user-management" pathname={pathname} vurgu>🛡️ Yetki Yönetimi</Baglanti>
          </>
        )}
      </div>

      {/* Kullanıcı — çubuğun dibine yaslı */}
      <div style={kullaniciAlani}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)", minWidth: 0 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {user?.displayName}
            </div>
            <div className="caption" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {user?.branchId}
            </div>
          </div>
          <TemaIkonu />
        </div>
        <button onClick={logout} className="press" style={cikisBtn}>🚪 Çıkış</button>
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

/* ------------------------------------------------------------ parçalar */

/**
 * Bir gezinme bağlantısı. Etkin olan sol kenarındaki çubukla işaretlenir:
 * dikey listede zemin farkı tek başına zayıf kalıyor, kenar çizgisi göz
 * listeyi tararken hangi satırda olduğunu bir bakışta veriyor.
 *
 * `eslesen`, adresi hedeften farklı olan bağlantılar için: Finans
 * /finance/view'a gider ama /finance/* altındayken de etkin görünmeli.
 */
function Baglanti({
  to, pathname, children, eslesen, vurgu,
}: { to: string; pathname: string; children: React.ReactNode; eslesen?: string; vurgu?: boolean }) {
  const kok = eslesen ?? to;
  const etkin = pathname === kok || pathname.startsWith(kok + "/");

  return (
    <Link
      to={to}
      className="press"
      aria-current={etkin ? "page" : undefined}
      style={{
        position: "relative",
        display: "block",
        padding: "var(--sp-2) var(--sp-3)",
        paddingLeft: "var(--sp-4)",
        borderRadius: "var(--r-sm)",
        textDecoration: "none",
        color: etkin ? "var(--text)" : vurgu ? "var(--accent)" : "var(--text-2)",
        background: etkin ? "var(--surface-raised)" : "transparent",
        fontWeight: etkin ? 700 : 500,
        fontSize: "0.88rem",
        border: etkin ? "1px solid var(--line-strong)" : "1px solid transparent",
        transition: "background-color var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out)",
      }}
    >
      {etkin && (
        <span
          aria-hidden
          style={{
            position: "absolute", left: 4, top: "50%", transform: "translateY(-50%)",
            width: 3, height: "1.1em", borderRadius: "var(--r-full)", background: "var(--accent)",
          }}
        />
      )}
      {children}
    </Link>
  );
}

/** Bölüm ayırıcısı: ince çizgi ve üstünde küçük bir başlık. */
function Ayirici({ etiket }: { etiket: string }) {
  return (
    <div style={{ marginTop: "var(--sp-3)", paddingTop: "var(--sp-3)", borderTop: "1px solid var(--line)" }}>
      <div className="caption" style={{ textTransform: "uppercase", letterSpacing: "var(--t-label-ls)", paddingLeft: "var(--sp-4)", marginBottom: "var(--sp-1)" }}>
        {etiket}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- stiller */

const kenarCubugu: React.CSSProperties = {
  position: "fixed",
  top: 0,
  bottom: 0,
  left: 0,
  width: "var(--nav-w)",
  zIndex: 1000,
  display: "flex",
  flexDirection: "column",
  // Materyal çentiğin arkasına uzanır; içerik güvenli alandan sonra başlar.
  paddingLeft: "max(var(--sp-3), var(--safe-left))",
  paddingRight: "var(--sp-3)",
  paddingBottom: "calc(var(--sp-3) + var(--safe-bottom))",
};

const marka: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--sp-3)",
  cursor: "pointer",
  userSelect: "none",
  padding: "var(--sp-4) var(--sp-2)",
  flexShrink: 0,
};

const liste: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 2,
  flex: 1,
  minHeight: 0,
  overflowY: "auto",
  paddingBottom: "var(--sp-3)",
};

const kullaniciAlani: React.CSSProperties = {
  flexShrink: 0,
  borderTop: "1px solid var(--line)",
  paddingTop: "var(--sp-3)",
  display: "flex",
  flexDirection: "column",
  gap: "var(--sp-2)",
};

const cikisBtn: React.CSSProperties = {
  background: "transparent",
  border: "1px solid var(--line-strong)",
  color: "var(--danger)",
  padding: "var(--sp-2) var(--sp-3)",
  borderRadius: "var(--r-sm)",
  fontWeight: 600,
  fontSize: "0.85rem",
  width: "100%",
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
