// Mastery score → color (Easy/Medium/Hard system)
export function masteryColor(score) {
  if (score >= 70) return "#00b8a3";
  if (score >= 40) return "#ffc01e";
  return "#ff375f";
}

// Difficulty → color
export function difficultyColor(diff) {
  if (diff === "Easy")   return "#00b8a3";
  if (diff === "Medium") return "#ffc01e";
  return "#ff375f";
}

// Relative time (e.g. "3 days ago")
export function timeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60)     return "just now";
  if (diff < 3600)   return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Get username from localStorage
export function getUsername() {
  return localStorage.getItem("lm_username") || "";
}
