import { useState, type CSSProperties } from "react";

/* =====================================================================
   SAYI GİRDİSİ — rakam alanları için tek doğru giriş

   Neden ayrı bir bileşen: <input type="number"> ile sayı state'ini
   doğrudan birbirine bağlamak iki gerçek soruna yol açıyor.

   1) Son rakam silinince metin "" olur, Number("") → 0 döner ve kutuya
      "0" yazılır. Kullanıcı alanı boşaltamaz; temizleyip yeniden yazmak
      için önce o sıfırı silmesi gerekir.
   2) type="number" alanı, geçerli olmayan ara adımlarda boş metin döner.
      "1,5" yazarken "1," adımında değer sıfırlanır — ondalık yazılamaz.

   Çözüm: kullanıcının yazdığı METİN burada saklanır, dışarıya yalnızca
   SAYI verilir. Alan boşken dışarısı 0 görür ama kutu boş kalır; odak
   çıkınca kutu gerçek değere döner. Böylece yazma anı bozulmaz, hesap
   da her an tutarlı olur.
   ===================================================================== */

interface Props {
  /** Dışarıdaki gerçek değer. Tanımsız ise kutu boş başlar. */
  deger: number | undefined;
  degistir: (deger: number) => void;
  min?: number;
  max?: number;
  /** Ondalık (virgüllü) girişe izin ver — saat, oran gibi alanlar için. */
  ondalikli?: boolean;
  placeholder?: string;
  style?: CSSProperties;
  className?: string;
  "aria-label"?: string;
}

export default function SayiGirdisi({
  deger, degistir, min, max, ondalikli = false, placeholder, style, className, ...erisim
}: Props) {
  // null = "kullanıcı şu an yazmıyor, dışarıdaki değeri göster"
  const [taslak, setTaslak] = useState<string | null>(null);

  const gorunen =
    taslak ??
    (deger === undefined || deger === null || !Number.isFinite(deger)
      ? ""
      : ondalikli ? String(deger).replace(".", ",") : String(deger));

  const kelepce = (n: number) => {
    let v = n;
    if (min !== undefined) v = Math.max(min, v);
    if (max !== undefined) v = Math.min(max, v);
    return v;
  };

  const yaz = (ham: string) => {
    // Yalnızca anlamlı karakterler kalsın; eksi yalnızca başta ve yalnızca
    // negatif değere izin varsa geçerli.
    let temiz = ham.replace(ondalikli ? /[^\d.,-]/g : /[^\d-]/g, "");
    const negatifOlabilir = min === undefined || min < 0;
    const eksi = negatifOlabilir && temiz.startsWith("-") ? "-" : "";
    temiz = eksi + temiz.replace(/-/g, "");

    // Tek ayırıcı: "1,5,2" gibi girişler tek virgüle indirgenir.
    if (ondalikli) {
      const parcalar = temiz.split(/[.,]/);
      if (parcalar.length > 1) temiz = parcalar[0] + "," + parcalar.slice(1).join("");
    }

    setTaslak(temiz);

    // Boş kutu dışarıya 0 der; ama kutu boş kalmaya devam eder.
    const sayi = temiz === "" || temiz === "-" ? 0 : Number(temiz.replace(",", "."));
    if (Number.isFinite(sayi)) degistir(kelepce(sayi));
  };

  return (
    <input
      type="text"
      inputMode={ondalikli ? "decimal" : "numeric"}
      value={gorunen}
      onChange={(e) => yaz(e.target.value)}
      onBlur={() => setTaslak(null)}
      placeholder={placeholder}
      style={style}
      className={className}
      {...erisim}
    />
  );
}
