import { useCallback, useEffect, useState } from "react";
import { getMessaging, getToken, onMessage, isSupported } from "firebase/messaging";
import { doc, updateDoc, arrayUnion } from "firebase/firestore";
import app, { db } from "../firebase";

/* =====================================================================
   BİLDİRİM YÖNETİMİ (yalnızca kurucular)

   Nasıl çalışır:
     1. Kullanıcı izin verir  -> tarayıcı bir "cihaz anahtarı" (token) üretir
     2. Bu anahtar users/{uid}.fcmTokens dizisine yazılır
     3. Yeni kayıt girildiğinde sunucudaki fonksiyon o anahtarlara bildirim yollar

   iPhone notu: iOS'ta bildirim yalnızca uygulama ANA EKRANA EKLENMİŞSE
   çalışır (iOS 16.4+). Safari sekmesinde tarayıcı izin bile sormaz.
   ===================================================================== */

// Firebase Console > Project Settings > Cloud Messaging > Web Push certificates
const VAPID_ANAHTARI =
  "BHF44yjS06G4Wsv4mtEP9gYmfzmF8f2up3piPzQjvlTO3IDTvcz3Yq1s1MjUXlEg-T8LipVLO6gJNXYN6OUCWNI";

export type BildirimDurumu =
  | "kontrol-ediliyor"
  | "desteklenmiyor"   // tarayıcı/işletim sistemi bildirim desteklemiyor
  | "ana-ekran-gerekli" // iOS'ta Safari sekmesinde açık
  | "sorulmadi"        // henüz izin istenmedi
  | "reddedildi"
  | "acik";

/** iOS'ta uygulama ana ekrandan mı açılmış? */
function anaEkrandanMiAcildi(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true
  );
}

function iOSmu(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export function useBildirim(uid: string | undefined, aktif: boolean) {
  // Baslangic degeri senkron hesaplanabilenlerden secilir; efekt icinde
  // senkron setState cagirmak zincirleme render tetikliyor.
  const [durum, setDurum] = useState<BildirimDurumu>(() => {
    if (!aktif) return "desteklenmiyor";
    if (typeof window === "undefined") return "kontrol-ediliyor";
    if (iOSmu() && !anaEkrandanMiAcildi()) return "ana-ekran-gerekli";
    if (!("Notification" in window) || !("serviceWorker" in navigator)) return "desteklenmiyor";
    const izin = Notification.permission;
    return izin === "granted" ? "acik" : izin === "denied" ? "reddedildi" : "sorulmadi";
  });
  const [mesaj, setMesaj] = useState<string>("");

  /* ---- Tarayıcı desteğini asenkron doğrula ----
     Yukarıdaki senkron tahmin çoğu durumda doğru; burada yalnızca
     Firebase'in kendi destek kontrolü yanlışlarsa düzeltiliyor. */
  useEffect(() => {
    if (!aktif) return;
    let iptal = false;
    isSupported()
      .then((destekli) => {
        if (iptal || destekli) return;
        setDurum(iOSmu() && !anaEkrandanMiAcildi() ? "ana-ekran-gerekli" : "desteklenmiyor");
      })
      .catch(() => {});
    return () => { iptal = true; };
  }, [aktif]);

  /* ---- İzin verilmişse cihaz anahtarını tazele ----
     Anahtar zamanla değişebilir; her açılışta yenilenip kaydediliyor. */
  useEffect(() => {
    if (durum !== "acik" || !uid) return;
    let iptal = false;

    (async () => {
      try {
        const kayit = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
        const token = await getToken(getMessaging(app), {
          vapidKey: VAPID_ANAHTARI,
          serviceWorkerRegistration: kayit,
        });
        if (!token || iptal) return;
        await updateDoc(doc(db, "users", uid), { fcmTokens: arrayUnion(token) });
      } catch (e) {
        console.warn("Bildirim anahtarı alınamadı:", e);
      }
    })();

    return () => { iptal = true; };
  }, [durum, uid]);

  /* ---- Uygulama AÇIKKEN gelen bildirim ---- */
  useEffect(() => {
    if (durum !== "acik") return;
    let cozUlme: (() => void) | undefined;
    (async () => {
      if (!(await isSupported().catch(() => false))) return;
      cozUlme = onMessage(getMessaging(app), (payload) => {
        const b = payload.notification?.title || "Yeni kayıt";
        const g = payload.notification?.body || "";
        setMesaj(`${b} — ${g}`);
        // 6 saniye sonra kendiliğinden kaybolur
        window.setTimeout(() => setMesaj(""), 6000);
      });
    })();
    return () => cozUlme?.();
  }, [durum]);

  /* ---- İzin iste ---- */
  const izinIste = useCallback(async () => {
    try {
      const izin = await Notification.requestPermission();
      setDurum(izin === "granted" ? "acik" : izin === "denied" ? "reddedildi" : "sorulmadi");
      return izin === "granted";
    } catch {
      setDurum("reddedildi");
      return false;
    }
  }, []);

  return { durum, izinIste, canliMesaj: mesaj, temizle: () => setMesaj("") };
}
