import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, Link } from "react-router-dom";
import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, ResponsiveContainer, Tooltip as RechartsTooltip, ReferenceLine } from "recharts";
import AppLayout from "../components/AppLayout";
import { getAllMastery } from "../api";
import { getUsername, masteryColor } from "../utils";

/* ─── Skeleton ────────────────────────────────────────────────── */
function Skeleton({ className = "" }) {
  return <div className={`rounded bg-white/5 animate-pulse ${className}`} />;
}

/* ─── Pattern Card ────────────────────────────────────────────── */
function PatternCard({ item, showRecency = false }) {
  const color = masteryColor(item.score);
  return (
    <Link
      to={`/topics/${encodeURIComponent(item.category)}`}
      className="bg-[#333333]/50 rounded-lg p-4 border border-[#3d3d3d]/50 hover:border-[#ffa116]/50 transition-colors flex items-center justify-between group"
    >
      <div className="flex flex-col gap-1">
        <span className="text-white font-medium text-[14px] group-hover:text-[#ffa116] transition-colors">{item.pattern}</span>
        <span className="text-[#8c8c8c] text-[12px]">{item.category}</span>
        {showRecency && (
          <span className="text-[#ef4743] text-[11px] font-medium mt-1 flex items-center gap-1">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
            Decayed by {Math.round((1 - item.recency_multiplier) * 100)}%
          </span>
        )}
      </div>
      <div className="flex flex-col items-end">
        <span className="text-[18px] font-bold tabular-nums leading-none" style={{ color }}>{Math.round(item.score)}</span>
        <span className="text-[#6b6b6b] text-[10px] font-bold uppercase tracking-wider mt-1">Score</span>
      </div>
    </Link>
  );
}

