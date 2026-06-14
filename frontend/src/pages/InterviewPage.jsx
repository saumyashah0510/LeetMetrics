import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import AppLayout from "../components/AppLayout";
import { getCompanies, getCompanyQuestions } from "../api";
import { getUsername, difficultyColor } from "../utils";

const FEATURED_COMPANIES = ["Google", "Meta", "Amazon", "Microsoft", "Apple", "Netflix", "Uber", "Bloomberg"];

/* ─── Company Initials Generator ────────────────────────────────── */
function getCompanyInitials(name) {
  if (!name) return "";
  return name
    .split("-")
    .map(word => word[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();
}

/* ─── Company Hashed Colors ────────────────────────────────────── */
function getCompanyColorHash(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash) % 360;
  return `hsla(${h}, 70%, 55%, 0.15)`;
}

/* ─── Company Logo Component ───────────────────────────────────── */
function CompanyLogo({ name, size = 20 }) {
  const logos = {
    Google: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
      </svg>
    ),
    Meta: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M16.89 4.11a5.61 5.61 0 0 0-7.93 0L3.11 9.94a5.61 5.61 0 0 0 0 7.93 5.61 5.61 0 0 0 7.93 0l2.36-2.36 1.15 1.15-2.36 2.36a7.24 7.24 0 0 1-10.23 0 7.24 7.24 0 0 1 0-10.23l5.85-5.85a7.24 7.24 0 0 1 10.23 0 7.24 7.24 0 0 1 0 10.23l-2.92 2.92a1.76 1.76 0 0 1-2.49 0l-.82-.82a1.76 1.76 0 0 1 0-2.49l2.92-2.92a3.98 3.98 0 0 0 0-5.63 3.98 3.98 0 0 0-5.63 0L7.1 12.33a3.98 3.98 0 0 0 0 5.63c1.55 1.55 4.08 1.55 5.63 0l1.15-1.15a1.76 1.76 0 0 1 2.49 0c.69.69.69 1.8 0 2.49l-1.15 1.15c-3.11 3.11-8.15 3.11-11.26 0-3.11-3.11-3.11-8.15 0-11.26l5.85-5.85c3.11-3.11 8.15-3.11 11.26 0 3.11 3.11 3.11 8.15 0 11.26l-2.92 2.92a3.98 3.98 0 0 1-5.63 0l-.82-.82a3.98 3.98 0 0 1 0-5.63l2.92-2.92a5.61 5.61 0 0 1 7.93 0 5.61 5.61 0 0 1 0 7.93l-2.92 2.92c-.31.31-.31.83 0 1.15.31.31.83.31 1.15 0l2.92-2.92a7.24 7.24 0 0 0 0-10.23z" fill="#0668E1"/>
      </svg>
    ),
    Amazon: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M18.8 19.5c-3.1 2.2-7.8 3-11.6 3-4.2 0-8.1-1.3-11-3.8-.4-.3-.1-.9.4-.7 4.1 1.6 9.1 2.3 12.9 1.1 3.2-1 6.3-3.1 8.6-5.8.4-.4.9-.1.7.4z" fill="#FF9900"/>
        <path d="M18.7 14.5c-.2-.4-1.2-.2-1.7-.1-1.8.4-4.5.9-6.3.9-2.5 0-5.1-.6-5.1-3.4 0-1.8 1.1-2.9 2.7-3.3 2.1-.5 5.5-.3 7.6.2.2 0 .4-.1.4-.3V7c0-1.3-.4-2.8-2.2-2.8-1.5 0-2.8.9-3.1 2.3-.1.4-.4.6-.7.4L1.7 5.7c-.4-.2-.4-.7-.1-1 1.4-1.6 4-2.7 7.5-2.7 4.9 0 6.6 3.1 6.6 7.4v5.3c0 1 .4 1.5.8 2 .3.3.3.7 0 1-1 1.1-2.4 2.5-3.8 2.5-.5 0-.9-.3-.9-.9V17c-.7.9-2 1.6-3.7 1.6-3.2 0-5.6-2.1-5.6-5.5 0-3.9 3.2-5.3 7.9-5.3.7 0 1.3 0 2 .1V7.7c0-1.6-1.1-2.4-2.9-2.4-1.8 0-2.9 1-2.9 2.6V8c0 .3-.2.5-.5.5L2.3 8.3c-.3 0-.5-.3-.5-.5V7.4c0-3 2.4-5.4 6-5.4 4.5 0 6.9 2.4 6.9 6.2v6.3zm-3-4.2c-.4-.1-.9-.1-1.4-.1-2.7 0-4.6.6-4.6 2.8 0 1.6 1.1 2.4 2.6 2.4 1.9 0 3.2-1.1 3.4-2.7v-2.4z" fill="#FFF"/>
      </svg>
    ),
    Microsoft: (
      <svg width={size} height={size} viewBox="0 0 23 23" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="10.8" height="10.8" fill="#F25022"/>
        <rect x="12.2" width="10.8" height="10.8" fill="#7FBA00"/>
        <rect y="12.2" width="10.8" height="10.8" fill="#00A4EF"/>
        <rect x="12.2" y="12.2" width="10.8" height="10.8" fill="#FFB900"/>
      </svg>
    ),
    Apple: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className="text-white">
        <path d="M18.71 19.5C17.88 20.74 17 21.95 15.66 21.97C14.32 22 13.89 21.18 12.37 21.18C10.84 21.18 10.37 21.95 9.1 22C7.79 22.05 6.8 20.68 5.96 19.48C4.25 17 2.94 12.45 4.7 9.39C5.57 7.87 7.13 6.91 8.82 6.88C10.1 6.86 11.32 7.75 12.11 7.75C12.89 7.75 14.37 6.68 15.92 6.84C16.57 6.87 18.39 7.1 19.56 8.82C19.47 8.88 17.39 10.1 17.41 12.63C17.44 15.65 20.06 16.66 20.1 16.67C20.08 16.74 19.67 18.11 18.71 19.5M15.97 4.17C16.63 3.37 17.07 2.28 16.95 1C15.85 1.04 14.51 1.73 13.73 2.65C13.07 3.42 12.49 4.52 12.64 5.78C13.87 5.87 15.12 5.17 15.97 4.17Z"/>
      </svg>
    ),
    Netflix: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M5.1 2v20h3.8V10.5l6.3 11.5H19V2h-3.8v11.5L8.9 2H5.1z" fill="#E50914"/>
      </svg>
    ),
    Uber: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="2.5"/>
        <rect x="9" y="9" width="6" height="6" rx="1" fill="white"/>
      </svg>
    ),
    Bloomberg: (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="24" height="24" rx="4" fill="#0056B3"/>
        <text x="5" y="17" fill="white" fontFamily="sans-serif" fontWeight="900" fontSize="14">B</text>
      </svg>
    )
  };

  const logoKey = Object.keys(logos).find(k => k.toLowerCase() === name.toLowerCase());
  if (logoKey) return logos[logoKey];

  const initials = getCompanyInitials(name);
  const bg = getCompanyColorHash(name);
  const border = bg.replace("0.15", "0.35");
  const text = bg.replace("0.15", "0.95");

  return (
    <div
      className="rounded flex items-center justify-center font-bold text-[10px] tracking-wide border shrink-0 font-mono select-none"
      style={{
        width: size,
        height: size,
        backgroundColor: bg,
        borderColor: border,
        color: text
      }}
    >
      {initials}
    </div>
  );
}

