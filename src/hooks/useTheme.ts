import { useSyncExternalStore, useCallback } from "react";

/* =====================================================================
   TEMA YÖNETİMİ

   Üç durum var:
     "sistem"  — telefonun/bilgisayarın ayarını takip eder (varsayılan)
     "light"   — kullanıcı açıkça aydınlık seçti
     "dark"    — kullanıcı açıkça koyu seçti

   Seçim localStorage'da tutulur ve index.html'deki küçük betik tarafından
   ilk boyamadan ÖNCE uygulanır. Bu yüzden sayfa açılırken koyudan aydınlığa
   atlama (flash) olmaz.
   ===================================================================== */

export type TemaTercihi = "sistem" | "light" | "dark";
export type EtkinTema = "light" | "dark";

const ANAHTAR = "asaf-tema";

function tercihOku(): TemaTercihi {
  try {
    const v = localStorage.getItem(ANAHTAR);
    return v === "light" || v === "dark" ? v : "sistem";
  } catch {
    // Gizli sekmede localStorage erişimi hata verebilir
    return "sistem";
  }
}

function sistemTemasi(): EtkinTema {
  return typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

/** Tercihe göre gerçekte hangi tema uygulanacak. */
export function etkinTemaHesapla(tercih: TemaTercihi): EtkinTema {
  return tercih === "sistem" ? sistemTemasi() : tercih;
}

/** Kök öğeye uygular ve tarayıcı arayüz rengini (durum çubuğu) günceller. */
export function temaUygula(tercih: TemaTercihi) {
  const etkin = etkinTemaHesapla(tercih);
  document.documentElement.setAttribute("data-theme", etkin);

  // PWA'da telefonun üst çubuğu bu renge boyanır
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", etkin === "light" ? "#f1f5f9" : "#020617");
}

/* --- Abonelik: hem localStorage hem sistem ayarı değişimini dinler --- */
const dinleyiciler = new Set<() => void>();

function abone(bildir: () => void) {
  dinleyiciler.add(bildir);
  const mql = window.matchMedia("(prefers-color-scheme: light)");
  const sistemDegisti = () => { temaUygula(tercihOku()); bildir(); };
  mql.addEventListener("change", sistemDegisti);
  // Başka sekmede değiştirilirse burada da güncellensin
  const depoDegisti = (e: StorageEvent) => {
    if (e.key === ANAHTAR) { temaUygula(tercihOku()); bildir(); }
  };
  window.addEventListener("storage", depoDegisti);

  return () => {
    dinleyiciler.delete(bildir);
    mql.removeEventListener("change", sistemDegisti);
    window.removeEventListener("storage", depoDegisti);
  };
}

let anlik: TemaTercihi | null = null;
function anlikDeger(): TemaTercihi {
  if (anlik === null) anlik = tercihOku();
  return anlik;
}

export function useTheme() {
  const tercih = useSyncExternalStore(abone, anlikDeger, () => "sistem" as TemaTercihi);

  const ayarla = useCallback((yeni: TemaTercihi) => {
    try {
      if (yeni === "sistem") localStorage.removeItem(ANAHTAR);
      else localStorage.setItem(ANAHTAR, yeni);
    } catch {
      // localStorage yoksa tema yine de bu oturum için uygulanır
    }
    anlik = yeni;
    temaUygula(yeni);
    dinleyiciler.forEach((b) => b());
  }, []);

  return { tercih, etkin: etkinTemaHesapla(tercih), ayarla };
}
