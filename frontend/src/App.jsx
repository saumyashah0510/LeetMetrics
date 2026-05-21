import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import DashboardPage from "./pages/DashboardPage";
import TopicsPage from "./pages/TopicsPage";
import CategoryPage from "./pages/CategoryPage";
import ContestsPage from "./pages/ContestsPage";
import CustomCursor from "./components/CustomCursor";
import AppLayout from "./components/AppLayout";

// Placeholder — will be replaced page by page
const Placeholder = ({ name }) => (
  <AppLayout>
    <div className="flex flex-col items-center justify-center min-h-[80vh] gap-4">
      <div className="w-12 h-12 rounded-2xl bg-[#ffa116]/10 border border-[#ffa116]/20 flex items-center justify-center">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffa116" strokeWidth="1.8">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <line x1="3" y1="9" x2="21" y2="9"/>
          <line x1="9" y1="21" x2="9" y2="9"/>
        </svg>
      </div>
      <p className="text-[#aba9b0] text-sm font-medium">
        <span className="text-white font-semibold">{name}</span> page — coming soon
      </p>
    </div>
  </AppLayout>
);

export default function App() {
  return (
    <BrowserRouter>
      <CustomCursor />
      <Routes>
        <Route path="/"          element={<LandingPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/mastery"   element={<Placeholder name="Mastery" />} />
        <Route path="/topics"    element={<TopicsPage />} />
        <Route path="/topics/:categoryId" element={<CategoryPage />} />
        <Route path="/contests"  element={<ContestsPage />} />
        <Route path="*"          element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
