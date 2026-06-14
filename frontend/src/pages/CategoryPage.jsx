import React, { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useNavigate, Link, useLocation } from "react-router-dom";
import AppLayout from "../components/AppLayout";
import { getCurriculum } from "../api";
import { getUsername, masteryColor, difficultyColor, timeAgo } from "../utils";

/* ─── Company Badge ────────────────────────────────────────────── */
function CompanyBadge({ name, frequency }) {
  const colors = {
    Google: { bg: "bg-[#ea4335]/10", border: "border-[#ea4335]/20", text: "text-[#ea4335]" },
    Meta: { bg: "bg-[#0668e1]/10", border: "border-[#0668e1]/20", text: "text-[#0668e1]" },
    Amazon: { bg: "bg-[#ff9900]/10", border: "border-[#ff9900]/20", text: "text-[#ff9900]" },
    Microsoft: { bg: "bg-[#00a4ef]/10", border: "border-[#00a4ef]/20", text: "text-[#00a4ef]" }
  };
  
  let style = colors[name];
  if (!style) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h = Math.abs(hash) % 360;
    style = {
      bg: `rgba(0,0,0,0)`, // keep transparent and use style bg
      border: `hsla(${h}, 70%, 55%, 0.25)`,
      text: `hsla(${h}, 70%, 55%, 0.95)`,
      customBg: `hsla(${h}, 70%, 55%, 0.1)`
    };
  }

  return (
    <span 
      className={`px-1.5 py-0.5 rounded text-[10px] font-bold border transition-all hover:scale-105 ${style.bg || ""} ${style.border} ${style.text}`}
      style={style.customBg ? { backgroundColor: style.customBg } : {}}
      title={`${name} frequency: ${frequency.toFixed(1)}%`}
    >
      {name} {frequency > 0 ? `${Math.round(frequency)}%` : ""}
    </span>
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

/* ─── Deterministic Seed-based Shuffle ──────────────────────── */
function seedShuffle(array, seed) {
  if (array.length <= 1) return [...array];
  if (seed === 0) return [...array]; // Keep original order for seed 0 to prioritize high ac_rate first

  let shuffled = [...array];
  let currentSeed = seed;
  for (let i = shuffled.length - 1; i > 0; i--) {
    currentSeed = (currentSeed * 9301 + 49297) % 233280;
    const j = Math.floor((currentSeed / 233280) * (i + 1));
    const temp = shuffled[i];
    shuffled[i] = shuffled[j];
    shuffled[j] = temp;
  }
  return shuffled;
}

/* ─── Pick 5 from pool using seed shuffle ────────────────────── */
function pickRecs(pool, seed) {
  if (!pool || pool.length === 0) return [];

  const easy = pool.filter(r => r.difficulty === "Easy");
  const med  = pool.filter(r => r.difficulty === "Medium");
  const hard = pool.filter(r => r.difficulty === "Hard");

  // Deterministically shuffle each bucket based on the seed
  const sEasy = seedShuffle(easy, seed + 1);
  const sMed  = seedShuffle(med,  seed + 2);
  const sHard = seedShuffle(hard, seed + 3);

  const picked = [];
  if (sEasy.length > 0) picked.push(sEasy[0]);   // 1 Easy
  picked.push(...sMed.slice(0, 3));               // up to 3 Medium
  if (sHard.length > 0) picked.push(sHard[0]);   // 1 Hard

  // Fill to exactly 5 using whatever is left in the pool
  if (picked.length < 5) {
    const pickedUrls = new Set(picked.map(r => r.url_name));
    const extras = pool.filter(r => !pickedUrls.has(r.url_name));
    const sExtras = seedShuffle(extras, seed + 4);
    picked.push(...sExtras.slice(0, 5 - picked.length));
  }

  return picked.slice(0, 5);
}

/* ─── Subtopic Row ────────────────────────────────────────────── */
function SubtopicRow({ subtopic }) {
  const location = useLocation();
  const targetId = `subtopic-${subtopic.id}`;
  const isTarget = location.hash === `#${targetId}`;

  const [expanded, setExpanded]   = useState(isTarget);
  const [activeTab, setActiveTab] = useState("recommendations");
  const [recSeed, setRecSeed]     = useState(0);
  const [spinning, setSpinning]   = useState(false);

  useEffect(() => {
    if (isTarget) {
      setExpanded(true);
      const timer = setTimeout(() => {
        const el = document.getElementById(targetId);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [location.hash, isTarget, targetId]);

  const { sub_pattern, score, progress, recommendations = [], solved_problems = [] } = subtopic;

  const pct   = progress.total > 0 ? (progress.solved / progress.total) * 100 : 0;
  const color = masteryColor(score);

  // Pick 5 from the backend pool based on current seed
  const displayedRecs = useMemo(
    () => pickRecs(recommendations, recSeed),
    [recommendations, recSeed]
  );

  const canRefresh = recommendations.length > 5;

  function handleRefresh(e) {
    e.stopPropagation();
    setSpinning(true);
    setRecSeed(s => s + 1);
    setTimeout(() => setSpinning(false), 400);
  }

  return (
    <div
      id={targetId}
      className={`border bg-[#282828] rounded-xl overflow-hidden mb-4 transition-all duration-500 ${
        isTarget
          ? "border-[#ffa116] ring-1 ring-[#ffa116]"
          : "border-[#3d3d3d]/50"
      }`}
    >
      {/* Header */}
      <div
        className="flex flex-col md:flex-row md:items-center justify-between p-5 hover:bg-[#333333] cursor-pointer transition-colors gap-4"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex flex-col gap-1.5 flex-1">
          <div className="flex items-center gap-3">
            <span className="text-white font-semibold text-[16px]">{sub_pattern}</span>
            <span
              className="px-2 py-0.5 rounded text-[11px] font-bold tracking-wide bg-[#333333] border border-[#3d3d3d]"
              style={{ color }}
            >
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
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center bg-[#333333] transition-transform duration-200 ${
              expanded ? "rotate-180 bg-[#ffa116]/10" : ""
            }`}
          >
            <svg
              width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke={expanded ? "#ffa116" : "#aba9b0"}
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </div>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div className="bg-[#1f1f1f] border-t border-[#3d3d3d]/50">
          {/* Tab Bar */}
          <div className="flex border-b border-[#3d3d3d]/50">
            <button
              id={`tab-recommendations-${subtopic.id}`}
              onClick={() => setActiveTab("recommendations")}
              className={`flex items-center gap-2 px-5 py-3 text-[13px] font-semibold border-b-2 transition-colors ${
                activeTab === "recommendations"
                  ? "border-[#ffa116] text-[#ffa116]"
                  : "border-transparent text-[#8c8c8c] hover:text-[#eff2f6]"
              }`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              Recommendations
            </button>

            <button
              id={`tab-solved-${subtopic.id}`}
              onClick={() => setActiveTab("solved")}
              className={`flex items-center gap-2 px-5 py-3 text-[13px] font-semibold border-b-2 transition-colors ${
                activeTab === "solved"
                  ? "border-[#00b8a3] text-[#00b8a3]"
                  : "border-transparent text-[#8c8c8c] hover:text-[#eff2f6]"
              }`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Solved
              {solved_problems.length > 0 && (
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                    activeTab === "solved"
                      ? "bg-[#00b8a3]/20 text-[#00b8a3]"
                      : "bg-[#3d3d3d] text-[#8c8c8c]"
                  }`}
                >
                  {solved_problems.length}
                </span>
              )}
            </button>
          </div>

          {/* Tab Content */}
          <div className="p-5">

            {/* ── Recommendations Tab ── */}
            {activeTab === "recommendations" && (
              <div>
                {/* Tab header with refresh button */}
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-white text-[14px] font-semibold flex items-center gap-2">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffa116" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                    Targeted Recommendations
                    <span className="text-[#6b6b6b] text-[11px] font-normal">
                      ({displayedRecs.length} of {recommendations.length})
                    </span>
                  </h4>

                  {/* Refresh button — only shown if pool has more than 5 */}
                  {canRefresh && (
                    <button
                      id={`refresh-recs-${subtopic.id}`}
                      onClick={handleRefresh}
                      title="Get different recommendations"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2f2f2f] border border-[#3d3d3d]/70 text-[#8c8c8c] hover:text-[#ffa116] hover:border-[#ffa116]/40 transition-colors text-[12px] font-medium group"
                    >
                      <svg
                        width="13" height="13" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                        className={`transition-transform duration-300 ${spinning ? "rotate-180" : ""} group-hover:rotate-180`}
                        style={{ transition: spinning ? "transform 0.3s ease" : "transform 0.3s ease" }}
                      >
                        <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                        <path d="M21 3v5h-5" />
                        <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                        <path d="M8 16H3v5" />
                      </svg>
                      Refresh
                    </button>
                  )}
                </div>

                {progress.solved === progress.total && progress.total > 0 && (
                  <div className="flex items-center gap-3 p-3 mb-4 bg-[#00b8a3]/10 rounded-lg border border-[#00b8a3]/20">
                    <div className="w-8 h-8 rounded-full bg-[#00b8a3]/20 flex items-center justify-center shrink-0">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00b8a3" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                    <p className="text-[#00b8a3] text-[13px] font-medium">
                      You have solved all problems in this pattern! Review these questions to maintain your mastery.
                    </p>
                  </div>
                )}

                <div className="grid lg:grid-cols-2 gap-3">
                  {displayedRecs.map((rec) => (
                    <a
                      key={rec.url_name}
                      href={`https://leetcode.com/problems/${rec.url_name}/`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-4 rounded-lg bg-[#282828] border border-[#3d3d3d]/50 hover:border-[#ffa116]/50 transition-colors group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {rec.solved && (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00b8a3" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                        <span className="text-[#6b6b6b] text-[13px] font-mono w-6 shrink-0 text-right">
                          {rec.frontend_id}.
                        </span>
                        <div className="flex flex-col min-w-0">
                          <span
                            className={`text-[14px] font-medium group-hover:text-[#ffa116] transition-colors truncate ${
                              rec.solved ? "text-[#8c8c8c] line-through decoration-[#8c8c8c]/50" : "text-[#eff2f6]"
                            }`}
                          >
                            {rec.title}
                          </span>
                          {rec.companies && rec.companies.length > 0 && (
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                              {rec.companies.map(c => (
                                <CompanyBadge key={c.name} name={c.name} frequency={c.frequency} />
                              ))}
                            </div>
                          )}
                        </div>
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
              </div>
            )}

            {/* ── Solved Tab ── */}
            {activeTab === "solved" && (
              <div>
                {solved_problems.length === 0 ? (
                  <div className="py-10 flex flex-col items-center gap-3 text-center">
                    <div className="w-12 h-12 rounded-full bg-[#3d3d3d]/50 flex items-center justify-center">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6b6b6b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                    </div>
                    <p className="text-[#6b6b6b] text-[13px] font-medium">No solved questions yet in this pattern.</p>
                    <p className="text-[#4d4d4d] text-[12px]">Start with the recommendations above!</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {solved_problems.map((prob, idx) => (
                      <a
                        key={prob.url_name}
                        href={`https://leetcode.com/problems/${prob.url_name}/`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between p-3.5 rounded-lg bg-[#282828] border border-[#3d3d3d]/50 hover:border-[#00b8a3]/40 transition-colors group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-[#4d4d4d] text-[11px] font-mono w-5 shrink-0 text-right">
                            {idx + 1}
                          </span>
                          <div className="w-5 h-5 rounded-full bg-[#00b8a3]/15 flex items-center justify-center shrink-0">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#00b8a3" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </div>
                          <span className="text-[#6b6b6b] text-[12px] font-mono w-6 shrink-0 text-right">
                            {prob.frontend_id}.
                          </span>
                          <div className="flex flex-col min-w-0">
                            <span className="text-[14px] font-medium text-[#eff2f6] group-hover:text-[#00b8a3] transition-colors truncate">
                              {prob.title}
                            </span>
                            {prob.companies && prob.companies.length > 0 && (
                              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                {prob.companies.map(c => (
                                  <CompanyBadge key={c.name} name={c.name} frequency={c.frequency} />
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-4 shrink-0 pl-4">
                          {prob.solved_at && (
                            <span className="text-[#6b6b6b] text-[12px] tabular-nums hidden sm:block">
                              {timeAgo(prob.solved_at)}
                            </span>
                          )}
                          <DiffBadge diff={prob.difficulty} />
                        </div>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
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
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
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
                        <circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" />
                      </svg>
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

          {/* Recognition & Strategy Guide (PDF Mind Map Insights) */}
          {!isLoading && category && (category.recognition_cues?.length > 0 || category.core_concepts?.length > 0) && (
            <div className="bg-[#282828]/30 border border-white/5 rounded-2xl p-6 backdrop-blur-xl flex flex-col gap-5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#ffa116]/10 border border-[#ffa116]/20 flex items-center justify-center text-[#ffa116]">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                  </svg>
                </div>
                <div>
                  <h3 className="text-white font-bold text-sm tracking-wide uppercase">Pattern Recognition Heuristics</h3>
                  <p className="text-[#8c8c8c] text-xs">Interview strategies and cues mapped directly from the DSA pattern mind map.</p>
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-6 text-[13px]">
                {/* Core Concepts */}
                {category.core_concepts?.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <span className="text-[#ffa116] font-semibold tracking-wide uppercase text-[10px]">Core Concepts</span>
                    <ul className="list-disc pl-4 space-y-1 text-[#eff2f6]/80 leading-relaxed">
                      {category.core_concepts.map((concept, i) => (
                        <li key={i}>{concept}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Recognition Cues */}
                {category.recognition_cues?.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <span className="text-[#ffa116] font-semibold tracking-wide uppercase text-[10px]">Recognition Cues</span>
                    <ul className="list-disc pl-4 space-y-1 text-[#eff2f6]/80 leading-relaxed">
                      {category.recognition_cues.map((cue, i) => (
                        <li key={i}>{cue}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Common Combinations */}
                {category.common_combinations?.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <span className="text-[#ffa116] font-semibold tracking-wide uppercase text-[10px]">Common Combinations</span>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {category.common_combinations.map((comb, i) => (
                        <span key={i} className="px-2 py-1 rounded bg-[#1f1f1f] border border-[#3d3d3d]/50 text-[#aba9b0] text-[11px] font-medium leading-none">
                          {comb}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

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
