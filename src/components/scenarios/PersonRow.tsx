import type { Person, PaymentMode, PersonRole } from '../../types/scenario';
import { personYearlyCost } from '../../utils/scenarioCalculations';

interface Props {
  person: Person;
  kidemOn: boolean;
  onChange: (updated: Person) => void;
  onRemove: () => void;
}

const ROLE_LABELS: Record<PersonRole, string> = {
  mudur: 'Müdür',
  mudur_yard: 'Müdür Yrd.',
  ogretmen: 'Öğretmen',
  yardimci: 'Yardımcı',
};

const MODE_LABELS: Record<PaymentMode, string> = {
  sgk: "SGK'lı (Net)",
  sgksiz: "SGK'sız (Elden)",
  karma: 'Karma',
  saat_resmi: 'Ders Saati (Resmi)',
  saat_sigortasiz: 'Ders Saati (Elden)',
};

const fmt = (n: number) => Math.round(n).toLocaleString('tr-TR');

export default function PersonRow({ person, kidemOn, onChange, onRemove }: Props) {
  const cost = personYearlyCost(person, kidemOn);

  const update = (fields: Partial<Person>) => onChange({ ...person, ...fields });

  const handleModeChange = (newMode: PaymentMode) => {
    const reset: Partial<Person> = { mode: newMode };
    if (newMode === 'sgk' || newMode === 'sgksiz') {
      reset.hourlyRate = undefined;
      reset.weeklyHours = undefined;
      reset.eldenSalary = undefined;
    } else if (newMode === 'karma') {
      reset.hourlyRate = undefined;
      reset.weeklyHours = undefined;
    } else {
      reset.netSalary = undefined;
      reset.eldenSalary = undefined;
    }
    onChange({ ...person, ...reset });
  };

  const numInput = (label: string, value: number | undefined, field: keyof Person, opts?: { min?: number; max?: number }) => (
    <div style={fieldWrap}>
      <div style={fieldLabel}>{label}</div>
      <input
        type="number"
        value={value ?? ''}
        min={opts?.min ?? 0}
        max={opts?.max}
        onChange={e => {
          let v = Number(e.target.value);
          if (opts?.min !== undefined) v = Math.max(opts.min, v);
          if (opts?.max !== undefined) v = Math.min(opts.max, v);
          update({ [field]: v } as Partial<Person>);
        }}
        style={inp}
      />
    </div>
  );

  const isSaatlik = person.mode === 'saat_resmi' || person.mode === 'saat_sigortasiz';

  return (
    <div style={card}>
      {/* Üst satır: etiket, pozisyon, ödeme şekli, sil */}
      <div style={topRow}>
        <input
          value={person.label}
          onChange={e => update({ label: e.target.value })}
          style={{ ...inp, flex: 1, minWidth: 120 }}
          placeholder="Pozisyon adı"
        />
        <select value={person.role} onChange={e => update({ role: e.target.value as PersonRole })} style={sel}>
          {(Object.keys(ROLE_LABELS) as PersonRole[]).map(r => (
            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
          ))}
        </select>
        <select value={person.mode} onChange={e => handleModeChange(e.target.value as PaymentMode)} style={sel}>
          {(Object.keys(MODE_LABELS) as PaymentMode[]).map(m => (
            <option key={m} value={m}>{MODE_LABELS[m]}</option>
          ))}
        </select>
        <button onClick={onRemove} style={delBtn} title="Çalışanı sil">✕</button>
      </div>

      {/* Giriş alanları */}
      <div style={inputGrid}>
        {numInput('Kişi Sayısı', person.count, 'count', { min: 1 })}
        {numInput('Ay Sayısı', person.months, 'months', { min: 1, max: 12 })}

        {!isSaatlik && (
          numInput(person.mode === 'sgksiz' ? 'Aylık elden (₺)' : 'Net maaş (₺/ay)', person.netSalary, 'netSalary', { min: 0 })
        )}
        {person.mode === 'karma' && (
          numInput('Elden ek (₺/ay)', person.eldenSalary, 'eldenSalary', { min: 0 })
        )}
        {isSaatlik && (
          <>
            {numInput('Saatlik ücret (₺)', person.hourlyRate, 'hourlyRate', { min: 0 })}
            {numInput('Haftalık saat', person.weeklyHours, 'weeklyHours', { min: 0 })}
          </>
        )}
      </div>

      {/* Maliyet özeti */}
      <div style={costRow}>
        {cost.kayitli > 0 && <span style={tag('#3b82f6')}>Kayıtlı: ₺{fmt(cost.kayitli)}</span>}
        {cost.elden > 0 && <span style={tag('#f59e0b')}>Elden: ₺{fmt(cost.elden)}</span>}
        {cost.kidem > 0 && <span style={tag('#8b5cf6')}>Kıdem: ₺{fmt(cost.kidem)}</span>}
        <span style={totalTag}>Yıllık toplam: ₺{fmt(cost.toplam)}</span>
      </div>
    </div>
  );
}

const card: React.CSSProperties = {
  background: '#020617', border: '1px solid #1e293b', borderRadius: 10,
  padding: '14px', display: 'flex', flexDirection: 'column', gap: 10
};
const topRow: React.CSSProperties = { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' };
const inputGrid: React.CSSProperties = { display: 'flex', gap: 8, flexWrap: 'wrap' };
const fieldWrap: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4, minWidth: 110, flex: 1 };
const fieldLabel: React.CSSProperties = { color: '#64748b', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.04em' };
const inp: React.CSSProperties = {
  background: '#1e293b', border: '1px solid #334155', color: 'white',
  padding: '7px 10px', borderRadius: 6, fontSize: '0.85rem', outline: 'none', width: '100%', boxSizing: 'border-box'
};
const sel: React.CSSProperties = {
  background: '#1e293b', border: '1px solid #334155', color: 'white',
  padding: '7px 8px', borderRadius: 6, fontSize: '0.8rem', outline: 'none', cursor: 'pointer'
};
const delBtn: React.CSSProperties = {
  background: 'transparent', border: '1px solid #334155', color: '#ef4444',
  width: 30, height: 30, borderRadius: 6, cursor: 'pointer', fontSize: '0.85rem',
  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
};
const costRow: React.CSSProperties = { display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' };
const tag = (color: string): React.CSSProperties => ({
  background: color + '15', border: `1px solid ${color}30`, color,
  padding: '2px 8px', borderRadius: 4, fontSize: '0.7rem', fontWeight: 600
});
const totalTag: React.CSSProperties = {
  marginLeft: 'auto', color: '#f8fafc', fontSize: '0.75rem', fontWeight: 700
};
