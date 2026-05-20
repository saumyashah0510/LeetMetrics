import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { checkHealth, triggerSync } from "../api";

/* ── Mastery color — matches the project's Easy/Medium/Hard system ───── */
function masteryColor(score) {
  if (score >= 70) return "#00b8a3"; // Easy green  → strong mastery
  if (score >= 40) return "#ffc01e"; // Medium yellow → average mastery
  return "#ff375f";                   // Hard red     → weak mastery
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
    <div className="mb-3">
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs text-lc-text font-medium">{name}</span>
        <span className="text-xs font-bold tabular-nums" style={{ color }}>{score}</span>
      </div>
      <div className="h-1.5 rounded-full bg-lc-surface overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-1000 ease-out"
          style={{ width: `${w}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

const BARS = [
  { name: "Binary Search", score: 84 },  // → green  (strong)
  { name: "Sliding Window", score: 71 },  // → green  (strong)
  { name: "Dynamic Programming", score: 47 },  // → yellow (average)
  { name: "Graph Traversal (BFS)", score: 12 },  // → red    (weak)
];

function HeroCard() {
  return (
    <div className="relative animate-float">
      {/* outer glow */}
      <div className="absolute -inset-6 rounded-3xl bg-lc-orange/10 blur-3xl animate-glow-pulse pointer-events-none" />

      <div className="relative glass rounded-2xl p-5 w-80 shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 pb-4 mb-4 border-b border-lc-border">
          <div className="w-9 h-9 rounded-full bg-lc-orange flex items-center justify-center font-bold font-display text-black text-sm shrink-0">
            S
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-lc-text text-sm font-semibold truncate">saumyashah0510</p>
            <p className="text-lc-muted text-xs">
              Rating: <span className="text-lc-orange font-bold">1,847</span>
            </p>
          </div>
          <span className="text-[10px] bg-lc-easy/15 text-lc-easy px-2 py-0.5 rounded-full font-semibold shrink-0">
            ● Synced
          </span>
        </div>

        {/* Bars */}
        <p className="text-[10px] uppercase tracking-widest text-lc-subtle mb-3 font-semibold">
          Pattern Mastery
        </p>
        {BARS.map((b, i) => (
          <PatternBar key={b.name} {...b} delay={400 + i * 160} />
        ))}

        {/* Footer stats */}
        <div className="grid grid-cols-3 gap-2 pt-4 mt-1 border-t border-lc-border text-center">
          {[["247", "Solved"], ["68", "Patterns"], ["42%", "Avg Score"]].map(([v, l]) => (
            <div key={l}>
              <p className="text-lc-orange font-bold font-display text-sm">{v}</p>
              <p className="text-lc-subtle text-[10px]">{l}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Floating pill */}
      <div className="absolute -top-3 -right-3 bg-lc-orange text-black text-[10px] font-bold px-2.5 py-1 rounded-full shadow-lg">
        LIVE PREVIEW
      </div>
    </div>
  );
}

const STEPS = [
  { label: "Validating credentials…" },
  { label: "Starting data sync…" },
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

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("lm_user") || "{}");
      if (saved.username) setUsername(saved.username);
      if (saved.cookie) setCookie(saved.cookie);
    } catch { }
  }, []);

  const isLoading = step !== null && step < 2;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !cookie.trim()) {
      setError("Both fields are required.");
      return;
    }
    setError("");
    setStep(0);
    try {
      await checkHealth(username.trim(), cookie.trim());
      setStep(1);
      await triggerSync(username.trim(), cookie.trim());
      setStep(2);
      if (remember) localStorage.setItem("lm_user", JSON.stringify({ username: username.trim(), cookie: cookie.trim() }));
      localStorage.setItem("lm_username", username.trim());
      setTimeout(() => navigate("/dashboard"), 900);
    } catch (err) {
      setStep(null);
      setError(err?.response?.data?.detail || "Invalid credentials. Check your cookie and try again.");
    }
  };

  return (
    <div className="min-h-screen page-bg">
      {/* ── Navbar ── */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-lc-border/60 bg-[rgba(26,26,26,0.85)] backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-lc-orange/15 border border-lc-orange/25 flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffa116" strokeWidth="2">
                <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5" />
                <line x1="12" y1="2" x2="12" y2="22" />
                <line x1="2" y1="8.5" x2="22" y2="8.5" />
              </svg>
            </div>
            <span className="font-display font-bold text-lc-text text-[15px] tracking-tight">
              Leet<span className="text-lc-orange">Metrics</span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="#how"
              className="hidden sm:block text-lc-muted hover:text-lc-text text-sm transition-colors"
            >
              How it works
            </a>
            <a
              href="#connect"
              className="text-xs font-semibold bg-lc-orange text-black px-4 py-2 rounded-lg hover:bg-lc-orange2 transition-all hover:shadow-[0_4px_16px_rgba(255,161,22,0.3)]"
            >
              Get Started
            </a>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="pt-32 pb-20 px-6 max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left */}
          <div className="flex flex-col gap-7">
            <div className="animate-fade-up">
              <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-lc-orange border border-lc-orange/25 bg-lc-orange/8 px-3 py-1.5 rounded-full mb-6">
                <span className="w-1.5 h-1.5 rounded-full bg-lc-orange animate-pulse" />
                DSA Mastery Analytics Engine
              </span>
              <h1 className="font-display text-5xl lg:text-6xl font-800 leading-[1.1] tracking-tight text-lc-text">
                LeetCode tells<br />you <em className="not-italic gradient-text">how many.</em><br />
                <span className="text-lc-text">We tell you</span>{" "}
                <em className="not-italic text-lc-text">how well.</em>
              </h1>
            </div>

            <p className="text-lc-muted text-base leading-relaxed max-w-lg animate-fade-up delay-100">
              LeetMetrics re-maps your submissions to <span className="text-lc-text font-medium">68 DSA micro-patterns</span>,
              scores your mastery using mathematical heuristics — volume, difficulty weighting & recency decay —
              and generates a targeted weekly study plan based on your exact weaknesses.
            </p>

            <div className="flex flex-wrap gap-3 animate-fade-up delay-200">
              <a
                href="#connect"
                className="flex items-center gap-2 bg-lc-orange hover:bg-lc-orange2 text-black font-bold px-5 py-3 rounded-xl text-sm transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(255,161,22,0.35)]"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                </svg>
                Connect Account
              </a>
              <a
                href="#how"
                className="flex items-center gap-2 bg-lc-surface hover:bg-lc-border text-lc-text font-semibold px-5 py-3 rounded-xl text-sm transition-all border border-lc-border hover:border-lc-muted/40"
              >
                See how it works
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </a>
            </div>

            {/* Stat chips */}
            <div className="flex flex-wrap gap-3 animate-fade-up delay-300">
              {[
                ["3,900+", "Problems Mapped"],
                ["68", "DSA Patterns"],
                ["0–100", "Mastery Score"],
              ].map(([v, l]) => (
                <div key={l} className="bg-lc-card border border-lc-border rounded-xl px-4 py-2.5">
                  <p className="font-display font-700 text-lc-orange text-lg leading-none">{v}</p>
                  <p className="text-lc-muted text-[11px] mt-0.5">{l}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Right — animated mockup */}
          <div className="flex justify-center lg:justify-end animate-fade-up delay-200">
            <HeroCard />
          </div>
        </div>
      </section>

      {/* ── Feature Strip ── */}
      <section className="border-y border-lc-border bg-lc-card/50">
        <div className="max-w-6xl mx-auto px-6 py-12 grid sm:grid-cols-3 gap-px">
          {[
            {
              icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <circle cx="12" cy="12" r="10" /><path d="M12 8v4l3 3" />
                </svg>
              ),
              title: "Recency Decay",
              desc: "Memory retention modeled as eˉ⁰·⁰⁰¹ˣᵈᵃʸˢ. Old solves count for less. Active revision snaps your score back instantly.",
            },
            {
              icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                </svg>
              ),
              title: "Difficulty Weighting",
              desc: "Easy = 0.5×, Medium = 2×, Hard = 5×. Non-linear weights reward hard problems with major progression leaps.",
            },
            {
              icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M18 20V10M12 20V4M6 20v-6" />
                </svg>
              ),
              title: "Transparent Scoring",
              desc: "Every score exposes its volume, difficulty & recency components directly. You always know exactly why your score moved.",
            },
          ].map((f) => (
            <div key={f.title} className="bg-lc-card px-8 py-8 card-hover group cursor-default">
              <div className="w-10 h-10 rounded-xl bg-lc-orange/10 border border-lc-orange/20 flex items-center justify-center text-lc-orange mb-4 group-hover:bg-lc-orange/20 transition-colors">
                {f.icon}
              </div>
              <h3 className="font-display font-700 text-lc-text text-base mb-2">{f.title}</h3>
              <p className="text-lc-muted text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Connect Section ── */}
      <section id="connect" className="py-24 px-6">
        <div className="max-w-lg mx-auto">
          <div className="text-center mb-10">
            <h2 className="font-display font-700 text-3xl text-lc-text mb-3">
              Connect your account
            </h2>
            <p className="text-lc-muted text-sm leading-relaxed">
              Your credentials stay in <span className="text-lc-text">your browser only</span> —
              never sent to any third-party server.
            </p>
          </div>

          <div className="glass rounded-2xl p-8 shadow-2xl">
            <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
              {/* Username */}
              <div className="flex flex-col gap-2">
                <label htmlFor="username" className="text-lc-text text-sm font-medium">
                  LeetCode Username
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-lc-muted">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  </span>
                  <input
                    id="username"
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    disabled={isLoading}
                    placeholder="e.g. saumyashah0510"
                    className="w-full pl-10 pr-4 py-3 bg-lc-surface border border-lc-border rounded-xl text-lc-text text-sm placeholder:text-lc-subtle input-focus transition-all disabled:opacity-50"
                  />
                </div>
              </div>

              {/* Cookie */}
              <div className="flex flex-col gap-2">
                <label htmlFor="cookie" className="text-lc-text text-sm font-medium flex items-center justify-between">
                  <span>LeetCode Session Cookie</span>
                  <span className="text-lc-subtle text-[11px] font-normal">DevTools → Application → Cookies</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-lc-muted">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="11" width="18" height="11" rx="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  </span>
                  <input
                    id="cookie"
                    type={showCookie ? "text" : "password"}
                    value={cookie}
                    onChange={e => setCookie(e.target.value)}
                    disabled={isLoading}
                    placeholder="Paste LEETCODE_SESSION value…"
                    className="w-full pl-10 pr-11 py-3 bg-lc-surface border border-lc-border rounded-xl text-lc-text text-[13px] font-mono placeholder:text-lc-subtle input-focus transition-all disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCookie(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-lc-muted hover:text-lc-text transition-colors p-1"
                  >
                    {showCookie
                      ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                      : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                    }
                  </button>
                </div>
              </div>

              {/* Remember me */}
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <div
                  onClick={() => setRemember(v => !v)}
                  className={`w-4.5 h-4.5 rounded border-2 flex items-center justify-center transition-all ${remember ? "bg-lc-orange border-lc-orange" : "border-lc-border bg-lc-surface"}`}
                >
                  {remember && <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="black" strokeWidth="2.5"><polyline points="1 6 4.5 9.5 11 2.5" /></svg>}
                </div>
                <span className="text-sm text-lc-muted">
                  Remember me <span className="text-lc-subtle text-xs">(saved to localStorage)</span>
                </span>
              </label>

              {/* Error */}
              {error && (
                <div className="flex items-start gap-2.5 px-4 py-3 bg-lc-hard/10 border border-lc-hard/25 rounded-xl text-lc-hard text-sm">
                  <svg className="shrink-0 mt-0.5" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  {error}
                </div>
              )}

              {/* Step progress */}
              {step !== null && (
                <div className="flex flex-col gap-2.5 px-4 py-3.5 bg-lc-surface border border-lc-border rounded-xl">
                  {STEPS.map((s, i) => (
                    <div key={s.label} className={`flex items-center gap-2.5 text-sm transition-colors ${i < step ? "text-lc-easy" : i === step ? "text-lc-orange" : "text-lc-subtle"}`}>
                      <span className="w-4 h-4 flex items-center justify-center shrink-0">
                        {i < step
                          ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                          : i === step
                            ? <span className="spinner w-3.5 h-3.5 block" />
                            : <span className="w-1.5 h-1.5 rounded-full bg-current block mx-auto" />
                        }
                      </span>
                      {s.label}
                    </div>
                  ))}
                </div>
              )}

              {/* Submit */}
              <button
                id="connect-btn"
                type="submit"
                disabled={isLoading}
                className="flex items-center justify-center gap-2 w-full py-3.5 bg-lc-orange hover:bg-lc-orange2 text-black font-bold text-sm rounded-xl transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(255,161,22,0.35)] disabled:opacity-60 disabled:cursor-not-allowed disabled:translate-y-0 disabled:shadow-none"
              >
                {isLoading
                  ? <><span className="spinner w-4 h-4" />Processing…</>
                  : <><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>Connect &amp; Sync</>
                }
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section id="how" className="pb-24 px-6 border-t border-lc-border">
        <div className="max-w-6xl mx-auto pt-16">
          <div className="text-center mb-12">
            <h2 className="font-display font-700 text-2xl text-lc-text">How it works</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { n: "01", title: "Connect", desc: "Paste your LeetCode session cookie. It lives only in your browser." },
              { n: "02", title: "Sync", desc: "We fetch all accepted submissions via LeetCode's GraphQL API." },
              { n: "03", title: "Score", desc: "The engine maps submissions to 68 patterns and computes mastery." },
              { n: "04", title: "Improve", desc: "Get a targeted 5-problem weekly plan aimed at your weakest areas." },
            ].map((s, i) => (
              <div
                key={s.n}
                className="bg-lc-card border border-lc-border rounded-2xl p-6 card-hover group relative overflow-hidden"
              >
                {/* Connector line */}
                {i < 3 && (
                  <div className="hidden lg:block absolute top-8 -right-px w-px h-6 bg-lc-border" />
                )}
                <span className="font-display font-800 text-4xl text-lc-surface group-hover:text-lc-border transition-colors leading-none block mb-4">
                  {s.n}
                </span>
                <h3 className="font-display font-700 text-lc-text text-base mb-1.5">{s.title}</h3>
                <p className="text-lc-muted text-sm leading-relaxed">{s.desc}</p>
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-lc-orange to-transparent scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-lc-border/60 py-10 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-lc-orange/15 border border-lc-orange/25 flex items-center justify-center">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#ffa116" strokeWidth="2">
                <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5" />
                <line x1="12" y1="2" x2="12" y2="22" />
                <line x1="2" y1="8.5" x2="22" y2="8.5" />
              </svg>
            </div>
            <span className="font-display font-bold text-lc-muted text-sm">
              Leet<span className="text-lc-orange">Metrics</span>
            </span>
          </div>
          <p className="text-lc-subtle text-xs text-center">
            Built by <span className="text-lc-muted font-medium">Saumya Shah</span> · Not affiliated with LeetCode
          </p>
        </div>
      </footer>
    </div>
  );
}
