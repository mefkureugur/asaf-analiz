import {
  setDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";

import type { FinanceInput } from "../store/FinanceStore";
import { estimateSeasonalYearlyExpensePartial } from "./financeCalculator";

/**
 * Finansal verileri işler ve Firestore'da kalıcı bir "snapshot" (özet) oluşturur.
 * ASAF Yapısı: 6 Şube + Genel Toplam
 */
export async function saveFinanceSnapshot(
  year: number,
  unit: string, // "Mefkure LGS", "Altınküre Lise", "GENERAL" vb.
  input: FinanceInput
) {
  // 1. Toplam Yıllık Tahmini Gelir (Eğitim + Yemek + Diğer)
  const incomeTotal =
    (Number(input.income.student) || 0) +
    (Number(input.income.food) || 0) +
    (Number(input.income.other) || 0);

  // 2. Mevsimsel Gider Tahmini (Eğitim Sektörü Katsayılarıyla)
  const seasonal = estimateSeasonalYearlyExpensePartial(input.expenses);

  // 3. Şu Ana Kadar Gerçekleşen Toplam Harcama
  const expenseRealSoFar = input.expenses
    .filter((x) => x > 0)
    .reduce((a, b) => a + (Number(b) || 0), 0);

  // 4. MODEL 1: RUN-RATE (Mevcut Ayların Ortalaması × 12)
  const filled = input.expenses.filter((x) => x > 0);
  const avgMonthlyExpense = filled.length
    ? filled.reduce((a, b) => a + (Number(b) || 0), 0) / filled.length
    : 0;

  const expenseRunRate = Math.round(avgMonthlyExpense * 12);

  // 5. MODEL 2: SEASONAL PROFIT (Mevsimsel Gider Tahmini Bazlı Kâr)
  const profitEstimate = incomeTotal - seasonal.yearlyTotal;
  const profitMargin =
    incomeTotal > 0 ? profitEstimate / incomeTotal : 0;

  // 6. Hangi Ayların Verisi Girildi? (0: Ağustos, 1: Eylül...)
  const filledMonths = input.expenses
    .map((v, i) => (v > 0 ? i : null))
    .filter((v) => v !== null);

  // 🔑 Deterministik ID Mantığı: Örn: "2026_Mefkure LGS"
  const snapshotId = `${year}_${unit}`;

  try {
    await setDoc(
      doc(db, "financeSnapshots", snapshotId),
      {
        year,
        unit,
        revenueTotal: incomeTotal,

        expenseRunRate,                     // Model 1: Düz Ortalama
        expenseEstimated: seasonal.yearlyTotal, // Model 2: Mevsimsel Tahmin

        expenseRealSoFar,
        method: "seasonal_v2",              // Versiyon takibi için
        filledMonths,
        profitEstimate,
        profitMargin,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    console.log(`✅ ${unit} finansal özeti başarıyla kaydedildi.`);
  } catch (error) {
    console.error(`❌ ${unit} snapshot kaydedilirken hata oluştu:`, error);
    throw error;
  }
}