import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { checkHealth, triggerSync, getSyncStatus } from "../api";

/* ── Mastery color — matches the project's Easy/Medium/Hard system ───── */
function masteryColor(score) {
  if (score >= 70) return "#00b8a3"; // Easy green  → strong mastery
  if (score >= 40) return "#ffc01e"; // Medium yellow → average mastery
  return "#ff375f";                  // Hard red     → weak mastery
}

/* ── Mini sub-components ─────────────────────────────────────────────── */
function PatternBar({ name, score, delay }) {
  const [w, setW] = useState(0);
  const color = masteryColor(score);

  useEffect(() => {
    const t = setTimeout(() => setW(score), delay);
    return () => clearTimeout(t);
  }, [score, delay]);

  return (
    <div className="mb-3.5">
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-xs text-lc-text font-medium tracking-wide">{name}</span>
        <span className="text-xs font-bold tabular-nums" style={{ color }}>{score}</span>
      </div>
      <div className="h-2 rounded-full bg-black/40 shadow-inner overflow-hidden border border-white/5">
        <div
          className="h-full rounded-full transition-all duration-1000 ease-out relative"
          style={{ width: `${w}%`, backgroundColor: color }}
        >
          {/* Subtle shine effect on the progress bar */}
          <div className="absolute top-0 inset-x-0 h-1/2 bg-white/20 rounded-full" />
        </div>
      </div>
    </div>
  );
}

const BARS = [
  { name: "Binary Search", score: 84 },
  { name: "Sliding Window", score: 71 },
  { name: "Dynamic Programming", score: 47 },
  { name: "Graph Traversal", score: 12 },
];

