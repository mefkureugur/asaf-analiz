import { useEffect, useRef, type ReactNode } from "react";

/* =====================================================================
   MODAL — engelleyici görev katmanı

   • Materyalleşerek gelir: blur + ölçek + opaklık BİRLİKTE animasyonlanır,
     böylece düz bir solma değil, gerçek bir yüzeyin gelişi gibi okunur (§12).
   • Odaklamak için karartır (§12): arkadaki içerik scrim ile geri itilir.
   • Escape ve scrim tıklaması ile çıkış — kullanıcı asla kapana kısılmaz (§16).
   • Odak içeride tutulur, kapanınca tetikleyen öğeye geri döner.
   ===================================================================== */

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}

export default function Modal({ open, onClose, title, children, footer }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    restoreFocusRef.current = document.activeElement as HTMLElement;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key !== "Tab") return;

      // Odak tuzağı: Tab döngüsü panelin dışına çıkmaz.
      const focusables = panelRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusables || focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };

    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Açılınca ilk odaklanabilir öğeye geç.
    const t = window.setTimeout(() => {
      panelRef.current?.querySelector<HTMLElement>(
        'input, button, [tabindex]:not([tabindex="-1"])'
      )?.focus();
    }, 60);

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      window.clearTimeout(t);
      restoreFocusRef.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="presentation"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--sp-4)",
        background: "var(--scrim)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        animation: "asaf-scrim-in var(--dur-med) var(--ease-out) both",
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{
          width: "100%",
          maxWidth: 380,
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: "var(--r-lg)",
          padding: "var(--sp-5)",
          boxShadow: "var(--shadow-lg), inset 0 1px 0 var(--material-edge)",
          animation: "asaf-modal-in var(--dur-med) var(--ease-out) both",
        }}
      >
        <h2 style={{
          margin: 0,
          marginBottom: "var(--sp-4)",
          fontSize: "var(--t-title-size)",
          lineHeight: "var(--t-title-lh)",
          letterSpacing: "var(--t-title-ls)",
          color: "var(--text)",
          fontWeight: 700,
        }}>
          {title}
        </h2>

        {children}

        {footer && (
          <div style={{ display: "flex", gap: "var(--sp-3)", marginTop: "var(--sp-5)" }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
