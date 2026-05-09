export const KURUMLAR = [
  { id: 'altinkure_ilk',  name: 'Altınküre İlköğretim' },
  { id: 'altinkure_lise', name: 'Altınküre Lise' },
  { id: 'altinkure_tek',  name: 'Altınküre Teknokent' },
  { id: 'mefkure_lgs',   name: 'Mefkure LGS' },
  { id: 'mefkure_yks',   name: 'Mefkure YKS' },
] as const;

export type KurumId = typeof KURUMLAR[number]['id'];
