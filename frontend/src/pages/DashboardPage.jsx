import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, Link } from "react-router-dom";
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip } from "recharts";
import AppLayout from "../components/AppLayout";
import { getDashboard, getContestSummary, getAllMastery } from "../api";
import { masteryColor, difficultyColor, timeAgo, getUsername } from "../utils";

/* ─── Skeleton ────────────────────────────────────────────────── */
function Skeleton({ className = "" }) {
  return (
    <div className={`rounded bg-white/5 animate-pulse ${className}`} />
  );
}

/* ─── Solved Progress Ring ────────────────────────────────────── */
function SolvedRing({ stats, loading }) {
  if (loading || !stats) {
    return <div className="bg-[#282828] rounded-lg p-5 flex flex-col justify-center shadow-sm h-[224px]"><Skeleton className="h-full w-full" /></div>;
  }

  const { solved, total } = stats;
  const easy = solved?.Easy || 0;
  const med = solved?.Medium || 0;
  const hard = solved?.Hard || 0;
  const totalSolved = easy + med + hard;

  const tEasy = total?.Easy || 944;
  const tMed = total?.Medium || 2057;
  const tHard = total?.Hard || 934;
  const grandTotal = tEasy + tMed + tHard;

  // SVG Ring Math
  const radius = 58;
  const strokeWidth = 5;
  const circumference = 2 * Math.PI * radius; // ~364.4

  // The ring spans 260 degrees (leaving a 100 degree gap at the bottom)
  const ringAngle = 260;
  const ringLength = circumference * (ringAngle / 360);

  // We have 3 segments. We want 2 gaps between them.
  const trackGap = 16; // Increased gap to account for rounded stroke caps
  const availableLength = ringLength - (2 * trackGap);

  // Base track lengths (proportional to total problems in that difficulty)
  const lEasy = Math.max(0, availableLength * (tEasy / grandTotal));
  const lMed = Math.max(0, availableLength * (tMed / grandTotal));
  const lHard = Math.max(0, availableLength * (tHard / grandTotal));

  // Solved lengths
  const sEasy = Math.max(0, lEasy * (easy / tEasy));
  const sMed = Math.max(0, lMed * (med / tMed));
  const sHard = Math.max(0, lHard * (hard / tHard));

  // Positions (offsets)
  const pEasy = 0;
  const pMed = pEasy + lEasy + trackGap;
  const pHard = pMed + lMed + trackGap;

  const renderTrack = (color, length, offset, isBg) => {
    if (length <= 0) return null;
    return (
      <circle
        cx="70" cy="70" r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={`${length} ${circumference}`}
        strokeDashoffset={-offset}
        strokeLinecap="round"
        className={isBg ? "" : "transition-all duration-1000 ease-out"}
      />
    );
  };

  return (
    <div className="bg-[#282828] rounded-lg shadow-sm flex items-center justify-between p-6 h-[224px]">

      {/* Left: Circular Ring */}
      <div className="relative flex items-center justify-center flex-1">
        {/* rotate(140) starts the 260-degree arc from bottom-left */}
        <svg width="140" height="140" viewBox="0 0 140 140" className="rotate-[140deg] origin-center">

          {/* Unsolved (Background) Tracks */}
          {renderTrack("#2b3d3a", lEasy, pEasy, true)}
          {renderTrack("#4a3e20", lMed, pMed, true)}
          {renderTrack("#462b31", lHard, pHard, true)}

          {/* Solved (Foreground) Tracks */}
          {easy > 0 && renderTrack("#00b8a3", sEasy, pEasy, false)}
          {med > 0 && renderTrack("#ffc01e", sMed, pMed, false)}
          {hard > 0 && renderTrack("#ff375f", sHard, pHard, false)}

        </svg>

        {/* Center Text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-[-10px]">
          <div className="flex items-baseline gap-0.5">
            <span className="text-white text-[28px] font-semibold tracking-tight leading-none">{totalSolved}</span>
            <span className="text-[#aba9b0] text-[12px] font-medium">/{grandTotal}</span>
          </div>
          <div className="flex items-center gap-1 mt-1 text-white">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#00b8a3" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span className="text-[13px] font-medium">Solved</span>
          </div>
        </div>
      </div>

      {/* Right: Legend Chips */}
      <div className="flex flex-col gap-2.5 w-[110px] shrink-0">
        <div className="bg-[#333333] rounded-md px-3 py-1.5 flex flex-col items-center justify-center">
          <span className="text-[#00b8a3] text-[12px] font-medium mb-0.5">Easy</span>
          <span className="text-white text-[13px] font-semibold">{easy}<span className="text-[#aba9b0] text-[11px] font-normal">/{tEasy}</span></span>
        </div>
        <div className="bg-[#333333] rounded-md px-3 py-1.5 flex flex-col items-center justify-center">
          <span className="text-[#ffc01e] text-[12px] font-medium mb-0.5">Med.</span>
          <span className="text-white text-[13px] font-semibold">{med}<span className="text-[#aba9b0] text-[11px] font-normal">/{tMed}</span></span>
        </div>
        <div className="bg-[#333333] rounded-md px-3 py-1.5 flex flex-col items-center justify-center">
          <span className="text-[#ff375f] text-[12px] font-medium mb-0.5">Hard</span>
          <span className="text-white text-[13px] font-semibold">{hard}<span className="text-[#aba9b0] text-[11px] font-normal">/{tHard}</span></span>
        </div>
      </div>

    </div>
  );
}

