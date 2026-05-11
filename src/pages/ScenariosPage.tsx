import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAuth } from '../store/AuthContext';
import { KURUMLAR } from '../constants/kurumlar';
import type { Scenario, ScenarioDraft, Person } from '../types/scenario';
import {
  listenToScenarios, listenToActiveScenarios,
  saveScenario, activateScenario, deleteScenario
} from '../services/scenarioService';
import ScenarioToolbar from '../components/scenarios/ScenarioToolbar';
import RevenueCard from '../components/scenarios/RevenueCard';
import PeopleCard from '../components/scenarios/PeopleCard';
import OtherSettingsCard from '../components/scenarios/OtherSettingsCard';
import ResultPanel from '../components/scenarios/ResultPanel';
import ScenarioCharts from '../components/scenarios/ScenarioCharts';
import ComparisonTable from '../components/scenarios/ComparisonTable';
import { calculateScenario } from '../utils/scenarioCalculations';

const genId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

const DEFAULT_DRAFT = (kurumId: string): ScenarioDraft => ({
  kurumId,
  name: 'Yeni senaryo',
  note: '',
  isActive: false,
  ogrenciSayisi: 100,
  yillikOgrenciUcreti: 36000,
  digerGider: 0,
  kidemKarsiligiOn: false,
  people: [
    { id: genId('p'), role: 'mudur',      label: 'Müdür',              mode: 'sgk', count: 1, netSalary: 60000, months: 12 },
    { id: genId('p'), role: 'mudur_yard', label: 'Müdür yardımcısı',   mode: 'sgk', count: 1, netSalary: 45000, months: 12 },
    { id: genId('p'), role: 'ogretmen',   label: 'Branş öğretmeni',    mode: 'sgk', count: 5, netSalary: 50000, months: 10 },
    { id: genId('p'), role: 'yardimci',   label: 'Sekreter',           mode: 'sgk', count: 1, netSalary: 30000, months: 12 },
  ],
});

