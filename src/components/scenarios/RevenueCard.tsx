interface Props {
  ogrenciSayisi: number;
  yillikOgrenciUcreti: number;
  onChange: (updates: { ogrenciSayisi?: number; yillikOgrenciUcreti?: number }) => void;
}

const fmt = (n: number) => `₺${Math.round(n).toLocaleString('tr-TR')}`;

export default function RevenueCard({ ogrenciSayisi, yillikOgrenciUcreti, onChange }: Props) {
  const ciro = ogrenciSayisi * yillikOgrenciUcreti;

  return (
    <div style={card}>
      <div style={cardTitle}>GELİR</div>
      <div style={grid}>
        <div style={fieldWrap}>
          <label style={lbl}>Öğrenci Sayısı</label>
          <input
            type="number" min={0} value={ogrenciSayisi}
            onChange={e => onChange({ ogrenciSayisi: Math.max(0, Number(e.target.value)) })}
            style={inp}
          />
        </div>
        <div style={fieldWrap}>
          <label style={lbl}>Yıllık Ortalama Ücret (₺)</label>
          <input
            type="number" min={0} value={yillikOgrenciUcreti}
            onChange={e => onChange({ yillikOgrenciUcreti: Math.max(0, Number(e.target.value)) })}
            style={inp}
          />
        </div>
      </div>
      <div style={ciroBadge}>
        <span style={{ color: '#64748b', fontSize: '0.75rem' }}>Hesaplanan Yıllık Ciro</span>
        <span style={{ color: '#22c55e', fontSize: '1.3rem', fontWeight: 800 }}>{fmt(ciro)}</span>
      </div>
    </div>
  );
}

const card: React.CSSProperties = { background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: '20px' };
const cardTitle: React.CSSProperties = { color: '#94a3b8', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.05em', marginBottom: 14 };
const grid: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 };
const fieldWrap: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6 };
const lbl: React.CSSProperties = { color: '#64748b', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.04em' };
const inp: React.CSSProperties = {
  background: '#1e293b', border: '1px solid #334155', color: 'white',
  padding: '10px 12px', borderRadius: 8, fontSize: '0.9rem', outline: 'none', width: '100%', boxSizing: 'border-box'
};
const ciroBadge: React.CSSProperties = {
  marginTop: 14, background: '#022c1a', border: '1px solid #166534', borderRadius: 8,
  padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
};
