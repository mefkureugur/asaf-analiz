interface Props {
  digerGider: number;
  kidemKarsiligiOn: boolean;
  onChange: (updates: { digerGider?: number; kidemKarsiligiOn?: boolean }) => void;
}

export default function OtherSettingsCard({ digerGider, kidemKarsiligiOn, onChange }: Props) {
  return (
    <div style={card}>
      <div style={cardTitle}>DİĞER AYARLAR</div>

      <div style={row}>
        <label style={lbl}>Diğer Giderler (Yıllık Tutar)</label>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
          <span style={{ color: 'var(--text-3)', fontSize: '0.9rem', flexShrink: 0 }}>₺</span>
          <input
            type="number"
            min={0}
            step={5000}
            value={digerGider}
            onChange={e => onChange({ digerGider: Math.max(0, Number(e.target.value)) })}
            style={{ ...numInp, flex: 1 }}
          />
        </div>
      </div>

      <div
        style={toggleRow}
        onClick={() => onChange({ kidemKarsiligiOn: !kidemKarsiligiOn })}
      >
        <div>
          <div style={{ color: 'var(--text)', fontSize: '0.85rem', fontWeight: 600 }}>Kıdem Tazminatı Karşılığı</div>
          <div style={{ color: 'var(--text-3)', fontSize: '0.7rem', marginTop: 2 }}>
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

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: "var(--r-md)", padding: '20px' };
const cardTitle: React.CSSProperties = { color: 'var(--text-2)', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.05em', marginBottom: 16 };
const lbl: React.CSSProperties = { color: 'var(--text-3)', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.04em' };
const row: React.CSSProperties = { marginBottom: 16 };
const numInp: React.CSSProperties = {
  background: 'var(--line)', border: '1px solid var(--line-strong)', color: 'var(--text)',
  padding: '10px 12px', borderRadius: "var(--r-sm)", fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box'
};
const toggleRow: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: "var(--r-sm)",
  padding: '12px 14px', cursor: 'pointer', userSelect: 'none'
};
const toggleTrack = (on: boolean): React.CSSProperties => ({
  width: 40, height: 22, borderRadius: "var(--r-md)", flexShrink: 0,
  background: on ? 'var(--accent)' : 'var(--line-strong)', position: 'relative', transition: 'background 0.2s'
});
const toggleThumb = (on: boolean): React.CSSProperties => ({
  // Topuz her iki temada da zeminden ayrilmali: aydinlikta beyaz
    // topuz acik rayda kaybolurdu, bu yuzden yuzey rengi kullaniliyor.
    width: 16, height: 16, borderRadius: '50%', background: 'var(--surface)',
    boxShadow: '0 1px 2px rgba(0,0,0,.25)',
  position: 'absolute', top: 3, left: on ? 21 : 3, transition: 'left 0.2s'
});
