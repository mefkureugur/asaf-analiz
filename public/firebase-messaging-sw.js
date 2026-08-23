/* =====================================================================
   BİLDİRİM SERVİS ÇALIŞANI (service worker)

   Uygulama kapalıyken bile arka planda çalışır ve gelen bildirimleri
   gösterir. Firebase bu dosyayı TAM OLARAK bu adda ve kök dizinde arar:
   /firebase-messaging-sw.js

   Not: Bu dosya uygulamanın geri kalanından bağımsızdır, modül sistemi
   kullanamaz; bu yüzden Firebase'in "compat" sürümü yükleniyor.
   ===================================================================== */

importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyCILtbLmDourU4xKZu-zKntMABpemBLOXc",
  authDomain: "asaf-analiz.firebaseapp.com",
  projectId: "asaf-analiz",
  storageBucket: "asaf-analiz.firebasestorage.app",
  messagingSenderId: "43481419846",
  appId: "1:43481419846:web:b9dd2bbd986d2188e9fa47",
});

const messaging = firebase.messaging();

/* Uygulama kapalı / arka plandayken gelen bildirim */
messaging.onBackgroundMessage((payload) => {
  const baslik = payload.notification?.title || "Yeni kayıt";
  const govde = payload.notification?.body || "";

  self.registration.showNotification(baslik, {
    body: govde,
    icon: "/logo192.png",
    badge: "/logo192.png",
    tag: "yeni-kayit",
    renotify: true,
    data: { yol: payload.data?.yol || "/reports/daily" },
  });
});

/* Bildirime dokunulunca uygulamayı aç — açıksa öne getir */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const yol = event.notification.data?.yol || "/reports/daily";
  const hedef = new URL(yol, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((pencereler) => {
      for (const p of pencereler) {
        if ("focus" in p) {
          p.navigate?.(hedef);
          return p.focus();
        }
      }
      return self.clients.openWindow(hedef);
    })
  );
});
