import React from "react";
import { Link, useLocation } from "react-router-dom";

const NAV_LINKS = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/mastery",   label: "Mastery" },
  { to: "/topics",    label: "Topics" },
  { to: "/interview", label: "Interview" },
  { to: "/contests",  label: "Contests" },
];

// Shared ascending-bars logo SVG
function LogoIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1"   y="9"   width="3" height="6"    rx="0.75" fill="#ffa116" opacity="0.5"/>
      <rect x="5.5" y="5.5" width="3" height="9.5"  rx="0.75" fill="#ffa116" opacity="0.75"/>
      <rect x="10"  y="2"   width="3" height="13"   rx="0.75" fill="#ffa116"/>
      <line x1="0.5" y1="15.25" x2="13.5" y2="15.25" stroke="#ffa116" strokeWidth="1" strokeLinecap="round" opacity="0.4"/>
      <circle cx="11.5" cy="1.5" r="1" fill="#ffa116"/>
    </svg>
  );
}

export default function AppLayout({ children }) {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#eff2f6]">
      {/* ── Top Nav ── */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-white/5 bg-[#0a0a0a]/80 backdrop-blur-2xl">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center gap-6">
          {/* Logo → Home */}
          <Link to="/" className="flex items-center gap-2.5 shrink-0 group">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#ffa116]/20 to-transparent border border-[#ffa116]/30 flex items-center justify-center">
              <LogoIcon size={14} />
            </div>
            <span className="font-[Space_Grotesk,sans-serif] font-extrabold text-white text-[15px] tracking-tight">
              Leet<span className="text-[#ffa116]">Metrics</span>
            </span>
          </Link>

          {/* Divider */}
          <div className="w-px h-5 bg-white/10 shrink-0" />

          {/* Nav links */}
          <div className="flex items-center gap-1 overflow-x-auto">
            {NAV_LINKS.map(({ to, label }) => {
              const active = location.pathname === to;
              return (
                <Link
                  key={to}
                  to={to}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                    active
                      ? "bg-[#ffa116]/10 text-[#ffa116]"
                      : "text-[#aba9b0] hover:text-white hover:bg-white/5"
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </div>

          {/* Right side — username & logout */}
          <div className="ml-auto shrink-0 flex items-center gap-4">
            <span className="text-[#6b6b6b] text-xs font-medium">
              {localStorage.getItem("lm_username") || "—"}
            </span>
            <button
              onClick={() => {
                localStorage.removeItem("lm_user");
                localStorage.removeItem("lm_username");
                window.location.href = "/";
              }}
              className="flex items-center gap-1.5 text-[#ff375f]/70 hover:text-[#ff375f] text-xs font-bold uppercase tracking-wider transition-colors px-2.5 py-1.5 rounded-md hover:bg-[#ff375f]/10"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              Logout
            </button>
          </div>
        </div>
      </nav>

      {/* Page content with top offset */}
      <main className="pt-14">
        {children}
      </main>
    </div>
  );
}
