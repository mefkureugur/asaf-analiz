import type { Timestamp } from 'firebase/firestore';

export type PersonRole = 'mudur' | 'mudur_yard' | 'ogretmen' | 'yardimci';
export type PaymentMode = 'sgk' | 'sgksiz' | 'karma' | 'saat_resmi' | 'saat_sigortasiz';

export interface Person {
  id: string;
  role: PersonRole;
  label: string;
  mode: PaymentMode;
  count: number;
  months: number;
  netSalary?: number;
  eldenSalary?: number;
  hourlyRate?: number;
  weeklyHours?: number;
}

export interface Scenario {
  id: string;
  kurumId: string;
  name: string;
  note?: string;
  isActive: boolean;
  ogrenciSayisi: number;
  yillikOgrenciUcreti: number;
  people: Person[];
  digerGider: number;
  kidemKarsiligiOn: boolean;
  createdBy: string;
  createdByEmail: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ScenarioDraft {
  id?: string;
  kurumId: string;
  name: string;
  note?: string;
  isActive: boolean;
  ogrenciSayisi: number;
  yillikOgrenciUcreti: number;
  people: Person[];
  digerGider: number;
  kidemKarsiligiOn: boolean;
}

export interface PersonCost {
  kayitli: number;
  elden: number;
  kidem: number;
  toplam: number;
}

export interface ScenarioResult {
  yillikCiro: number;
  totalKayitli: number;
  totalElden: number;
  totalKidem: number;
  totalPersonel: number;
  digerGiderler: number;
  vergiMatrahi: number;
  kurumlarVergisi: number;
  netKar: number;
  karMarji: number;
  toplamKisi: number;
}
