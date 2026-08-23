import { useTheme, type TemaTercihi } from "../../hooks/useTheme";

/* =====================================================================
   TEMA SEÇİCİ

   İki biçim:
     "ikon"    — dar yerler için tek düğme (masaüstü nav). Aydınlık ile koyu
                 arasında gidip gelir.
     "satir"   — geniş yerler için üç seçenek (mobil menü). "Sistem" burada
                 seçilebilir: cihaz gece moduna geçince uygulama da geçer.
   ===================================================================== */

export function TemaIkonu() {
  const { etkin, ayarla } = useTheme();
  const hedef = etkin === "dark" ? "light" : "dark";

  return (
    <button
      onClick={() => ayarla(hedef)}
      className="press"
      aria-label={hedef === "light" ? "Aydınlık temaya geç" : "Koyu temaya geç"}
      title={hedef === "light" ? "Aydınlık tema" : "Koyu tema"}
      style={{
        background: "transparent",
        border: "1px solid var(--line-strong)",
        color: "var(--text-2)",
        borderRadius: "var(--r-sm)",
        width: 34,
        height: 34,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        padding: 0,
      }}
    >
      <Simge tema={etkin} />
    </button>
  );
}

export function TemaSatiri() {
  const { tercih, ayarla } = useTheme();
  const secenekler: { deger: TemaTercihi; etiket: string }[] = [
    { deger: "sistem", etiket: "Sistem" },
    { deger: "light", etiket: "Açık" },
    { deger: "dark", etiket: "Koyu" },
  ];

  return (
    <div style={{ padding: "var(--sp-3) var(--sp-5)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--sp-3)" }}>
      <span className="caption">Görünüm</span>
      <div style={{ display: "inline-flex", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-md)", padding: 2 }}>
        {secenekler.map((s) => (
          <button
            key={s.deger}
            onClick={() => ayarla(s.deger)}
            style={{
              border: "none",
              borderRadius: "var(--r-sm)",
              padding: "var(--sp-2) var(--sp-3)",
              fontSize: "0.75rem",
              fontWeight: 600,
              whiteSpace: "nowrap",
              background: tercih === s.deger ? "var(--surface-raised)" : "transparent",
              color: tercih === s.deger ? "var(--text)" : "var(--text-3)",
              boxShadow: tercih === s.deger ? "inset 0 1px 0 var(--material-edge)" : "none",
            }}
          >
            {s.etiket}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Güneş / ay — currentColor kullanır, tema rengini alır. */
function Simge({ tema }: { tema: "light" | "dark" }) {
  const ortak = {
    width: 17, height: 17, viewBox: "0 0 24 24",
    fill: "none", stroke: "currentColor",
    strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
  };
  // Koyu temadayken güneş gösterilir (basınca aydınlığa geçilecek)
  return tema === "dark" ? (
    <svg {...ortak} aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  ) : (
    <svg {...ortak} aria-hidden="true">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  );
}
