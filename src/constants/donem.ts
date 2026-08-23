/* =====================================================================
   DÖNEM (KAYIT YILI) YÖNETİMİ

   Uygulama başlangıçta 2026'ya sabitlenmişti: kodun onlarca yerinde
   "2026" ve kıyas için "2025" elle yazılıydı. Ocak 2027'de yeni kayıtlar
   girildiğinde bu ekranlar boş görünecekti — çünkü hiçbiri 2027'yi
   tanımıyordu.

   Burada tek bir kaynak var. Aktif dönem TAKVİM YILINDAN türetilir:
   sözleşme tarihi "23.08.2026" olan kayıt "2026 dönemi"ne aittir. Ocak
   2027'de aktif dönem kendiliğinden 2027 olur, kıyas dönemi 2026.

   ÖNEMLİ: Bu davranış bugünkü (2026) davranışla birebir aynıdır; yalnızca
   yıl değiştiğinde kendini günceller.
   ===================================================================== */

/** Kayıt döneminin ait olduğu yıl — sözleşme tarihinin yılı. */
export function aktifDonem(): number {
  return new Date().getFullYear();
}

/** Karşılaştırma için bir önceki dönem. */
export function kiyasDonem(donem: number = aktifDonem()): number {
  return donem - 1;
}

/** Bir tarih metninden ("23.08.2026" veya "2026-08-23") yılı çıkarır. */
export function tarihinYili(tarih: unknown): number | null {
  const s = String(tarih ?? "").trim();
  if (!s) return null;
  // GG.AA.YYYY
  if (s.includes(".")) {
    const y = Number(s.split(".").pop());
    return Number.isFinite(y) && y > 1900 ? y : null;
  }
  // YYYY-AA-GG
  if (s.includes("-")) {
    const y = Number(s.split("-")[0]);
    return Number.isFinite(y) && y > 1900 ? y : null;
  }
  return null;
}

/**
 * Veride bulunan dönemleri yeniden eskiye sıralar.
 *
 * Veride hiç kayıt olmasa bile şunlar listeye eklenir:
 *   • gelecek dönem  — Aralık'ta önümüzdeki yılın kayıtları girilmeye
 *     başlanır; henüz kayıt yokken de o dönemi seçip bakabilmek gerekir
 *   • aktif dönem    — içinde bulunulan yıl (varsayılan seçim)
 *   • kıyas dönemi   — bir önceki yıl
 */
export function donemListesi(
  kayitlar: { SözleşmeTarihi?: unknown }[],
  ekstra: number[] = []
): number[] {
  const set = new Set<number>([aktifDonem() + 1, aktifDonem(), kiyasDonem(), ...ekstra]);
  kayitlar.forEach((k) => {
    const y = tarihinYili(k.SözleşmeTarihi);
    if (y) set.add(y);
  });
  return [...set].sort((a, b) => b - a);
}

/** Hedeflerin saklandığı belge kimliği: targets/2026, targets/2027 … */
export function hedefBelgeKimligi(donem: number = aktifDonem()): string {
  return String(donem);
}

/**
 * Finans modülünün kullandığı eğitim-öğretim yılı biçimi: "2025-2026".
 * Kayıt dönemi 2026 ise eğitim yılı 2025-2026'dır.
 */
export function egitimYili(donem: number = aktifDonem()): string {
  return `${donem - 1}-${donem}`;
}

/** Finans dönem listesi — en eskiden yeniye, aktif dönem dahil. */
export function egitimYiliListesi(geriyeKacYil = 2): string[] {
  const su = aktifDonem();
  const liste: string[] = [];
  for (let i = geriyeKacYil; i >= 0; i--) liste.push(egitimYili(su - i));
  return liste;
}
