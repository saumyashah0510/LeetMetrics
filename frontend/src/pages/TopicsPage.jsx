import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, Link } from "react-router-dom";
import AppLayout from "../components/AppLayout";
import { getCurriculum } from "../api";
import { getUsername, masteryColor } from "../utils";

/* ─── Skeleton ────────────────────────────────────────────────── */
function Skeleton({ className = "" }) {
  return <div className={`rounded bg-white/5 animate-pulse ${className}`} />;
}

/* ─── Major Category Card ─────────────────────────────────────── */
function MajorCategoryCard({ category }) {
  const { major_category, total_score, subtopics } = category;
  
  let totalProblems = 0;
  let solvedProblems = 0;
  subtopics.forEach(sub => {
    totalProblems += sub.progress.total;
    solvedProblems += sub.progress.solved;
  });
  
  const pct = totalProblems > 0 ? (solvedProblems / totalProblems) * 100 : 0;
  const color = masteryColor(total_score);
  
  return (
    <Link 
      to={`/topics/${encodeURIComponent(major_category)}`}
      className="bg-[#282828] rounded-xl shadow-sm border border-[#3d3d3d]/50 overflow-hidden flex flex-col hover:border-[#ffa116]/50 transition-colors group cursor-pointer"
    >
      <div className="p-5 flex flex-col gap-4">
        <div className="flex items-start justify-between">
          <h2 className="text-white font-semibold text-[18px] group-hover:text-[#ffa116] transition-colors line-clamp-1 pr-4">
            {major_category}
          </h2>
          <div className="flex flex-col items-end shrink-0">
            <span className="text-[18px] font-bold tabular-nums leading-none" style={{ color }}>
              {Math.round(total_score)}
            </span>
            <span className="text-[#6b6b6b] text-[10px] font-bold uppercase tracking-wider mt-1">Mastery</span>
          </div>
        </div>
        
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-[12px]">
            <span className="text-[#aba9b0] font-medium">{subtopics.length} Subtopics</span>
            <span className="text-[#aba9b0] tabular-nums">{solvedProblems} / {totalProblems} Solved</span>
          </div>
          
          {/* Completion Bar */}
          <div className="w-full h-1.5 bg-[#3e3e3e] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-1000 ease-out"
              style={{ width: `${pct}%`, backgroundColor: color }}
            />
          </div>
        </div>
      </div>
      
      <div className="bg-[#2f2f2f]/50 p-3 px-5 border-t border-[#3d3d3d]/50 flex items-center justify-between">
        <span className="text-[#8c8c8c] text-[12px] font-medium group-hover:text-[#eff2f6] transition-colors">
          View all patterns
        </span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#8c8c8c] group-hover:text-[#ffa116] transition-colors group-hover:translate-x-1">
          <line x1="5" y1="12" x2="19" y2="12"/>
          <polyline points="12 5 19 12 12 19"/>
        </svg>
      </div>
    </Link>
  );
}

/* ─── Topics Page ─────────────────────────────────────────────── */
export default function TopicsPage() {
  const navigate = useNavigate();
  const username = getUsername();

  React.useEffect(() => {
    if (!username) navigate("/", { replace: true });
  }, [username, navigate]);

  const { data: curriculumData, isLoading } = useQuery({
    queryKey: ["curriculum", username],
    queryFn: () => getCurriculum(username).then(r => r.data.curriculum),
    enabled: !!username
  });

  return (
    <AppLayout>
      <div className="bg-[#1a1a1a] min-h-[calc(100vh-56px)] selection:bg-[#ffa116]/30">
        <div className="max-w-[1200px] w-full mx-auto px-6 py-8 flex flex-col gap-8">
          
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-[#3d3d3d]/50">
            <div>
              <h1 className="text-white font-bold text-2xl tracking-tight">Curriculum & Topics</h1>
              <p className="text-[#8c8c8c] text-sm mt-1">
                Select a major category to view detailed patterns and targeted problem recommendations.
              </p>
            </div>
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="bg-[#282828] rounded-xl h-[160px] p-5 flex flex-col justify-between">
                  <div className="flex justify-between">
                    <Skeleton className="h-6 w-1/2" />
                    <Skeleton className="h-6 w-8" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Skeleton className="h-3 w-16" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                    <Skeleton className="h-1.5 w-full" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Grid of Cards */}
          {!isLoading && curriculumData && (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
              {curriculumData.map(category => (
                <MajorCategoryCard key={category.major_category} category={category} />
              ))}
            </div>
          )}

          {!isLoading && (!curriculumData || curriculumData.length === 0) && (
            <div className="py-20 text-center">
              <p className="text-[#8c8c8c]">No curriculum data found. Sync your profile to get started.</p>
            </div>
          )}

        </div>
      </div>
    </AppLayout>
  );
}
