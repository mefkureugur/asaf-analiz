import { useEffect, useMemo } from "react";
import type { Kayit } from "./useRecords";

/* =====================================================================
   UYGULAMA İKONU ROZETİ (WhatsApp'taki kırmızı sayı)

   Görülmemiş yeni kayıt sayısını uygulama ikonunun üstünde gösterir.
   "Görüldü" bilgisi cihazda saklanır; kurucu Günlük Rapor sayfasını
   açtığında sıfırlanır.

   Destek: ana ekrana eklenmiş uygulamalarda çalışır (iOS 16.4+, Android,
   masaüstü Chrome). Desteklenmeyen yerde sessizce hiçbir şey yapmaz.
   ===================================================================== */

const ANAHTAR = "asaf-son-gorulen";

function sonGorulen(): number {
  try {
    const v = Number(localStorage.getItem(ANAHTAR));
    return Number.isFinite(v) && v > 0 ? v : 0;
  } catch {
    return 0;
  }
}

function zamanDamgasi(k: Kayit): number {
  // createdAt Firestore Timestamp olarak gelir
  const c: any = k.createdAt;
  if (c?.toMillis) return c.toMillis();
  if (c?.seconds) return c.seconds * 1000;
  return 0;
}

export function useRozet(kayitlar: Kayit[], aktif: boolean) {
  const gorulmeyen = useMemo(() => {
    if (!aktif) return 0;
    const esik = sonGorulen();
    // İlk kullanımda eşik yok — geçmiş tüm kayıtları saymayalım
    if (!esik) return 0;
    return kayitlar.filter((k) => k.kaynak === "manual" && zamanDamgasi(k) > esik).length;
  }, [kayitlar, aktif]);

  useEffect(() => {
    if (!aktif) return;
    const nav: any = navigator;
    if (!nav.setAppBadge) return; // desteklenmiyorsa sessizce geç
    if (gorulmeyen > 0) nav.setAppBadge(gorulmeyen).catch(() => {});
    else nav.clearAppBadge?.().catch(() => {});
  }, [gorulmeyen, aktif]);

  /** Kurucu raporu açtığında çağrılır: rozet sıfırlanır. */
  const gorulduIsaretle = () => {
    try { localStorage.setItem(ANAHTAR, String(Date.now())); } catch { /* yoksay */ }
    const nav: any = navigator;
    nav.clearAppBadge?.().catch(() => {});
  };

  return { gorulmeyen, gorulduIsaretle };
}

/** İlk girişte eşik yoksa "şu an"ı işaretle — eski kayıtlar bildirim saymasın. */
export function rozetBaslat() {
  try {
    if (!localStorage.getItem(ANAHTAR)) {
      localStorage.setItem(ANAHTAR, String(Date.now()));
    }
  } catch { /* yoksay */ }
}
