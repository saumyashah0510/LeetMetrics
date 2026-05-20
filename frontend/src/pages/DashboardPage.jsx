import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip } from "recharts";
import AppLayout from "../components/AppLayout";
import { getDashboard, getStudyPlan, getContestSummary, getAllMastery } from "../api";
import { masteryColor, difficultyColor, timeAgo, getUsername } from "../utils";

/* ─── Skeleton ────────────────────────────────────────────────── */
function Skeleton({ className = "" }) {
  return (
    <div className={`rounded-lg bg-white/5 animate-pulse ${className}`} />
  );
}

/* ─── Stat Card ───────────────────────────────────────────────── */
function StatCard({ label, value, sub, icon, loading }) {
  return (
    <div className="bg-[#141414] border border-white/8 rounded-2xl p-5 flex items-start gap-4 hover:border-white/15 transition-colors">
      <div className="w-10 h-10 rounded-xl bg-[#ffa116]/10 border border-[#ffa116]/20 flex items-center justify-center text-[#ffa116] shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[#6b6b6b] text-xs font-medium uppercase tracking-wider mb-1">{label}</p>
        {loading
          ? <Skeleton className="h-7 w-20 mb-1" />
          : <p className="text-white font-extrabold text-2xl font-[Space_Grotesk,sans-serif] leading-none">{value ?? "—"}</p>
        }
        {sub && <p className="text-[#6b6b6b] text-xs mt-1">{sub}</p>}
      </div>
    </div>
  );
}

/* ─── Difficulty Badge ────────────────────────────────────────── */
function DiffBadge({ diff }) {
  const color = difficultyColor(diff);
  return (
    <span
      className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
      style={{ color, background: `${color}18`, border: `1px solid ${color}30` }}
    >
      {diff}
    </span>
  );
}

/* ─── Mastery Bar Row ─────────────────────────────────────────── */
function MasteryBarRow({ label, score, showScore = true }) {
  const color = masteryColor(score);
  return (
    <div className="flex items-center gap-3">
      <span className="text-[#aba9b0] text-xs w-40 truncate shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${score}%`, background: color }}
        />
      </div>
      {showScore && (
        <span className="text-xs font-bold tabular-nums w-8 text-right shrink-0" style={{ color }}>
          {Math.round(score)}
        </span>
      )}
    </div>
  );
}

/* ─── Custom Radar Tooltip ────────────────────────────────────── */
function RadarTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const { subject, score } = payload[0]?.payload || {};
  return (
    <div className="bg-[#1a1a1a] border border-white/10 rounded-xl px-3 py-2 shadow-xl">
      <p className="text-white text-xs font-semibold mb-0.5">{subject}</p>
      <p className="text-[#ffa116] text-sm font-bold">{Math.round(score ?? 0)}</p>
    </div>
  );
}

