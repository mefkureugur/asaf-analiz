import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";

import DashboardPage from "./pages/Dashboard/DashboardPage";
import ComparePage from "./pages/Compare/ComparePage";
import ImportLastYearPage from "./pages/ImportLastYear/ImportLastYearPage";
import DailyEntryPage from "./pages/DailyEntry/DailyEntryPage";
import TargetsPage from "./pages/Targets/TargetsPage";
import StudentsPage from "./pages/Students/StudentsPage";

// 🔥 FİNANS SAYFALARI (YENİ)
import FinanceInputPage from "./pages/Finance/FinanceInputPage";
import FinanceViewPage from "./pages/Finance/FinanceViewPage";

import TopNav from "./components/TopNav";
import TopNavMobile from "./components/TopNavMobile";

export default function App() {
  // 🔑 breakpoint’i bilinçli olarak 900 yaptık
  const [isMobile, setIsMobile] = useState(window.innerWidth < 900);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 900);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <BrowserRouter>
      {/* NAV */}
      {isMobile ? <TopNavMobile /> : <TopNav />}

      {/* ROUTES */}
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" />} />

        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/compare" element={<ComparePage />} />
        <Route path="/import" element={<ImportLastYearPage />} />
        <Route path="/daily" element={<DailyEntryPage />} />
        <Route path="/targets" element={<TargetsPage />} />
        <Route path="/students" element={<StudentsPage />} />

        {/* 🔥 FİNANS */}
        <Route path="/finance" element={<Navigate to="/finance/view" />} />
        <Route path="/finance/input" element={<FinanceInputPage />} />
        <Route path="/finance/view" element={<FinanceViewPage />} />
      </Routes>
    </BrowserRouter>
  );
}
