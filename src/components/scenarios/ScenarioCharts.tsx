import { useMemo } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';
import type { Person, ScenarioResult, PersonRole } from '../../types/scenario';
import { personYearlyCost } from '../../utils/scenarioCalculations';

interface Props {
  result: ScenarioResult;
  people: Person[];
  kidemOn: boolean;
}

const ROLE_LABELS: Record<PersonRole, string> = {
  mudur: 'Müdür', mudur_yard: 'Müd.Yrd.', ogretmen: 'Öğretmen', yardimci: 'Yardımcı'
};

const fmt = (n: number) => `₺${Math.round(n / 1000)}K`;

export default function ScenarioCharts({ result, people, kidemOn }: Props) {
  const pieData = useMemo(() => [
    { name: 'Personel Kayıtlı', value: result.totalKayitli, color: '#3b82f6' },
    { name: 'Personel Elden', value: result.totalElden, color: '#f59e0b' },
    { name: 'Kıdem Karşılığı', value: result.totalKidem, color: '#8b5cf6' },
    { name: 'Diğer Giderler', value: result.digerGiderler, color: '#64748b' },
    { name: 'Kurumlar Vergisi', value: result.kurumlarVergisi, color: '#ef4444' },
    { name: 'Net Kâr', value: Math.max(0, result.netKar), color: '#22c55e' },
  ].filter(d => d.value > 0), [result]);

  const barData = useMemo(() => {
    const roles: PersonRole[] = ['mudur', 'mudur_yard', 'ogretmen', 'yardimci'];
    return roles.map(role => {
      const rolePeople = people.filter(p => p.role === role);
      const total = rolePeople.reduce((sum, p) => sum + personYearlyCost(p, kidemOn).toplam, 0);
      return { name: ROLE_LABELS[role], value: total };
    }).filter(d => d.value > 0);
  }, [people, kidemOn]);

  const tooltipStyle = { background: '#020617', border: '1px solid #1e293b', borderRadius: 8, fontSize: '0.75rem' };

  return (
    <div style={card}>
      <div style={cardTitle}>GİDER DAĞILIMI</div>

      {pieData.length > 0 && (
        <div style={{ height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={pieData} dataKey="value" cx="50%" cy="50%" outerRadius={75} paddingAngle={2}>
                {pieData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v: any) => [`₺${Math.round(v).toLocaleString('tr-TR')}`, '']}
              />
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: '0.65rem', color: '#94a3b8' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {barData.length > 0 && (
        <>
          <div style={{ ...cardTitle, marginTop: 16 }}>POZİSYON BAZLI MALİYET</div>
          <div style={{ height: 160 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} />
                <YAxis hide />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v: any) => [`₺${Math.round(v).toLocaleString('tr-TR')}`, 'Yıllık Maliyet']}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} fill="#3b82f6">
                  {barData.map((_, i) => (
                    <Cell key={i} fill={['#3b82f6', '#38bdf8', '#22c55e', '#f59e0b'][i % 4]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}

const card: React.CSSProperties = { background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: '20px' };
const cardTitle: React.CSSProperties = { color: '#94a3b8', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.05em', marginBottom: 10 };
