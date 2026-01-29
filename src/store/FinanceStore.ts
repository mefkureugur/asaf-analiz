/* ================================
   TYPES (ASAF 6 ŞUBE)
================================ */

// Şube isimlerini sistemin geri kalanıyla tam uyumlu hale getirdik
export type Branch = 
  | "Mefkure LGS" 
  | "Mefkure VİP" 
  | "Mefkure PLUS" 
  | "Altınküre İlköğretim" 
  | "Altınküre Lise" 
  | "Altınküre Teknokent";

export type FinanceInput = {
  income: {
    student: number;
    food: number;
    other: number;
  };
  expenses: number[]; // 12 ay (Ağustos - Temmuz)
};

// State yapısını dinamik hale getirdik (Key olarak Branch kullanır)
export type FinanceState = Record<Branch, FinanceInput>;

const STORAGE_KEY = "asaf_analiz_finance_v2"; // Versiyonu v2 yaptık ki eski verilerle çakışmasın

/* ================================
   HELPERS
================================ */

function emptyInput(): FinanceInput {
  return {
    income: { student: 0, food: 0, other: 0 },
    expenses: Array.from({ length: 12 }, () => 0),
  };
}

// Tüm şubeler için boş bir başlangıç durumu oluşturur
function emptyState(): FinanceState {
  return {
    "Mefkure LGS": emptyInput(),
    "Mefkure VİP": emptyInput(),
    "Mefkure PLUS": emptyInput(),
    "Altınküre İlköğretim": emptyInput(),
    "Altınküre Lise": emptyInput(),
    "Altınküre Teknokent": emptyInput(),
  };
}

/* ================================
   OPERATIONS
================================ */

export function loadFinance(): FinanceState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    
    const parsed = JSON.parse(raw);
    
    // Eğer yeni eklenen bir şube varsa ve localstorage'da yoksa onu da boş olarak ekle (Crash koruması)
    const state = emptyState();
    return { ...state, ...parsed };
  } catch {
    return emptyState();
  }
}

export function saveFinance(state: FinanceState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}