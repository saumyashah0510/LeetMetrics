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

// Dashboard
export const getDashboard = (username) =>
  api.get("/api/dashboard", { params: { username } });

// Mastery
export const getAllMastery = (username) =>
  api.get("/api/mastery", { params: { username } });

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
export const getContestSummary = (username) =>
  api.get("/api/contests/summary", { params: { username } });

export const getContests = (username) =>
  api.get("/api/contests", { params: { username } });
