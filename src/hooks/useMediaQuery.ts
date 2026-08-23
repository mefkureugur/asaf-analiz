import { useSyncExternalStore, useCallback } from "react";

/**
 * Bir medya sorgusunu React durumu olarak izler.
 *
 * Neden gerekli: render sırasında doğrudan window.innerWidth okumak,
 * pencere yeniden boyutlandığında veya cihaz döndürüldüğünde React'e
 * haber vermez — düzen eski kırılım noktasında donmuş kalır.
 *
 * Neden useSyncExternalStore: bu bir "dış kaynak" aboneliği. useState +
 * useEffect ile yazıldığında ilk render ile abonelik arasında değer
 * değişirse kaçırılır (ve effect içinde setState lint hatası verir).
 * useSyncExternalStore bu senkronizasyonu React'in kendisine bırakır.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback((onChange: () => void) => {
    const mql = window.matchMedia(query);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query]);

  // Sunucuda render edilirse (ileride SSR eklenirse) masaüstü varsayılır.
  const getServerSnapshot = useCallback(() => false, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Uygulamanın mobil kırılım noktası. */
export const useIsMobile = () => useMediaQuery("(max-width: 767px)");
