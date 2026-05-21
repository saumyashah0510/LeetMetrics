import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useNavigate, Link } from "react-router-dom";
import AppLayout from "../components/AppLayout";
import { getCurriculum } from "../api";
import { getUsername, masteryColor, difficultyColor } from "../utils";

/* ─── Difficulty Badge ────────────────────────────────────────── */
function DiffBadge({ diff }) {
  const color = difficultyColor(diff);
  return (
    <span className="text-[12px] font-medium" style={{ color }}>
      {diff}
    </span>
  );
}

/* ─── Subtopic Row ────────────────────────────────────────────── */
function SubtopicRow({ subtopic }) {
  const [expanded, setExpanded] = useState(false);
  const { sub_pattern, score, progress, recommendations } = subtopic;
  
  const pct = progress.total > 0 ? (progress.solved / progress.total) * 100 : 0;
  const color = masteryColor(score);
  
  return (
    <div className="border border-[#3d3d3d]/50 bg-[#282828] rounded-xl overflow-hidden mb-4 transition-all">
      {/* Header */}
      <div 
        className="flex flex-col md:flex-row md:items-center justify-between p-5 hover:bg-[#333333] cursor-pointer transition-colors gap-4"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex flex-col gap-1.5 flex-1">
          <div className="flex items-center gap-3">
            <span className="text-white font-semibold text-[16px]">{sub_pattern}</span>
            <span className="px-2 py-0.5 rounded text-[11px] font-bold tracking-wide bg-[#333333] border border-[#3d3d3d]" style={{ color }}>
              MASTERY: {Math.round(score)}
            </span>
          </div>
          <span className="text-[#aba9b0] text-[13px]">
            {progress.solved} / {progress.total} Solved
          </span>
          
          {/* Completion Bar */}
          <div className="w-full max-w-md h-1.5 bg-[#3e3e3e] rounded-full overflow-hidden mt-1">
            <div
              className="h-full rounded-full transition-all duration-1000 ease-out"
              style={{ width: `${pct}%`, backgroundColor: color }}
            />
          </div>
        </div>
        
        <div className="flex items-center justify-end shrink-0">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center bg-[#333333] transition-transform duration-200 ${expanded ? "rotate-180 bg-[#ffa116]/10" : ""}`}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={expanded ? "#ffa116" : "#aba9b0"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </div>
        </div>
      </div>

      {/* Expanded Content (Recommendations) */}
      {expanded && (
        <div className="bg-[#1f1f1f] border-t border-[#3d3d3d]/50 p-5">
          <h4 className="text-white text-[14px] font-semibold mb-4 flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffa116" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
            Targeted Recommendations
          </h4>
          
          {recommendations.length === 0 ? (
            <div className="flex items-center gap-3 p-4 bg-[#282828] rounded-lg border border-[#3d3d3d]/50">
              <div className="w-8 h-8 rounded-full bg-[#00b8a3]/10 flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00b8a3" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <p className="text-[#00b8a3] text-[13px] font-medium">You have solved all problems in this pattern! Excellent work.</p>
            </div>
          ) : (
            <div className="grid lg:grid-cols-2 gap-3">
              {recommendations.map((rec) => (
                <a
                  key={rec.url_name}
                  href={`https://leetcode.com/problems/${rec.url_name}/`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-4 rounded-lg bg-[#282828] border border-[#3d3d3d]/50 hover:border-[#ffa116]/50 transition-colors group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-[#6b6b6b] text-[13px] font-mono w-8 shrink-0">{rec.frontend_id}.</span>
                    <span className="text-[#eff2f6] text-[14px] font-medium group-hover:text-[#ffa116] transition-colors truncate">
                      {rec.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-5 shrink-0 pl-4">
                    <span className="text-[#aba9b0] text-[13px] tabular-nums bg-[#333333] px-2 py-0.5 rounded">
                      {rec.ac_rate.toFixed(1)}% Acc
                    </span>
                    <DiffBadge diff={rec.difficulty} />
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function CategoryPage() {
  const { categoryId } = useParams();
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

  const category = curriculumData?.find(c => c.major_category === categoryId);

  return (
    <AppLayout>
      <div className="bg-[#1a1a1a] min-h-[calc(100vh-56px)] selection:bg-[#ffa116]/30">
        <div className="max-w-[1000px] w-full mx-auto px-6 py-8 flex flex-col gap-6">
          
          {/* Header & Back Button */}
          <div className="flex flex-col gap-4 pb-4 border-b border-[#3d3d3d]/50">
            <Link to="/topics" className="flex items-center gap-2 text-[#aba9b0] hover:text-white transition-colors text-[13px] font-medium w-fit">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
              Back to Topics
            </Link>
            
            {isLoading ? (
              <div className="h-8 w-64 bg-white/5 animate-pulse rounded" />
            ) : category ? (
              <div className="flex items-end justify-between">
                <div>
                  <h1 className="text-white font-bold text-2xl tracking-tight">{category.major_category}</h1>
                  <p className="text-[#8c8c8c] text-sm mt-1">
                    {category.subtopics.length} subtopics • Master each pattern to increase your score.
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-[24px] font-bold text-white tabular-nums leading-none">
                    {Math.round(category.total_score)}
                  </div>
                  <div className="flex items-center justify-end gap-1.5 mt-1">
                    <div className="text-[#aba9b0] text-[11px] font-bold uppercase tracking-wider">
                      Overall Mastery
                    </div>
                    <div className="group relative cursor-help">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6b6b6b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="hover:stroke-[#ffa116] transition-colors">
                        <circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>
                      </svg>
                      {/* CSS Tooltip */}
                      <div className="pointer-events-none absolute right-0 top-full mt-2 w-64 opacity-0 transition-opacity group-hover:opacity-100 z-50 bg-[#333333] border border-[#3d3d3d] p-3 rounded shadow-lg text-left text-[#aba9b0] text-[11px] font-normal normal-case tracking-normal">
                        <p className="mb-1.5 text-white font-semibold text-[12px]">Mastery Calculation</p>
                        <p>Score out of 100 based on three factors:</p>
                        <ul className="list-disc pl-4 mt-1 space-y-0.5">
                          <li><span className="text-white">Volume:</span> Total problems solved in this pattern.</li>
                          <li><span className="text-white">Difficulty:</span> Weighted by Easy (1x), Medium (2.5x), Hard (5x).</li>
                          <li><span className="text-white">Recency:</span> Scores decay exponentially over time if not practiced.</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {/* Subtopics List */}
          {!isLoading && category && (
            <div className="flex flex-col">
              {category.subtopics.map(sub => (
                <SubtopicRow key={sub.id} subtopic={sub} />
              ))}
            </div>
          )}

          {!isLoading && !category && (
            <div className="py-20 text-center">
              <p className="text-[#8c8c8c]">Category not found.</p>
              <Link to="/topics" className="text-[#ffa116] hover:underline mt-2 inline-block">Go back</Link>
            </div>
          )}

        </div>
      </div>
    </AppLayout>
  );
}
