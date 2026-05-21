import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import AppLayout from "../components/AppLayout";
import { getContests, getContestSummary } from "../api";
import { getUsername } from "../utils";

/* ─── Skeleton ────────────────────────────────────────────────── */
function Skeleton({ className = "" }) {
  return <div className={`rounded bg-white/5 animate-pulse ${className}`} />;
}

/* ─── Custom Tooltip ──────────────────────────────────────────── */
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-[#282828] border border-[#3d3d3d] p-3 rounded-lg shadow-xl">
        <p className="text-white font-medium text-[13px] mb-1">{data.contest_name}</p>
        <p className="text-[#8c8c8c] text-[12px] mb-2">{new Date(data.date).toLocaleDateString()}</p>
        <div className="flex flex-col gap-1 text-[13px]">
          <div className="flex items-center justify-between gap-4">
            <span className="text-[#aba9b0]">Rating:</span>
            <span className="text-white font-semibold tabular-nums">{Math.round(data.rating)}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-[#aba9b0]">Change:</span>
            <span className={`font-semibold tabular-nums ${data.rating_change >= 0 ? "text-[#00b8a3]" : "text-[#ef4743]"}`}>
              {data.rating_change >= 0 ? "+" : ""}{Math.round(data.rating_change)}
            </span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

/* ─── Contests Page ───────────────────────────────────────────── */
export default function ContestsPage() {
  const navigate = useNavigate();
  const username = getUsername();

  React.useEffect(() => {
    if (!username) navigate("/", { replace: true });
  }, [username, navigate]);

  // Fetch summary stats
  const { data: summaryData, isLoading: isSummaryLoading } = useQuery({
    queryKey: ["contest_summary", username],
    queryFn: () => getContestSummary(username).then(r => r.data),
    enabled: !!username
  });

  // Fetch full contest history
  const { data: historyData, isLoading: isHistoryLoading } = useQuery({
    queryKey: ["contests", username],
    queryFn: () => getContests(username).then(r => {
      // The backend returns newest first for the table, but we need oldest first for the line chart!
      return [...r.data].reverse();
    }),
    enabled: !!username
  });

  const isLoading = isSummaryLoading || isHistoryLoading;
  
  // Format history for the table (we want newest first, so we just use the original data)
  const tableData = historyData ? [...historyData].reverse() : [];

  return (
    <AppLayout>
      <div className="bg-[#1a1a1a] min-h-[calc(100vh-56px)] selection:bg-[#ffa116]/30">
        <div className="max-w-[1200px] w-full mx-auto px-6 py-8 flex flex-col gap-6">
          
          {/* Header */}
          <div className="flex items-center justify-between pb-2 border-b border-[#3d3d3d]/50">
            <div>
              <h1 className="text-white font-semibold text-xl tracking-tight">Contest Analytics</h1>
              <p className="text-[#8c8c8c] text-sm mt-1">
                Track your Elo rating history and global ranking progression.
              </p>
            </div>
          </div>

          {isLoading ? (
            <div className="flex flex-col gap-6">
               <div className="grid grid-cols-3 gap-6">
                 <Skeleton className="h-24 w-full" />
                 <Skeleton className="h-24 w-full" />
                 <Skeleton className="h-24 w-full" />
               </div>
               <Skeleton className="h-[400px] w-full" />
               <Skeleton className="h-[300px] w-full" />
            </div>
          ) : historyData && historyData.length > 0 ? (
            <div className="flex flex-col gap-6">
              
              {/* Stat Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-[#282828] border border-[#3d3d3d]/50 rounded-xl p-6 flex flex-col justify-center relative overflow-hidden group">
                  <div className="absolute -right-4 -top-4 w-24 h-24 bg-[#ffa116]/5 rounded-full group-hover:scale-150 transition-transform duration-500 ease-out" />
                  <span className="text-[#8c8c8c] text-[12px] font-bold uppercase tracking-wider mb-2 relative z-10">Current Rating</span>
                  <div className="text-white text-4xl font-bold tabular-nums relative z-10 flex items-center gap-3">
                    {Math.round(summaryData?.rating || 0)}
                    {tableData[0]?.rating_change && (
                      <span className={`text-[14px] font-medium px-2 py-0.5 rounded-full ${tableData[0].rating_change >= 0 ? 'bg-[#00b8a3]/10 text-[#00b8a3]' : 'bg-[#ef4743]/10 text-[#ef4743]'}`}>
                        {tableData[0].rating_change >= 0 ? '↑' : '↓'} {Math.abs(Math.round(tableData[0].rating_change))}
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="bg-[#282828] border border-[#3d3d3d]/50 rounded-xl p-6 flex flex-col justify-center relative overflow-hidden group">
                  <div className="absolute -right-4 -top-4 w-24 h-24 bg-[#00b8a3]/5 rounded-full group-hover:scale-150 transition-transform duration-500 ease-out" />
                  <span className="text-[#8c8c8c] text-[12px] font-bold uppercase tracking-wider mb-2 relative z-10">Global Ranking</span>
                  <span className="text-white text-4xl font-bold tabular-nums relative z-10">
                    {summaryData?.global_ranking ? summaryData.global_ranking.toLocaleString() : "Unranked"}
                  </span>
                </div>
                
                <div className="bg-[#282828] border border-[#3d3d3d]/50 rounded-xl p-6 flex flex-col justify-center relative overflow-hidden group">
                  <div className="absolute -right-4 -top-4 w-24 h-24 bg-[#0a84ff]/5 rounded-full group-hover:scale-150 transition-transform duration-500 ease-out" />
                  <span className="text-[#8c8c8c] text-[12px] font-bold uppercase tracking-wider mb-2 relative z-10">Contests Attended</span>
                  <span className="text-white text-4xl font-bold tabular-nums relative z-10">
                    {historyData.length}
                  </span>
                </div>
              </div>

              {/* Rating Chart */}
              <div className="bg-[#282828] border border-[#3d3d3d]/50 rounded-xl p-6">
                <h3 className="text-white font-semibold text-[15px] mb-6 flex items-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffa116" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                  Rating Progression
                </h3>
                <div className="h-[350px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={historyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorRating" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ffa116" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#ffa116" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#3d3d3d" vertical={false} />
                      <XAxis 
                        dataKey="date" 
                        tickFormatter={(val) => new Date(val).toLocaleDateString(undefined, { month: 'short', year: '2-digit' })} 
                        stroke="#6b6b6b"
                        tick={{ fill: '#8c8c8c', fontSize: 12 }}
                        tickLine={false}
                        axisLine={false}
                        dy={10}
                      />
                      <YAxis 
                        domain={['auto', 'auto']} 
                        stroke="#6b6b6b"
                        tick={{ fill: '#8c8c8c', fontSize: 12 }}
                        tickLine={false}
                        axisLine={false}
                        dx={-10}
                        tickFormatter={(val) => Math.round(val)}
                      />
                      <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#5c5c5c', strokeWidth: 1, strokeDasharray: '4 4' }} />
                      <ReferenceLine y={1500} stroke="#4a4a4a" strokeDasharray="3 3" label={{ position: 'insideTopLeft', value: 'Baseline', fill: '#6b6b6b', fontSize: 11 }} />
                      <Line 
                        type="monotone" 
                        dataKey="rating" 
                        stroke="#ffa116" 
                        strokeWidth={3} 
                        dot={{ r: 3, fill: '#1a1a1a', stroke: '#ffa116', strokeWidth: 2 }}
                        activeDot={{ r: 6, fill: '#ffa116', stroke: '#1a1a1a', strokeWidth: 2 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Contest Table */}
              <div className="bg-[#282828] border border-[#3d3d3d]/50 rounded-xl overflow-hidden">
                <div className="p-6 border-b border-[#3d3d3d]/50">
                  <h3 className="text-white font-semibold text-[15px] flex items-center gap-2">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00b8a3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
                    Contest History
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#3d3d3d]/50 bg-[#333333]/50">
                        <th className="px-6 py-4 text-[12px] font-semibold text-[#8c8c8c] uppercase tracking-wider">Contest</th>
                        <th className="px-6 py-4 text-[12px] font-semibold text-[#8c8c8c] uppercase tracking-wider">Date</th>
                        <th className="px-6 py-4 text-[12px] font-semibold text-[#8c8c8c] uppercase tracking-wider text-right">Solved</th>
                        <th className="px-6 py-4 text-[12px] font-semibold text-[#8c8c8c] uppercase tracking-wider text-right">Rating Change</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#3d3d3d]/30">
                      {tableData.map((contest, idx) => (
                        <tr key={idx} className="hover:bg-[#333333]/30 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap text-[14px] font-medium text-[#eff2f6]">
                            {contest.contest_name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-[13px] text-[#aba9b0]">
                            {new Date(contest.date).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-[13px] text-[#aba9b0] text-right tabular-nums">
                            {contest.problems_solved} / 4
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-[13px] text-right tabular-nums font-medium">
                            <span className={contest.rating_change >= 0 ? "text-[#00b8a3]" : "text-[#ef4743]"}>
                              {contest.rating_change >= 0 ? "+" : ""}{Math.round(contest.rating_change)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              
            </div>
          ) : (
            <div className="py-20 text-center">
              <div className="w-16 h-16 rounded-full bg-[#333333] flex items-center justify-center mx-auto mb-4">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#8c8c8c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              </div>
              <h3 className="text-white font-medium text-lg mb-2">No Contest History</h3>
              <p className="text-[#8c8c8c]">You haven't participated in any LeetCode contests yet.</p>
            </div>
          )}

        </div>
      </div>
    </AppLayout>
  );
}