/* ─── LeetCode Style Stat Card ────────────────────────────────── */
function StatCard({ label, value, sub, loading }) {
  return (
    <div className="bg-[#282828] rounded-lg p-5 flex flex-col justify-center shadow-sm h-[104px]">
      <p className="text-[#aba9b0] text-xs font-medium mb-1.5">{label}</p>
      {loading
        ? <Skeleton className="h-6 w-16 mb-1" />
        : <p className="text-white font-semibold text-2xl leading-none mb-1.5 tracking-tight">{value ?? "—"}</p>
      }
      {sub && <p className="text-[#8c8c8c] text-[11px]">{sub}</p>}
    </div>
  );
}

/* ─── Difficulty Badge ────────────────────────────────────────── */
function DiffBadge({ diff }) {
  const color = difficultyColor(diff);
  return (
    <span className="text-[12px] font-medium" style={{ color }}>
      {diff}
    </span>
  );
}

/* ─── Mastery Bar Row ─────────────────────────────────────────── */
function MasteryBarRow({ label, score, showScore = true }) {
  const color = masteryColor(score);
  return (
    <div className="flex flex-col gap-1.5 py-1.5">
      <div className="flex justify-between items-center">
        <span className="text-[#eff2f6] text-[13px] font-medium truncate pr-4">{label}</span>
        {showScore && (
          <span className="text-[13px] font-semibold tabular-nums" style={{ color }}>
            {Math.round(score)}
          </span>
        )}
      </div>
      <div className="h-1.5 bg-[#3e3e3e] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-1000 ease-out"
          style={{ width: `${score}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

/* ─── Custom Radar Tooltip ────────────────────────────────────── */
function RadarTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const { subject, score } = payload[0]?.payload || {};
  return (
    <div className="bg-[#282828] border border-[#3d3d3d] rounded shadow-lg px-3 py-2">
      <p className="text-[#aba9b0] text-[11px] font-medium mb-1 uppercase tracking-wider">{subject}</p>
      <p className="text-[#ffa116] text-sm font-bold tabular-nums">{Math.round(score ?? 0)}</p>
    </div>
  );
}

/* ─── Dashboard Page ──────────────────────────────────────────── */
export default function DashboardPage() {
  const navigate = useNavigate();
  const username = getUsername();

  React.useEffect(() => {
    if (!username) navigate("/", { replace: true });
  }, [username, navigate]);



  const { data: dash, isLoading: dashLoading } = useQuery({ queryKey: ["dashboard", username], queryFn: () => getDashboard(username).then(r => r.data), enabled: !!username });
  const { data: contest, isLoading: contestLoad } = useQuery({ queryKey: ["contest-sum", username], queryFn: () => getContestSummary(username).then(r => r.data), enabled: !!username });
  const { data: mastery, isLoading: masteryLoad } = useQuery({ queryKey: ["mastery", username], queryFn: () => getAllMastery(username).then(r => r.data), enabled: !!username });

  /* ── Category averages for radar (WEIGHTED) ── */
  const radarData = useMemo(() => {
    if (!mastery) return [];
    const byCategory = {};
    mastery.forEach(({ category, score, weight }) => {
      if (!byCategory[category]) byCategory[category] = { totalWeightedScore: 0, totalWeight: 0 };
      byCategory[category].totalWeightedScore += (score * weight);
      byCategory[category].totalWeight += weight;
    });
    return Object.entries(byCategory)
      .map(([cat, { totalWeightedScore, totalWeight }]) => ({
        subject: cat.length > 14 ? cat.slice(0, 14) + "…" : cat,
        fullName: cat,
        score: totalWeight > 0 ? Math.round(totalWeightedScore / totalWeight) : 0,
      }))
      .sort((a, b) => b.score - a.score);
  }, [mastery]);

  /* ── Mastered Topics Count ── */
  const masteredCount = useMemo(() => {
    if (!mastery?.length) return null;
    return mastery.filter(m => m.score >= 60).length;
  }, [mastery]);

  /* ── Overall Weighted Avg Mastery ── */
  const avgMastery = useMemo(() => {
    if (!mastery?.length) return null;
    let totalScore = 0;
    let totalWeight = 0;
    mastery.forEach(({ score, weight }) => {
      totalScore += (score * weight);
      totalWeight += weight;
    });
    return totalWeight > 0 ? Math.round(totalScore / totalWeight) : 0;
  }, [mastery]);

  return (
    <AppLayout>
      {/* Exact LeetCode Background */}
      <div className="bg-[#1a1a1a] min-h-[calc(100vh-56px)] selection:bg-[#ffa116]/30">
        <div className="max-w-[1440px] w-full mx-auto px-6 py-8 flex flex-col gap-6">

          {/* ── Top Header Row ── */}
          <div className="flex items-center justify-between pb-2 border-b border-[#3d3d3d]/50">
            <div>
              <h1 className="text-white font-semibold text-xl tracking-tight">Overview</h1>
              <p className="text-[#8c8c8c] text-sm mt-1 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00b8a3] animate-pulse" />
                Live sync for <span className="text-[#eff2f6] font-medium">@{username}</span>
              </p>
            </div>

          </div>

          {/* ── Main Grid Layout (Left 70%, Right 30%) ── */}
          <div className="grid lg:grid-cols-12 gap-6 items-start">

            {/* ── LEFT COLUMN (8 cols) ── */}
            <div className="lg:col-span-8 flex flex-col gap-6">

              {/* Top Row: Solved Ring + Stat Cards */}
              <div className="grid md:grid-cols-2 gap-6">

                {/* Solved Ring */}
                <SolvedRing stats={dash?.solved_stats} loading={dashLoading} />

                {/* Stat Cards 2x2 Grid */}
                <div className="grid grid-cols-2 gap-4 h-[224px]">
                  <StatCard
                    label="Contest Rating"
                    value={contest?.rating ? Math.round(contest.rating) : "—"}
                    sub="Global Rating"
                    loading={contestLoad}
                  />
                  <StatCard
                    label="Global Rank"
                    value={contest?.global_ranking ? `#${contest.global_ranking.toLocaleString()}` : "—"}
                    sub="Worldwide Standing"
                    loading={contestLoad}
                  />
                  <StatCard
                    label="Mastered Topics"
                    value={masteredCount != null ? `${masteredCount} / ${mastery?.length || 88}` : "—"}
                    sub="Score ≥ 60"
                    loading={masteryLoad}
                  />
                  <StatCard
                    label="Avg Mastery"
                    value={avgMastery != null ? `${avgMastery}%` : "—"}
                    sub="Weighted average"
                    loading={masteryLoad}
                  />
                </div>
              </div>

              {/* Middle Section: Radar & Categories Side-by-Side */}
              {/* Note: h-[420px] perfectly matches the combined height of the right column elements */}
              <div className="grid sm:grid-cols-2 gap-6 h-auto sm:h-[420px]">

                {/* Mastery Radar */}
                <div className="bg-[#282828] rounded-lg p-5 shadow-sm flex flex-col min-h-0">
                  <h2 className="text-[#eff2f6] font-semibold text-[15px] mb-1">Mastery Radar</h2>
                  <p className="text-[#8c8c8c] text-[12px] mb-2">Weighted average per major category</p>
                  <div className="flex-1 w-full relative min-h-0">
                    {masteryLoad
                      ? <Skeleton className="absolute inset-0 m-4 rounded-full" />
                      : !radarData.length
                        ? <div className="absolute inset-0 flex items-center justify-center"><p className="text-[#6b6b6b] text-sm">No data yet.</p></div>
                        : (
                          <ResponsiveContainer width="100%" height="100%">
                            <RadarChart data={radarData} margin={{ top: 15, right: 30, bottom: 15, left: 30 }}>
                              <PolarGrid stroke="#4a4a4a" />
                              <PolarAngleAxis
                                dataKey="subject"
                                tick={{ fill: "#aba9b0", fontSize: 11, fontWeight: 500 }}
                              />
                              <Radar
                                dataKey="score"
                                stroke="#ffa116"
                                fill="#ffa116"
                                fillOpacity={0.15}
                                strokeWidth={2}
                                activeDot={{ r: 4, fill: '#ffa116', stroke: '#fff', strokeWidth: 1 }}
                              />
                              <Tooltip content={<RadarTooltip />} cursor={{ stroke: '#4a4a4a' }} />
                            </RadarChart>
                          </ResponsiveContainer>
                        )
                    }
                  </div>
                </div>

                {/* Category Breakdown */}
                <div className="bg-[#282828] rounded-lg p-5 shadow-sm flex flex-col min-h-0">
                  <h2 className="text-[#eff2f6] font-semibold text-[15px] mb-1">Category Breakdown</h2>
                  <p className="text-[#8c8c8c] text-[12px] mb-4">Ranked by proficiency</p>
                  <div className="flex-1 overflow-y-auto pr-3 space-y-3 min-h-0 custom-scrollbar">
                    {masteryLoad
                      ? <div className="space-y-4">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-8" />)}</div>
                      : !radarData.length
                        ? <p className="text-[#6b6b6b] text-sm text-center py-20">No data yet.</p>
                        : (
                          [...radarData].sort((a, b) => b.score - a.score).map(({ fullName, score }) => (
                            <MasteryBarRow key={fullName} label={fullName} score={score} />
                          ))
                        )
                    }
                  </div>
                </div>
              </div>

            </div>

            {/* ── RIGHT COLUMN (4 cols) ── */}
            <div className="lg:col-span-4 flex flex-col gap-6">

              {/* Priority Targets */}
              <div className="bg-[#282828] rounded-lg shadow-sm flex flex-col">
                <div className="p-4 border-b border-[#3d3d3d]/60 shrink-0">
                  <h2 className="text-[#eff2f6] font-semibold text-[15px]">Priority Targets</h2>
                  <p className="text-[#8c8c8c] text-[12px] mt-0.5">Lowest mastery patterns</p>
                </div>
                <div className="flex flex-col">
                  {dashLoading
                    ? <div className="space-y-4 p-4">{[0, 1, 2].map(i => <Skeleton key={i} className="h-6" />)}</div>
                    : !dash?.top_weaknesses?.length
                      ? <p className="text-[#6b6b6b] text-sm py-4 text-center">No data yet.</p>
                      : (
                        <div className="flex flex-col">
                          {dash.top_weaknesses.map(({ pattern, score }) => (
                            <div key={pattern} className="px-4 py-2.5 border-b border-[#3d3d3d]/60 last:border-0 hover:bg-[#333333] transition-colors">
                              <MasteryBarRow label={pattern} score={score} />
                            </div>
                          ))}
                        </div>
                      )
                  }
                </div>
              </div>

              {/* Recent Submissions */}
              <div className="bg-[#282828] rounded-lg shadow-sm flex flex-col">
                <div className="p-4 border-b border-[#3d3d3d]/60 shrink-0">
                  <h2 className="text-[#eff2f6] font-semibold text-[15px]">Recent Submissions</h2>
                  <p className="text-[#8c8c8c] text-[12px] mt-0.5">Last 5 accepted solves</p>
                </div>
                <div className="flex flex-col">
                  {dashLoading
                    ? <div className="p-4 space-y-4">{[0, 1, 2, 3, 4].map(i => <Skeleton key={i} className="h-6" />)}</div>
                    : !dash?.recent_solves?.length
                      ? <p className="text-[#6b6b6b] text-sm py-8 text-center">No solves found.</p>
                      : (
                        dash.recent_solves.map(({ title, date, difficulty, category, subtopic_id }, i) => (
                          <Link
                            key={i}
                            to={category ? `/topics/${encodeURIComponent(category)}${subtopic_id ? `#subtopic-${subtopic_id}` : ""}` : "/topics"}
                            className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[#3d3d3d]/60 last:border-0 hover:bg-[#333333] transition-colors group cursor-pointer text-left"
                          >
                            <div className="flex flex-col min-w-0 flex-1">
                              <span className="text-[#eff2f6] text-[13px] font-medium truncate group-hover:text-[#ffa116] transition-colors">
                                {title}
                              </span>
                              {category && (
                                <span className="text-[#8c8c8c] text-[11px] truncate mt-0.5 font-normal">
                                  {category}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <DiffBadge diff={difficulty} />
                              <span className="text-[#aba9b0] text-[11px] w-14 text-right tabular-nums">{timeAgo(date)}</span>
                            </div>
                          </Link>
                        ))
                      )
                  }
                </div>
              </div>

            </div>

          </div>
        </div>
      </div>
    </AppLayout>
  );
}