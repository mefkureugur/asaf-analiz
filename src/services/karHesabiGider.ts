import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";
import asafFinansRaw from "../data/finans.json";

/* =====================================================================
   KÂR HESABI · FİNANS ÖZETİ

   Finans ekranının kullandığı modelin aynısı, tek farkı canlı dinlemek
   yerine bir kez okuması:

     Gider — Ağustos–Aralık dosyadan (finans.json), Ocak–Temmuz
             Firestore'dan; dolu ayların ortalaması on iki ile çarpılır.
     Ciro  — Firestore'daki "Ciro" kayıtlarının toplamı.

   Finans ekranına dokunmamak için mantık burada yeniden kuruldu; iki
   ekranın aynı rakamı verdiği tarayıcıda doğrulanıyor.
   ===================================================================== */

const AYLAR = [
  "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz",
];

/** Finans dosyasındaki kurum adları — panelin okul adlarından farklı. */
export const FINANS_KURUM = { yks: "Mefkure YKS", lgs: "Mefkure LGS" } as const;

interface FinansSatiri { Kurum: string; Alan: string; Dönem: string; [ay: string]: unknown }

const tutar = (v: unknown): number => {
  if (typeof v === "number") return v;
  return parseInt(String(v ?? "0").replace(/,/g, "")) || 0;
};

export interface FinansOzeti {
  /** Firestore'daki "Ciro" kayıtlarının toplamı. */
  ciro: number;
  /** Dolu ay ortalamasının on iki katı — Finans'taki "Gider" rakamı. */
  gider: number;
  /** Gider kaç aydan hesaplandı; sıfırsa o dönem için veri yok demektir. */
  doluAy: number;
}

export interface FinansOzetleri {
  donem: string;
  yks: FinansOzeti;
  lgs: FinansOzeti;
}

/** Her iki hattı tek Firestore okumasıyla getirir. */
export async function finansOzetleri(donem: string): Promise<FinansOzetleri> {
  const yil = parseInt(donem.split("-")[1]);

  let anlikGoruntuler: Record<string, any>[] = [];
  try {
    const sonuc = await getDocs(query(collection(db, "financeSnapshots"), where("year", "==", yil)));
    anlikGoruntuler = sonuc.docs.map((d) => d.data() as Record<string, any>);
  } catch {
    // Firestore okunamazsa dosyadaki aylarla devam edilir.
    anlikGoruntuler = [];
  }

  const hesapla = (kurum: string): FinansOzeti => {
    const dosya = (asafFinansRaw as FinansSatiri[]).filter(
      (r) => r.Dönem === donem && r.Alan === "Toplam Giderler" && r.Kurum === kurum,
    );
    const giderKayitlari = anlikGoruntuler.filter(
      (d) => d.unit === kurum && d.category === "Toplam Giderler",
    );

    const aylik = AYLAR.map((ay, i) => {
      if (i <= 4) return dosya.reduce((toplam, r) => toplam + tutar(r[ay]), 0);

      return giderKayitlari.reduce((toplam, d) => {
        const aylikDizi = d.expenses as number[] | undefined;
        if (aylikDizi && Number(aylikDizi[i]) > 0) return toplam + Number(aylikDizi[i]);

        // Eski kayıtlarda ay ayrımı yok; girilen aylara bölünerek dağıtılır.
        const dolular = d.filledMonths as number[] | undefined;
        if (dolular?.includes(i) && dolular.length > 0) {
          return toplam + Number(d.expenseRealSoFar || 0) / dolular.length;
        }
        return toplam;
      }, 0);
    });

    const dolu = aylik.filter((v) => v > 1000);
    const ortalama = dolu.length > 0 ? dolu.reduce((a, b) => a + b, 0) / dolu.length : 0;

    const ciro = anlikGoruntuler
      .filter((d) => d.unit === kurum && d.category === "Ciro")
      .reduce((toplam, d) => toplam + (Number(d.revenueTotal) || 0), 0);

    return { ciro, gider: Math.round(ortalama * 12), doluAy: dolu.length };
  };

  return { donem, yks: hesapla(FINANS_KURUM.yks), lgs: hesapla(FINANS_KURUM.lgs) };
}
