import { useMemo } from "react";
import { useData } from "../../store/DataContext";

/* ================================
   HELPERS
================================ */

function normalizeDate(input: any): Date | null {
  if (!input) return null;
  if (typeof input?.toDate === "function") return input.toDate();
  if (input instanceof Date) return input;
  return new Date(input);
}

type ScopeKey = "lgs" | "plus" | "vip";

function resolveScopeByBranch(branch: any): ScopeKey | null {
  if (!branch) return null;
  const b = String(branch).toLowerCase();
  if (b.includes("lgs")) return "lgs";
  if (b.includes("plus")) return "plus";
  if (b.includes("vip")) return "vip";
  return null;
}

/* ================================
   STYLES (TargetsPage ile uyumlu)
================================ */

const cardStyle: React.CSSProperties = {
  background: "linear-gradient(180deg, #0f172a, #020617)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 14,
  padding: 16,
};

const titleStyle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 700,
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: 16,
  marginTop: 16,
};

const rowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginTop: 10,
  fontSize: 14,
};

/* ================================
   PAGE
================================ */

export default function StudentsPage() {
  const { allRecords, loading } = useData();

  const CURRENT_YEAR = 2026;
  const PREV_YEAR = 2025;

  /* ================================
     VERİLERİ YILLARA AYIR
  ================================ */

  const records2025 = useMemo(() => {
    return allRecords.filter((r: any) => {
      const d = normalizeDate(r.contractDate);
      return d && d.getFullYear() === PREV_YEAR;
    });
  }, [allRecords]);

  const records2026 = useMemo(() => {
    return allRecords.filter((r: any) => {
      const d = normalizeDate(r.contractDate);
      return d && d.getFullYear() === CURRENT_YEAR;
    });
  }, [allRecords]);

  /* ================================
     2025 İSİM SETİ (ESKİLER)
  ================================ */

  const names2025 = useMemo(() => {
    return new Set(
      records2025
        .map((r: any) => String(r.studentName || "").trim())
        .filter(Boolean)
    );
  }, [records2025]);

  /* ================================
     HESAPLAMA
  ================================ */

  function compute(scope: ScopeKey) {
    let yeni = 0;
    let yenileme = 0;

    const scoped2026 = records2026.filter(
      (r: any) => resolveScopeByBranch(r.branch) === scope
    );

    scoped2026.forEach((r: any) => {
      const name = String(r.studentName || "").trim();
      if (!name) return;

      if (names2025.has(name)) {
        yenileme += 1;
      } else {
        yeni += 1;
      }
    });

    return {
      yeni,
      yenileme,
      toplam: yeni + yenileme,
    };
  }

  const lgs = useMemo(() => compute("lgs"), [records2026, names2025]);
  const plus = useMemo(() => compute("plus"), [records2026, names2025]);
  const vip = useMemo(() => compute("vip"), [records2026, names2025]);

  const total = {
    yeni: lgs.yeni + plus.yeni + vip.yeni,
    yenileme: lgs.yenileme + plus.yenileme + vip.yenileme,
    toplam: lgs.toplam + plus.toplam + vip.toplam,
  };

  if (loading) {
    return <div style={{ padding: 24, color: "white" }}>Yükleniyor…</div>;
  }

  /* ================================
     KART BİLEŞENİ
  ================================ */

  function StudentCard({
    title,
    data,
  }: {
    title: string;
    data: { yeni: number; yenileme: number; toplam: number };
  }) {
    return (
      <div style={cardStyle}>
        <div style={titleStyle}>{title}</div>

        <div style={rowStyle}>
          <span>🟢 Yeni kayıt</span>
          <strong>{data.yeni}</strong>
        </div>

        <div style={rowStyle}>
          <span>🔵 Kayıt yenileme</span>
          <strong>{data.yenileme}</strong>
        </div>

        <div
          style={{
            ...rowStyle,
            marginTop: 14,
            paddingTop: 10,
            borderTop: "1px solid rgba(255,255,255,0.08)",
            fontWeight: 700,
          }}
        >
          <span>Toplam</span>
          <span>{data.toplam}</span>
        </div>
      </div>
    );
  }

  /* ================================
     RENDER
  ================================ */

  return (
    <div style={{ padding: 24, color: "white" }}>
      <h2 style={{ margin: 0 }}>🧑‍🎓 Yeni Kayıt – Kayıt Yenileme</h2>

      <div style={gridStyle}>
        <StudentCard title="Mefkure LGS" data={lgs} />
        <StudentCard title="Mefkure Plus" data={plus} />
        <StudentCard title="Mefkure Vip" data={vip} />
        <StudentCard title="TOPLAM" data={total} />
      </div>
    </div>
  );
}
