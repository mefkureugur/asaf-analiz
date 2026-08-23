import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../../store/AuthContext";
import { useRecords } from "../../hooks/useRecords";
import { useRozet, rozetBaslat } from "../../hooks/useRozet";

/* =====================================================================
   ROZET YÖNETİCİSİ

   Görülmemiş yeni kayıt sayısını uygulama ikonuna basar. Kurucu Günlük
   Rapor sayfasını açtığında sıfırlanır.

   Görsel bir şey çizmez; yalnızca ikon rozetini yönetir.
   ===================================================================== */
export default function RozetYoneticisi() {
  const { user } = useAuth();
  const kurucu = user?.role?.trim().toLowerCase() === "admin";
  const { tumKayitlar } = useRecords();
  const { gorulduIsaretle } = useRozet(tumKayitlar, kurucu);
  const { pathname } = useLocation();

  // İlk girişte eşiği "şimdi" yap; geçmiş kayıtlar rozete sayılmasın
  useEffect(() => { if (kurucu) rozetBaslat(); }, [kurucu]);

  // Günlük Rapor açıldığında görülmüş sayılır
  useEffect(() => {
    if (kurucu && pathname.startsWith("/reports/daily")) gorulduIsaretle();
  }, [pathname, kurucu, gorulduIsaretle]);

  return null;
}
