import  type { FinanceInput } from "../store/FinanceStore";

/* ======================================================
   1️⃣ TEMEL HESAPLAR (MEVCUT YAPI – BOZULMADI)
====================================================== */

export function calculateFinance(input: FinanceInput) {
  const income =
    input.income.student +
    input.income.food +
    input.income.other;

  const filled = input.expenses.filter((x) => x > 0);
  const months = filled.length;

  const totalExpense = filled.reduce((a, b) => a + b, 0);
  const avgExpense = months ? totalExpense / months : 0;

  // ⚠️ NOT:
  // Buradaki profit = aylık ortalama bazlı fark
  // (dashboard’ta yıllık hesap ayrı yapılıyor)
  const profit = income - avgExpense;

  const baseMargin = income > 0 ? (profit / income) * 100 : null;

  return {
    income,
    months,
    totalExpense,
    avgExpense: Math.round(avgExpense),
    profit: Math.round(profit),

    // senaryolar (dashboard’ta opsiyonel kullanılıyor)
    pessimistic: baseMargin ? baseMargin * 0.7 : null,
    realistic: baseMargin,
    optimistic: baseMargin ? baseMargin * 1.15 : null,
  };
}

/* ======================================================
   2️⃣ YKS + LGS BİRLEŞTİRME
====================================================== */

export function combineFinance(
  a: FinanceInput,
  b: FinanceInput
): FinanceInput {
  return {
    income: {
      student: a.income.student + b.income.student,
      food: a.income.food + b.income.food,
      other: a.income.other + b.income.other,
    },
    expenses: a.expenses.map((v, i) => v + b.expenses[i]),
  };
}

/* ======================================================
   3️⃣ MEVSİMSEL KATSAYILAR (GERÇEK VERİDEN)
   Ağustos → Temmuz
====================================================== */

// ⛳️ Geçen yılın gerçek giderlerinden çıkarılmış katsayılar
export const SEASON_WEIGHTS_AUG_TO_JUL = [
  0.39, // Ağustos
  1.11, // Eylül
  0.92, // Ekim
  1.00, // Kasım
  1.62, // Aralık
  0.81, // Ocak
  1.59, // Şubat
  0.90, // Mart
  0.93, // Nisan
  1.12, // Mayıs
  0.84, // Haziran
  0.77, // Temmuz
];

/* ======================================================
   4️⃣ MEVSİMSEL YILLIK GİDER TAHMİNİ
   - Girilen aylar GERÇEK
   - Boş aylar KATSAYI ile TAHMİN
====================================================== */

export function estimateSeasonalYearlyExpensePartial(
  expenses: number[],
  weights: number[] = SEASON_WEIGHTS_AUG_TO_JUL
) {
  const safe = (n: any) => {
    const x = Number(n);
    return Number.isFinite(x) ? x : 0;
  };

  const exp = Array.isArray(expenses)
    ? expenses.map(safe)
    : [];

  const w =
    Array.isArray(weights) && weights.length === 12
      ? weights
      : SEASON_WEIGHTS_AUG_TO_JUL;

  let sumActual = 0;     // gerçek girilen gider toplamı
  let sumWActual = 0;   // o ayların katsayı toplamı
  let actualMonths = 0;

  // 🔎 Girilmiş ayları bul
  for (let i = 0; i < 12; i++) {
    const e = safe(exp[i]);
    if (e > 0) {
      sumActual += e;
      sumWActual += safe(w[i]);
      actualMonths++;
    }
  }

  // hiç veri yoksa → tahmin yapma
  if (actualMonths === 0 || sumWActual <= 0) {
    return {
      yearlyTotal: 0,
      actualMonths: 0,
      base: 0,
      predictedByMonth: Array(12).fill(0),
    };
  }

  // 🎯 Baz gider (katsayı birimi başına)
  const base = sumActual / sumWActual;

  // 📆 12 ayın tamamı (gerçek + tahmin)
  const predictedByMonth = Array.from({ length: 12 }, (_, i) => {
    const e = safe(exp[i]);
    if (e > 0) return Math.round(e);              // gerçek
    return Math.round(base * safe(w[i]));         // tahmin
  });

  const yearlyTotal = predictedByMonth.reduce(
    (a, b) => a + safe(b),
    0
  );

  return {
    yearlyTotal: Math.round(yearlyTotal),
    actualMonths,
    base,
    predictedByMonth,
  };
}