function HeroCard() {
  return (
    <div className="relative group hover:-translate-y-2 transition-transform duration-500 ease-out">
      {/* Enhanced outer glow */}
      <div className="absolute -inset-4 rounded-[2rem] bg-gradient-to-b from-lc-orange/20 to-transparent blur-2xl opacity-60 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

      <div className="relative bg-[#1a1a1a]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-6 w-80 shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 pb-5 mb-5 border-b border-white/5">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-lc-orange to-yellow-500 flex items-center justify-center font-bold font-display text-black shadow-lg shrink-0">
            S
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-lc-text text-sm font-bold truncate">saumyashah0510</p>
            <p className="text-lc-muted text-xs flex items-center gap-1 mt-0.5">
              Rating: <span className="text-lc-orange font-bold">1,847</span>
            </p>
          </div>
          <span className="flex items-center gap-1.5 text-[10px] bg-[#00b8a3]/10 text-[#00b8a3] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider shrink-0 border border-[#00b8a3]/20">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00b8a3] animate-pulse" />
            Synced
          </span>
        </div>

        {/* Bars */}
        <p className="text-[10px] uppercase tracking-[0.2em] text-lc-subtle mb-4 font-bold">
          Pattern Mastery
        </p>
        {BARS.map((b, i) => (
          <PatternBar key={b.name} {...b} delay={400 + i * 160} />
        ))}

        {/* Footer stats */}
        <div className="grid grid-cols-3 gap-3 pt-5 mt-2 border-t border-white/5 text-center">
          {[["247", "Solved"], ["68", "Patterns"], ["42%", "Avg Score"]].map(([v, l]) => (
            <div key={l} className="flex flex-col gap-0.5">
              <p className="text-lc-text font-bold font-display text-lg tracking-tight">{v}</p>
              <p className="text-lc-subtle text-[10px] uppercase tracking-wider font-semibold">{l}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Floating pill with glass effect */}
      <div className="absolute -top-4 -right-4 bg-lc-orange/90 backdrop-blur-md border border-white/20 text-black text-[10px] font-extrabold tracking-widest px-3 py-1.5 rounded-full shadow-[0_8px_16px_rgba(255,161,22,0.3)]">
        LIVE PREVIEW
      </div>
    </div>
  );
}

const STEPS = [
  { label: "Validating credentials…" },
  { label: "Starting data sync…" },
  { label: "Syncing your submissions…" },
  { label: "All set! Redirecting…" },
];

/* ── Main Page ────────────────────────────────────────────────────────── */
export default function LandingPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [cookie, setCookie] = useState("");
  const [showCookie, setShowCookie] = useState(false);
  const [remember, setRemember] = useState(true);
  const [step, setStep] = useState(null);
  const [error, setError] = useState("");
  const [syncCount, setSyncCount] = useState(0);
  const pollRef = useRef(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("lm_user") || "{}");
      if (saved.username) setUsername(saved.username);
      if (saved.cookie) setCookie(saved.cookie);
    } catch { }
  }, []);

  const isLoading = step !== null && step < 3;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !cookie.trim()) {
      setError("Both fields are required.");
      return;
    }
    setError("");
    setStep(0);
    const u = username.trim();
    const c = cookie.trim();
    try {
      // Step 0: validate cookie
      await checkHealth(u, c);
      setStep(1);

      // Step 1: kick off sync (returns immediately — sync runs in background)
      await triggerSync(u, c);
      setStep(2);

      // Step 2: poll /sync/status until done (max ~2 min)
      if (remember) localStorage.setItem("lm_user", JSON.stringify({ username: u, cookie: c }));
      localStorage.setItem("lm_username", u);

      const POLL_INTERVAL = 3000;
      const MAX_POLLS = 40; // 40 × 3s = 2 min timeout
      let polls = 0;

      await new Promise((resolve) => {
        pollRef.current = setInterval(async () => {
          polls++;
          try {
            const res = await getSyncStatus(u);
            const { status, submissions_count } = res.data;
            setSyncCount(submissions_count || 0);

            if (status === "success" || polls >= MAX_POLLS) {
              clearInterval(pollRef.current);
              resolve();
            }
            // if status === "failed", also stop
            if (status === "failed") {
              clearInterval(pollRef.current);
              resolve();
            }
          } catch {
            // poll error — just keep trying
          }
        }, POLL_INTERVAL);
      });

      // Step 3: done!
      setStep(3);
      setTimeout(() => navigate("/dashboard"), 800);
    } catch (err) {
      if (pollRef.current) clearInterval(pollRef.current);
      setStep(null);
      setError(err?.response?.data?.detail || "Invalid credentials. Check your cookie and try again.");
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-lc-text selection:bg-lc-orange/30">
      {/* Background ambient mesh */}
      <div className="fixed inset-0 z-0 pointer-events-none bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-lc-orange/5 via-[#0a0a0a] to-[#0a0a0a]" />

      {/* ── Navbar ── */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-white/5 bg-[#0a0a0a]/70 backdrop-blur-2xl transition-all">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-lc-orange/20 to-transparent border border-lc-orange/30 flex items-center justify-center shadow-[0_0_15px_rgba(255,161,22,0.15)]">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* Ascending bars — mastery levels */}
                <rect x="1" y="9" width="3" height="6" rx="0.75" fill="#ffa116" opacity="0.5" />
                <rect x="5.5" y="5.5" width="3" height="9.5" rx="0.75" fill="#ffa116" opacity="0.75" />
                <rect x="10" y="2" width="3" height="13" rx="0.75" fill="#ffa116" />
                {/* Baseline */}
                <line x1="0.5" y1="15.25" x2="13.5" y2="15.25" stroke="#ffa116" strokeWidth="1" strokeLinecap="round" opacity="0.4" />
                {/* Top dot on tallest bar */}
                <circle cx="11.5" cy="1.5" r="1" fill="#ffa116" />
              </svg>
            </div>
            <span className="font-display font-extrabold text-white text-lg tracking-tight">
              Leet<span className="text-lc-orange drop-shadow-[0_0_8px_rgba(255,161,22,0.4)]">Metrics</span>
            </span>
          </div>
          <div className="flex items-center gap-6">
            <a href="#how" className="hidden sm:block text-lc-muted hover:text-white text-sm font-medium transition-colors">
              Pipeline
            </a>
            <a
              href="#connect"
              className="text-xs font-bold bg-lc-orange text-black px-5 py-2.5 rounded-lg hover:bg-[#ffb347] transition-all hover:shadow-[0_0_20px_rgba(255,161,22,0.4)] hover:-translate-y-0.5"
            >
              Get Started
            </a>
          </div>
        </div>
      </nav>

      <main className="relative z-10">
        {/* ── Hero ── */}
        <section className="pt-40 pb-24 px-6 max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left */}
            <div className="flex flex-col gap-8">
              <div className="animate-fade-up">
                <div className="inline-flex items-center gap-2 text-[10px] sm:text-xs font-bold uppercase tracking-widest text-lc-orange border border-lc-orange/20 bg-lc-orange/5 px-4 py-2 rounded-full mb-8 shadow-[0_0_15px_rgba(255,161,22,0.05)]">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-lc-orange opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-lc-orange"></span>
                  </span>
                  DSA Mastery Analytics Engine
                </div>
                <h1 className="font-display text-5xl lg:text-7xl font-extrabold leading-[1.05] tracking-tight text-white">
                  LeetCode tells<br />you{" "}
                  <em className="not-italic bg-gradient-to-r from-lc-orange to-yellow-400 bg-clip-text text-transparent">how many.</em><br />
                  We tell you{" "}
                  <em className="not-italic bg-gradient-to-r from-[#00b8a3] to-emerald-400 bg-clip-text text-transparent">how well.</em>
                </h1>
              </div>

              <p className="text-lc-muted text-lg leading-relaxed max-w-lg animate-fade-up" style={{ animationDelay: '100ms' }}>
                LeetMetrics re-maps your submissions to <span className="text-white font-semibold">68 DSA micro-patterns</span>,
                scores your mastery using mathematical heuristics,
                and generates a targeted study plan based on your exact weaknesses.
              </p>

              <div className="flex flex-wrap gap-4 animate-fade-up" style={{ animationDelay: '200ms' }}>
                <a
                  href="#connect"
                  className="flex items-center gap-2 bg-lc-orange hover:bg-[#ffb347] text-black font-bold px-6 py-3.5 rounded-xl text-sm transition-all hover:-translate-y-1 hover:shadow-[0_10px_40px_rgba(255,161,22,0.4)]"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                  </svg>
                  Connect Account
                </a>
                <a
                  href="#how"
                  className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white font-semibold px-6 py-3.5 rounded-xl text-sm transition-all border border-white/10 hover:border-white/20"
                >
                  See how it works
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </a>
              </div>

              {/* Stat chips */}
              <div className="flex flex-wrap gap-4 pt-4 animate-fade-up" style={{ animationDelay: '300ms' }}>
                {[
                  ["3,900+", "Problems Mapped"],
                  ["68", "DSA Patterns"],
                  ["0–100", "Mastery Score"],
                ].map(([v, l]) => (
                  <div key={l} className="bg-white/[0.02] border border-white/5 rounded-xl px-5 py-3 hover:bg-white/[0.04] transition-colors">
                    <p className="font-display font-extrabold text-white text-xl leading-none mb-1">{v}</p>
                    <p className="text-lc-subtle text-xs font-medium uppercase tracking-wide">{l}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Right — animated mockup */}
            <div className="flex justify-center lg:justify-end animate-fade-up" style={{ animationDelay: '200ms' }}>
              <HeroCard />
            </div>
          </div>
        </section>

        {/* ── Feature Strip ── */}
        <section className="relative border-y border-white/5 bg-black/40 backdrop-blur-sm overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.02] to-transparent pointer-events-none" />
          <div className="max-w-6xl mx-auto px-6 py-16 grid sm:grid-cols-3 gap-8 sm:gap-12 lg:gap-16">
            {[
              {
                icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>,
                title: "Recency Decay",
                desc: "Memory retention is modeled mathematically. Old solves count for less; active revision snaps your score back instantly.",
              },
              {
                icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>,
                title: "Difficulty Weighting",
                desc: "Easy = 0.5×, Medium = 2×, Hard = 5×. Non-linear weights directly reward hard problems with major progression leaps.",
              },
              {
                icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83" /><path d="M22 12A10 10 0 0 0 12 2v10z" /></svg>,
                title: "Transparent Scoring",
                desc: "Every score exposes its volume, difficulty, and recency components directly. You always know exactly why your score moved.",
              },
            ].map((f) => (
              <div key={f.title} className="group relative">
                <div className="w-12 h-12 rounded-2xl bg-lc-orange/10 border border-lc-orange/20 flex items-center justify-center text-lc-orange mb-6 group-hover:scale-110 group-hover:bg-lc-orange/20 transition-all duration-300 shadow-[0_0_15px_rgba(255,161,22,0.1)]">
                  {f.icon}
                </div>
                <h3 className="font-display font-bold text-white text-lg mb-3">{f.title}</h3>
                <p className="text-lc-muted text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Connect Section ── */}
        <section id="connect" className="py-32 px-6 relative">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-lc-orange/5 blur-[120px] rounded-full pointer-events-none" />

          <div className="max-w-md mx-auto relative z-10">
            <div className="text-center mb-10">
              <h2 className="font-display font-extrabold text-3xl text-white mb-4">
                Connect your account
              </h2>
              <p className="text-lc-muted text-sm leading-relaxed">
                Your credentials stay in <span className="text-white font-medium">your browser only</span> —
                never sent to any third-party server.
              </p>
            </div>

            <div className="bg-[#141414] border border-white/10 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
              {/* Subtle top glare */}
              <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

              <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
                {/* Username */}
                <div className="flex flex-col gap-2.5">
                  <label htmlFor="username" className="text-white text-sm font-semibold">
                    LeetCode Username
                  </label>
                  <div className="relative group">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lc-subtle group-focus-within:text-lc-orange transition-colors">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                    </span>
                    <input
                      id="username"
                      type="text"
                      value={username}
                      onChange={e => setUsername(e.target.value)}
                      disabled={isLoading}
                      placeholder="e.g. saumyashah0510"
                      className="w-full pl-12 pr-4 py-3.5 bg-black/50 border border-white/10 rounded-xl text-white text-sm placeholder:text-lc-subtle focus:ring-2 focus:ring-lc-orange/50 focus:border-lc-orange outline-none transition-all disabled:opacity-50 shadow-inner"
                    />
                  </div>
                </div>

                {/* Cookie */}
                <div className="flex flex-col gap-2.5">
                  <label htmlFor="cookie" className="text-white text-sm font-semibold flex items-center justify-between">
                    <span>LeetCode Session Cookie</span>
                    <span className="text-lc-subtle text-[10px] font-medium uppercase tracking-wider bg-white/5 px-2 py-1 rounded">DevTools → Cookies</span>
                  </label>
                  <div className="relative group">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lc-subtle group-focus-within:text-lc-orange transition-colors">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                    </span>
                    <input
                      id="cookie"
                      type={showCookie ? "text" : "password"}
                      value={cookie}
                      onChange={e => setCookie(e.target.value)}
                      disabled={isLoading}
                      placeholder="Paste LEETCODE_SESSION value…"
                      className="w-full pl-12 pr-12 py-3.5 bg-black/50 border border-white/10 rounded-xl text-white text-sm font-mono placeholder:text-lc-subtle focus:ring-2 focus:ring-lc-orange/50 focus:border-lc-orange outline-none transition-all disabled:opacity-50 shadow-inner"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCookie(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-lc-subtle hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/5"
                    >
                      {showCookie
                        ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                        : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                      }
                    </button>
                  </div>
                </div>

                {/* Remember me */}
                <label
                  className="flex items-center gap-3 cursor-pointer select-none group w-fit"
                  onClick={() => setRemember(!remember)}
                >
                  <div className={`w-5 h-5 rounded flex items-center justify-center transition-all duration-200 ${remember ? "bg-lc-orange border-lc-orange shadow-[0_0_10px_rgba(255,161,22,0.3)]" : "border-2 border-white/20 bg-black/50 group-hover:border-white/40"}`}>
                    {remember && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
                  </div>
                  <span className="text-sm font-medium text-lc-muted group-hover:text-white transition-colors">
                    Remember me <span className="text-lc-subtle font-normal ml-1">(saved locally)</span>
                  </span>
                </label>

                {/* Error */}
                {error && (
                  <div className="flex items-start gap-3 px-4 py-3.5 bg-[#ff375f]/10 border border-[#ff375f]/30 rounded-xl text-[#ff375f] text-sm font-medium animate-fade-up">
                    <svg className="shrink-0 mt-0.5" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                    {error}
                  </div>
                )}

                {/* Step progress */}
                {step !== null && (
                  <div className="flex flex-col gap-3 px-5 py-4 bg-black/40 border border-white/10 rounded-xl">
                    {STEPS.map((s, i) => {
                      const isActive  = i === step;
                      const isDone    = i < step;
                      const isPending = i > step;
                      // Live label for the sync-polling step
                      const label = (i === 2 && isActive && syncCount > 0)
                        ? `Syncing… ${syncCount} submission${syncCount !== 1 ? "s" : ""} found`
                        : s.label;
                      return (
                        <div
                          key={s.label}
                          className={`flex items-center gap-3 text-sm font-medium transition-colors duration-300 ${
                            isDone    ? "text-[#00b8a3]" :
                            isActive  ? "text-lc-orange"  :
                            "text-[#3d3d3d]"
                          }`}
                        >
                          <span className="w-5 h-5 flex items-center justify-center shrink-0">
                            {isDone
                              ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                              : isActive
                              ? <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>
                              : <span className="w-1.5 h-1.5 rounded-full bg-current block mx-auto" />
                            }
                          </span>
                          <span>{label}</span>
                          {/* Show live counter badge during polling */}
                          {i === 2 && isActive && syncCount > 0 && (
                            <span className="ml-auto text-[10px] font-bold text-[#ffa116] bg-[#ffa116]/10 border border-[#ffa116]/20 px-2 py-0.5 rounded-full tabular-nums">
                              {syncCount}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Submit */}
                <button
                  id="connect-btn"
                  type="submit"
                  disabled={isLoading}
                  className="relative overflow-hidden flex items-center justify-center gap-2.5 w-full py-4 bg-lc-orange hover:bg-[#ffb347] text-black font-extrabold text-base rounded-xl transition-all hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(255,161,22,0.4)] disabled:opacity-70 disabled:cursor-not-allowed disabled:translate-y-0 disabled:shadow-none group mt-2"
                >
                  {/* Button shine effect */}
                  <div className="absolute top-0 -inset-full h-full w-1/2 z-5 block transform -skew-x-12 bg-gradient-to-r from-transparent to-white opacity-20 group-hover:animate-[shine_1s]" />

                  {isLoading
                    ? <><svg className="animate-spin w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Processing…</>
                    : <><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg> Connect &amp; Sync</>
                  }
                </button>
              </form>
            </div>
          </div>
        </section>

        {/* ── How It Works ── */}
        <section id="how" className="py-24 px-6 border-t border-white/5 bg-[#0a0a0a]">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="font-display font-extrabold text-3xl sm:text-4xl text-white mb-4">Pipeline</h2>
              <p className="text-lc-muted text-lg">How LeetMetrics processes your data</p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 relative">
              {/* Connector line behind cards (desktop) */}
              <div className="hidden lg:block absolute top-1/2 left-0 right-0 h-0.5 bg-gradient-to-r from-white/5 via-white/20 to-white/5 -translate-y-1/2" />

              {[
                { n: "01", title: "Connect", desc: "Paste your session cookie. It strictly lives only in your local browser." },
                { n: "02", title: "Sync", desc: "We fetch your accepted submissions via LeetCode's GraphQL API." },
                { n: "03", title: "Score", desc: "The engine maps submissions to 68 patterns and computes mastery." },
                { n: "04", title: "Improve", desc: "Get a targeted 5-problem weekly plan aimed at your weakest areas." },
              ].map((s, i) => (
                <div
                  key={s.n}
                  className="bg-[#141414] border border-white/10 rounded-2xl p-8 relative hover:-translate-y-2 transition-transform duration-300 shadow-xl group"
                >
                  <span className="font-display font-extrabold text-5xl text-white/5 group-hover:text-lc-orange/20 transition-colors leading-none block mb-6">
                    {s.n}
                  </span>
                  <h3 className="font-display font-bold text-white text-xl mb-2">{s.title}</h3>
                  <p className="text-lc-muted text-sm leading-relaxed">{s.desc}</p>

                  {/* Bottom animated border */}
                  <div className="absolute bottom-0 inset-x-0 h-1 bg-gradient-to-r from-lc-orange to-yellow-500 scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left rounded-b-2xl" />
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-white/10 py-12 px-6 bg-black relative z-10">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5 opacity-80 hover:opacity-100 transition-opacity">
            <div className="w-7 h-7 rounded-lg bg-lc-orange/10 border border-lc-orange/20 flex items-center justify-center">
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="1" y="9" width="3" height="6" rx="0.75" fill="#ffa116" opacity="0.5" />
                <rect x="5.5" y="5.5" width="3" height="9.5" rx="0.75" fill="#ffa116" opacity="0.75" />
                <rect x="10" y="2" width="3" height="13" rx="0.75" fill="#ffa116" />
                <line x1="0.5" y1="15.25" x2="13.5" y2="15.25" stroke="#ffa116" strokeWidth="1" strokeLinecap="round" opacity="0.4" />
                <circle cx="11.5" cy="1.5" r="1" fill="#ffa116" />
              </svg>
            </div>
            <span className="font-display font-bold text-white text-sm tracking-wide">
              Leet<span className="text-lc-orange">Metrics</span>
            </span>
          </div>
          <p className="text-lc-subtle text-xs text-center font-medium">
            Built by <span className="text-white">Saumya Shah</span> <span className="mx-2 opacity-50">|</span> Not affiliated with LeetCode
          </p>
        </div>
      </footer>

      {/* Optional: Add this to your index.css if not already present for the button shine:
      @keyframes shine {
        100% { left: 125%; }
      } 
      */}
    </div>
  );
}