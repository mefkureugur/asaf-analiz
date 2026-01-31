import {
  setDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";

import type { FinanceInput } from "../store/FinanceStore";
import { estimateSeasonalYearlyExpensePartial } from "./financeCalculator";

/**
 * Finansal verileri işler ve Firestore'da kalıcı bir "snapshot" oluşturur.
 * GÜNCELLEME: Kategori (Maaş, SGK vb.) bazlı bağımsız döküman yapısı.
 */
export async function saveFinanceSnapshot(
  year: number,
  unit: string, 
  input: FinanceInput & { category?: string } // Kategori bilgisini ekledik
) {
  // 1. Toplam Yıllık Tahmini Gelir
  const incomeTotal =
    (Number(input.income.student) || 0) +
    (Number(input.income.food) || 0) +
    (Number(input.income.other) || 0);

  // 2. Mevsimsel Gider Tahmini
  const seasonal = estimateSeasonalYearlyExpensePartial(input.expenses);

  // 3. Şu Ana Kadar Gerçekleşen Toplam Harcama
  const expenseRealSoFar = input.expenses
    .filter((x) => x > 0)
    .reduce((a, b) => a + (Number(b) || 0), 0);

  // 4. MODEL 1: RUN-RATE
  const filled = input.expenses.filter((x) => x > 0);
  const avgMonthlyExpense = filled.length
    ? expenseRealSoFar / filled.length
    : 0;

  const expenseRunRate = Math.round(avgMonthlyExpense * 12);

  // 5. MODEL 2: SEASONAL PROFIT
  const profitEstimate = incomeTotal - seasonal.yearlyTotal;
  const profitMargin =
    incomeTotal > 0 ? profitEstimate / incomeTotal : 0;

  // 6. Hangi Ayların Verisi Girildi?
  const filledMonths = input.expenses
    .map((v, i) => (v > 0 ? i : null))
    .filter((v) => v !== null);

  // 🛡️ ZIRH: Deterministik ID Yapısı - Kategoriyi ID'ye ekleyerek çakışmayı bitiriyoruz
  // Örn: "2026_Mefkure YKS_Maaşlar"
  const currentCategory = input.category || "Toplam Giderler";
  const snapshotId = `${year}_${unit}_${currentCategory}`;

  try {
    await setDoc(
      doc(db, "financeSnapshots", snapshotId),
      {
        year,
        unit,
        category: currentCategory, // Ana sayfanın okuması için bu mühür şart
        revenueTotal: incomeTotal,

        expenseRunRate,
        expenseEstimated: seasonal.yearlyTotal,

        expenseRealSoFar,
        method: "seasonal_v3", // Versiyonu yükselttik
        filledMonths,
        profitEstimate,
        profitMargin,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    console.log(`✅ ${unit} - ${currentCategory} özeti Firebase'e mühürlendi.`);
  } catch (error) {
    console.error(`❌ Snapshot hatası:`, error);
    throw error;
  }
}