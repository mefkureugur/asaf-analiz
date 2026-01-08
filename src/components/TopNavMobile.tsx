import { useState } from "react";
import { NavLink } from "react-router-dom";

export default function TopNavMobile() {
  const [open, setOpen] = useState(false);

  return (
    <div className="mobileNavWrapper">
      {/* ÜST BAR */}
      <div className="mobileTopBar">
        <div className="mobileLogo">Mefkure Kayıt Sayfası</div>

        <button
          className="hamburgerBtn"
          aria-label="Menü"
          onClick={() => setOpen((v) => !v)}
        >
          ☰ <span className="hamburgerLabel">Menü</span>
        </button>
      </div>

      {/* AÇILIR MENÜ */}
      {open && (
        <nav className="mobileMenu">
          <NavLink to="/dashboard" onClick={() => setOpen(false)}>
            🏠 Anasayfa
          </NavLink>

          <NavLink to="/import" onClick={() => setOpen(false)}>
            📥 Import
          </NavLink>

          <NavLink to="/daily" onClick={() => setOpen(false)}>
            ✍️ Günlük Kayıt Girişi
          </NavLink>

          <NavLink to="/compare" onClick={() => setOpen(false)}>
            ⚖️ Karşılaştırma
          </NavLink>

          <NavLink to="/targets" onClick={() => setOpen(false)}>
            🎯 Hedefler
          </NavLink>

          {/* ✅ YENİ EKLENEN */}
          <NavLink to="/students" onClick={() => setOpen(false)}>
            🎓 Yeni Kayıt / Kayıt Yenileme
          </NavLink>
        </nav>
      )}
    </div>
  );
}
