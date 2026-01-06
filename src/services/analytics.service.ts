import type { ImportedRecord } from "./excelImport.service";

/* ================================
   TYPES
================================ */

export type PeriodMode = "YTD" | "MONTH";

export type Filters = {
  periodMode: PeriodMode;
  year: number;
  month?: number; // 0–11
  branch?: ImportedRecord["branch"];
  classTypes?: string[]; // ✅ ÇOKLU PROGRAM
};

export type KPIResult = {
  studentCount: number;
  totalRevenue: number;
  avgRevenue: number;
};

/* ================================
   DATE NORMALIZER (ALTIN ANAHTAR)
================================ */

function normalizeDate(input: any): Date | null {
  if (!input) return null;

  // Firestore Timestamp
  if (typeof input?.toDate === "function") {
    const d = input.toDate();
    return isNaN(d.getTime()) ? null : d;
  }

  // Date
  if (input instanceof Date) {
    return isNaN(input.getTime()) ? null : input;
  }

  // number (ms)
  if (typeof input === "number") {
    const d = new Date(input);
    return isNaN(d.getTime()) ? null : d;
  }

  // string
  if (typeof input === "string") {
    const d = new Date(input);
    return isNaN(d.getTime()) ? null : d;
  }

  return null;
}

/* ================================
   DATE HELPERS
================================ */

function startOfYear(year: number) {
  return new Date(year, 0, 1);
}

function startOfMonth(year: number, month: number) {
  return new Date(year, month, 1);
}

function endOfMonth(year: number, month: number) {
  return new Date(year, month + 1, 0, 23, 59, 59, 999);
}

/* ================================
   FILTER ENGINE (KALP)
================================ */

export function filterRecords(
  records: ImportedRecord[],
  filters: Filters
): ImportedRecord[] {
  const today = new Date();

  /* ---------- 1️⃣ YEAR FİLTRESİ (EN KRİTİK) ---------- */
  let rows = records.filter((r) => {
    const d = normalizeDate(r.contractDate);
    return d !== null && d.getFullYear() === filters.year;
  });

  /* ---------- 2️⃣ PERIOD (YTD / MONTH) ---------- */
  let startDate: Date;
  let endDate: Date;

  if (filters.periodMode === "YTD") {
    startDate = startOfYear(filters.year);

    endDate =
      filters.year === today.getFullYear()
        ? today
        : new Date(
            filters.year,
            today.getMonth(),
            today.getDate(),
            23,
            59,
            59,
            999
          );
  } else {
    if (typeof filters.month !== "number") return [];
    startDate = startOfMonth(filters.year, filters.month);
    endDate = endOfMonth(filters.year, filters.month);
  }

  rows = rows.filter((r) => {
    const d = normalizeDate(r.contractDate);
    return d !== null && d >= startDate && d <= endDate;
  });

  /* ---------- 3️⃣ ŞUBE ---------- */
  if (filters.branch) {
    rows = rows.filter((r) => r.branch === filters.branch);
  }

  /* ---------- 4️⃣ PROGRAM (ÇOKLU) ---------- */
  if (filters.classTypes && filters.classTypes.length > 0) {
    rows = rows.filter((r) =>
      filters.classTypes!.includes(r.classType)
    );
  }

  return rows;
}

/* ================================
   KPI CALCULATOR
================================ */

export function computeKPI(records: ImportedRecord[]): KPIResult {
  const studentCount = records.length;
  const totalRevenue = records.reduce(
    (sum, r) => sum + Number(r.amount || 0),
    0
  );
  const avgRevenue =
    studentCount === 0 ? 0 : totalRevenue / studentCount;

  return {
    studentCount,
    totalRevenue,
    avgRevenue,
  };
}

/* ================================
   GROUPING (ŞUBE / PROGRAM)
================================ */

export function groupByBranch(records: ImportedRecord[]) {
  const map = new Map<ImportedRecord["branch"], ImportedRecord[]>();

  records.forEach((r) => {
    if (!map.has(r.branch)) {
      map.set(r.branch, []);
    }
    map.get(r.branch)!.push(r);
  });

  return Array.from(map.entries()).map(([branch, items]) => ({
    branch,
    ...computeKPI(items),
  }));
}

export function groupByClassType(records: ImportedRecord[]) {
  const map = new Map<string, ImportedRecord[]>();

  records.forEach((r) => {
    if (!map.has(r.classType)) {
      map.set(r.classType, []);
    }
    map.get(r.classType)!.push(r);
  });

  return Array.from(map.entries()).map(([classType, items]) => ({
    classType,
    ...computeKPI(items),
  }));
}
