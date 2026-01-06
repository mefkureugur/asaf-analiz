import { useState } from "react";
import { useData } from "../../store/DataContext";
import {
  computeKPI,
  groupByBranch,
} from "../../services/analytics.service";

/* ================================
   HELPERS
================================ */

function normalizeDate(input: any): Date | null {
  if (!input) return null;
  if (typeof input?.toDate === "function") return input.toDate();
  if (input instanceof Date) return input;
  return new Date(input);
}

function trendInfo(prev: number, curr: number) {
  if (prev === 0) {
    return { text: "—", color: "#9ca3af", arrow: "" };
  }
  const pct = ((curr - prev) / prev) * 100;
  const up = pct > 0;
  const down = pct < 0;

  return {
    text: `${pct.toFixed(1)}%`,
    color: up ? "#22c55e" : down ? "#ef4444" : "#9ca3af",
    arrow: up ? "▲" : down ? "▼" : "",
  };
}

function mergeGroups<T extends { [key: string]: any }>(
  prev: T[],
  curr: T[],
  key: string
) {
  const map = new Map<string, { prev?: T; curr?: T }>();

  prev.forEach((item) => {
    map.set(item[key], { prev: item });
  });

  curr.forEach((item) => {
    const existing = map.get(item[key]);
    map.set(item[key], { ...existing, curr: item });
  });

  return Array.from(map.entries()).map(([name, data]) => ({
    name,
    prev: data.prev,
    curr: data.curr,
  }));
}

/* ================================
   PROGRAM SABİT LİSTESİ (KORUNDU)
================================ */

/* ================================
   PROGRAM GERÇEK TANIMI
================================ */

const PROGRAM_DEFS = [
  { label: "6", classType: "6" },
  { label: "7", classType: "7" },
  { label: "8", classType: "8" },

  { label: "Mefkure Plus – 11", classType: "11", branch: "Mefkure Plus" },
  { label: "Mefkure Plus – 12", classType: "12", branch: "Mefkure Plus" },
  { label: "Mefkure Plus – Mezun", classType: "Mezun", branch: "Mefkure Plus" },

  { label: "Mefkure Vip – 11", classType: "11", branch: "Mefkure Vip" },
  { label: "Mefkure Vip – 12", classType: "12", branch: "Mefkure Vip" },
  { label: "Mefkure Vip – Mezun", classType: "Mezun", branch: "Mefkure Vip" },
];

function filterProgramRecords(records: any[], def: any) {
  return records.filter((r) => {
    if (r.classType !== def.classType) return false;
    if (def.branch && r.branch !== def.branch) return false;
    return true;
  });
}

/* ================================
   STYLES
================================ */

const cardStyle: React.CSSProperties = {
  background: "linear-gradient(180deg, #0f172a, #020617)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 14,
  padding: 16,
};

const titleStyle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 600,
};

const rowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  marginTop: 6,
  fontSize: 14,
};

/* ================================
   PAGE
================================ */

