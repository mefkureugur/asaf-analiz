import { useMemo } from "react";

const PROGRAMS = ["6", "7", "8", "11", "12", "Mezun", "Mood"];

type Props = {
  year: number;
  setYear: (y: number) => void;
  month: number | null;
  setMonth: (m: number | null) => void;
  branch: string;
  setBranch: (b: string) => void;
  classTypes: string[];
  setClassTypes: React.Dispatch<React.SetStateAction<string[]>>;
};

export default function FilterBar({
  year,
  setYear,
  month,
  setMonth,
  branch,
  setBranch,
  classTypes,
  setClassTypes,
}: Props) {
  const years = useMemo(() => {
    const now = new Date().getFullYear();
    return [now - 1, now];
  }, []);

  const months = [
    { v: null, l: "Tümü" },
    { v: 0, l: "Ocak" },
    { v: 1, l: "Şubat" },
    { v: 2, l: "Mart" },
    { v: 3, l: "Nisan" },
    { v: 4, l: "Mayıs" },
    { v: 5, l: "Haziran" },
    { v: 6, l: "Temmuz" },
    { v: 7, l: "Ağustos" },
    { v: 8, l: "Eylül" },
    { v: 9, l: "Ekim" },
    { v: 10, l: "Kasım" },
    { v: 11, l: "Aralık" },
  ];

  const toggleProgram = (p: string) => {
    setClassTypes((prev) =>
      prev.includes(p)
        ? prev.filter((x) => x !== p)
        : [...prev, p]
    );
  };

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
        gap: 12,
        marginTop: 12,
        marginBottom: 8,
      }}
    >
      {/* YIL */}
      <select value={year} onChange={(e) => setYear(+e.target.value)} style={s}>
        {years.map((y) => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>

      {/* AY */}
      <select
        value={month ?? ""}
        onChange={(e) =>
          setMonth(e.target.value === "" ? null : Number(e.target.value))
        }
        style={s}
      >
        {months.map((m) => (
          <option key={String(m.v)} value={m.v ?? ""}>{m.l}</option>
        ))}
      </select>

      {/* ŞUBE */}
      <select value={branch} onChange={(e) => setBranch(e.target.value)} style={s}>
        <option value="">Tüm Şubeler</option>
        <option value="Mefkure Plus">Mefkure Plus</option>
        <option value="Mefkure Vip">Mefkure Vip</option>
        <option value="Mefkure LGS">Mefkure LGS</option>
      </select>

      {/* PROGRAM */}
      <details style={box}>
        <summary style={summary}>
          Program
          {classTypes.length > 0 && (
            <span style={{ opacity: 0.7 }}>
              {" "}({classTypes.length} seçili)
            </span>
          )}
        </summary>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 8,
            marginTop: 8,
          }}
        >
          {PROGRAMS.map((p) => (
            <label key={p} style={row}>
              <input
                type="checkbox"
                checked={classTypes.includes(p)}
                onChange={() => toggleProgram(p)}
              />
              {p}
            </label>
          ))}
        </div>
      </details>
    </div>
  );
}

const s: React.CSSProperties = {
  background: "#020617",
  border: "1px solid #ffffff22",
  color: "white",
  padding: "8px 10px",
  borderRadius: 6,
};

const box: React.CSSProperties = {
  background: "#020617",
  border: "1px solid #ffffff22",
  borderRadius: 6,
  padding: 8,
};

const summary: React.CSSProperties = {
  cursor: "pointer",
  fontWeight: 500,
};

const row: React.CSSProperties = {
  display: "flex",
  gap: 6,
  alignItems: "center",
  whiteSpace: "nowrap",
};