/* ─── Skeleton Component ───────────────────────────────────────── */
function Skeleton({ className = "" }) {
  return <div className={`rounded bg-white/5 animate-pulse ${className}`} />;
}

/* ─── Importance Badge ─────────────────────────────────────────── */
function ImportanceBadge({ level }) {
  const styles = {
    "Most Frequent": "bg-[#ff375f]/10 border-[#ff375f]/20 text-[#ff375f]",
    "Important": "bg-[#ffa116]/10 border-[#ffa116]/20 text-[#ffa116]",
    "Regular": "bg-white/5 border-white/10 text-[#aba9b0]"
  };
  const style = styles[level] || styles["Regular"];
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${style}`}>
      {level}
    </span>
  );
}

/* ─── Difficulty Label ─────────────────────────────────────────── */
function DiffLabel({ diff }) {
  const color = difficultyColor(diff);
  return (
    <span className="text-[12px] font-semibold" style={{ color }}>
      {diff}
    </span>
  );
}

/* ─── Company Selector Card ────────────────────────────────────── */
function CompanyCard({ name, active, onClick }) {
  const borders = {
    Google: "hover:border-[#ea4335]/40 active:bg-[#ea4335]/5",
    Meta: "hover:border-[#0668e1]/40 active:bg-[#0668e1]/5",
    Amazon: "hover:border-[#ff9900]/40 active:bg-[#ff9900]/5",
    Microsoft: "hover:border-[#00a4ef]/40 active:bg-[#00a4ef]/5",
    Apple: "hover:border-white/40 active:bg-white/5",
    Netflix: "hover:border-[#e50914]/40 active:bg-[#e50914]/5",
    Uber: "hover:border-white/40 active:bg-white/5",
    Bloomberg: "hover:border-[#0056b3]/40 active:bg-[#0056b3]/5"
  };

  const activeStyles = {
    Google: "border-[#ea4335] bg-[#ea4335]/10 shadow-[#ea4335]/10",
    Meta: "border-[#0668e1] bg-[#0668e1]/10 shadow-[#0668e1]/10",
    Amazon: "border-[#ff9900] bg-[#ff9900]/10 shadow-[#ff9900]/10",
    Microsoft: "border-[#00a4ef] bg-[#00a4ef]/10 shadow-[#00a4ef]/10",
    Apple: "border-white bg-white/10 shadow-white/10",
    Netflix: "border-[#e50914] bg-[#e50914]/10 shadow-[#e50914]/10",
    Uber: "border-white bg-white/10 shadow-white/10",
    Bloomberg: "border-[#0056b3] bg-[#0056b3]/10 shadow-[#0056b3]/10"
  };

  const borderClass = active 
    ? (activeStyles[name] || "border-[#ffa116] bg-[#ffa116]/10 shadow-[#ffa116]/10") 
    : `border-[#3d3d3d]/50 bg-[#282828]/50 ${borders[name] || "hover:border-[#ffa116]/40 active:bg-white/5"}`;

  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-center gap-3 px-5 py-4 rounded-xl border transition-all duration-300 shadow-sm font-semibold text-[15px] cursor-pointer ${borderClass}`}
    >
      <CompanyLogo name={name} size={20} />
      <span className="text-white truncate">{name}</span>
    </button>
  );
}

/* ─── Category Accordion Component ─────────────────────────────── */
function CategoryAccordion({ category, searchQuery }) {
  const { category: categoryName, subtopics } = category;

  const filteredSubtopics = useMemo(() => {
    if (!searchQuery) return subtopics;
    const query = searchQuery.toLowerCase();
    return subtopics
      .map(sub => {
        const matchingQuestions = sub.questions.filter(
          q =>
            q.title.toLowerCase().includes(query) ||
            q.frontend_id.toString().includes(query) ||
            sub.pattern.toLowerCase().includes(query)
        );
        return { ...sub, questions: matchingQuestions };
      })
      .filter(sub => sub.questions.length > 0);
  }, [subtopics, searchQuery]);

  const stats = useMemo(() => {
    let total = 0;
    let solved = 0;
    filteredSubtopics.forEach(sub => {
      total += sub.questions.length;
      solved += sub.questions.filter(q => q.solved).length;
    });
    return { total, solved };
  }, [filteredSubtopics]);

  const [expanded, setExpanded] = useState(searchQuery.length > 0);

  React.useEffect(() => {
    if (searchQuery.length > 0 && stats.total > 0) {
      setExpanded(true);
    }
  }, [searchQuery, stats.total]);

  if (stats.total === 0) return null;

  const pct = stats.total > 0 ? (stats.solved / stats.total) * 100 : 0;

  return (
    <div className="border border-[#3d3d3d]/50 bg-[#282828] rounded-xl overflow-hidden mb-4 transition-all">
      {/* Header */}
      <div
        className="flex flex-col sm:flex-row sm:items-center justify-between p-5 hover:bg-[#333333] cursor-pointer transition-colors gap-4"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h3 className="text-white font-bold text-[16px]">{categoryName}</h3>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#333333] border border-[#3d3d3d] text-[#ffa116]">
              {stats.solved} / {stats.total} Solved
            </span>
          </div>
          <div className="w-full max-w-xs h-1 bg-[#3e3e3e] rounded-full overflow-hidden mt-2">
            <div
              className="h-full rounded-full bg-[#ffa116] transition-all duration-500"
              style={{ width: `${pct}%` }}
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

      {/* Expanded Table */}
      {expanded && (
        <div className="bg-[#1f1f1f] border-t border-[#3d3d3d]/50 p-5 flex flex-col gap-6">
          {filteredSubtopics.map(sub => (
            <div key={sub.pattern} className="flex flex-col gap-3">
              <div className="flex items-center justify-between border-b border-[#3d3d3d]/30 pb-2">
                <span className="text-white/70 text-xs font-bold uppercase tracking-wider">
                  {sub.pattern}
                </span>
                <span className="text-[#6b6b6b] text-[11px]">
                  {sub.questions.filter(q => q.solved).length} / {sub.questions.length} solved
                </span>
              </div>

              <div className="flex flex-col gap-2">
                {sub.questions.map(q => (
                  <a
                    key={q.url_name}
                    href={`https://leetcode.com/problems/${q.url_name}/`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-3 px-4 rounded-lg bg-[#282828] border border-[#3d3d3d]/40 hover:border-[#ffa116]/40 transition-colors group gap-3 cursor-pointer"
                  >
                    {/* ID & Title */}
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="pt-0.5 shrink-0">
                        {q.solved ? (
                          <div className="w-4 h-4 rounded-full bg-[#00b8a3]/20 flex items-center justify-center border border-[#00b8a3]/30">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#00b8a3" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </div>
                        ) : (
                          <div className="w-4 h-4 rounded-full border border-[#4d4d4d] group-hover:border-[#ffa116]/40 transition-colors" />
                        )}
                      </div>

                      <span className="text-[#6b6b6b] text-[13px] font-mono shrink-0 w-8 text-right">
                        {q.frontend_id}.
                      </span>

                      <span
                        className={`text-[14px] font-medium group-hover:text-[#ffa116] transition-colors truncate ${
                          q.solved ? "text-[#8c8c8c] line-through decoration-[#8c8c8c]/50" : "text-[#eff2f6]"
                        }`}
                      >
                        {q.title}
                      </span>
                    </div>

                    {/* Stats & Badges */}
                    <div className="flex items-center gap-4 shrink-0 pl-7 sm:pl-0 justify-between sm:justify-end">
                      <div className="flex items-center gap-2" title={`Frequency score: ${q.frequency.toFixed(1)}%`}>
                        <span className="text-[#8c8c8c] text-[11px] tabular-nums">
                          {Math.round(q.frequency)}% Freq
                        </span>
                        <div className="w-12 h-1.5 bg-[#3d3d3d] rounded-full overflow-hidden hidden xs:block">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-[#ffa116]/60 to-[#ffa116]"
                            style={{ width: `${Math.min(q.frequency, 100)}%` }}
                          />
                        </div>
                      </div>

                      <ImportanceBadge level={q.importance} />

                      <div className="w-16 text-right">
                        <DiffLabel diff={q.difficulty} />
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Interview Prep Page Component ────────────────────────────── */
export default function InterviewPage() {
  const navigate = useNavigate();
  const username = getUsername();

  React.useEffect(() => {
    if (!username) navigate("/", { replace: true });
  }, [username, navigate]);

  // States
  const [selectedCompany, setSelectedCompany] = useState("Google");
  const [selectedTimeframe, setSelectedTimeframe] = useState("6-months");
  const [searchQuery, setSearchQuery] = useState("");
  const [companySearch, setCompanySearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [companySort, setCompanySort] = useState("alphabetical"); // "alphabetical" or "importance"

  // Query Companies List
  const { data: companies = [] } = useQuery({
    queryKey: ["companies_list"],
    queryFn: () => getCompanies().then(r => r.data),
    staleTime: 60 * 60 * 1000 // 1 hour caching
  });

  // Normalize companies safely to handle both old cache (strings) and new API (objects)
  const normalizedCompanies = useMemo(() => {
    if (!companies) return [];
    return companies.map(c => {
      if (typeof c === "string") {
        return { name: c, count: 0 };
      }
      return { name: c?.name || "", count: c?.count || 0 };
    });
  }, [companies]);

  // Categorize Featured vs Others
  const featured = useMemo(() => {
    const lowerCompanies = new Set(normalizedCompanies.map(c => c.name.toLowerCase()));
    return FEATURED_COMPANIES.filter(fc => lowerCompanies.has(fc.toLowerCase()));
  }, [normalizedCompanies]);

  const others = useMemo(() => {
    const featuredSet = new Set(FEATURED_COMPANIES.map(fc => fc.toLowerCase()));
    return normalizedCompanies.filter(c => !featuredSet.has(c.name.toLowerCase()));
  }, [normalizedCompanies]);

  // Sort other targets based on user preference
  const sortedOthers = useMemo(() => {
    const list = [...others];
    if (companySort === "importance") {
      return list.sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return a.name.localeCompare(b.name);
      });
    } else {
      return list.sort((a, b) => a.name.localeCompare(b.name));
    }
  }, [others, companySort]);

  // Filter dropdown matches
  const filteredOthers = useMemo(() => {
    const q = companySearch.toLowerCase().trim();
    if (!q) return sortedOthers;
    return sortedOthers.filter(c => c.name.toLowerCase().includes(q));
  }, [sortedOthers, companySearch]);

  const isOtherActive = useMemo(() => {
    return !FEATURED_COMPANIES.map(fc => fc.toLowerCase()).includes(selectedCompany.toLowerCase());
  }, [selectedCompany]);

  // Query Company Questions
  const { data: companyQuestions, isLoading } = useQuery({
    queryKey: ["company_questions", selectedCompany, selectedTimeframe, username],
    queryFn: () => getCompanyQuestions(selectedCompany, selectedTimeframe, username).then(r => r.data),
    enabled: !!username && !!selectedCompany && !!selectedTimeframe
  });

  const stats = companyQuestions?.stats;
  const categories = companyQuestions?.categories || [];

  return (
    <AppLayout>
      <div className="bg-[#1a1a1a] min-h-[calc(100vh-56px)] selection:bg-[#ffa116]/30">
        <div className="max-w-[1000px] w-full mx-auto px-6 py-8 flex flex-col gap-8">
          
          {/* Header */}
          <div className="flex flex-col gap-2 pb-4 border-b border-[#3d3d3d]/50">
            <h1 className="text-white font-bold text-2xl tracking-tight">Company Interview Prep</h1>
            <p className="text-[#8c8c8c] text-sm">
              Study the most frequent and important LeetCode questions asked by tech giants, grouped contextually by DSA patterns.
            </p>
          </div>

          {/* Selector Dashboard Container */}
          <div className="relative z-20 flex flex-col gap-5 bg-[#282828]/20 border border-white/5 rounded-2xl p-6 backdrop-blur-xl">
            {/* Featured Grid */}
            <div className="flex flex-col gap-3">
              <span className="text-[#8c8c8c] text-[11px] font-bold uppercase tracking-wider">
                Featured Targets
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {featured.map(comp => (
                  <CompanyCard
                    key={comp}
                    name={comp}
                    active={selectedCompany.toLowerCase() === comp.toLowerCase()}
                    onClick={() => {
                      setSelectedCompany(comp);
                      setCompanySearch("");
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Other Targets & Active Selection Indicator */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-t border-[#3d3d3d]/30 pt-4 gap-4">
              {/* Search Dropdown Selector */}
              <div className="flex items-center gap-3 relative flex-1 max-w-md">
                <span className="text-[#8c8c8c] text-[11px] font-bold uppercase tracking-wider whitespace-nowrap">
                  All Other Targets:
                </span>
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={companySearch}
                    onFocus={() => setShowDropdown(true)}
                    onChange={(e) => {
                      setCompanySearch(e.target.value);
                      setShowDropdown(true);
                    }}
                    placeholder={`Search ${others.length}+ companies...`}
                    className="w-full bg-[#1f1f1f] border border-[#3d3d3d]/60 rounded-lg pl-3 pr-8 py-2 text-sm text-[#eff2f6] placeholder-[#6b6b6b] focus:outline-none focus:border-[#ffa116]/50 transition-colors"
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-[#6b6b6b]">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
                  </div>

                  {showDropdown && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowDropdown(false)} />
                      <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-[#1f1f1f] border border-[#3d3d3d] rounded-lg shadow-2xl p-1 custom-scrollbar flex flex-col w-full">
                        {/* Sort Options Bar */}
                        <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-[#3d3d3d]/50 mb-1 shrink-0 text-[10px] font-bold text-[#8c8c8c]">
                          <span>SORT BY</span>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setCompanySort("alphabetical");
                              }}
                              className={`px-1.5 py-0.5 rounded cursor-pointer transition-colors ${
                                companySort === "alphabetical"
                                  ? "bg-[#ffa116]/10 text-[#ffa116]"
                                  : "hover:text-white"
                              }`}
                            >
                              A-Z
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setCompanySort("importance");
                              }}
                              className={`px-1.5 py-0.5 rounded cursor-pointer transition-colors ${
                                companySort === "importance"
                                  ? "bg-[#ffa116]/10 text-[#ffa116]"
                                  : "hover:text-white"
                              }`}
                            >
                              Most Important
                            </button>
                          </div>
                        </div>

                        {/* List Items Scrollable Area */}
                        <div className="max-h-56 overflow-y-auto w-full custom-scrollbar flex flex-col">
                          {filteredOthers.map(c => (
                            <button
                              key={c.name}
                              onClick={() => {
                                setSelectedCompany(c.name);
                                setCompanySearch("");
                                setShowDropdown(false);
                              }}
                              className={`w-full text-left px-3 py-2 text-xs rounded transition-colors flex items-center justify-between cursor-pointer ${
                                selectedCompany.toLowerCase() === c.name.toLowerCase()
                                  ? "bg-[#ffa116]/10 text-[#ffa116]"
                                  : "text-[#aba9b0] hover:text-white hover:bg-white/5"
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <CompanyLogo name={c.name} size={14} />
                                <span className="truncate">{c.name}</span>
                              </div>
                              <span className="text-[10px] text-[#6b6b6b] font-mono shrink-0">
                                {c.count} Qs
                              </span>
                            </button>
                          ))}
                          {filteredOthers.length === 0 && (
                            <div className="text-[#6b6b6b] text-xs px-3 py-2 text-center">No matches found</div>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Active Non-Featured Badge */}
              {isOtherActive && (
                <div className="flex items-center gap-2 bg-[#ffa116]/10 border border-[#ffa116]/20 px-3 py-2 rounded-lg text-sm font-semibold text-white w-fit animate-fade-in">
                  <span className="text-[#8c8c8c] text-xs font-normal">Active:</span>
                  <CompanyLogo name={selectedCompany} size={16} />
                  <span>{selectedCompany}</span>
                  <button 
                    onClick={() => setSelectedCompany("Google")}
                    className="ml-1.5 p-0.5 rounded-full hover:bg-white/5 text-[#ffa116] hover:text-white transition-colors cursor-pointer"
                    title="Reset to Google"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Timeframe & Question Search Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#282828]/30 border border-white/5 rounded-2xl p-4 backdrop-blur-xl">
            {/* Timeframe tabs */}
            <div className="flex items-center bg-[#1f1f1f] p-1 rounded-lg border border-[#3d3d3d]/60 w-fit">
              {[
                { value: "30-days", label: "Last 30 Days" },
                { value: "3-months", label: "Last 3 Months" },
                { value: "6-months", label: "Last 6 Months" }
              ].map(tf => (
                <button
                  key={tf.value}
                  onClick={() => setSelectedTimeframe(tf.value)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                    selectedTimeframe === tf.value
                      ? "bg-[#ffa116] text-[#0a0a0a]"
                      : "text-[#aba9b0] hover:text-white"
                  }`}
                >
                  {tf.label}
                </button>
              ))}
            </div>

            {/* Questions Search Input */}
            <div className="relative flex-1 md:max-w-md">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#6b6b6b]">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search questions by title, ID or subtopic..."
                className="w-full bg-[#1f1f1f] border border-[#3d3d3d]/60 rounded-lg pl-9 pr-8 py-2 text-sm text-[#eff2f6] placeholder-[#6b6b6b] focus:outline-none focus:border-[#ffa116]/50 transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-[#6b6b6b] hover:text-white transition-colors cursor-pointer"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Loading / Content State */}
          {isLoading ? (
            <div className="flex flex-col gap-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map(i => (
                  <Skeleton key={i} className="h-24 w-full" />
                ))}
              </div>
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : (
            <>
              {/* Overall Statistics Panel */}
              {stats && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 animate-fade-in">
                  <div className="bg-[#282828] border border-[#3d3d3d]/50 rounded-xl p-5 flex flex-col justify-between h-24 shadow-md">
                    <span className="text-[#8c8c8c] text-[11px] font-bold uppercase tracking-wider">
                      Overall Progress
                    </span>
                    <div className="flex items-baseline justify-between mt-1">
                      <span className="text-white text-[22px] font-bold tabular-nums">
                        {stats.solved} <span className="text-[#6b6b6b] text-base font-medium">/ {stats.total}</span>
                      </span>
                      <span className="text-[#ffa116] text-[13px] font-bold tabular-nums">
                        {stats.total > 0 ? ((stats.solved / stats.total) * 100).toFixed(1) : "0.0"}%
                      </span>
                    </div>
                  </div>

                  <div className="bg-[#282828] border border-[#3d3d3d]/50 rounded-xl p-5 flex flex-col justify-between h-24 shadow-md">
                    <span className="text-[#8c8c8c] text-[11px] font-bold uppercase tracking-wider">
                      Easy Questions
                    </span>
                    <div className="flex items-baseline justify-between mt-1">
                      <span className="text-white text-[22px] font-bold tabular-nums">
                        {stats.by_difficulty?.Easy?.solved || 0}{" "}
                        <span className="text-[#6b6b6b] text-base font-medium">
                          / {stats.by_difficulty?.Easy?.total || 0}
                        </span>
                      </span>
                      <span className="text-[#00b8a3] text-[13px] font-semibold">
                        Easy
                      </span>
                    </div>
                  </div>

                  <div className="bg-[#282828] border border-[#3d3d3d]/50 rounded-xl p-5 flex flex-col justify-between h-24 shadow-md">
                    <span className="text-[#8c8c8c] text-[11px] font-bold uppercase tracking-wider">
                      Medium Questions
                    </span>
                    <div className="flex items-baseline justify-between mt-1">
                      <span className="text-white text-[22px] font-bold tabular-nums">
                        {stats.by_difficulty?.Medium?.solved || 0}{" "}
                        <span className="text-[#6b6b6b] text-base font-medium">
                          / {stats.by_difficulty?.Medium?.total || 0}
                        </span>
                      </span>
                      <span className="text-[#ffc01e] text-[13px] font-semibold">
                        Medium
                      </span>
                    </div>
                  </div>

                  <div className="bg-[#282828] border border-[#3d3d3d]/50 rounded-xl p-5 flex flex-col justify-between h-24 shadow-md">
                    <span className="text-[#8c8c8c] text-[11px] font-bold uppercase tracking-wider">
                      Hard Questions
                    </span>
                    <div className="flex items-baseline justify-between mt-1">
                      <span className="text-white text-[22px] font-bold tabular-nums">
                        {stats.by_difficulty?.Hard?.solved || 0}{" "}
                        <span className="text-[#6b6b6b] text-base font-medium">
                          / {stats.by_difficulty?.Hard?.total || 0}
                        </span>
                      </span>
                      <span className="text-[#ff375f] text-[13px] font-semibold">
                        Hard
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Accordions List */}
              <div className="flex flex-col mt-2">
                {categories.map(category => (
                  <CategoryAccordion
                    key={category.category}
                    category={category}
                    searchQuery={searchQuery}
                  />
                ))}

                {categories.length === 0 && (
                  <div className="py-20 text-center">
                    <div className="w-16 h-16 rounded-full bg-[#282828] flex items-center justify-center mx-auto mb-4 border border-[#3d3d3d]/50">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6b6b6b" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                    </div>
                    <h3 className="text-white font-medium text-lg mb-1">No Questions Found</h3>
                    <p className="text-[#aba9b0] text-sm">
                      There are no questions matching your current filters or search query for {selectedCompany}.
                    </p>
                  </div>
                )}
              </div>
            </>
          )}

        </div>
      </div>
    </AppLayout>
  );
}
