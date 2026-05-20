import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import CustomCursor from "./components/CustomCursor";

const Placeholder = ({ name }) => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", color: "#ffa116", fontFamily: "Inter, sans-serif", fontSize: "1.1rem" }}>
    🚧 {name} — Coming soon
  </div>
);

export default function App() {
  return (
    <BrowserRouter>
      <CustomCursor />
      <Routes>
        <Route path="/"          element={<LandingPage />} />
        <Route path="/dashboard" element={<Placeholder name="Dashboard" />} />
        <Route path="/mastery"   element={<Placeholder name="Mastery" />} />
        <Route path="/topics"    element={<Placeholder name="Topics" />} />
        <Route path="/contests"  element={<Placeholder name="Contests" />} />
        <Route path="*"          element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
