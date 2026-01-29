import type { FinanceInput } from "../store/FinanceStore";

/* ======================================================
   1️⃣ TEMEL HESAPLAR
====================================================== */
export function calculateFinance(input: FinanceInput) {
  const income =
    (Number(input.income.student) || 0) +
    (Number(input.income.food) || 0) +
    (Number(input.income.other) || 0);

  const filled = input.expenses.filter((x) => x > 0);
  const months = filled.length;

  const totalExpense = filled.reduce((a, b) => a + b, 0);
  const avgExpense = months ? totalExpense / months : 0;

  // Yıllık projeksiyon için: Gelir (Yıllık Tahmin) - (Aylık Ort Gider * 12)
  const estimatedYearlyProfit = income - (avgExpense * 12);
  const profitMargin = income > 0 ? (estimatedYearlyProfit / income) * 100 : 0;

  return {
    income,
    months,
    totalExpense,
    avgExpense: Math.round(avgExpense),
    estimatedYearlyProfit: Math.round(estimatedYearlyProfit),
    profitMargin: Number(profitMargin.toFixed(2)),
    
    // Senaryo Analizleri
    pessimistic: profitMargin * 0.8,
    realistic: profitMargin,
    optimistic: profitMargin * 1.2,
  };
}

/* ======================================================
   2️⃣ ÇOKLU ŞUBE BİRLEŞTİRME (Dinamik ASAF Yapısı)
====================================================== */
/**
 * Artık sadece YKS+LGS değil, sınırsız sayıda şubeyi 
 * tek bir genel tabloda birleştirebilir.
 */
export function combineMultipleFinances(finances: FinanceInput[]): FinanceInput {
  return finances.reduce((acc, curr) => ({
    income: {
      student: acc.income.student + (Number(curr.income.student) || 0),
      food: acc.income.food + (Number(curr.income.food) || 0),
      other: acc.income.other + (Number(curr.income.other) || 0),
    },
    expenses: acc.expenses.map((v, i) => v + (Number(curr.expenses[i]) || 0)),
  }), {
    income: { student: 0, food: 0, other: 0 },
    expenses: Array(12).fill(0)
  });
}

/* ======================================================
   3️⃣ MEVSİMSEL KATSAYILAR (Eğitim Sektörü Uyumlu)
====================================================== */
// Ağustos'tan Temmuz'a kadar gider ağırlıkları
export const SEASON_WEIGHTS_AUG_TO_JUL = [
  0.40, // Ağustos (Düşük gider)
  1.10, // Eylül (Açılış maliyetleri)
  0.95, // Ekim
  1.00, // Kasım
  1.60, // Aralık (Yıl sonu giderleri)
  0.85, // Ocak
  1.50, // Şubat (Isınma ve 2. dönem başlangıcı)
  0.90, // Mart
  0.95, // Nisan
  1.10, // Mayıs
  0.85, // Haziran
  0.80, // Temmuz
];

/* ======================================================
   4️⃣ MEVSİMSEL YILLIK GİDER TAHMİNİ
====================================================== */
export function estimateSeasonalYearlyExpensePartial(
  expenses: number[],
  weights: number[] = SEASON_WEIGHTS_AUG_TO_JUL
) {
  const safe = (n: any) => {
    const x = Number(n);
    return Number.isFinite(x) ? x : 0;
  };

  const exp = expenses.map(safe);
  const w = weights.length === 12 ? weights : SEASON_WEIGHTS_AUG_TO_JUL;

  let sumActual = 0;      // Gerçekten girilmiş ayların toplamı
  let sumWActual = 0;     // O ayların katsayı toplamı
  let actualMonths = 0;

  for (let i = 0; i < 12; i++) {
    if (exp[i] > 0) {
      sumActual += exp[i];
      sumWActual += w[i];
      actualMonths++;
    }
  }

  if (actualMonths === 0 || sumWActual === 0) {
    return { yearlyTotal: 0, actualMonths: 0, predictedByMonth: Array(12).fill(0) };
  }

  // Birim katsayı başına düşen harcama (Baz)
  const base = sumActual / sumWActual;

  const predictedByMonth = exp.map((e, i) => {
    return e > 0 ? Math.round(e) : Math.round(base * w[i]);
  });

  const yearlyTotal = predictedByMonth.reduce((a, b) => a + b, 0);

  return {
    yearlyTotal: Math.round(yearlyTotal),
    actualMonths,
    predictedByMonth,
  };
}