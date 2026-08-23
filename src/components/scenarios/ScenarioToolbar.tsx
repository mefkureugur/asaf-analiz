import { KURUMLAR } from '../../constants/kurumlar';
import type { Scenario } from '../../types/scenario';

interface Props {
  selectedKurumId: string;
  onKurumChange: (id: string) => void;
  /** Kurucu için true: kurum listesi açılır. Müdür için false: kendi
      kurumunun adı sabit metin olarak görünür. */
  kurumSecilebilir?: boolean;
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
    selectedKurumId, onKurumChange, kurumSecilebilir = true,
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
        {/* Kurucu kurum seçebilir; müdür kendi kurumuna kilitli olduğu için
            seçici yerine kurumunun adını sabit görür. */}
        {kurumSecilebilir ? (
          <select value={selectedKurumId} onChange={e => onKurumChange(e.target.value)} style={sel}>
            {KURUMLAR.map(k => (
              <option key={k.id} value={k.id}>{k.name}</option>
            ))}
          </select>
        ) : (
          <div style={kurumEtiketi}>
            {KURUMLAR.find(k => k.id === selectedKurumId)?.name ?? 'Kurum'}
          </div>
        )}

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
        <Btn onClick={onNew} label="+ Yeni" color="var(--accent)" />
        <Btn onClick={onSave} label={isSaving ? 'Kaydediliyor...' : '💾 Kaydet'} color="var(--success)" disabled={isSaving} />
        <Btn
          onClick={onActivate}
          label="⭐ Aktif Yap"
          color="var(--warning)"
          disabled={isNewUnsaved || isActive}
          title={isActive ? 'Zaten aktif' : undefined}
        />
        <Btn onClick={onDelete} label="🗑 Sil" color="var(--danger)" disabled={isNewUnsaved} />
        <Btn onClick={onPrint} label="🖨 PDF" color="var(--text-2)" />
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
      // Saydam kenar icin hex'e alfa eklemek yerine color-mix kullaniliyor:
      // `color-mix(in srgb, ${color} 38%, transparent)` yalnizca hex ile calisirdi, var(--token) ile bozulurdu.
      style={{
        background: 'transparent',
        border: `1px solid ${disabled ? 'var(--line)' : `color-mix(in srgb, ${color} 38%, transparent)`}`,
        color: disabled ? 'var(--line-strong)' : color,
        padding: '8px 12px', borderRadius: "var(--r-sm)", cursor: disabled ? 'default' : 'pointer',
        fontSize: '0.8rem', fontWeight: 600, whiteSpace: 'nowrap', transition: 'all 0.15s'
      }}
    >
      {label}
    </button>
  );
}

const toolbar: React.CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: "var(--r-md)",
  padding: '12px 16px', display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center'
};
const dropdowns: React.CSSProperties = { display: 'flex', gap: 10, flex: 1, flexWrap: 'wrap' };
const buttons: React.CSSProperties = { display: 'flex', gap: 8, flexWrap: 'wrap' };
const kurumEtiketi: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--line)',
  color: 'var(--text)',
  borderRadius: 'var(--r-md)',
  padding: '10px 14px',
  fontSize: '0.85rem',
  fontWeight: 700,
  display: 'flex',
  alignItems: 'center',
  whiteSpace: 'nowrap',
};

const sel: React.CSSProperties = {
  background: 'var(--bg)', border: '1px solid var(--line-strong)', color: 'var(--text)',
  padding: '8px 12px', borderRadius: "var(--r-sm)", fontSize: '0.85rem', outline: 'none', cursor: 'pointer', minWidth: 160
};
