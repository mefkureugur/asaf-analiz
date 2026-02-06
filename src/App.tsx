import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useEffect, useState, useLayoutEffect } from "react";

// STORE & PROVIDERS
import { DataProvider } from "./store/DataContext";
import { useAuth } from "./store/AuthContext"; 

// PAGES
import DashboardPage from "./pages/Dashboard/DashboardPage";
import ComparePage from "./pages/Compare/ComparePage";
import DailyEntryPage from "./pages/DailyEntry/DailyEntryPage";
import TargetsPage from "./pages/Targets/TargetsPage";
import ManagerTargets from "./pages/ManagerTargets"; 
import StudentsPage from "./pages/Students/StudentsPage";
import StudentList from "./pages/Students/StudentList"; 
import FinanceInputPage from "./pages/Finance/FinanceInputPage";
import FinanceViewPage from "./pages/Finance/FinanceViewPage";
// 🚀 YENİ RAPOR SAYFASI EKLENDİ
import DailyEnrollmentReport from "./pages/reports/DailyEnrollmentReport"; 
import LoginPage from "./pages/Login/LoginPage"; 
import UserManagement from "./pages/admin/UserManagement"; 

// COMPONENTS
import TopNav from "./components/TopNav";
import TopNavMobile from "./components/TopNavMobile";

function ScrollToTop() {
  const { pathname } = useLocation();
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function AppContent() {
  const { user, loading } = useAuth();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 900);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 900);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  if (loading) {
    return <div style={loaderStyle}>Kimlik kontrolü yapılıyor...</div>;
  }

  if (!user) {
    return <LoginPage />;
  }

  // 🛡️ Admin ve Uğur Bey yetkisi (Sistemdeki tek yetkili giriş kapısı)
  const isAdmin = user.role?.trim().toLowerCase() === 'admin' || user.email === 'ugur@asaf.com';

  return (
    <DataProvider>
      <ScrollToTop />
      {isMobile ? <TopNavMobile isAdmin={isAdmin} /> : <TopNav isAdmin={isAdmin} />}
      
      <main style={mainContentStyle}>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/compare" element={<ComparePage />} />
          <Route path="/students" element={<StudentsPage />} />
          <Route path="/ogrenci-listesi" element={<StudentList />} /> 
          <Route path="/daily" element={<DailyEntryPage />} />
          
          {/* 🚀 GÜNLÜK KAYIT RAPORU: Hem Admin Hem Müdür Görebilir */}
          <Route path="/reports/daily" element={<DailyEnrollmentReport />} />

          {/* 🎯 HEDEF, YÖNETİM & FİNANS AYRIMI */}
          {isAdmin ? (
            <>
              <Route path="/targets" element={<TargetsPage />} />
              <Route path="/performans" element={<Navigate to="/dashboard" replace />} /> 
              <Route path="/user-management" element={<UserManagement />} />
              {/* 💰 FİNANS: Sadece Admin ve Uğur Bey girebilir */}
              <Route path="/finance" element={<Navigate to="/finance/view" replace />} />
              <Route path="/finance/input" element={<FinanceInputPage />} />
              <Route path="/finance/view" element={<FinanceViewPage />} />
            </>
          ) : (
            <>
              <Route path="/targets" element={<Navigate to="/performans" replace />} /> 
              <Route path="/performans" element={<ManagerTargets />} />
              <Route path="/user-management" element={<Navigate to="/dashboard" replace />} />
              {/* 🚫 FİNANS KİLİDİ: Müdürler girmeye çalışırsa Dashboard'a atılır */}
              <Route path="/finance/*" element={<Navigate to="/dashboard" replace />} />
            </>
          )}

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>
    </DataProvider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

const mainContentStyle: React.CSSProperties = {
  minHeight: "calc(100vh - 70px)",
  paddingBottom: "40px",
};

const loaderStyle: React.CSSProperties = {
  height: '100vh', 
  display: 'flex', 
  alignItems: 'center', 
  justifyContent: 'center', 
  color: 'white', 
  backgroundColor: '#020617'
};