import React, { useState } from 'react';
import { useAuth } from '../../store/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useIsMobile } from '../../hooks/useMediaQuery';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { login } = useAuth();
  const navigate = useNavigate();

  const isMobile = useIsMobile();

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
      <div className="rise" style={{
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
              boxShadow: 'var(--shadow-md)'
            }} 
          />
          <h1 style={logoStyle}>
            ASAF <span style={{ color: "var(--text)" }}>ANALİZ</span>
          </h1>
          <p style={subtitleStyle}>Kurumsal Yönetim Paneli</p>
        </div>

        {error && <div role="alert" style={errorBoxStyle}>{error}</div>}

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
            className="press"
            disabled={isSubmitting} 
            style={{...buttonStyle, opacity: isSubmitting ? 0.7 : 1}}
          >
            {isSubmitting ? 'Giriş Yapılıyor...' : 'Sisteme Giriş Yap'}
          </button>
        </form>
        
        <p style={footerStyle}>© {new Date().getFullYear()} Sakarya ASAF Eğitim Kurumları</p>
      </div>
    </div>
  );
}

// STİLLER — tümü tasarım tokenlarından okur
const containerStyle: React.CSSProperties = { minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg)', padding: 'var(--sp-4)' };
const cardStyle: React.CSSProperties = { backgroundColor: 'var(--surface)', borderRadius: 'var(--r-xl)', maxWidth: '400px', textAlign: 'center', border: '1px solid var(--line)', boxShadow: 'var(--shadow-lg), inset 0 1px 0 var(--material-edge)', boxSizing: 'border-box' };
// Marka adı büyük: tracking negatife çekilir, yoksa harfler dağılmış okunur (§15)
const logoStyle: React.CSSProperties = { color: 'var(--accent)', fontSize: '1.75rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em', lineHeight: 1.1 };
const subtitleStyle: React.CSSProperties = { color: 'var(--text-3)', fontSize: 'var(--t-label-size)', letterSpacing: 'var(--t-label-ls)', marginTop: 'var(--sp-2)', textTransform: 'uppercase', fontWeight: 600 };
const formStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' };
const inputGroupStyle: React.CSSProperties = { textAlign: 'left' };
const labelStyle: React.CSSProperties = { display: 'block', color: 'var(--text-2)', fontSize: '0.8rem', marginBottom: 'var(--sp-2)', fontWeight: 600 };
const inputStyle: React.CSSProperties = { padding: 'var(--sp-4)', borderRadius: 'var(--r-md)', fontSize: '1rem' };
const buttonStyle: React.CSSProperties = { width: '100%', padding: 'var(--sp-4)', backgroundColor: 'var(--accent)', color: 'var(--accent-ink)', border: 'none', borderRadius: 'var(--r-md)', fontWeight: 700, fontSize: '1rem', cursor: 'pointer', marginTop: 'var(--sp-2)' };
const errorBoxStyle: React.CSSProperties = { backgroundColor: 'color-mix(in srgb, var(--danger) 12%, transparent)', color: 'var(--danger)', padding: 'var(--sp-3)', borderRadius: 'var(--r-sm)', marginBottom: 'var(--sp-4)', fontSize: '0.875rem', border: '1px solid color-mix(in srgb, var(--danger) 35%, transparent)', textAlign: 'left' };
const footerStyle: React.CSSProperties = { marginTop: 'var(--sp-6)', color: 'var(--text-3)', fontSize: 'var(--t-caption-size)', fontWeight: 500 };
