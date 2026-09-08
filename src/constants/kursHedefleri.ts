/* =====================================================================
   KURS DÖNEM HEDEFLERİ

   Bunlar Hedefler ekranındaki (targets/{dönem}) şube hedeflerinden AYRIDIR.
   Orası aylık/yıllık şube kırılımıdır ve yönetim elle doldurur; burası
   kurucuların kurslar için koyduğu dönemin bağlayıcı hattır — ekranda
   uyarı üretmek için kullanılır, kimse ekrandan değiştiremez.

   Yıl koda gömülmez: hedefler döneme göre anahtarlanır, aktif dönem
   donem.ts'ten gelir. Yeni dönemin hedefi buraya eklenene kadar sayfa
   "hedef tanımlı değil" der — sessizce eski yılın hedefini kullanmaz.
   ===================================================================== */

export type KursHatti = "yks" | "lgs";

export interface KursHedefi {
  /** Ekranda görünen ad */
  ad: string;
  /** Hangi şube adlarından oluşuyor (veri sadeleştirilerek eşleşir) */
  hatlar: string[];
  /** Dönem sonu öğrenci hedefi */
  ogrenci: number;
  /** Dönem sonu ciro hedefi (₺) */
  ciro: number;
  /** Kartın vurgu rengi — tasarım tokenı */
  renk: string;
}

/** Dönem → hat → hedef. Yeni dönem için buraya blok eklenir. */
const HEDEFLER: Record<number, Record<KursHatti, KursHedefi>> = {
  2026: {
    yks: {
      ad: "Mefkure YKS",
      hatlar: ["Mefkure PLUS", "Mefkure VİP"],
      ogrenci: 400,
      ciro: 80_000_000,
      renk: "var(--sube-plus)",
    },
    lgs: {
      ad: "Mefkure LGS",
      hatlar: ["Mefkure LGS"],
      ogrenci: 120,
      ciro: 23_000_000,
      renk: "var(--sube-lgs)",
    },
  },
};

/** O dönemin kurs hedefleri; tanımlı değilse null. */
export function kursHedefleri(donem: number): Record<KursHatti, KursHedefi> | null {
  return HEDEFLER[donem] ?? null;
}

/**
 * Veride hangi okul adları bu hatta sayılır.
 * "Mefkure Plus", "MEFKURE Vip", "Mefkure VİP" gibi yazım farkları
 * sadeleştirme ile toplanır; VİP Türkçe İ ile de geçiyor.
 */
export const HAT_OKULLARI: Record<KursHatti, string[]> = {
  yks: ["mefkure plus", "mefkure vip"],
  lgs: ["mefkure lgs"],
};
