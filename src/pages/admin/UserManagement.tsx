import React, { useState, useEffect } from 'react';
import { db, auth } from '../../firebase'; 
import { collection, doc, updateDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { createUserWithEmailAndPassword, getAuth, signOut, sendPasswordResetEmail } from 'firebase/auth'; // 🔑 Yeni import
import { initializeApp, getApps } from 'firebase/app';
import { Key } from 'lucide-react'; // Simge için lucide-react kullanıyoruz (zaten projenizde var)

export default function UserManagement() {
  const [users, setUsers] = useState<any[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [newPass, setNewPass] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const branches = ["Altınküre İlköğretim", "Altınküre Lise", "Altınküre Teknokent", "Mefkure LGS", "Mefkure YKS", "Mefkure PLUS"];

  const getSecondaryAuth = () => {
    const appName = "SecondaryAdminApp";
    let secondaryApp = getApps().find(app => app.name === appName);
    if (!secondaryApp) {
      secondaryApp = initializeApp(auth.app.options, appName);
    }
    return getAuth(secondaryApp);
  };

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "users"), (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsers(list);
    });
    return () => unsub();
  }, []);

  // 🔑 ŞİFRE SIFIRLAMA MOTORU
  const handleResetPassword = async (email: string) => {
    if (!window.confirm(`${email} adresine şifre sıfırlama bağlantısı gönderilsin mi?`)) return;
    try {
      await sendPasswordResetEmail(auth, email);
      alert("Şifre sıfırlama e-postası başarıyla gönderildi!");
    } catch (err: any) {
      alert("Hata: " + err.message);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    const sAuth = getSecondaryAuth();
    try {
      const res = await createUserWithEmailAndPassword(sAuth, newEmail, newPass);
      await setDoc(doc(db, "users", res.user.uid), {
        email: newEmail,
        role: 'manager', 
        branchId: '',
        displayName: newEmail.split('@')[0]
      });
      await signOut(sAuth);
      alert("Müdür başarıyla oluşturuldu!");
      setNewEmail(''); setNewPass('');
    } catch (err: any) {
      alert("Hata: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const updatePermission = async (userId: string, role: string, branchId: string) => {
    try {
      await updateDoc(doc(db, "users", userId), { role, branchId });
      alert("Yetki güncellendi!");
    } catch (err) {
      alert("Hata oluştu!");
    }
  };

  return (
    <div className="page rise" style={{ maxWidth: 1000 }}>
      <h2 style={{ color: 'var(--accent)', borderBottom: '2px solid var(--line)', paddingBottom: '10px' }}>
          🛡️ ASAF ANALİZ | Yönetim Paneli
      </h2>

      <div style={formCardStyle}>
        <h4 style={{ marginTop: 0, color: 'var(--text-2)' }}>Yeni Müdür Tanımla</h4>
        <form onSubmit={handleAddUser} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <input type="email" placeholder="E-posta" value={newEmail} onChange={e => setNewEmail(e.target.value)} style={inputStyle} required />
          <input type="password" placeholder="Şifre" value={newPass} onChange={e => setNewPass(e.target.value)} style={inputStyle} required />
          <button type="submit" disabled={isProcessing} style={addBtnStyle}>
            {isProcessing ? 'İşleniyor...' : 'Sisteme Kaydet'}
          </button>
        </form>
      </div>

      <div style={tableWrapperStyle}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', backgroundColor: 'var(--line)', color: 'var(--text-2)' }}>
              <th style={paddingStyle}>E-posta</th>
              <th style={paddingStyle}>Rol</th>
              <th style={paddingStyle}>Yetkili Şube</th>
              <th style={paddingStyle}>İşlem</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} style={{ borderBottom: '1px solid var(--line)' }}>
                <td style={paddingStyle}>{u.email}</td>
                <td style={paddingStyle}>
                  <select defaultValue={u.role} id={`role-${u.id}`} style={selectStyle}>
                    <option value="admin">Admin (Kurucu)</option>
                    <option value="manager">Manager (Müdür)</option>
                    <option value="unauthorized">Yetkisiz</option>
                  </select>
                </td>
                <td style={paddingStyle}>
                  <select defaultValue={u.branchId} id={`branch-${u.id}`} style={selectStyle}>
                    <option value="">Şube Seçin...</option>
                    <option value="all">Tüm Şubeler</option>
                    {branches.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </td>
                <td style={paddingStyle}>
                  {/* 🛠️ Butonları yan yana dizmek için flex ekledim */}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button 
                      onClick={() => {
                        const r = (document.getElementById(`role-${u.id}`) as HTMLSelectElement).value;
                        const b = (document.getElementById(`branch-${u.id}`) as HTMLSelectElement).value;
                        updatePermission(u.id, r, b);
                      }}
                      style={saveBtnStyle}
                      title="Yetkileri Kaydet"
                    >💾</button>

                    <button 
                      onClick={() => handleResetPassword(u.email)} 
                      style={{ ...saveBtnStyle, backgroundColor: '#6366f1' }}
                      title="Şifre Sıfırlama Maili Gönder"
                    >🔑</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const formCardStyle = { backgroundColor: 'var(--surface)', padding: '25px', borderRadius: '12px', border: '1px solid var(--line)', marginBottom: '30px' };
const inputStyle = { backgroundColor: 'var(--line)', border: '1px solid var(--line-strong)', color: 'var(--text)', padding: '12px', borderRadius: '8px', flex: 1 };
// Renkli zemin uzerinde metin: iki temada da beyaz kalmali
const addBtnStyle = { backgroundColor: 'var(--success)', color: '#ffffff', border: 'none', padding: '12px 25px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' as const };
const tableWrapperStyle = { backgroundColor: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--line)', overflow: 'hidden' };
const selectStyle = { backgroundColor: 'var(--line)', color: 'var(--text)', border: '1px solid var(--line-strong)', padding: '10px', borderRadius: '8px', width: '100%' };
const saveBtnStyle = { backgroundColor: 'var(--accent)', color: 'var(--bg)', border: 'none', padding: '10px 12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' as const };
const paddingStyle = { padding: '15px' };