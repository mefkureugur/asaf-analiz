import { useEffect, useState } from "react";
import { useAuth } from "../../store/AuthContext";
import { useBildirim } from "../../hooks/useBildirim";
import Modal from "./Modal";

/* =====================================================================
   BİLDİRİM İZNİ KUTUSU

   Yalnızca kuruculara ve yalnızca izin henüz verilmemişse görünür.
   "Şimdi değil" denirse bu cihazda bir daha sorulmaz.
   ===================================================================== */

const ERTELENDI = "asaf-bildirim-ertelendi";

/**
 * Görünen adı hitap için düzenler.
 * Bazı hesaplarda ad e-postadan türetildiği için küçük harfli olabiliyor
 * ("ugur"), bazılarında tam ad yazılı ("Uğur Yılmaz"). Hitapta yalnızca
 * ilk isim kullanılır ve Türkçe kurallarına göre büyütülür.
 */
function hitapAdi(gorunenAd: unknown, eposta: unknown): string {
  const ham = String(gorunenAd || "").trim() || String(eposta || "").split("@")[0] || "";
  const ilk = ham.split(/\s+/)[0] || "";
  if (!ilk) return "";
  return ilk.charAt(0).toLocaleUpperCase("tr-TR") + ilk.slice(1).toLocaleLowerCase("tr-TR");
}

export default function BildirimKutusu() {
  const { user } = useAuth();
  const kurucu = user?.role?.trim().toLowerCase() === "admin";
  const { durum, izinIste, canliMesaj, temizle } = useBildirim(user?.uid, kurucu);
  const [ertelendi, setErtelendi] = useState(() => {
    try { return localStorage.getItem(ERTELENDI) === "1"; } catch { return false; }
  });

  const ad = hitapAdi(user?.displayName, user?.email);

  const erteleVeKapat = () => {
    try { localStorage.setItem(ERTELENDI, "1"); } catch { /* yoksay */ }
    setErtelendi(true);
  };

  if (!kurucu) return null;

  // Sorun giderme için: hangi koşulun sağlanmadığı tek bakışta görünsün
  const teshis = [
    typeof Notification !== "undefined" ? "bildirim API var" : "bildirim API yok",
    "serviceWorker" in navigator ? "sw var" : "sw yok",
    window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true
      ? "ana ekrandan açık"
      : "tarayıcı sekmesi",
  ].join(" · ");

  return (
    <>
      {/* Uygulama açıkken gelen bildirim — üstte kısa bir şerit */}
      {canliMesaj && (
        <div role="status" onClick={temizle} style={seritStil}>
          {canliMesaj}
        </div>
      )}

      {/* İzin daveti — kurucu uygulamayı ilk açtığında büyük ve net çıkar */}
      <Modal
        open={!ertelendi && (durum === "sorulmadi" || durum === "ana-ekran-gerekli" || durum === "desteklenmiyor")}
        onClose={erteleVeKapat}
        title={ad ? `${ad} Bey, Selamün Aleyküm` : "Selamün Aleyküm"}
        genis
        footer={
          <>
            {durum === "sorulmadi" && (
              <button className="press" onClick={izinIste} style={btnAc}>
                Bildirimleri Aç
              </button>
            )}
            <button className="press" onClick={erteleVeKapat} style={btnSonra}>
              Şimdi değil
            </button>
          </>
        }
      >
        <p style={{ fontSize: "1rem", lineHeight: 1.7, color: "var(--text-2)", margin: 0 }}>
          {durum === "sorulmadi" && (
            <>
              Bildirim izni verip bildirimlerinizi açarsanız <strong style={{ color: "var(--text)" }}>her
              kayıtta</strong> size bildirim gelecek.
              <br /><br />
              Teşekkürler.
            </>
          )}
          {durum === "ana-ekran-gerekli" && (
            <>
              Bildirim alabilmeniz için uygulamayı <strong style={{ color: "var(--text)" }}>ana ekrana
              ekleyip</strong> oradan açmanız gerekiyor. Safari sekmesinde iPhone bildirim göndermiyor.
              <br /><br />
              Teşekkürler.
            </>
          )}
          {durum === "desteklenmiyor" && (
            <>
              Bu cihaz bildirim desteklemiyor. iPhone'da <strong style={{ color: "var(--text)" }}>iOS 16.4
              ve üzeri</strong> gerekiyor; ayrıca uygulamanın ana ekrandan açılması şart.
              <br /><br />
              Teşekkürler.
            </>
          )}
        </p>

        {durum !== "sorulmadi" && (
          <div className="caption" style={{ marginTop: "var(--sp-4)", color: "var(--text-3)" }}>
            Durum: {durum} · {teshis}
          </div>
        )}
      </Modal>

    </>
  );
}

/** Bildirim izni reddedilmişse ayarlardan açması gerektiğini söyler. */
export function BildirimDurumSatiri() {
  const { user } = useAuth();
  const kurucu = user?.role?.trim().toLowerCase() === "admin";
  const { durum } = useBildirim(user?.uid, kurucu);
  const [gorunur, setGorunur] = useState(false);

  useEffect(() => { setGorunur(durum === "reddedildi"); }, [durum]);
  if (!kurucu || !gorunur) return null;

  return (
    <div className="caption" style={{ padding: "var(--sp-3) var(--sp-5)", color: "var(--warning)" }}>
      Bildirimler kapalı. Açmak için telefon ayarlarından bu uygulamaya bildirim izni vermelisin.
    </div>
  );
}

const seritStil: React.CSSProperties = {
  position: "sticky",
  top: "var(--nav-total)",
  zIndex: 800,
  margin: "0 auto",
  maxWidth: 720,
  background: "color-mix(in srgb, var(--accent) 14%, var(--surface))",
  border: "1px solid color-mix(in srgb, var(--accent) 40%, transparent)",
  color: "var(--text)",
  borderRadius: "var(--r-md)",
  padding: "var(--sp-3) var(--sp-4)",
  marginTop: "var(--sp-3)",
  fontSize: "0.88rem",
  fontWeight: 600,
  cursor: "pointer",
  boxShadow: "var(--shadow-md)",
  animation: "asaf-rise 300ms var(--ease-out) both",
};



const btnAc: React.CSSProperties = {
  background: "var(--accent)",
  color: "var(--accent-ink)",
  border: "none",
  padding: "var(--sp-3) var(--sp-4)",
  borderRadius: "var(--r-sm)",
  fontWeight: 700,
  fontSize: "0.85rem",
  whiteSpace: "nowrap",
};

const btnSonra: React.CSSProperties = {
  background: "transparent",
  color: "var(--text-3)",
  border: "1px solid var(--line-strong)",
  padding: "var(--sp-3) var(--sp-4)",
  borderRadius: "var(--r-sm)",
  fontWeight: 600,
  fontSize: "0.85rem",
  whiteSpace: "nowrap",
};
