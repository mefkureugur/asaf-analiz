import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";

/* =====================================================================
   KÂR HESABI · ORTAK MODEL

   Kâr Hesabı ve Kurs Hedefleri aynı rakamı vermek zorunda. Daha önce
   sabitler ve hat tanımları Kâr Hesabı sayfasının içinde duruyordu;
   ikinci ekran onları kopyalasaydı ilk değişiklikte iki ekran ayrışırdı.
   Bu yüzden model burada, iki sayfa da buradan okuyor.

   Modelin özeti:
     gider  = Finans'ın o dönem gideri × (1 + % artış)
              Finans'ta veri yoksa aşağıdaki yedek rakam kullanılır
     kâr    = ciro − gider
     hedef  = gider ÷ (1 − kâr marjı)      ← o marja ulaştıran ciro
   ===================================================================== */

/** Kayıtlı varsayımların Firestore koleksiyonu — dönem başına bir belge. */
export const KOLEKSIYON = "karHesabiVarsayimlari";

/** TÜİK Temmuz 2026 yıllık TÜFE. Kâr Hesabı ekranından değiştirilebilir. */
export const ENFLASYON = 31.75;

/** Kâr marjı hedefi, hat başına (%). Kaydedilmemişse bu geçerli. */
export type Hedefler = { y: number; l: number };
export const KAR_HEDEFI: Hedefler = { y: 20, l: 20 };

/** Finans'ta o döneme ait gider yoksa kullanılan yedek rakamlar. */
export const YKS_GIDER = 58_800_000;
export const LGS_GIDER = 16_000_000;

/** Finans rakamlarını önümüzdeki döneme taşıyan yüzdeler. */
export type Artislar = { y_ciro: number; y_gider: number; l_ciro: number; l_gider: number };
export const VARSAYILAN_ARTIS: Artislar = {
  y_ciro: ENFLASYON, y_gider: ENFLASYON, l_ciro: ENFLASYON, l_gider: ENFLASYON,
};

/* Okul adı veride farklı yazımlarla geçiyor ("Mefkure Plus", "MEFKURE Vip",
   "Mefkure VİP"). Türkçe I/İ yüzünden düz toLowerCase yetmez. */
export const sadelestir = (s: unknown): string =>
  String(s ?? "").toLocaleLowerCase("tr-TR").trim()
    .replace(/ı/g, "i").replace(/ğ/g, "g").replace(/ü/g, "u")
    .replace(/ş/g, "s").replace(/ö/g, "o").replace(/ç/g, "c");

export const YKS_HATLARI = ["mefkure plus", "mefkure vip"];
export const LGS_HATLARI = ["mefkure lgs"];

/**
 * MOOD, YKS cirosuna kayıt olarak sayılmaz.
 * Kâr Hesabı'nda ayrı bir "ek kaynak" kutusu olarak elle giriliyor;
 * kayıtlardan da sayılsaydı iki kez toplanırdı.
 */
export const moodMu = (sinif: unknown): boolean => sadelestir(sinif) === "mood";

/* Kâr Hesabı'ndaki kutular. ogr/ort dışındakiler "ek kaynaklar": ciroya
   kayıtlardan değil elle eklenen kalemler. Hatlara göre değişirler —
   MOOD yalnız YKS'de, birebir/özel ders ve deneme yalnız LGS'de. */
export const ALANLAR = {
  y: ["ogr", "ort", "mood", "yemek", "diger"],
  l: ["ogr", "ort", "biders", "ozel", "deneme", "yemek", "diger"],
} as const;

/** Ek kaynak kalemleri — ciroya eklenir, kayıt sayısına girmez. */
export const EK_ALANLAR = {
  y: ["mood", "yemek", "diger"],
  l: ["biders", "ozel", "deneme", "yemek", "diger"],
} as const;

export type Varsayimlar = Record<string, number>;

/** Kâr Hesabı ekranının kendi başlangıç değerleri. */
export const VARSAYILAN: Varsayimlar = {
  y_ogr: 131, y_ort: 200_000, y_mood: 5_000_000, y_yemek: 0, y_diger: 0,
  l_ogr: 45, l_ort: 170_000, l_biders: 0, l_ozel: 0, l_deneme: 0, l_yemek: 0, l_diger: 0,
};

/**
 * Bir hattın ek kaynak toplamı. Kaydedilmemiş kalem için ekranın kendi
 * varsayılanı geçerli — Kâr Hesabı da kutuları öyle dolduruyor, iki ekran
 * aynı MOOD rakamını göstersin.
 */
export function ekKaynakToplami(veri: Record<string, unknown> | null, on: "y" | "l"): number {
  return EK_ALANLAR[on].reduce((toplam, alan) => {
    const anahtar = `${on}_${alan}`;
    const deger = veri?.[anahtar];
    return toplam + (typeof deger === "number" ? deger : (VARSAYILAN[anahtar] ?? 0));
  }, 0);
}

export interface KayitliVarsayimlar {
  artis: Artislar;
  karHedefi: Hedefler;
  /** Hat başına ek kaynak toplamı — Kâr Hesabı bunu ciroya ekler. */
  ekKaynak: Hedefler;
}

/** Dönemin kayıtlı varsayımları; belge yoksa varsayılanlar döner. */
export async function karVarsayimlari(donem: number): Promise<KayitliVarsayimlar> {
  let d: Record<string, any> | null = null;
  try {
    const anlik = await getDoc(doc(db, KOLEKSIYON, String(donem)));
    d = anlik.exists() ? (anlik.data() as Record<string, any>) : null;
  } catch {
    // Okunamazsa varsayılanlarla devam edilir; ekran çalışmaya devam etsin.
    d = null;
  }

  const sayi = (v: unknown, yedek: number) => (typeof v === "number" ? v : yedek);
  // Eski kayıtlarda tek bir karHedefi vardı; o da geçerli sayılır.
  const eski = typeof d?.karHedefi === "number" ? d.karHedefi : null;

  return {
    ekKaynak: { y: ekKaynakToplami(d, "y"), l: ekKaynakToplami(d, "l") },
    artis: {
      y_ciro: sayi(d?.artis_y_ciro, ENFLASYON),
      y_gider: sayi(d?.artis_y_gider, ENFLASYON),
      l_ciro: sayi(d?.artis_l_ciro, ENFLASYON),
      l_gider: sayi(d?.artis_l_gider, ENFLASYON),
    },
    karHedefi: {
      y: sayi(d?.karHedefi_y, eski ?? KAR_HEDEFI.y),
      l: sayi(d?.karHedefi_l, eski ?? KAR_HEDEFI.l),
    },
  };
}

/**
 * Kâr Hesabı'nın gider projeksiyonu: Finans'ın ham gideri × (1 + % artış).
 * Finans'ta o dönemin gideri yoksa yedek rakam kullanılır ve `veriVar`
 * false döner — ekran rakamın nereden geldiğini söyleyebilsin.
 */
export function giderProjeksiyonu(
  finans: { gider: number; doluAy: number } | undefined,
  artisYuzdesi: number,
  yedek: number,
): { gider: number; hamGider: number; veriVar: boolean } {
  const veriVar = (finans?.doluAy ?? 0) > 0;
  const hamGider = veriVar ? finans!.gider : yedek;
  return { gider: Math.round(hamGider * (1 + artisYuzdesi / 100)), hamGider, veriVar };
}

/** O kâr marjına ulaştıran ciro: gider ÷ (1 − marj). */
export function karHedefiCirosu(gider: number, marjYuzdesi: number): number {
  return marjYuzdesi < 100 ? gider / (1 - marjYuzdesi / 100) : 0;
}