export default function ScenariosPage() {
  const { user } = useAuth();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 900);
  const [selectedKurumId, setSelectedKurumId] = useState<string>(KURUMLAR[0].id);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ScenarioDraft>(() => DEFAULT_DRAFT(KURUMLAR[0].id));
  const [allActiveScenarios, setAllActiveScenarios] = useState<Scenario[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const scenariosRef = useRef<Scenario[]>([]);
  scenariosRef.current = scenarios;

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 900);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  useEffect(() => listenToActiveScenarios(setAllActiveScenarios), []);

  useEffect(() => {
    setScenarios([]);
    setSelectedScenarioId(null);
    setDraft(DEFAULT_DRAFT(selectedKurumId));

    const unsub = listenToScenarios(selectedKurumId, (list) => {
      setScenarios(list);
      setSelectedScenarioId(prev => {
        if (prev === null && list.length > 0) {
          return (list.find(s => s.isActive) || list[0]).id;
        }
        return prev;
      });
    });
    return unsub;
  }, [selectedKurumId]);

  useEffect(() => {
    if (!selectedScenarioId) return;
    const s = scenariosRef.current.find(sc => sc.id === selectedScenarioId);
    if (!s) return;
    setDraft({
      id: s.id,
      kurumId: s.kurumId,
      name: s.name,
      note: s.note ?? '',
      isActive: s.isActive,
      ogrenciSayisi: s.ogrenciSayisi,
      yillikOgrenciUcreti: s.yillikOgrenciUcreti,
      people: s.people || [],
      digerGider: s.digerGider ?? 0,
      kidemKarsiligiOn: s.kidemKarsiligiOn,
    });
  }, [selectedScenarioId]);

  const result = useMemo(() => calculateScenario(draft), [draft]);
  const isNewUnsaved = !draft.id;

  const handleKurumChange = useCallback((id: string) => {
    setSelectedKurumId(id);
  }, []);

  // Yeni senaryo: mevcut değerleri koru, sadece id ve adı sıfırla
  const handleNew = useCallback(() => {
    setSelectedScenarioId(null);
    setDraft(prev => ({
      ...prev,
      id: undefined,
      kurumId: selectedKurumId,
      name: 'Yeni senaryo',
      note: '',
      isActive: false,
    }));
  }, [selectedKurumId]);

  const handleSave = useCallback(async () => {
    if (!draft.name.trim()) { alert('Senaryo adı boş olamaz.'); return; }
    if (!user) return;
    setIsSaving(true);
    try {
      const savedId = await saveScenario(draft, user);
      setDraft(prev => ({ ...prev, id: savedId }));
      setSelectedScenarioId(savedId);
    } catch (e) {
      alert('Kayıt hatası: ' + e);
    } finally {
      setIsSaving(false);
    }
  }, [draft, user]);

  const handleActivate = useCallback(async () => {
    if (!selectedScenarioId || isNewUnsaved) {
      alert('Önce kaydedin, sonra aktif yapın.');
      return;
    }
    try {
      await activateScenario(selectedScenarioId, selectedKurumId);
    } catch (e) {
      alert('Aktivasyon hatası: ' + e);
    }
  }, [selectedScenarioId, selectedKurumId, isNewUnsaved]);

  const handleDelete = useCallback(async () => {
    if (!selectedScenarioId) return;
    if (!window.confirm('Bu senaryoyu silmek istediğinizden emin misiniz?')) return;
    try {
      await deleteScenario(selectedScenarioId);
      setSelectedScenarioId(null);
      setDraft(DEFAULT_DRAFT(selectedKurumId));
    } catch (e) {
      alert('Silme hatası: ' + e);
    }
  }, [selectedScenarioId, selectedKurumId]);

  const updateDraft = useCallback((updates: Partial<ScenarioDraft>) => {
    setDraft(prev => ({ ...prev, ...updates }));
  }, []);

  const handlePeopleChange = useCallback((people: Person[]) => {
    setDraft(prev => ({ ...prev, people }));
  }, []);

  const selectedKurumName = KURUMLAR.find(k => k.id === selectedKurumId)?.name ?? '';

  return (
    <>
      <style>{printCss}</style>
      <div style={{ padding: isMobile ? '12px 12px' : '20px 30px', color: 'white', maxWidth: 1400, margin: '0 auto' }}>

        {/* Sadece baskıda görünen başlık */}
        <div className="print-header">
          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>
            ASAF ANALİZ — Senaryo Raporu
          </div>
          <div style={{ color: '#475569', fontSize: '0.85rem' }}>
            {selectedKurumName} · {draft.name}
          </div>
          <div style={{ color: '#94a3b8', fontSize: '0.75rem', marginTop: 2 }}>
            {new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })}
          </div>
          <hr style={{ margin: '10px 0 0 0', borderColor: '#cbd5e1' }} />
        </div>

        <div className="no-print" style={{ marginBottom: 16, color: '#94a3b8', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em' }}>
          SENARYO HESAP MODÜLÜ
        </div>

        <ScenarioToolbar
          selectedKurumId={selectedKurumId}
          onKurumChange={handleKurumChange}
          scenarios={scenarios}
          selectedScenarioId={selectedScenarioId}
          onScenarioChange={setSelectedScenarioId}
          onNew={handleNew}
          onSave={handleSave}
          onActivate={handleActivate}
          onDelete={handleDelete}
          onPrint={() => window.print()}
          isSaving={isSaving}
          isNewUnsaved={isNewUnsaved}
        />

        <div
          className="scenarios-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '1fr 380px',
            gap: 20,
            marginTop: 20,
            alignItems: 'start',
          }}
        >
          {/* Sol panel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={nameCard}>
              <label style={nameLbl}>Senaryo Adı</label>
              <input
                value={draft.name}
                onChange={e => updateDraft({ name: e.target.value })}
                style={nameInp}
                placeholder="Senaryo adı"
              />
              <label style={{ ...nameLbl, marginTop: 14 }}>Not</label>
              <textarea
                value={draft.note ?? ''}
                onChange={e => updateDraft({ note: e.target.value })}
                rows={3}
                placeholder="Bu senaryo hakkında not ekleyin..."
                style={noteArea}
              />
            </div>

            <RevenueCard
              ogrenciSayisi={draft.ogrenciSayisi}
              yillikOgrenciUcreti={draft.yillikOgrenciUcreti}
              onChange={updateDraft}
            />

            <PeopleCard
              people={draft.people}
              kidemOn={draft.kidemKarsiligiOn}
              onChange={handlePeopleChange}
            />

            <OtherSettingsCard
              digerGider={draft.digerGider}
              kidemKarsiligiOn={draft.kidemKarsiligiOn}
              onChange={updateDraft}
            />
          </div>

          {/* Sağ panel — sticky */}
          <div style={{ position: isMobile ? 'static' : 'sticky', top: 80, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <ResultPanel result={result} kidemOn={draft.kidemKarsiligiOn} />
            <ScenarioCharts result={result} people={draft.people} kidemOn={draft.kidemKarsiligiOn} />
          </div>
        </div>

        <div style={{ marginTop: 30 }}>
          <ComparisonTable activeScenarios={allActiveScenarios} />
        </div>

        <div style={{ marginTop: 16, color: '#334155', fontSize: '0.65rem' }}>
          Görüntüleyen: {user?.displayName} ({user?.email})
        </div>
      </div>
    </>
  );
}

