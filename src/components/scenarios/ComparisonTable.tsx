import { useMemo } from 'react';
import { KURUMLAR } from '../../constants/kurumlar';
import type { Scenario } from '../../types/scenario';
import { calculateScenario } from '../../utils/scenarioCalculations';

interface Props {
  activeScenarios: Scenario[];
}

const fmt = (n: number) => `₺${Math.round(n / 1000)}K`;
const pct = (n: number) => `%${n.toFixed(1)}`;

export default function ComparisonTable({ activeScenarios }: Props) {
  const rows = useMemo(() => {
    return KURUMLAR.map(k => {
      const s = activeScenarios.find(sc => sc.kurumId === k.id);
      if (!s) return { name: k.name, hasData: false, result: null, kisi: 0 };
      const result = calculateScenario(s);
      return { name: k.name, hasData: true, result, kisi: result.toplamKisi };
    });
  }, [activeScenarios]);

  const totals = useMemo(() => {
    const dataRows = rows.filter(r => r.hasData && r.result);
    if (dataRows.length === 0) return null;
    return dataRows.reduce((acc, r) => {
      const res = r.result!;
      return {
        kisi: acc.kisi + r.kisi,
        ciro: acc.ciro + res.yillikCiro,
        personel: acc.personel + res.totalPersonel,
        diger: acc.diger + res.digerGiderler,
        vergi: acc.vergi + res.kurumlarVergisi,
        netKar: acc.netKar + res.netKar,
      };
    }, { kisi: 0, ciro: 0, personel: 0, diger: 0, vergi: 0, netKar: 0 });
  }, [rows]);

  return (
    <div style={card}>
      <div style={cardTitle}>KURUM KARŞILAŞTIRMASI (Aktif Senaryolar)</div>
      <div style={{ overflowX: 'auto' }}>
        <table style={tbl}>
          <thead>
            <tr>
              {['Kurum', 'Çalışan', 'Ciro', 'Personel', 'Diğer Gider', 'Vergi', 'Net Kâr', 'Marj'].map(h => (
                <th key={h} style={th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.name} style={tr}>
                <td style={td}>{r.name}</td>
                {r.hasData && r.result ? (
                  <>
                    <td style={td}>{r.kisi}</td>
                    <td style={td}>{fmt(r.result.yillikCiro)}</td>
                    <td style={td}>{fmt(r.result.totalPersonel)}</td>
                    <td style={td}>{fmt(r.result.digerGiderler)}</td>
                    <td style={td}>{fmt(r.result.kurumlarVergisi)}</td>
                    <td style={{ ...td, color: r.result.netKar >= 0 ? '#22c55e' : '#ef4444', fontWeight: 700 }}>
                      {r.result.netKar >= 0 ? '' : '-'}{fmt(r.result.netKar)}
                    </td>
                    <td style={{ ...td, color: r.result.karMarji >= 0 ? '#22c55e' : '#ef4444', fontWeight: 700 }}>
                      {pct(r.result.karMarji)}
                    </td>
                  </>
                ) : (
                  <td colSpan={7} style={{ ...td, color: '#334155', textAlign: 'center' }}>— aktif senaryo yok —</td>
                )}
              </tr>
            ))}

            {totals && (
              <tr style={{ ...tr, borderTop: '2px solid #334155' }}>
                <td style={{ ...td, fontWeight: 800, color: '#f8fafc' }}>TOPLAM</td>
                <td style={{ ...td, fontWeight: 700 }}>{totals.kisi}</td>
                <td style={{ ...td, fontWeight: 700 }}>{fmt(totals.ciro)}</td>
                <td style={{ ...td, fontWeight: 700 }}>{fmt(totals.personel)}</td>
                <td style={{ ...td, fontWeight: 700 }}>{fmt(totals.diger)}</td>
                <td style={{ ...td, fontWeight: 700 }}>{fmt(totals.vergi)}</td>
                <td style={{ ...td, fontWeight: 800, color: totals.netKar >= 0 ? '#22c55e' : '#ef4444' }}>
                  {totals.netKar >= 0 ? '' : '-'}{fmt(totals.netKar)}
                </td>
                <td style={{ ...td, fontWeight: 700, color: totals.ciro > 0 ? (totals.netKar >= 0 ? '#22c55e' : '#ef4444') : '#64748b' }}>
                  {totals.ciro > 0 ? pct((totals.netKar / totals.ciro) * 100) : '—'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const card: React.CSSProperties = { background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: '20px' };
const cardTitle: React.CSSProperties = { color: '#94a3b8', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.05em', marginBottom: 14 };
const tbl: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' };
const th: React.CSSProperties = { color: '#64748b', fontWeight: 700, fontSize: '0.65rem', letterSpacing: '0.04em', padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid #1e293b' };
const tr: React.CSSProperties = { borderBottom: '1px solid #1e2937' };
const td: React.CSSProperties = { color: '#94a3b8', padding: '10px 12px', whiteSpace: 'nowrap' };
