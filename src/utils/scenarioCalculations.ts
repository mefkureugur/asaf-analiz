import type { Person, Scenario, PersonCost, ScenarioResult, ScenarioDraft } from '../types/scenario';

const KURUMLAR_VERGISI = 0.20;
const KIDEM_RATE = 1 / 12;
const SAAT_HAFTA_AY = 4;

export function netToTotalCost(netMonthly: number): number {
  let katsayi: number;
  if (netMonthly <= 35000)       katsayi = 1.46;
  else if (netMonthly <= 50000)  katsayi = 1.48;
  else if (netMonthly <= 65000)  katsayi = 1.52;
  else if (netMonthly <= 85000)  katsayi = 1.58;
  else if (netMonthly <= 110000) katsayi = 1.63;
  else                            katsayi = 1.72;
  return netMonthly * katsayi;
}

export function personYearlyCost(p: Person, kidemOn: boolean): PersonCost {
  let kayitli = 0, elden = 0, kidem = 0;

  if (p.mode === 'sgk') {
    const monthlyKuruma = netToTotalCost(p.netSalary ?? 0);
    kayitli = p.count * monthlyKuruma * p.months;
    if (kidemOn) {
      kidem = p.count * ((p.netSalary ?? 0) * 1.30) * KIDEM_RATE * p.months;
    }
  } else if (p.mode === 'sgksiz') {
    elden = p.count * (p.netSalary ?? 0) * p.months;
  } else if (p.mode === 'karma') {
    const monthlyKayitli = netToTotalCost(p.netSalary ?? 0);
    kayitli = p.count * monthlyKayitli * p.months;
    elden = p.count * (p.eldenSalary ?? 0) * p.months;
    if (kidemOn) {
      kidem = p.count * ((p.netSalary ?? 0) * 1.30) * KIDEM_RATE * p.months;
    }
  } else if (p.mode === 'saat_resmi') {
    const monthly = p.count * (p.hourlyRate ?? 0) * (p.weeklyHours ?? 0) * SAAT_HAFTA_AY;
    kayitli = monthly * p.months;
  } else if (p.mode === 'saat_sigortasiz') {
    const monthly = p.count * (p.hourlyRate ?? 0) * (p.weeklyHours ?? 0) * SAAT_HAFTA_AY;
    elden = monthly * p.months;
  }

  return { kayitli, elden, kidem, toplam: kayitli + elden + kidem };
}

export function calculateScenario(s: Scenario | ScenarioDraft): ScenarioResult {
  const yillikCiro = (s.ogrenciSayisi ?? 0) * (s.yillikOgrenciUcreti ?? 0);

  const peopleCosts = (s.people ?? []).map((p: Person) => personYearlyCost(p, s.kidemKarsiligiOn ?? false));
  const totalKayitli = peopleCosts.reduce((sum, c) => sum + c.kayitli, 0);
  const totalElden   = peopleCosts.reduce((sum, c) => sum + c.elden, 0);
  const totalKidem   = peopleCosts.reduce((sum, c) => sum + c.kidem, 0);
  const totalPersonel = totalKayitli + totalElden + totalKidem;

  const digerGiderler = s.digerGider ?? 0;

  const vergiMatrahi = yillikCiro - totalKayitli - totalKidem - digerGiderler;
  const kurumlarVergisi = vergiMatrahi > 0 ? vergiMatrahi * KURUMLAR_VERGISI : 0;

  const netKar = yillikCiro - totalPersonel - digerGiderler - kurumlarVergisi;
  const toplamKisi = (s.people ?? []).reduce((sum, p) => sum + (p.count ?? 0), 0);
  const karMarji = yillikCiro > 0 ? (netKar / yillikCiro) * 100 : 0;

  return {
    yillikCiro, totalKayitli, totalElden, totalKidem, totalPersonel,
    digerGiderler, vergiMatrahi, kurumlarVergisi, netKar, karMarji, toplamKisi
  };
}