const nameCard: React.CSSProperties = { background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: '20px' };
const nameLbl: React.CSSProperties = { color: '#94a3b8', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.05em', marginBottom: 10, display: 'block' };
const nameInp: React.CSSProperties = {
  background: '#1e293b', border: '1px solid #334155', color: 'white',
  padding: '10px 14px', borderRadius: 8, fontSize: '1rem', outline: 'none', width: '100%', boxSizing: 'border-box'
};
const noteArea: React.CSSProperties = {
  background: '#1e293b', border: '1px solid #334155', color: '#94a3b8',
  padding: '10px 14px', borderRadius: 8, fontSize: '0.85rem', outline: 'none',
  width: '100%', boxSizing: 'border-box', resize: 'vertical', lineHeight: 1.5
};

const printCss = `
  .print-header { display: none; }

  @media print {
    .no-print { display: none !important; }
    nav, header, aside { display: none !important; }

    @page {
      margin: 15mm 10mm;
      size: A4 portrait;
    }

    .print-header {
      display: block !important;
      margin-bottom: 16px;
    }

    /* Tüm koyu arka planları beyaza çevir */
    * {
      background-color: white !important;
      border-color: #e2e8f0 !important;
      box-shadow: none !important;
    }

    /* Tüm metinleri koyu yap */
    body, div, span, p, label, td, th, textarea {
      color: #1e293b !important;
    }

    /* Net kâr renk kodları korunsun */
    .val-green { color: #15803d !important; }
    .val-red   { color: #dc2626 !important; }

    /* Input/select görünümü */
    input, select, textarea {
      border: 1px solid #cbd5e1 !important;
      color: #1e293b !important;
    }
    input[type="range"] { display: none !important; }
    button { display: none !important; }

    /* İki sütunlu grid → tek sütun */
    .scenarios-grid {
      display: block !important;
    }
    .scenarios-grid > * {
      margin-bottom: 14px;
    }

    /* Sticky konum iptal */
    [style*="sticky"], [style*="position: sticky"] {
      position: static !important;
    }

    /* Sayfa kırılma kontrolü */
    .scenarios-grid > * > * {
      break-inside: avoid;
      page-break-inside: avoid;
    }
  }
`;
