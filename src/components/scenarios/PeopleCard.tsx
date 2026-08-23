import type { Person } from '../../types/scenario';
import PersonRow from './PersonRow';

interface Props {
  people: Person[];
  kidemOn: boolean;
  onChange: (people: Person[]) => void;
}

const genId = () => `p_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

const DEFAULT_PERSON = (): Person => ({
  id: genId(),
  role: 'ogretmen',
  label: 'Yeni çalışan',
  mode: 'sgk',
  count: 1,
  months: 10,
  netSalary: 40000,
});

export default function PeopleCard({ people, kidemOn, onChange }: Props) {
  const handleUpdate = (id: string, updated: Person) => {
    onChange(people.map(p => p.id === id ? updated : p));
  };

  const handleRemove = (id: string) => {
    onChange(people.filter(p => p.id !== id));
  };

  const handleAdd = () => {
    onChange([...people, DEFAULT_PERSON()]);
  };

  return (
    <div style={card}>
      <div style={header}>
        <span style={title}>ÇALIŞANLAR</span>
        <span style={badge}>{people.reduce((s, p) => s + p.count, 0)} kişi</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {people.map(p => (
          <PersonRow
            key={p.id}
            person={p}
            kidemOn={kidemOn}
            onChange={updated => handleUpdate(p.id, updated)}
            onRemove={() => handleRemove(p.id)}
          />
        ))}
      </div>

      <button onClick={handleAdd} style={addBtn}>+ Çalışan Ekle</button>
    </div>
  );
}

const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: "var(--r-md)", padding: '20px' };
const header: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 };
const title: React.CSSProperties = { color: 'var(--text-2)', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.05em' };
const badge: React.CSSProperties = { background: 'var(--line)', color: 'var(--text-2)', fontSize: '0.65rem', padding: '2px 8px', borderRadius: 4 };
const addBtn: React.CSSProperties = {
  marginTop: 10, background: 'transparent', border: '1px dashed var(--line-strong)', color: 'var(--accent)',
  padding: '10px', borderRadius: "var(--r-sm)", cursor: 'pointer', width: '100%', fontSize: '0.85rem', fontWeight: 600
};
