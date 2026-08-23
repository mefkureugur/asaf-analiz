import { useEffect, useState } from "react";
import { useAuth } from "../../store/AuthContext";
import { useBildirim } from "../../hooks/useBildirim";

/* =====================================================================
   BİLDİRİM İZNİ KUTUSU

   Yalnızca kuruculara ve yalnızca izin henüz verilmemişse görünür.
   "Şimdi değil" denirse bu cihazda bir daha sorulmaz.
   ===================================================================== */

const ERTELENDI = "asaf-bildirim-ertelendi";

export default function BildirimKutusu() {
  const { user } = useAuth();
  const kurucu = user?.role?.trim().toLowerCase() === "admin";
  const { durum, izinIste, canliMesaj, temizle } = useBildirim(user?.uid, kurucu);
  const [ertelendi, setErtelendi] = useState(() => {
    try { return localStorage.getItem(ERTELENDI) === "1"; } catch { return false; }
  });

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

      {/* İzin daveti.
          NOT: sarmalayıcıda .page sınıfı KULLANILMAZ — o sınıf min-height:100dvh
          taşıyor ve altındaki sayfayı ekran dışına iterdi. */}
      {!ertelendi && (durum === "sorulmadi" || durum === "ana-ekran-gerekli" || durum === "desteklenmiyor") && (
        <div style={sarmalayici}>
          <div style={kutuStil}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontWeight: 700, marginBottom: "var(--sp-1)" }}>
                Yeni kayıtlardan haberdar ol
              </div>
              <div className="caption" style={{ lineHeight: 1.6 }}>
                {durum === "ana-ekran-gerekli" &&
                  "Bildirim alabilmek için uygulamayı ana ekrana ekleyip oradan açman gerekiyor. Safari sekmesinde iPhone bildirim göndermiyor."}
                {durum === "desteklenmiyor" &&
                  "Bu cihaz bildirim desteklemiyor. iPhone'da iOS 16.4 ve üzeri gerekiyor; ayrıca uygulamanın ana ekrandan açılması şart."}
                {durum === "sorulmadi" &&
                  "Bir şubeye yeni kayıt girildiğinde telefonuna anında bildirim gelsin."}
              </div>

              {/* Sorun yaşanırsa nedeni görünsün — sessizce kaybolmasın */}
              {durum !== "sorulmadi" && (
                <div className="caption" style={{ marginTop: "var(--sp-2)", color: "var(--text-3)" }}>
                  Durum: {durum} · {teshis}
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: "var(--sp-2)", flexShrink: 0 }}>
              {durum === "sorulmadi" && (
                <button className="press" onClick={izinIste} style={btnAc}>
                  Bildirimleri Aç
                </button>
              )}
              <button
                className="press"
                onClick={() => {
                  try { localStorage.setItem(ERTELENDI, "1"); } catch { /* yoksay */ }
                  setErtelendi(true);
                }}
                style={btnSonra}
              >
                Şimdi değil
              </button>
            </div>
          </div>
        </div>
      )}
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

const sarmalayici: React.CSSProperties = {
  width: "100%",
  maxWidth: 1280,
  marginInline: "auto",
  paddingLeft: "max(var(--sp-4), var(--safe-left))",
  paddingRight: "max(var(--sp-4), var(--safe-right))",
};

const kutuStil: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--sp-4)",
  flexWrap: "wrap",
  background: "var(--surface)",
  border: "1px solid var(--line)",
  borderLeft: "3px solid var(--accent)",
  borderRadius: "var(--r-md)",
  padding: "var(--sp-4)",
  marginTop: "var(--sp-4)",
  boxShadow: "var(--shadow-sm)",
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
