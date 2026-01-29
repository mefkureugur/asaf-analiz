import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";

// ASAF 6 Şube + Genel Toplam
export type FinanceUnit = 
  | "Mefkure LGS" 
  | "Mefkure VİP" 
  | "Mefkure PLUS" 
  | "Altınküre İlköğretim" 
  | "Altınküre Lise" 
  | "Altınküre Teknokent" 
  | "GENERAL"
  | "YKS" // Eski verilerle uyumluluk için bırakıldı
  | "LGS";

export type FinanceSnapshot = {
  year: number;
  unit: string; // FinanceUnit tipini kapsar

  revenueTotal: number;
  expenseEstimated: number;
  expenseRealSoFar: number;

  method?: string;
  filledMonths?: number[];

  profitEstimate: number;
  profitMargin: number;

  updatedAt?: any;
};

/**
 * Belirtilen yıl ve şube (unit) için Firestore'dan finansal özeti okur.
 */
export async function getFinanceSnapshot(
  year: number,
  unit: string // Daha esnek olması için string kabul ediyoruz
): Promise<FinanceSnapshot | null> {
  // ID mantığı: 2026_Mefkure LGS veya 2026_GENERAL
  const snapshotId = `${year}_${unit}`;
  
  try {
    const ref = doc(db, "financeSnapshots", snapshotId);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      console.log(`ℹ️ ${snapshotId} için henüz bir finansal snapshot bulunamadı.`);
      return null;
    }
    
    return snap.data() as FinanceSnapshot;
  } catch (err) {
    console.error(`❌ FinanceSnapshot okuma hatası (${snapshotId}):`, err);
    return null;
  }
}