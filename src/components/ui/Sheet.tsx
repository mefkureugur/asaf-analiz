import { useEffect, useRef, useCallback, type ReactNode } from "react";
import { createSpring, project, rubberband, VelocityTracker, type SpringHandle } from "../../utils/spring";

/* =====================================================================
   SHEET — üstten inen, sürüklenebilir panel

   • Açılış ve kapanış AYNI yolu izler (§7) — üstten iner, üste kapanır.
   • Sürükleme parmağa 1:1 yapışır, tutulan noktanın ofsetini korur (§2).
   • Sınırın ötesinde lastik bant direnci (§9).
   • Bırakınca hız devredilir; hedefi izdüşüm belirler (§6).
   • Uçarken yakalanıp ters çevrilebilir (§3).

   TASARIM NOTU: panelin görünürlüğü React durumuyla DEĞİL, doğrudan DOM
   üzerinden yönetiliyor. Bir "visible" state'i tutmak, efektin animasyon
   ortasında yeniden kurulmasına ve yayın yarıda donmasına yol açıyordu.
   Tek gerçeklik kaynağı `open`; efekt yalnızca o değişince çalışır.
   ===================================================================== */

interface SheetProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /**
   * Panelin üstten itibaren başlayacağı ofset — CSS ölçüsü.
   * Sayı değil string, çünkü güvenli alan (çentik/durum çubuğu) yalnızca
   * CSS env() ile bilinir: calc(60px + env(safe-area-inset-top)).
   */
  topOffset?: string;
  labelledBy?: string;
}

