import axios from "axios";
import { API_BASE_URL } from "./config";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

// Auth / Sync
export const checkHealth = (username, session_cookie) =>
  api.post("/api/health", { username, session_cookie });

export const triggerSync = (username, session_cookie) =>
  api.post("/api/sync", { username, session_cookie });

export const getSyncStatus = (username) =>
  api.get("/api/sync/status", { params: { username } });

// Dashboard
export const getDashboard = (username) => api.get("/api/dashboard", { params: { username } });
export const getContestSummary = (username) => api.get("/api/contests/summary", { params: { username } });
export const getAllMastery = (username) => api.get("/api/mastery", { params: { username } });
export const getCurriculum = (username) => api.get(`/api/curriculum/${username}`);

export const getCategoryMastery = (category, username) =>
  api.get(`/api/mastery/${encodeURIComponent(category)}`, {
    params: { username },
  });

// Topics
export const getTopics = (username) =>
  api.get("/api/topics", { params: { username } });

export const getUnsolvedInPattern = (patternId, username) =>
  api.get(`/api/topics/${patternId}`, { params: { username } });

// Study Plan
export const getStudyPlan = (username) =>
  api.get("/api/study-plan", { params: { username } });

// Contests

export const getContests = (username) =>
  api.get("/api/contests", { params: { username } });

// Companies / Interview Prep
export const getCompanies = () => api.get("/api/companies");
export const getCompanyQuestions = (companyName, timeframe, username) =>
  api.get(`/api/companies/${encodeURIComponent(companyName)}`, {
    params: { timeframe, username }
  });