export default function ComparePage() {
  const { allRecords, loading } = useData();

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const [cutoff, setCutoff] = useState(todayStr);

  if (loading) {
    return <div style={{ padding: 24, color: "white" }}>Yükleniyor…</div>;
  }

  const cutoffDate = new Date(cutoff);
  const cutoffMonth = cutoffDate.getMonth();
  const cutoffDay = cutoffDate.getDate();

  const currentYear = today.getFullYear();
  const prevYear = currentYear - 1;

  const rangeForYear = (year: number) => ({
    start: new Date(year, 0, 1),
    end: new Date(year, cutoffMonth, cutoffDay, 23, 59, 59, 999),
  });

  const filterByRange = (start: Date, end: Date) =>
    allRecords.filter((r) => {
      const d = normalizeDate(r.contractDate);
      return d && d >= start && d <= end;
    });

  const prevRecords = filterByRange(
    rangeForYear(prevYear).start,
    rangeForYear(prevYear).end
  );
  const currentRecords = filterByRange(
    rangeForYear(currentYear).start,
    rangeForYear(currentYear).end
  );

  const prevKPI = computeKPI(prevRecords);
  const currentKPI = computeKPI(currentRecords);

  const branchCompare = mergeGroups(
    groupByBranch(prevRecords),
    groupByBranch(currentRecords),
    "branch"
  );

  return (
    <div style={{ padding: 24, color: "white" }}>
      <h2>⚖️ Yıl Karşılaştırması</h2>

      {/* ✅ TARİH PENCERESİ – GERİ GELDİ */}
      <label style={{ display: "block", marginTop: 12 }}>
        Karşılaştırma tarihi:
        <input
          type="date"
          value={cutoff}
          onChange={(e) => setCutoff(e.target.value)}
          style={{ marginLeft: 8 }}
        />
      </label>

      {/* ================= KPI ================= */}

      <div style={{ marginTop: 24 }}>
        <h3>Genel KPI</h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 16,
            marginTop: 12,
          }}
        >
          {[
            {
              title: "👥 Öğrenci",
              prev: prevKPI.studentCount,
              curr: currentKPI.studentCount,
              format: (v: number) => v,
            },
            {
              title: "💰 Ciro",
              prev: prevKPI.totalRevenue,
              curr: currentKPI.totalRevenue,
              format: (v: number) => `₺${v.toLocaleString("tr-TR")}`,
            },
            {
              title: "📊 Ortalama",
              prev: prevKPI.avgRevenue,
              curr: currentKPI.avgRevenue,
              format: (v: number) =>
                v === 0 ? "—" : `₺${v.toLocaleString("tr-TR")}`,
            },
          ].map((kpi) => {
            const trend = trendInfo(kpi.prev, kpi.curr);

            return (
              <div key={kpi.title} style={cardStyle}>
                <div style={titleStyle}>{kpi.title}</div>
                <div style={rowStyle}>
                  <span>{prevYear}</span>
                  <strong>{kpi.format(kpi.prev)}</strong>
                </div>
                <div style={rowStyle}>
                  <span>{currentYear}</span>
                  <strong>{kpi.format(kpi.curr)}</strong>
                </div>
                <div style={{ marginTop: 10, color: trend.color, fontWeight: 600 }}>
                  {trend.arrow} {trend.text}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ================= BRANCH ================= */}

      <h3 style={{ marginTop: 40 }}>🏢 Şube Bazlı</h3>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
          gap: 16,
          marginTop: 12,
        }}
      >
        {branchCompare.map((b) => {
          const prev = b.prev ?? { studentCount: 0, totalRevenue: 0, avgRevenue: 0 };
          const curr = b.curr ?? { studentCount: 0, totalRevenue: 0, avgRevenue: 0 };
          const trend = trendInfo(prev.studentCount, curr.studentCount);

          return (
            <div key={b.name} style={cardStyle}>
              <div style={titleStyle}>{b.name}</div>
              <div style={rowStyle}>
                <span>👥 Öğrenci</span>
                <strong>{prev.studentCount} → {curr.studentCount}</strong>
              </div>
              <div style={rowStyle}>
                <span>💰 Ciro</span>
                <strong>₺{prev.totalRevenue.toLocaleString("tr-TR")} → ₺{curr.totalRevenue.toLocaleString("tr-TR")}</strong>
              </div>
              <div style={rowStyle}>
                <span>📊 Ortalama</span>
                <strong>₺{prev.avgRevenue.toLocaleString("tr-TR")} → ₺{curr.avgRevenue.toLocaleString("tr-TR")}</strong>
              </div>
              <div style={{ marginTop: 10, color: trend.color, fontWeight: 600 }}>
                {trend.arrow} {trend.text}
              </div>
            </div>
          );
        })}
      </div>

      {/* ================= PROGRAM ================= */}

      <h3 style={{ marginTop: 40 }}>🎓 Program Bazlı</h3>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
          gap: 16,
          marginTop: 12,
        }}
      >
        {PROGRAM_DEFS.map((def) => {
          const prev = computeKPI(filterProgramRecords(prevRecords, def));
          const curr = computeKPI(filterProgramRecords(currentRecords, def));
          const trend = trendInfo(prev.studentCount, curr.studentCount);

          return (
            <div key={def.label} style={cardStyle}>
              <div style={titleStyle}>{def.label}</div>
              <div style={rowStyle}>
                <span>👥 Öğrenci</span>
                <strong>{prev.studentCount} → {curr.studentCount}</strong>
              </div>
              <div style={rowStyle}>
                <span>💰 Ciro</span>
                <strong>₺{prev.totalRevenue.toLocaleString("tr-TR")} → ₺{curr.totalRevenue.toLocaleString("tr-TR")}</strong>
              </div>
              <div style={rowStyle}>
                <span>📊 Ortalama</span>
                <strong>₺{prev.avgRevenue.toLocaleString("tr-TR")} → ₺{curr.avgRevenue.toLocaleString("tr-TR")}</strong>
              </div>
              <div style={{ marginTop: 10, color: trend.color, fontWeight: 600 }}>
                {trend.arrow} {trend.text}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
