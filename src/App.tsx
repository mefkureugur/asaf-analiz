import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import DashboardPage from "./pages/Dashboard/DashboardPage";
import ComparePage from "./pages/Compare/ComparePage";
import ImportLastYearPage from "./pages/ImportLastYear/ImportLastYearPage";
import DailyEntryPage from "./pages/DailyEntry/DailyEntryPage";
import TargetsPage from "./pages/Targets/TargetsPage";
import StudentsPage from "./pages/Students/StudentsPage"; // ✅ YENİ

import TopNav from "./components/TopNav";

export default function App() {
  return (
    <BrowserRouter>
      <TopNav />
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/compare" element={<ComparePage />} />
        <Route path="/import" element={<ImportLastYearPage />} />
        <Route path="/daily" element={<DailyEntryPage />} />
        <Route path="/targets" element={<TargetsPage />} />
        <Route path="/students" element={<StudentsPage />} /> {/* ✅ YENİ */}
      </Routes>
    </BrowserRouter>
  );
}
