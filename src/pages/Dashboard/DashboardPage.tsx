import { useState } from "react";
import { useData } from "../../store/DataContext";
import { filterRecords, computeKPI } from "../../services/analytics.service";
import FilterBar from "../../components/FilterBar";

/* ================================
   BRANCH TYPE GUARD (SON HATA İÇİN)
================================ */

const ALLOWED_BRANCHES = [
  "Mefkure Plus",
  "Mefkure Vip",
  "Mefkure LGS",
] as const;

type AllowedBranch = (typeof ALLOWED_BRANCHES)[number];

function safeBranch(b?: string): AllowedBranch | undefined {
  return ALLOWED_BRANCHES.includes(b as AllowedBranch)
    ? (b as AllowedBranch)
    : undefined;
}

/* ================================
   PAGE
================================ */

export default function DashboardPage() {
  const { allRecords, loading } = useData();

  const nowYear = new Date().getFullYear();
  const [year, setYear] = useState<number>(nowYear);
  const [month, setMonth] = useState<number | null>(null);
  const [branch, setBranch] = useState<string>("");
  const [classTypes, setClassTypes] = useState<string[]>([]);

  if (loading) {
    return <div style={{ padding: 24, color: "white" }}>Yükleniyor…</div>;
  }

  const filtered = filterRecords(allRecords, {
    periodMode: month === null ? "YTD" : "MONTH",
    year,
    month: month ?? undefined,
    branch: safeBranch(branch),
    classTypes: classTypes.length ? classTypes : undefined,
  });

  const { studentCount, totalRevenue, avgRevenue } = computeKPI(filtered);

  const formatTL = (n: number) =>
    n.toLocaleString("tr-TR", {
      style: "currency",
      currency: "TRY",
      maximumFractionDigits: 0,
    });

  return (
    <div style={{ padding: 24, color: "white" }}>
      <h2>📊 Dashboard</h2>

      <FilterBar
        year={year}
        setYear={setYear}
        month={month}
        setMonth={setMonth}
        branch={branch}
        setBranch={setBranch}
        classTypes={classTypes}
        setClassTypes={setClassTypes}
      />

      {allRecords.length === 0 ? (
        <p style={{ opacity: 0.7, marginTop: 16 }}>Henüz veri yok.</p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 16,
            marginTop: 16,
          }}
        >
          <Card title="👥 Öğrenci" value={studentCount} />
          <Card title="💰 Ciro" value={formatTL(totalRevenue)} />
          <Card title="📈 Ortalama" value={formatTL(avgRevenue)} />
        </div>
      )}
    </div>
  );
}

/* ================================
   CARD
================================ */

function Card({ title, value }: { title: string; value: any }) {
  return (
    <div
      style={{
        padding: 16,
        background: "#020617",
        border: "1px solid #ffffff22",
        borderRadius: 8,
      }}
    >
      <strong>{title}</strong>
      <div style={{ fontSize: 28, marginTop: 8 }}>{value}</div>
    </div>
  );
}