/* ─── Dashboard Page ──────────────────────────────────────────── */
export default function DashboardPage() {
  const navigate  = useNavigate();
  const username  = getUsername();

  // Redirect if no user
  React.useEffect(() => {
    if (!username) navigate("/", { replace: true });
  }, [username, navigate]);

  const { data: dash,    isLoading: dashLoading  } = useQuery({ queryKey: ["dashboard",  username], queryFn: () => getDashboard(username).then(r => r.data),      enabled: !!username });
  const { data: plan,    isLoading: planLoading  } = useQuery({ queryKey: ["study-plan", username], queryFn: () => getStudyPlan(username).then(r => r.data),      enabled: !!username });
  const { data: contest, isLoading: contestLoad  } = useQuery({ queryKey: ["contest-sum",username], queryFn: () => getContestSummary(username).then(r => r.data), enabled: !!username });
  const { data: mastery, isLoading: masteryLoad  } = useQuery({ queryKey: ["mastery",    username], queryFn: () => getAllMastery(username).then(r => r.data),      enabled: !!username });

  /* ── Category averages for radar ── */
  const radarData = useMemo(() => {
    if (!mastery) return [];
    const byCategory = {};
    mastery.forEach(({ category, score }) => {
      if (!byCategory[category]) byCategory[category] = { total: 0, count: 0 };
      byCategory[category].total += score;
      byCategory[category].count += 1;
    });
    return Object.entries(byCategory)
      .map(([cat, { total, count }]) => ({
        subject: cat.length > 14 ? cat.slice(0, 14) + "…" : cat,
        fullName: cat,
        score: Math.round(total / count),
      }))
      .sort((a, b) => b.score - a.score);
  }, [mastery]);

  /* ── Avg mastery for stat card ── */
  const avgMastery = useMemo(() => {
    if (!mastery?.length) return null;
    const avg = mastery.reduce((s, m) => s + m.score, 0) / mastery.length;
    return Math.round(avg);
  }, [mastery]);

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">

        {/* ── Header ── */}
        <div>
          <h1 className="font-[Space_Grotesk,sans-serif] font-extrabold text-2xl text-white">
            Dashboard
          </h1>
          <p className="text-[#6b6b6b] text-sm mt-1">
            @{username} — Overview of your DSA mastery
          </p>
        </div>

        {/* ── Stat Cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Contest Rating"
            value={contest?.rating ? Math.round(contest.rating) : "—"}
            sub="LeetCode contest ELO"
            loading={contestLoad}
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/></svg>}
          />
          <StatCard
            label="Global Rank"
            value={contest?.global_ranking ? `#${contest.global_ranking.toLocaleString()}` : "—"}
            sub="Worldwide ranking"
            loading={contestLoad}
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>}
          />
          <StatCard
            label="Avg Mastery"
            value={avgMastery != null ? `${avgMastery}/100` : "—"}
            sub="Across all 68 patterns"
            loading={masteryLoad}
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/></svg>}
          />
          <StatCard
            label="Patterns Tracked"
            value="68"
            sub="DSA micro-patterns"
            loading={false}
            icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>}
          />
        </div>

        {/* ── Main Grid ── */}
        <div className="grid lg:grid-cols-5 gap-6">

          {/* ── Left: Weaknesses + Recent Solves ── */}
          <div className="lg:col-span-3 space-y-6">

            {/* Top Weaknesses */}
            <div className="bg-[#141414] border border-white/8 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-white font-semibold text-base">Top Weaknesses</h2>
                  <p className="text-[#6b6b6b] text-xs mt-0.5">Patterns with lowest mastery scores</p>
                </div>
                <div className="w-7 h-7 rounded-lg bg-[#ff375f]/10 border border-[#ff375f]/20 flex items-center justify-center">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ff375f" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                </div>
              </div>

              {dashLoading
                ? <div className="space-y-4">{[0,1,2].map(i => <Skeleton key={i} className="h-10" />)}</div>
                : !dash?.top_weaknesses?.length
                ? <p className="text-[#6b6b6b] text-sm py-6 text-center">No data yet — run a sync first.</p>
                : (
                  <div className="space-y-4">
                    {dash.top_weaknesses.map(({ pattern, score }) => (
                      <div key={pattern} className="space-y-1.5">
                        <div className="flex justify-between items-center">
                          <span className="text-[#eff2f6] text-sm font-medium">{pattern}</span>
                          <span className="text-xs font-bold tabular-nums" style={{ color: masteryColor(score) }}>
                            {Math.round(score)}/100
                          </span>
                        </div>
                        <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${score}%`, background: masteryColor(score) }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )
              }
            </div>

            {/* Recent Solves */}
            <div className="bg-[#141414] border border-white/8 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-white font-semibold text-base">Recent Solves</h2>
                  <p className="text-[#6b6b6b] text-xs mt-0.5">Last 5 accepted submissions</p>
                </div>
                <div className="w-7 h-7 rounded-lg bg-[#00b8a3]/10 border border-[#00b8a3]/20 flex items-center justify-center">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00b8a3" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
              </div>

              {dashLoading
                ? <div className="space-y-3">{[0,1,2,3,4].map(i => <Skeleton key={i} className="h-12" />)}</div>
                : !dash?.recent_solves?.length
                ? <p className="text-[#6b6b6b] text-sm py-6 text-center">No solves found. Run a sync first.</p>
                : (
                  <div className="space-y-1">
                    {dash.recent_solves.map(({ title, date, difficulty }, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/3 transition-colors group"
                      >
                        <div
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ background: difficultyColor(difficulty) }}
                        />
                        <span className="text-[#eff2f6] text-sm flex-1 truncate group-hover:text-white transition-colors">
                          {title}
                        </span>
                        <DiffBadge diff={difficulty} />
                        <span className="text-[#6b6b6b] text-xs shrink-0">{timeAgo(date)}</span>
                      </div>
                    ))}
                  </div>
                )
              }
            </div>
          </div>

          {/* ── Right: Study Plan ── */}
          <div className="lg:col-span-2">
            <div className="bg-[#141414] border border-white/8 rounded-2xl p-6 h-full">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-white font-semibold text-base">Weekly Study Plan</h2>
                  <p className="text-[#6b6b6b] text-xs mt-0.5">Targeted at your weakest patterns</p>
                </div>
                <div className="w-7 h-7 rounded-lg bg-[#ffa116]/10 border border-[#ffa116]/20 flex items-center justify-center">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffa116" strokeWidth="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
                </div>
              </div>

              {planLoading
                ? <div className="space-y-3">{[0,1,2,3,4].map(i => <Skeleton key={i} className="h-16" />)}</div>
                : !plan?.plan?.length
                ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#6b6b6b" strokeWidth="1.5"><path d="M9 12l2 2 4-4M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"/></svg>
                    <p className="text-white text-sm font-medium">All patterns mastered!</p>
                    <p className="text-[#6b6b6b] text-xs">No weak patterns found.</p>
                  </div>
                )
                : (
                  <div className="space-y-3">
                    {plan.plan.map(({ slug, title, difficulty, ac_rate, pattern }, i) => (
                      <a
                        key={slug}
                        href={`https://leetcode.com/problems/${slug}/`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-start gap-3 p-3.5 rounded-xl border border-white/5 hover:border-white/12 hover:bg-white/3 transition-all group"
                      >
                        <span className="text-[#3d3d3d] font-bold font-[Space_Grotesk,sans-serif] text-lg leading-none mt-0.5 shrink-0 group-hover:text-[#ffa116]/40 transition-colors">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[#eff2f6] text-sm font-medium truncate group-hover:text-white transition-colors">
                            {title}
                          </p>
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <DiffBadge diff={difficulty} />
                            <span className="text-[#6b6b6b] text-[10px]">{pattern}</span>
                            {ac_rate && (
                              <span className="text-[#6b6b6b] text-[10px] ml-auto">
                                {(ac_rate * 100).toFixed(1)}% AC
                              </span>
                            )}
                          </div>
                        </div>
                        <svg className="shrink-0 text-[#3d3d3d] group-hover:text-[#ffa116] transition-colors mt-1" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                        </svg>
                      </a>
                    ))}
                  </div>
                )
              }
            </div>
          </div>
        </div>

        {/* ── Category Mastery Radar + Bars ── */}
        <div className="grid lg:grid-cols-2 gap-6">

          {/* Radar Chart */}
          <div className="bg-[#141414] border border-white/8 rounded-2xl p-6">
            <h2 className="text-white font-semibold text-base mb-1">Mastery Radar</h2>
            <p className="text-[#6b6b6b] text-xs mb-6">Average score per major category</p>

            {masteryLoad
              ? <Skeleton className="h-64" />
              : !radarData.length
              ? <p className="text-[#6b6b6b] text-sm text-center py-20">No mastery data yet.</p>
              : (
                <ResponsiveContainer width="100%" height={260}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="#ffffff0d" />
                    <PolarAngleAxis
                      dataKey="subject"
                      tick={{ fill: "#6b6b6b", fontSize: 11, fontFamily: "Inter, sans-serif" }}
                    />
                    <Radar
                      dataKey="score"
                      stroke="#ffa116"
                      fill="#ffa116"
                      fillOpacity={0.12}
                      strokeWidth={1.5}
                    />
                    <Tooltip content={<RadarTooltip />} />
                  </RadarChart>
                </ResponsiveContainer>
              )
            }
          </div>

          {/* Category Bar Breakdown */}
          <div className="bg-[#141414] border border-white/8 rounded-2xl p-6">
            <h2 className="text-white font-semibold text-base mb-1">Category Breakdown</h2>
            <p className="text-[#6b6b6b] text-xs mb-6">Sorted by average mastery score</p>

            {masteryLoad
              ? <div className="space-y-4">{[...Array(6)].map((_,i) => <Skeleton key={i} className="h-6" />)}</div>
              : !radarData.length
              ? <p className="text-[#6b6b6b] text-sm text-center py-20">No mastery data yet.</p>
              : (
                <div className="space-y-3.5 overflow-y-auto max-h-[260px] pr-1">
                  {[...radarData].sort((a, b) => a.score - b.score).map(({ fullName, score }) => (
                    <MasteryBarRow key={fullName} label={fullName} score={score} />
                  ))}
                </div>
              )
            }
          </div>
        </div>

      </div>
    </AppLayout>
  );
}
