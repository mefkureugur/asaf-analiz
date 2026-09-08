import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { setGlobalOptions } from "firebase-functions/v2";
import * as admin from "firebase-admin";

admin.initializeApp();
const db = admin.firestore();
const messaging = admin.messaging();

// Avrupa bölgesi: kullanıcılar Türkiye'de, gecikme düşük olsun
setGlobalOptions({ region: "europe-west1", maxInstances: 10 });

/* =====================================================================
   YENİ KAYIT BİLDİRİMİ

   "records" koleksiyonuna elle bir kayıt eklendiğinde, rolü "admin"
   (Kurucu) olan kullanıcıların telefonlarına bildirim gönderir.

   Neden yalnızca elle eklenenler:
     Veri aktarımı 1806 kaydı toplu yazıyor. Bu tetikleyici her belge için
     çalıştığından, aktarım sırasında 1806 bildirim gönderilirdi. Bu yüzden
     yalnızca source === "manual" olan kayıtlar bildirim üretir.
   ===================================================================== */
/* =====================================================================
   OKUL İŞLETİM SİSTEMİ KÖPRÜSÜ

   Kayıt girildiğinde işletim sistemine "bir şey oldu, gidip bak" der.
   Gövde göndermez: oradaki kapı sayıyı bu istekten değil, doğrudan
   Firestore'dan okur. Böylece buradan yanlış bir sayı geçemez.

   Adres ve anahtar functions/.env dosyasından gelir. İkisi de tanımlı
   değilse köprü sessizce atlanır — bu fonksiyonun asıl işi bildirim
   göndermektir; köprü onun üstüne eklenmiş bir haberdir ve hiçbir
   koşulda bildirimi engellememelidir.
   ===================================================================== */
async function oisHaberVer(): Promise<void> {
  const adres = process.env.OIS_KOPRU_URL;
  const anahtar = process.env.OIS_KOPRU_ANAHTARI;
  if (!adres || !anahtar) return;
  try {
    const yanit = await fetch(adres, {
      method: "POST",
      headers: { "x-kopru-anahtari": anahtar },
      signal: AbortSignal.timeout(8000),
    });
    console.log(`OIS köprüsü: ${yanit.status}`);
  } catch (e) {
    // İşletim sistemi kapalıysa kayıt yine de girilmiş olmalı. Köprü
    // koparsa oradaki özet on beş dakikalık emniyet ağıyla tazelenir.
    console.warn("OIS köprüsüne ulaşılamadı:", e);
  }
}

export const yeniKayitBildirimi = onDocumentCreated("records/{kayitId}", async (event) => {
  const veri = event.data?.data();
  if (!veri) return;

  // Toplu aktarım bildirim üretmez
  if (veri.source !== "manual") return;

  // Köprü bildirimden ÖNCE: bildirim tarafında bir hata çıksa bile işletim
  // sistemi haberi almış olur.
  await oisHaberVer();

  const okul = String(veri.Okul || "Bilinmeyen şube");
  const ogrenci = String(veri.studentName || "").trim();
  const tutar = Number(veri.SonTutar || 0);
  const ekleyen = String(veri.addedByName || veri.addedBy || "").trim();

  // Kurucuların kayıtlı cihazlarını topla
  const kurucular = await db.collection("users").where("role", "==", "admin").get();

  const tokenlar: string[] = [];
  const tokenSahibi = new Map<string, string>(); // token -> kullanıcı belgesi
  kurucular.forEach((d) => {
    const liste: string[] = d.data().fcmTokens || [];
    liste.forEach((t) => {
      if (t && !tokenSahibi.has(t)) {
        tokenlar.push(t);
        tokenSahibi.set(t, d.id);
      }
    });
  });

  if (tokenlar.length === 0) {
    console.log("Bildirim gönderilecek cihaz yok");
    return;
  }

  const baslik = `${okul} — yeni kayıt`;
  const govde = [
    ogrenci || "Yeni öğrenci",
    tutar ? `₺${tutar.toLocaleString("tr-TR")}` : "",
    ekleyen ? `· ${ekleyen}` : "",
  ].filter(Boolean).join(" · ");

  const sonuc = await messaging.sendEachForMulticast({
    tokens: tokenlar,
    notification: { title: baslik, body: govde },
    data: {
      yol: "/reports/daily",
      okul,
      kayitId: event.params.kayitId,
    },
    webpush: {
      fcmOptions: { link: "https://asaf-analiz.web.app/reports/daily" },
      notification: {
        icon: "/logo192.png",
        badge: "/logo192.png",
        tag: "yeni-kayit",          // aynı etiketli bildirimler üst üste yığılmaz
        renotify: true,
      },
    },
  });

  // Geçersiz hale gelmiş cihaz kayıtlarını temizle
  const silinecek = new Map<string, string[]>();
  sonuc.responses.forEach((r, i) => {
    if (r.success) return;
    const kod = r.error?.code || "";
    if (kod.includes("registration-token-not-registered") || kod.includes("invalid-argument")) {
      const kullanici = tokenSahibi.get(tokenlar[i])!;
      const mevcut = silinecek.get(kullanici) || [];
      mevcut.push(tokenlar[i]);
      silinecek.set(kullanici, mevcut);
    }
  });

  await Promise.all(
    [...silinecek.entries()].map(([kullaniciId, tokenler]) =>
      db.collection("users").doc(kullaniciId).update({
        fcmTokens: admin.firestore.FieldValue.arrayRemove(...tokenler),
      })
    )
  );

  console.log(`Bildirim: ${sonuc.successCount} başarılı, ${sonuc.failureCount} başarısız`);
});
