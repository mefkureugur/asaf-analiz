import {
  setDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";

import type { FinanceInput } from "../store/FinanceStore";
import { estimateSeasonalYearlyExpensePartial } from "./financeCalculator";

export async function saveFinanceSnapshot(
  year: number,
  unit: "YKS" | "LGS" | "GENERAL",
  input: FinanceInput
) {
  const incomeTotal =
    input.income.student +
    input.income.food +
    input.income.other;

  const seasonal = estimateSeasonalYearlyExpensePartial(input.expenses);

  const expenseRealSoFar = input.expenses
    .filter((x) => x > 0)
    .reduce((a, b) => a + b, 0);

  // 1️⃣ RUN-RATE = girilen ayların ortalaması × 12
  const filled = input.expenses.filter((x) => x > 0);
  const avgMonthlyExpense = filled.length
    ? filled.reduce((a, b) => a + b, 0) / filled.length
    : 0;

  const expenseRunRate = Math.round(avgMonthlyExpense * 12);

  const profitEstimate = incomeTotal - seasonal.yearlyTotal;
  const profitMargin =
    incomeTotal > 0 ? profitEstimate / incomeTotal : 0;

  const filledMonths = input.expenses
    .map((v, i) => (v > 0 ? i : null))
    .filter((v) => v !== null);

  // 🔑 deterministik ID (aynı yıl + aynı unit → tek kayıt)
  const snapshotId = `${year}_${unit}`;

  await setDoc(
    doc(db, "financeSnapshots", snapshotId),
    {
      year,
      unit,
      revenueTotal: incomeTotal,

      expenseRunRate,                  // ✅ YENİ: Ort × 12
      expenseEstimated: seasonal.yearlyTotal, // Mevsimsel

      expenseRealSoFar,
      method: "seasonal",
      filledMonths,
      profitEstimate,
      profitMargin,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}
