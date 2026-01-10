// src/services/financeSnapshot.read.ts
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";

export type FinanceUnit = "YKS" | "LGS" | "GENERAL";

export type FinanceSnapshot = {
  year: number;
  unit: FinanceUnit;

  revenueTotal: number;
  expenseEstimated: number;
  expenseRealSoFar: number;

  method?: string;
  filledMonths?: number[];

  profitEstimate: number;
  profitMargin: number;

  updatedAt?: any;
};

export async function getFinanceSnapshot(
  year: number,
  unit: FinanceUnit
): Promise<FinanceSnapshot | null> {
  const snapshotId = `${year}_${unit}`; // saveFinanceSnapshot ile aynı ID mantığı
  const ref = doc(db, "financeSnapshots", snapshotId);
  const snap = await getDoc(ref);

  if (!snap.exists()) return null;
  return snap.data() as FinanceSnapshot;
}