export default function Sheet({ open, onClose, children, topOffset = "var(--nav-total)", labelledBy }: SheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const scrimRef = useRef<HTMLDivElement>(null);
  const springRef = useRef<SpringHandle | null>(null);
  const heightRef = useRef(0);
  const draggingRef = useRef(false);
  const grabOffsetRef = useRef(0);
  const tracker = useRef(new VelocityTracker());
  const initedRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  /**
   * Paneli verilen y ötelemesine boyar ve buna bağlı her şeyi günceller.
   * 0 = tam açık, -h = tam kapalı.
   */
  const paint = useCallback((y: number) => {
    const panel = panelRef.current;
    const scrim = scrimRef.current;
    if (!panel) return;

    const h = heightRef.current || 1;
    panel.style.transform = `translate3d(0, ${y}px, 0)`;

    // İlerleme 0..1 — scrim ve görünürlük buna bağlı, böylece geri bildirim
    // hareket BOYUNCA sürekli olur, yalnız sonunda değil (§1).
    const progress = Math.max(0, Math.min(1, 1 + y / h));

    if (scrim) {
      scrim.style.opacity = String(progress);
      scrim.style.pointerEvents = progress > 0.01 ? "auto" : "none";
    }

    // Tamamen kapalıyken panel etkileşimden ve okuyucudan çıkar.
    const closed = progress <= 0.001;
    panel.style.visibility = closed ? "hidden" : "visible";
    panel.style.pointerEvents = closed ? "none" : "auto";
  }, []);

  /** Anlık değerden ve anlık hızdan devam ederek hedefe yayla git (§3). */
  const animateTo = useCallback((target: number, velocity: number) => {
    const from = springRef.current?.getValue() ?? target;
    springRef.current?.stop();
    springRef.current = createSpring(from, target, {
      // Momentum taşıyan jest sonrası hafif aşma; başka yerde hak edilmez (§4).
      damping: velocity !== 0 ? 0.8 : 1.0,
      response: 0.3,
      velocity,
      onUpdate: paint,
    });
  }, [paint]);

  /* ---- Açılış / kapanış: tek bağımlılık, tek yay ---- */
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;

    // Ölçüm için panel geçici olarak görünür olmalı; visibility:hidden düzeni
    // korur ama ilk ölçümde 0 dönme ihtimaline karşı garanti altına alıyoruz.
    const h = panel.offsetHeight || heightRef.current || 1;
    heightRef.current = h;

    if (!initedRef.current) {
      initedRef.current = true;
      // İlk kare: her zaman kapalı konumdan başla ki açılış animasyonu görünsün.
      paint(-h);
    }

    const from = springRef.current?.getValue() ?? -h;
    const vel = springRef.current?.getVelocity() ?? 0;
    springRef.current?.stop();

    springRef.current = createSpring(from, open ? 0 : -h, {
      damping: 0.8,
      response: 0.3,
      velocity: vel,
      onUpdate: paint,
    });

    return () => { springRef.current?.stop(); };
  }, [open, paint]);

  /* ---- Kaydırma kenarı maskesi (§12) ----
     İçerik taşıyorsa taştığı kenar yumuşakça soluyor; böylece "burada
     devamı var" bilgisi ayırıcı çizgi olmadan veriliyor. */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const update = () => {
      const canScroll = el.scrollHeight > el.clientHeight + 1;
      if (!canScroll) { el.style.maskImage = ""; el.style.webkitMaskImage = ""; return; }

      const atTop = el.scrollTop <= 1;
      const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
      const top = atTop ? "0px" : "20px";
      const bottom = atBottom ? "0px" : "20px";
      const mask = `linear-gradient(to bottom, transparent 0, #000 ${top}, #000 calc(100% - ${bottom}), transparent 100%)`;
      el.style.maskImage = mask;
      el.style.webkitMaskImage = mask;
    };

    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => { el.removeEventListener("scroll", update); ro.disconnect(); };
  }, [open, children]);

  /* ---- Escape ile kapat + arkadaki gövdeyi dondur ---- */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  /* ---- Sürükleme ---- */
  const onPointerDown = (e: React.PointerEvent) => {
    // Liste yukarı kaydırılmışsa jest panel sürüklemesi değil, scroll'dur.
    const scroller = (e.target as HTMLElement).closest("[data-sheet-scroll]");
    if (scroller && scroller.scrollTop > 0) return;

    draggingRef.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

    // Uçan animasyonu anlık değerinden yakala — sıçrama olmaz (§3).
    const current = springRef.current?.getValue() ?? 0;
    springRef.current?.stop();

    // Nereden tutulduysa oradan: merkeze zıplatmak yanılsamayı bozar (§2).
    grabOffsetRef.current = e.clientY - current;
    tracker.current.reset();
    tracker.current.add(e.clientY);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    tracker.current.add(e.clientY);

    let y = e.clientY - grabOffsetRef.current;
    // Tam açığın ötesine çekilirse sert durmaz, kademeli direnir (§9).
    if (y > 0) y = rubberband(y, heightRef.current);
    y = Math.max(y, -heightRef.current);

    paint(y);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);

    const velocity = tracker.current.get();      // px/s — yukarı negatif
    const current = e.clientY - grabOffsetRef.current;
    const h = heightRef.current;

    // Bırakma noktasına değil, jestin GİTTİĞİ yere göre karar ver (§6).
    const projected = current + project(velocity);

    if (projected < -h / 2) {
      // Hızı devret; open=false efekti hareketi kesintisiz sürdürür.
      animateTo(-h, velocity);
      onClose();
    } else {
      animateTo(0, velocity);
    }
  };

  return (
    <>
      <div
        ref={scrimRef}
        onClick={onClose}
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: `${topOffset} 0 0 0`,
          background: "var(--scrim)",
          opacity: 0,
          zIndex: 900,
          pointerEvents: "none",
        }}
      />
      <nav
        ref={panelRef}
        aria-labelledby={labelledBy}
        aria-hidden={!open}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{
          position: "fixed",
          top: topOffset,
          left: 0,
          right: 0,
          zIndex: 950,
          display: "flex",
          flexDirection: "column",
          // Materyal: içerik altından akar, panel üstte yüzer (§12).
          background: "var(--material-sheet)",
          backdropFilter: "blur(var(--material-blur)) saturate(var(--material-saturate))",
          WebkitBackdropFilter: "blur(var(--material-blur)) saturate(var(--material-saturate))",
          borderBottom: "1px solid var(--line)",
          boxShadow: "var(--shadow-lg), inset 0 1px 0 var(--material-edge)",
          borderRadius: "0 0 var(--r-xl) var(--r-xl)",
          maxHeight: `calc(85dvh - ${topOffset})`,
          overflow: "hidden",
          touchAction: "none",
          visibility: "hidden",
          willChange: "transform",
        }}
      >
        <div ref={scrollRef} data-sheet-scroll style={{ overflowY: "auto", overscrollBehavior: "contain", paddingBottom: "var(--sp-2)" }}>
          {children}
        </div>

        {/* Tutamaç: panelin sürüklenebilir olduğunu söyleyen görsel ipucu */}
        <div style={{ display: "flex", justifyContent: "center", padding: "var(--sp-2) 0 var(--sp-3)" }}>
          <div style={{ width: 36, height: 4, borderRadius: "var(--r-full)", background: "var(--line-strong)" }} />
        </div>
      </nav>
    </>
  );
}
