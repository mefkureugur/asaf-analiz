import type { ScenarioResult } from '../../types/scenario';

interface Props {
  result: ScenarioResult;
  digerGiderOrani: number;
  kidemOn: boolean;
}

const fmt = (n: number) => `₺${Math.round(Math.abs(n)).toLocaleString('tr-TR')}`;

export default function ResultPanel({ result, digerGiderOrani, kidemOn }: Props) {
  const isProfit = result.netKar >= 0;

  return (
    <div style={card}>
      <div style={cardTitle}>SONUÇLAR (YILLIK)</div>

      <div style={table}>
        <Row label="Yıllık Ciro" value={fmt(result.yillikCiro)} color="#f8fafc" bold />
        <Divider />
        <Row label="Personel — Kayıtlı" value={`-${fmt(result.totalKayitli)}`} color="#ef4444" />
        <Row label="Personel — Elden" value={`-${fmt(result.totalElden)}`} color="#f59e0b" />
        {kidemOn && result.totalKidem > 0 && (
          <Row label="Kıdem Karşılığı" value={`-${fmt(result.totalKidem)}`} color="#8b5cf6" />
        )}
        <Row label={`Diğer Giderler (%${digerGiderOrani})`} value={`-${fmt(result.digerGiderler)}`} color="#64748b" />
        <Divider />
        <Row
          label="Vergi Matrahı"
          value={result.vergiMatrahi >= 0 ? fmt(result.vergiMatrahi) : `-${fmt(result.vergiMatrahi)}`}
          color={result.vergiMatrahi >= 0 ? '#94a3b8' : '#ef4444'}
        />
        <Row label="Kurumlar Vergisi (%25)" value={`-${fmt(result.kurumlarVergisi)}`} color="#ef4444" />
        <Divider />
        <Row
          label="NET KAR"
          value={(isProfit ? '' : '-') + fmt(result.netKar)}
          color={isProfit ? '#22c55e' : '#ef4444'}
          bold
          large
        />
        <Row label="Kâr Marjı" value={`%${result.karMarji.toFixed(1)}`} color={isProfit ? '#22c55e' : '#ef4444'} bold />
        <Row label="Toplam Çalışan" value={`${result.toplamKisi} kişi`} color="#94a3b8" />
      </div>
    </div>
  );
}

function Row({ label, value, color, bold, large }: { label: string; value: string; color: string; bold?: boolean; large?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0' }}>
      <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>{label}</span>
      <span style={{ color, fontWeight: bold ? 800 : 500, fontSize: large ? '1.1rem' : '0.85rem' }}>{value}</span>
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: '#1e293b', margin: '4px 0' }} />;
}

const card: React.CSSProperties = { background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: '20px' };
const cardTitle: React.CSSProperties = { color: '#94a3b8', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.05em', marginBottom: 14 };
const table: React.CSSProperties = { display: 'flex', flexDirection: 'column' };
