import React, { useState } from 'react';
import { useAuth } from '../../store/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      await login(email, password);
      // Giriş başarılıysa ana sayfaya gönder
      navigate('/dashboard');
    } catch (err: any) {
      console.error("Giriş hatası:", err);
      setError("Giriş başarısız. Lütfen bilgilerinizi kontrol edin.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <div style={{ marginBottom: '30px' }}>
          <h1 style={logoStyle}>ASAF ANALİZ</h1>
          <p style={subtitleStyle}>Kurumsal Yönetim Paneli</p>
        </div>

        {error && <div style={errorBoxStyle}>{error}</div>}

        <form onSubmit={handleSubmit} style={formStyle}>
          <div style={inputGroupStyle}>
            <label style={labelStyle}>E-posta</label>
            <input 
              type="email" 
              placeholder="ahmet@asaf.com" 
              style={inputStyle} 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div style={inputGroupStyle}>
            <label style={labelStyle}>Şifre</label>
            <input 
              type="password" 
              placeholder="••••••••" 
              style={inputStyle} 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button 
            type="submit" 
            disabled={isSubmitting} 
            style={{...buttonStyle, opacity: isSubmitting ? 0.7 : 1}}
          >
            {isSubmitting ? 'Giriş Yapılıyor...' : 'Sisteme Giriş Yap'}
          </button>
        </form>
        
        <p style={footerStyle}>© 2026 Sakarya ASAF Eğitim Kurumları</p>
      </div>
    </div>
  );
}

// STİLLER (ASAF Dark Theme)
const containerStyle: React.CSSProperties = { height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#020617', fontFamily: 'sans-serif' };
const cardStyle: React.CSSProperties = { backgroundColor: '#0f172a', padding: '40px', borderRadius: '16px', width: '100%', maxWidth: '400px', textAlign: 'center', border: '1px solid #1e293b', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)' };
const logoStyle: React.CSSProperties = { color: '#38bdf8', fontSize: '2rem', fontWeight: '800', margin: 0, letterSpacing: '1px' };
const subtitleStyle: React.CSSProperties = { color: '#94a3b8', fontSize: '0.9rem', marginTop: '5px' };
const formStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '20px' };
const inputGroupStyle: React.CSSProperties = { textAlign: 'left' };
const labelStyle: React.CSSProperties = { display: 'block', color: '#cbd5e1', fontSize: '0.85rem', marginBottom: '8px', marginLeft: '4px' };
const inputStyle: React.CSSProperties = { width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #334155', backgroundColor: '#1e293b', color: 'white', fontSize: '1rem', outline: 'none' };
const buttonStyle: React.CSSProperties = { width: '100%', padding: '14px', backgroundColor: '#38bdf8', color: '#020617', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer', transition: 'all 0.2s ease' };
const errorBoxStyle: React.CSSProperties = { backgroundColor: '#450a0a', color: '#fca5a5', padding: '12px', borderRadius: '8px', marginBottom: '20px', fontSize: '0.9rem', border: '1px solid #7f1d1d' };
const footerStyle: React.CSSProperties = { marginTop: '30px', color: '#475569', fontSize: '0.75rem' };