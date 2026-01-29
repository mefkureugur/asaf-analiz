export const CLASSES = [
  "Ana-4", "Ana-5", "Ana-6", // Anaokulu Grupları
  "1", "2", "3", "4",           // İlköğretim
  "5", "6", "7", "8",           // Ortaokul / LGS
  "9", "10", "11", "12",        // Lise / YKS
  "Mezun", 
  "Mood"
] as const;

export type ClassType = (typeof CLASSES)[number];