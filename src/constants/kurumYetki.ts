import { KURUMLAR, type KurumId } from "./kurumlar";

/* =====================================================================
   ŞUBE → KURUM EŞLEMESİ

   Kullanıcının yetkisi (users.branchId) Yetki Yönetimi'nde metin olarak
   tutuluyor: "Mefkure LGS", "Altınküre Lise" gibi. Senaryo modülü ise
   kurum kimliği kullanıyor: "mefkure_lgs", "altinkure_lise".

   Bu dosya ikisini birbirine bağlar. Türkçe karakter ve büyük/küçük harf
   farklarına takılmamak için normalize edilerek karşılaştırılır.
   ===================================================================== */

const normalize = (s: unknown): string =>
  String(s ?? "")
    .toLocaleLowerCase("tr-TR")
    .trim()
    .replace(/ı/g, "i").replace(/ğ/g, "g").replace(/ü/g, "u")
    .replace(/ş/g, "s").replace(/ö/g, "o").replace(/ç/g, "c")
    .replace(/[^a-z0-9]/g, "");

/** Kurum adından kimliğe (KURUMLAR listesinden türetilir) */
const ADDAN_KIMLIGE = new Map<string, KurumId>(
  KURUMLAR.map((k) => [normalize(k.name), k.id])
);

/** KURUMLAR'da doğrudan karşılığı olmayan şube adları */
const EK_ESLEME: Record<string, KurumId> = {
  // PLUS ve VİP, YKS kurumunun altında yönetiliyor
  mefkureplus: "mefkure_yks",
  mefkurevip: "mefkure_yks",
  mefkureyks: "mefkure_yks",
};

/**
 * Kullanıcının şubesine karşılık gelen kurum kimliği.
 * Eşleşme yoksa null döner (o kullanıcıya senaryo gösterilmez).
 */
export function branchIdToKurumId(branchId: unknown): KurumId | null {
  const anahtar = normalize(branchId);
  if (!anahtar) return null;
  return ADDAN_KIMLIGE.get(anahtar) ?? EK_ESLEME[anahtar] ?? null;
}
