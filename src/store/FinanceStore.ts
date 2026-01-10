export type Branch = "YKS" | "LGS";

export type FinanceInput = {
  income: {
    student: number;
    food: number;
    other: number;
  };
  expenses: number[]; // 12 ay
};

export type FinanceState = {
  YKS: FinanceInput;
  LGS: FinanceInput;
};

const STORAGE_KEY = "edu_analytics_finance_v1";

function emptyInput(): FinanceInput {
  return {
    income: { student: 0, food: 0, other: 0 },
    expenses: Array.from({ length: 12 }, () => 0),
  };
}

function emptyState(): FinanceState {
  return {
    YKS: emptyInput(),
    LGS: emptyInput(),
  };
}

export function loadFinance(): FinanceState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    return JSON.parse(raw);
  } catch {
    return emptyState();
  }
}

export function saveFinance(state: FinanceState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