/* ─── Mastery Page ────────────────────────────────────────────── */
export default function MasteryPage() {
  const navigate = useNavigate();
  const username = getUsername();

  React.useEffect(() => {
    if (!username) navigate("/", { replace: true });
  }, [username, navigate]);

  const { data: masteryData, isLoading } = useQuery({
    queryKey: ["mastery_all", username],
    queryFn: () => getAllMastery(username).then(r => r.data),
    enabled: !!username
  });

  const { scatterData, needsRevision, strongest, weakest } = useMemo(() => {
    if (!masteryData) return { scatterData: [], needsRevision: [], strongest: [], weakest: [] };

    // 1. Scatter Data (Volume vs Difficulty)
    const practiced = masteryData.filter(item => item.volume_score > 0);

    const scatterData = practiced.map(item => ({
      name: item.pattern,
      category: item.category,
      x: Math.round(item.volume_score), // 0 to 50
      y: Math.round(item.difficulty_score), // 0 to 50
      z: Math.round(item.score), // Used for bubble size
    }));

    // 2. Needs Revision
    const needsRevision = practiced
      .filter(item => item.recency_multiplier < 0.9)
      .sort((a, b) => a.recency_multiplier - b.recency_multiplier) // Lowest recency (most decayed) first
      .slice(0, 3);

    // 3. Strongest & Weakest
    const sortedPracticed = [...practiced].sort((a, b) => b.score - a.score);
    const strongest = sortedPracticed.slice(0, 4);
    const weakest = [...sortedPracticed].reverse().slice(0, 4);

    return { scatterData, needsRevision, strongest, weakest };
  }, [masteryData]);

  // Custom Scatter Tooltip
  const ScatterTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-[#282828] border border-[#3d3d3d] p-3 rounded-lg shadow-xl min-w-[150px]">
          <p className="text-white font-medium text-[13px] mb-1">{data.name}</p>
          <p className="text-[#8c8c8c] text-[11px] mb-2">{data.category}</p>
          <div className="flex flex-col gap-1 text-[12px]">
            <div className="flex justify-between gap-4">
              <span className="text-[#aba9b0]">Volume:</span>
              <span className="text-white tabular-nums">{data.x} / 50</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-[#aba9b0]">Difficulty:</span>
              <span className="text-white tabular-nums">{data.y} / 50</span>
            </div>
            <div className="flex justify-between gap-4 mt-1 pt-1 border-t border-[#3d3d3d]">
              <span className="text-[#aba9b0]">Total Score:</span>
              <span className="text-[#ffa116] font-bold tabular-nums">{data.z}</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <AppLayout>
      <div className="bg-[#1a1a1a] min-h-[calc(100vh-56px)] selection:bg-[#ffa116]/30">
        <div className="max-w-[1200px] w-full mx-auto px-6 py-8 flex flex-col gap-8">

          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-[#3d3d3d]/50">
            <div>
              <h1 className="text-white font-bold text-2xl tracking-tight">Mastery Trends & Review</h1>
              <p className="text-[#8c8c8c] text-sm mt-1">
                Visualize your proficiency across algorithms and identify patterns that need spaced repetition.
              </p>
            </div>
          </div>

          {isLoading ? (
            <div className="flex flex-col gap-6">
              <div className="grid grid-cols-3 gap-6">
                <Skeleton className="h-[400px] w-full col-span-2" />
                <Skeleton className="h-[400px] w-full" />
              </div>
              <Skeleton className="h-64 w-full" />
            </div>
          ) : masteryData && masteryData.length > 0 ? (
            <div className="flex flex-col gap-6">

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Scatter Chart (Takes up 2 cols on lg) */}
                <div className="bg-[#282828] border border-[#3d3d3d]/50 rounded-xl p-6 lg:col-span-2 flex flex-col h-full min-h-[450px]">
                  <h3 className="text-white font-semibold text-[15px] mb-1 flex items-center gap-2">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00b8a3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" /></svg>
                    Mastery Quadrant
                  </h3>
                  <p className="text-[#8c8c8c] text-[12px] mb-6">
                    Mapping your practiced patterns by Volume vs Difficulty.
                  </p>

                  <div className="flex-1 w-full relative">

                    {/* Centered Quadrant Watermarks - Accounts for margin + axis dimensions (YAxis width=60, XAxis height=30) */}
                    <div className="absolute top-[20px] right-[30px] bottom-[60px] left-[85px] flex flex-col pointer-events-none z-0">
                      <div className="flex-1 flex">
                        <div className="flex-1 flex items-center justify-center text-[#8c8c8c]/15 font-black text-3xl uppercase tracking-widest select-none">Snipers</div>
                        <div className="flex-1 flex items-center justify-center text-[#00b8a3]/10 font-black text-3xl uppercase tracking-widest select-none">Masters</div>
                      </div>
                      <div className="flex-1 flex">
                        <div className="flex-1 flex items-center justify-center text-[#ef4743]/10 font-black text-3xl uppercase tracking-widest select-none">Beginners</div>
                        <div className="flex-1 flex items-center justify-center text-[#ffa116]/10 font-black text-3xl uppercase tracking-widest select-none">Grinders</div>
                      </div>
                    </div>

                    {/* Fixed HTML Axis Labels to prevent SVG clipping */}
                    <div className="absolute left-1 top-1/2 -translate-y-1/2 -rotate-90 text-[#8c8c8c] text-[12px] font-medium tracking-wide pointer-events-none origin-center">Difficulty →</div>
                    <div className="absolute bottom-1 right-8 text-[#8c8c8c] text-[12px] font-medium tracking-wide pointer-events-none">Volume →</div>

                    <ResponsiveContainer width="100%" height="100%">
                      {/* Added extra margins so Axis labels don't get cut off */}
                      <ScatterChart margin={{ top: 20, right: 30, bottom: 30, left: 25 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#3d3d3d" opacity={0.6} />

                        <XAxis
                          type="number"
                          dataKey="x"
                          domain={[0, 50]}
                          ticks={[0, 25, 50]} /* Forces grid lines ONLY at 0, 25, and 50 */
                          tick={{ fill: '#8c8c8c', fontSize: 11 }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          type="number"
                          dataKey="y"
                          domain={[0, 50]}
                          ticks={[0, 25, 50]} /* Forces grid lines ONLY at 0, 25, and 50 */
                          tick={{ fill: '#8c8c8c', fontSize: 11 }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <ZAxis type="number" dataKey="z" range={[40, 400]} />
                        <RechartsTooltip cursor={{ strokeDasharray: '3 3', stroke: '#8c8c8c' }} content={<ScatterTooltip />} />

                        {/* Highlight the center crosshairs explicitly */}
                        <ReferenceLine x={25} stroke="#6b6b6b" strokeDasharray="4 4" strokeWidth={1.5} />
                        <ReferenceLine y={25} stroke="#6b6b6b" strokeDasharray="4 4" strokeWidth={1.5} />

                        <Scatter name="Patterns" data={scatterData} fill="#ffa116" fillOpacity={0.85}>
                          {
                            scatterData.map((entry, index) => (
                              <circle key={`cell-${index}`} fill={masteryColor(entry.z)} />
                            ))
                          }
                        </Scatter>
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Needs Revision Panel */}
                <div className="bg-[#282828] border border-[#3d3d3d]/50 rounded-xl p-6 flex flex-col h-full min-h-[450px]">
                  <h3 className="text-white font-semibold text-[15px] mb-4 flex items-center gap-2">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4743" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                    Spaced Repetition
                  </h3>
                  <p className="text-[#8c8c8c] text-[12px] mb-4">
                    These patterns are experiencing time decay. Solve a problem to restore their mastery scores to 100%.
                  </p>

                  {needsRevision.length > 0 ? (
                    <div className="flex flex-col gap-3 overflow-y-auto pr-2 custom-scrollbar">
                      {needsRevision.map(item => (
                        <PatternCard key={item.id} item={item} showRecency={true} />
                      ))}
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
                      <div className="w-12 h-12 rounded-full bg-[#00b8a3]/10 flex items-center justify-center mb-3">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00b8a3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                      </div>
                      <p className="text-white text-[14px] font-medium">All caught up!</p>
                      <p className="text-[#8c8c8c] text-[12px] mt-1">Your recent patterns are fully mastered with no decay.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Strongest vs Weakest */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-[#282828] border border-[#3d3d3d]/50 rounded-xl p-6">
                  <h3 className="text-white font-semibold text-[15px] mb-4 flex items-center gap-2">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00b8a3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
                    Strongest Patterns
                  </h3>
                  <div className="flex flex-col gap-3">
                    {strongest.map(item => <PatternCard key={item.id} item={item} />)}
                    {strongest.length === 0 && <p className="text-[#8c8c8c] text-sm">No patterns practiced yet.</p>}
                  </div>
                </div>

                <div className="bg-[#282828] border border-[#3d3d3d]/50 rounded-xl p-6">
                  <h3 className="text-white font-semibold text-[15px] mb-4 flex items-center gap-2">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8c8c8c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                    Weakest Patterns
                  </h3>
                  <div className="flex flex-col gap-3">
                    {weakest.map(item => <PatternCard key={item.id} item={item} />)}
                    {weakest.length === 0 && <p className="text-[#8c8c8c] text-sm">No patterns practiced yet.</p>}
                  </div>
                </div>
              </div>

            </div>
          ) : (
            <div className="py-20 text-center">
              <div className="w-16 h-16 rounded-full bg-[#333333] flex items-center justify-center mx-auto mb-4">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#8c8c8c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
              </div>
              <h3 className="text-white font-medium text-lg mb-2">No Mastery Data</h3>
              <p className="text-[#8c8c8c]">Solve some problems and sync your profile to generate mastery analytics.</p>
            </div>
          )}

        </div>
      </div>
    </AppLayout>
  );
}