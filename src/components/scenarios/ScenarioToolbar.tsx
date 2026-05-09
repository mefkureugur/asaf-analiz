import { KURUMLAR } from '../../constants/kurumlar';
import type { Scenario } from '../../types/scenario';

interface Props {
  selectedKurumId: string;
  onKurumChange: (id: string) => void;
  scenarios: Scenario[];
  selectedScenarioId: string | null;
  onScenarioChange: (id: string) => void;
  onNew: () => void;
  onSave: () => void;
  onActivate: () => void;
  onDelete: () => void;
  onPrint: () => void;
  isSaving: boolean;
  isNewUnsaved: boolean;
}

export default function ScenarioToolbar(props: Props) {
  const {
    selectedKurumId, onKurumChange,
    scenarios, selectedScenarioId, onScenarioChange,
    onNew, onSave, onActivate, onDelete, onPrint,
    isSaving, isNewUnsaved
  } = props;

  const selectedScenario = scenarios.find(s => s.id === selectedScenarioId);
  const isActive = selectedScenario?.isActive ?? false;

  return (
    <div style={toolbar} className="no-print">
      {/* Dropdowns */}
      <div style={dropdowns}>
        <select value={selectedKurumId} onChange={e => onKurumChange(e.target.value)} style={sel}>
          {KURUMLAR.map(k => (
            <option key={k.id} value={k.id}>{k.name}</option>
          ))}
        </select>

        <select
          value={selectedScenarioId ?? ''}
          onChange={e => onScenarioChange(e.target.value)}
          style={sel}
          disabled={scenarios.length === 0}
        >
          {scenarios.length === 0 && <option value="">— senaryo yok —</option>}
          {scenarios.map(s => (
            <option key={s.id} value={s.id}>
              {s.isActive ? '⭐ ' : ''}{s.name}
            </option>
          ))}
          {isNewUnsaved && <option value="">✏️ Yeni (kaydedilmedi)</option>}
        </select>
      </div>

      {/* Butonlar */}
      <div style={buttons}>
        <Btn onClick={onNew} label="+ Yeni" color="#38bdf8" />
        <Btn onClick={onSave} label={isSaving ? 'Kaydediliyor...' : '💾 Kaydet'} color="#22c55e" disabled={isSaving} />
        <Btn
          onClick={onActivate}
          label="⭐ Aktif Yap"
          color="#f59e0b"
          disabled={isNewUnsaved || isActive}
          title={isActive ? 'Zaten aktif' : undefined}
        />
        <Btn onClick={onDelete} label="🗑 Sil" color="#ef4444" disabled={isNewUnsaved} />
        <Btn onClick={onPrint} label="🖨 PDF" color="#94a3b8" />
      </div>
    </div>
  );
}

function Btn({ onClick, label, color, disabled, title }: { onClick: () => void; label: string; color: string; disabled?: boolean; title?: string }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        background: 'transparent',
        border: `1px solid ${disabled ? '#1e293b' : color + '60'}`,
        color: disabled ? '#334155' : color,
        padding: '8px 12px', borderRadius: 8, cursor: disabled ? 'default' : 'pointer',
        fontSize: '0.8rem', fontWeight: 600, whiteSpace: 'nowrap', transition: 'all 0.15s'
      }}
    >
      {label}
    </button>
  );
}

const toolbar: React.CSSProperties = {
  background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12,
  padding: '12px 16px', display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center'
};
const dropdowns: React.CSSProperties = { display: 'flex', gap: 10, flex: 1, flexWrap: 'wrap' };
const buttons: React.CSSProperties = { display: 'flex', gap: 8, flexWrap: 'wrap' };
const sel: React.CSSProperties = {
  background: '#020617', border: '1px solid #334155', color: 'white',
  padding: '8px 12px', borderRadius: 8, fontSize: '0.85rem', outline: 'none', cursor: 'pointer', minWidth: 160
};
