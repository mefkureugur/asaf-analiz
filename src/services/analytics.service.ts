import type { ImportedRecord } from "./excelImport.service";

/* ================================
   TYPES
================================ */
export type PeriodMode = "YTD" | "MONTH";

export type Filters = {
  periodMode: PeriodMode;
  year: number;
  month?: number; 
  branch?: string;
  classTypes?: string[];
};

export type KPIResult = {
  studentCount: number;
  totalRevenue: number;
  avgRevenue: number;
};

/* ================================
   TEMİZLİK VE NORMALLEŞTİRME
================================ */
function cleanText(v: any) {
  return String(v ?? "").trim().replace(/\s+/g, " ");
}

function normalizeClass(v: any) {
  const s = cleanText(v);
  // Excel'den gelen '08' verisini '8'e çevirerek UI ile eşleştirir
  return s.length === 2 && s.startsWith("0") ? s.slice(1) : s;
}

function normalizeDate(input: any): Date | null {
  if (!input) return null;
  if (typeof input?.toDate === "function") return input.toDate(); // Firestore
  if (input instanceof Date) return isNaN(input.getTime()) ? null : input;
  const d = new Date(input);
  return isNaN(d.getTime()) ? null : d;
}

/* ================================
   FILTER ENGINE (KALP)
================================ */
export function filterRecords(
  records: ImportedRecord[],
  filters: Filters
): ImportedRecord[] {
  const today = new Date();

  // 1. ADIM: YIL FİLTRESİ
  let rows = records.filter((r) => {
    const d = normalizeDate(r.contractDate);
    return d !== null && d.getFullYear() === filters.year;
  });

  // 2. ADIM: ZAMAN ARALIĞI (YTD veya AY BAZLI)
  let startDate: Date;
  let endDate: Date;

  if (filters.periodMode === "YTD") {
    startDate = new Date(filters.year, 0, 1); // 1 Ocak

    // ASIL KRİTİK NOKTA: Geçen yılları da bugünün tarihinde kesiyoruz
    endDate = new Date(
      filters.year,
      today.getMonth(),
      today.getDate(),
      23, 59, 59, 999
    );
  } else {
    if (typeof filters.month !== "number") return [];
    startDate = new Date(filters.year, filters.month, 1);
    endDate = new Date(filters.year, filters.month + 1, 0, 23, 59, 59, 999);
  }

  rows = rows.filter((r) => {
    const d = normalizeDate(r.contractDate);
    return d !== null && d >= startDate && d <= endDate;
  });

  // 3. ADIM: ŞUBE FİLTRESİ (ASAF şubeleri için esnek eşleşme)
  if (filters.branch) {
    const searchBranch = cleanText(filters.branch).toLowerCase();
    rows = rows.filter((r) => cleanText(r.branch).toLowerCase() === searchBranch);
  }

  // 4. ADIM: SINIF KADEMESİ (Çoklu Seçim ve Excel Normalizasyonu)
  if (filters.classTypes && filters.classTypes.length > 0) {
    const normalizedSelected = filters.classTypes.map(normalizeClass);
    rows = rows.filter((r) => 
      normalizedSelected.includes(normalizeClass(r.classType))
    );
  }

  return rows;
}

/* ================================
   KPI & GROUPING (AYNEN KORUNDU)
================================ */
export function computeKPI(records: ImportedRecord[]): KPIResult {
  const studentCount = records.length;
  const totalRevenue = records.reduce((sum, r) => sum + Number(r.amount || 0), 0);
  return {
    studentCount,
    totalRevenue,
    avgRevenue: studentCount === 0 ? 0 : totalRevenue / studentCount,
  };
}

export function groupByBranch(records: ImportedRecord[]) {
  const map = new Map<string, ImportedRecord[]>();
  records.forEach((r) => {
    const b = cleanText(r.branch);
    if (!map.has(b)) map.set(b, []);
    map.get(b)!.push(r);
  });

  return Array.from(map.entries()).map(([branch, items]) => ({
    branch,
    ...computeKPI(items),
  }));
}