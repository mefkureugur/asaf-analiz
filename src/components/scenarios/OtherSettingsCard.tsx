interface Props {
  digerGiderOrani: number;
  kidemKarsiligiOn: boolean;
  onChange: (updates: { digerGiderOrani?: number; kidemKarsiligiOn?: boolean }) => void;
}

export default function OtherSettingsCard({ digerGiderOrani, kidemKarsiligiOn, onChange }: Props) {
  return (
    <div style={card}>
      <div style={cardTitle}>DİĞER AYARLAR</div>

      <div style={row}>
        <div style={{ flex: 1 }}>
          <label style={lbl}>Diğer Gider Oranı (Ciro'nun %{digerGiderOrani}'i)</label>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 8 }}>
            <input
              type="range" min={0} max={50} step={1}
              value={digerGiderOrani}
              onChange={e => onChange({ digerGiderOrani: Number(e.target.value) })}
              style={{ flex: 1, accentColor: '#38bdf8' }}
            />
            <input
              type="number" min={0} max={100}
              value={digerGiderOrani}
              onChange={e => onChange({ digerGiderOrani: Math.min(100, Math.max(0, Number(e.target.value))) })}
              style={{ ...numInp, width: 60 }}
            />
            <span style={{ color: '#64748b', fontSize: '0.85rem' }}>%</span>
          </div>
        </div>
      </div>

      <div
        style={toggleRow}
        onClick={() => onChange({ kidemKarsiligiOn: !kidemKarsiligiOn })}
      >
        <div>
          <div style={{ color: '#f8fafc', fontSize: '0.85rem', fontWeight: 600 }}>Kıdem Tazminatı Karşılığı</div>
          <div style={{ color: '#64748b', fontSize: '0.7rem', marginTop: 2 }}>
            SGK'lı maaşların %8.33'ü ek maliyet olarak eklenir
          </div>
        </div>
        <div style={toggleTrack(kidemKarsiligiOn)}>
          <div style={toggleThumb(kidemKarsiligiOn)} />
        </div>
      </div>
    </div>
  );
}

const card: React.CSSProperties = { background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: '20px' };
const cardTitle: React.CSSProperties = { color: '#94a3b8', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.05em', marginBottom: 16 };
const lbl: React.CSSProperties = { color: '#64748b', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.04em' };
const row: React.CSSProperties = { marginBottom: 16 };
const numInp: React.CSSProperties = {
  background: '#1e293b', border: '1px solid #334155', color: 'white',
  padding: '6px 8px', borderRadius: 6, fontSize: '0.85rem', outline: 'none', boxSizing: 'border-box'
};
const toggleRow: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  background: '#020617', border: '1px solid #1e293b', borderRadius: 8,
  padding: '12px 14px', cursor: 'pointer', userSelect: 'none'
};
const toggleTrack = (on: boolean): React.CSSProperties => ({
  width: 40, height: 22, borderRadius: 11, flexShrink: 0,
  background: on ? '#38bdf8' : '#334155', position: 'relative', transition: 'background 0.2s'
});
const toggleThumb = (on: boolean): React.CSSProperties => ({
  width: 16, height: 16, borderRadius: '50%', background: 'white',
  position: 'absolute', top: 3, left: on ? 21 : 3, transition: 'left 0.2s'
});
