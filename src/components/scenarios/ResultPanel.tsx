import type { ScenarioResult } from '../../types/scenario';

interface Props {
  result: ScenarioResult;
  kidemOn: boolean;
}

const fmt = (n: number) => `₺${Math.round(Math.abs(n)).toLocaleString('tr-TR')}`;

export default function ResultPanel({ result, kidemOn }: Props) {
  const isProfit = result.netKar >= 0;

  return (
    <div style={card}>
      <div style={cardTitle}>SONUÇLAR (YILLIK)</div>

      <div style={table}>
        <Row label="Yıllık Ciro" value={fmt(result.yillikCiro)} color="var(--text)" bold />
        <Divider />
        <Row label="Personel — Kayıtlı" value={`-${fmt(result.totalKayitli)}`} color="var(--danger)" />
        <Row label="Personel — Elden" value={`-${fmt(result.totalElden)}`} color="var(--warning)" />
        {kidemOn && result.totalKidem > 0 && (
          <Row label="Kıdem Karşılığı" value={`-${fmt(result.totalKidem)}`} color="#8b5cf6" />
        )}
        <Row label="Diğer Giderler" value={`-${fmt(result.digerGiderler)}`} color="var(--text-3)" />
        <Divider />
        <Row
          label="Vergi Matrahı"
          value={result.vergiMatrahi >= 0 ? fmt(result.vergiMatrahi) : `-${fmt(result.vergiMatrahi)}`}
          color={result.vergiMatrahi >= 0 ? 'var(--text-2)' : 'var(--danger)'}
        />
        <Row label="Kurumlar Vergisi (%20)" value={`-${fmt(result.kurumlarVergisi)}`} color="var(--danger)" />
        <Divider />
        <Row
          label="NET KAR"
          value={(isProfit ? '' : '-') + fmt(result.netKar)}
          color={isProfit ? 'var(--success)' : 'var(--danger)'}
          bold
          large
          printClass={isProfit ? 'val-green' : 'val-red'}
        />
        <Row label="Kâr Marjı" value={`%${result.karMarji.toFixed(1)}`} color={isProfit ? 'var(--success)' : 'var(--danger)'} bold />
        <Row label="Toplam Çalışan" value={`${result.toplamKisi} kişi`} color="var(--text-2)" />
      </div>
    </div>
  );
}

function Row({ label, value, color, bold, large, printClass }: {
  label: string; value: string; color: string; bold?: boolean; large?: boolean; printClass?: string;
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0' }}>
      <span style={{ color: 'var(--text-2)', fontSize: '0.75rem' }}>{label}</span>
      <span className={printClass} style={{ color, fontWeight: bold ? 800 : 500, fontSize: large ? '1.1rem' : '0.85rem' }}>{value}</span>
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: 'var(--line)', margin: '4px 0' }} />;
}

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: "var(--r-md)", padding: '20px' };
const cardTitle: React.CSSProperties = { color: 'var(--text-2)', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.05em', marginBottom: 14 };
const table: React.CSSProperties = { display: 'flex', flexDirection: 'column' };
