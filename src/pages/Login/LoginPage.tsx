import React, { useState, useEffect } from 'react';
import { useAuth } from '../../store/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { login } = useAuth();
  const navigate = useNavigate();

  // 📱 MOBİL GÖZLEMCİ (Orantı bozulmaması için)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      await login(email, password);
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
      <div style={{
        ...cardStyle,
        width: isMobile ? '90%' : '100%', // Mobilde sağa sola yapışmaz
        padding: isMobile ? '30px 20px' : '40px'
      }}>
        
        {/* 🚀 KURUM LOGOSU BURAYA MÜHÜRLENDİ */}
        <div style={{ marginBottom: '25px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <img 
            src="/logo512.png" 
            alt="ASAF Logo" 
            style={{ 
              height: isMobile ? '70px' : '85px', 
              width: isMobile ? '70px' : '85px', 
              borderRadius: '14px',
              marginBottom: '15px',
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)'
            }} 
          />
          <h1 style={logoStyle}>
            ASAF <span style={{ color: "white" }}>ANALİZ</span>
          </h1>
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

// STİLLER (ASAF Dark Theme - Orijinal yapı bozulmadı)
const containerStyle: React.CSSProperties = { height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#020617', fontFamily: 'sans-serif' };
const cardStyle: React.CSSProperties = { backgroundColor: '#0f172a', borderRadius: '24px', maxWidth: '400px', textAlign: 'center', border: '1px solid #1e293b', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', boxSizing: 'border-box' };
const logoStyle: React.CSSProperties = { color: '#38bdf8', fontSize: '1.8rem', fontWeight: '900', margin: 0, letterSpacing: '1px' };
const subtitleStyle: React.CSSProperties = { color: '#64748b', fontSize: '0.85rem', marginTop: '5px' };
const formStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '15px' };
const inputGroupStyle: React.CSSProperties = { textAlign: 'left' };
const labelStyle: React.CSSProperties = { display: 'block', color: '#94a3b8', fontSize: '0.8rem', marginBottom: '6px', marginLeft: '4px', fontWeight: 600 };
const inputStyle: React.CSSProperties = { width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid #334155', backgroundColor: '#1e293b', color: 'white', fontSize: '1rem', outline: 'none', boxSizing: 'border-box' };
const buttonStyle: React.CSSProperties = { width: '100%', padding: '14px', backgroundColor: '#38bdf8', color: '#020617', border: 'none', borderRadius: '12px', fontWeight: '800', fontSize: '1rem', cursor: 'pointer', transition: 'all 0.2s ease', marginTop: '10px' };
const errorBoxStyle: React.CSSProperties = { backgroundColor: '#450a0a', color: '#fca5a5', padding: '12px', borderRadius: '8px', marginBottom: '20px', fontSize: '0.9rem', border: '1px solid #7f1d1d' };
const footerStyle: React.CSSProperties = { marginTop: '30px', color: '#334155', fontSize: '0.75rem', fontWeight: 600 };