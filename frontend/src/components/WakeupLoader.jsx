import React, { useState, useEffect } from "react";
import axios from "axios";
import { API_BASE_URL } from "../config";

const TIPS = [
  "Render's free tier spins down servers after 15 minutes of inactivity. Waking it up now...",
  "Starting the FastAPI ASGI app container...",
  "Securing SSL handshake and routing traffic...",
  "Establishing connections to serverless PostgreSQL (Neon)...",
  "Initializing Redis connection pool for rate limiting and cache...",
  "Loading 6,000+ company-wise interview questions...",
  "Parsing DSA curriculum mastery logic...",
  "Connecting nodes in the LeetMetrics ELO engine...",
  "Almost there! Preparing your analytics dashboard..."
];

export default function WakeupLoader({ children }) {
  const [isAwake, setIsAwake] = useState(false);
  const [fadeAway, setFadeAway] = useState(false);
  const [progress, setProgress] = useState(0);
  const [tipIndex, setTipIndex] = useState(0);
  const [errorCount, setErrorCount] = useState(0);

  // 1. Fake progressive loader bar
  useEffect(() => {
    if (isAwake) {
      setProgress(100);
      return;
    }

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 96) return prev; // Hold at 96% until awake
        let diff = 1.2;
        if (prev > 30) diff = 0.6;
        if (prev > 60) diff = 0.2;
        if (prev > 85) diff = 0.05;
        return Math.min(prev + diff, 96);
      });
    }, 100);

    return () => clearInterval(timer);
  }, [isAwake]);

  // 2. Cycle through tips
  useEffect(() => {
    if (isAwake) return;
    const interval = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % TIPS.length);
    }, 4500);
    return () => clearInterval(interval);
  }, [isAwake]);

  // 3. Ping the backend health check
  useEffect(() => {
    let isActive = true;
    let failCount = 0;

    const ping = async () => {
      try {
        // Ping the root endpoint which is lightweight
        const response = await axios.get(API_BASE_URL, { timeout: 3000 });
        if (response.status === 200 && isActive) {
          setIsAwake(true);
          // Smooth exit transition
          setTimeout(() => {
            if (isActive) setFadeAway(true);
          }, 600);
        }
      } catch (err) {
        if (isActive) {
          failCount++;
          setErrorCount(failCount);
          // Retry every 2.5 seconds
          setTimeout(ping, 2500);
        }
      }
    };

    ping();

    return () => {
      isActive = false;
    };
  }, []);

  if (fadeAway) {
    return children;
  }

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#0a0a0a] text-white selection:bg-[#ffa116]/30 transition-opacity duration-700 ease-in-out ${
        isAwake ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
    >
      {/* Background ambient mesh */}
      <div className="absolute inset-0 z-0 pointer-events-none bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-[#ffa116]/8 via-transparent to-transparent opacity-80" />

      <div className="relative z-10 flex flex-col items-center max-w-md w-full px-6 text-center gap-8">
        {/* Pulsing Logo */}
        <div className="flex items-center gap-3 animate-pulse">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#ffa116]/20 to-transparent border border-[#ffa116]/30 flex items-center justify-center shadow-[0_0_20px_rgba(255,161,22,0.2)]">
            <svg width="20" height="20" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="1" y="9" width="3" height="6" rx="0.75" fill="#ffa116" opacity="0.5" />
              <rect x="5.5" y="5.5" width="3" height="9.5" rx="0.75" fill="#ffa116" opacity="0.75" />
              <rect x="10" y="2" width="3" height="13" rx="0.75" fill="#ffa116" />
              <line x1="0.5" y1="15.25" x2="13.5" y2="15.25" stroke="#ffa116" strokeWidth="1" strokeLinecap="round" opacity="0.4" />
              <circle cx="11.5" cy="1.5" r="1" fill="#ffa116" />
            </svg>
          </div>
          <span className="font-display font-extrabold text-white text-2xl tracking-tight">
            Leet<span className="text-[#ffa116] drop-shadow-[0_0_8px_rgba(255,161,22,0.4)]">Metrics</span>
          </span>
        </div>

        {/* Text status */}
        <div className="flex flex-col gap-2">
          <h2 className="text-white font-bold text-lg tracking-tight">
            {isAwake ? "Server Connected!" : "Waking up Server..."}
          </h2>
          <p className="text-[#8c8c8c] text-xs leading-relaxed min-h-[36px] flex items-center justify-center px-4">
            {TIPS[tipIndex]}
          </p>
        </div>

        {/* Fake Progressive Loading Bar */}
        <div className="w-full">
          <div className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden border border-white/5 relative">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#ffa116] to-[#ffb347] transition-all duration-300 relative shadow-[0_0_10px_rgba(255,161,22,0.5)]"
              style={{ width: `${progress}%` }}
            >
              {/* Shine effect */}
              <div className="absolute top-0 inset-x-0 h-1/2 bg-white/20 rounded-full" />
            </div>
          </div>
          <div className="flex justify-between items-center mt-2.5 text-[10px] font-mono text-[#6b6b6b] font-bold uppercase tracking-wider">
            <span>{isAwake ? "Ready" : `Attempting connection...`}</span>
            <span>{Math.round(progress)}%</span>
          </div>
        </div>

        {/* Connection status indicator */}
        {errorCount > 0 && !isAwake && (
          <div className="text-[10px] text-[#ffa116]/60 font-medium font-mono border border-[#ffa116]/10 bg-[#ffa116]/5 px-3 py-1.5 rounded-full animate-fade-in">
            Failed attempts: {errorCount} • Retrying...
          </div>
        )}
      </div>
    </div>
  );
}
