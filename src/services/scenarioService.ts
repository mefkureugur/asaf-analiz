import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  query, where, onSnapshot, writeBatch, serverTimestamp, getDocs
} from 'firebase/firestore';
import { db } from '../firebase';
import type { Scenario, ScenarioDraft } from '../types/scenario';
import type { UserProfile } from '../store/types';

const COL = 'scenarios';

export function listenToScenarios(
  kurumId: string,
  cb: (scenarios: Scenario[]) => void
): () => void {
  const q = query(collection(db, COL), where('kurumId', '==', kurumId));
  return onSnapshot(q, snap => {
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Scenario));
    list.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
    cb(list);
  });
}

export function listenToActiveScenarios(cb: (scenarios: Scenario[]) => void): () => void {
  const q = query(collection(db, COL), where('isActive', '==', true));
  return onSnapshot(q, snap => {
    cb(snap.docs.map(d => ({ id: d.id, ...d.data() } as Scenario)));
  });
}

// Firestore undefined değer kabul etmez — tüm undefined alanları temizler
function stripUndefined<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}

export async function saveScenario(draft: ScenarioDraft, user: UserProfile): Promise<string> {
  const payload = stripUndefined({
    kurumId: draft.kurumId,
    name: draft.name,
    note: draft.note ?? '',
    ogrenciSayisi: draft.ogrenciSayisi,
    yillikOgrenciUcreti: draft.yillikOgrenciUcreti,
    people: draft.people,
    digerGider: draft.digerGider,
    kidemKarsiligiOn: draft.kidemKarsiligiOn,
  });

  if (draft.id) {
    await updateDoc(doc(db, COL, draft.id), { ...payload, updatedAt: serverTimestamp() });
    return draft.id;
  } else {
    const ref = await addDoc(collection(db, COL), {
      ...payload,
      isActive: false,
      createdBy: user.uid,
      createdByEmail: user.email,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return ref.id;
  }
}

export async function activateScenario(scenarioId: string, kurumId: string): Promise<void> {
  const q = query(
    collection(db, COL),
    where('kurumId', '==', kurumId),
    where('isActive', '==', true)
  );
  const snap = await getDocs(q);
  const batch = writeBatch(db);
  snap.docs.forEach(d => {
    if (d.id !== scenarioId) batch.update(d.ref, { isActive: false });
  });
  batch.update(doc(db, COL, scenarioId), { isActive: true, updatedAt: serverTimestamp() });
  await batch.commit();
}

export async function deleteScenario(scenarioId: string): Promise<void> {
  await deleteDoc(doc(db, COL, scenarioId));
}
