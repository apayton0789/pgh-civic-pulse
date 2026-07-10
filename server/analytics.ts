/**
 * Lightweight usage analytics — zero external deps, in-memory with periodic disk persistence.
 * Tracks page views, feature clicks, and session counts.
 * No PII collected — only aggregate counts and timestamps.
 */

import fs from "fs";
import path from "path";

interface DailyStats {
  date: string; // YYYY-MM-DD
  pageViews: Record<string, number>;      // route -> count
  featureClicks: Record<string, number>;   // feature_name -> count
  uniqueSessions: number;
  totalEvents: number;
}

interface AnalyticsStore {
  days: Record<string, DailyStats>;
  sessionIds: Set<string>;           // tracked per day (cleared at midnight)
  currentDate: string;
  totalLifetimePageViews: number;
  totalLifetimeSessions: number;
  suggestions: Array<{
    text: string;
    category: string;
    timestamp: string;
  }>;
}

const DATA_PATH = path.join(process.cwd(), "analytics_data.json");

const store: AnalyticsStore = {
  days: {},
  sessionIds: new Set(),
  currentDate: todayStr(),
  totalLifetimePageViews: 0,
  totalLifetimeSessions: 0,
  suggestions: [],
};

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

function ensureDay(date: string): DailyStats {
  if (!store.days[date]) {
    store.days[date] = {
      date,
      pageViews: {},
      featureClicks: {},
      uniqueSessions: 0,
      totalEvents: 0,
    };
  }
  // Reset session tracking at midnight
  if (date !== store.currentDate) {
    store.sessionIds = new Set();
    store.currentDate = date;
  }
  return store.days[date];
}

/** Track a page view */
export function trackPageView(route: string, sessionId: string): void {
  const today = todayStr();
  const day = ensureDay(today);
  day.pageViews[route] = (day.pageViews[route] || 0) + 1;
  day.totalEvents++;
  store.totalLifetimePageViews++;

  if (!store.sessionIds.has(sessionId)) {
    store.sessionIds.add(sessionId);
    day.uniqueSessions++;
    store.totalLifetimeSessions++;
  }
}

/** Track a feature click (e.g., "share_meeting", "download_ics", "open_detail") */
export function trackFeatureClick(feature: string, sessionId: string): void {
  const today = todayStr();
  const day = ensureDay(today);
  day.featureClicks[feature] = (day.featureClicks[feature] || 0) + 1;
  day.totalEvents++;

  if (!store.sessionIds.has(sessionId)) {
    store.sessionIds.add(sessionId);
    day.uniqueSessions++;
    store.totalLifetimeSessions++;
  }
}

/** Submit a user suggestion */
export function addSuggestion(text: string, category: string): void {
  store.suggestions.push({
    text: text.slice(0, 1000), // limit length
    category,
    timestamp: new Date().toISOString(),
  });
  // Keep at most 500 suggestions in memory
  if (store.suggestions.length > 500) {
    store.suggestions = store.suggestions.slice(-500);
  }
  persistToDisk();
}

/** Get analytics summary */
export function getAnalyticsSummary(): {
  today: DailyStats | null;
  last7Days: DailyStats[];
  lifetime: { pageViews: number; sessions: number };
  topPages: Array<[string, number]>;
  topFeatures: Array<[string, number]>;
  suggestionCount: number;
} {
  const today = todayStr();
  const todayStats = store.days[today] || null;

  // Last 7 days
  const last7: DailyStats[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split("T")[0];
    if (store.days[key]) last7.push(store.days[key]);
  }

  // Aggregate top pages and features across all time
  const allPages: Record<string, number> = {};
  const allFeatures: Record<string, number> = {};
  for (const day of Object.values(store.days)) {
    for (const [route, count] of Object.entries(day.pageViews)) {
      allPages[route] = (allPages[route] || 0) + count;
    }
    for (const [feat, count] of Object.entries(day.featureClicks)) {
      allFeatures[feat] = (allFeatures[feat] || 0) + count;
    }
  }

  const topPages = Object.entries(allPages).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const topFeatures = Object.entries(allFeatures).sort((a, b) => b[1] - a[1]).slice(0, 10);

  return {
    today: todayStats,
    last7Days: last7,
    lifetime: {
      pageViews: store.totalLifetimePageViews,
      sessions: store.totalLifetimeSessions,
    },
    topPages,
    topFeatures,
    suggestionCount: store.suggestions.length,
  };
}

/** Get all suggestions */
export function getSuggestions(): typeof store.suggestions {
  return [...store.suggestions].reverse(); // newest first
}

/** Persist to disk (best-effort, non-blocking) */
function persistToDisk(): void {
  try {
    const data = {
      days: store.days,
      totalLifetimePageViews: store.totalLifetimePageViews,
      totalLifetimeSessions: store.totalLifetimeSessions,
      suggestions: store.suggestions,
    };
    fs.writeFileSync(DATA_PATH, JSON.stringify(data), "utf-8");
  } catch {
    // Silently fail — analytics persistence is best-effort
  }
}

/** Load from disk on startup */
export function loadAnalytics(): void {
  try {
    if (fs.existsSync(DATA_PATH)) {
      const raw = JSON.parse(fs.readFileSync(DATA_PATH, "utf-8"));
      store.days = raw.days || {};
      store.totalLifetimePageViews = raw.totalLifetimePageViews || 0;
      store.totalLifetimeSessions = raw.totalLifetimeSessions || 0;
      store.suggestions = raw.suggestions || [];
      console.log(`[Analytics] Loaded ${Object.keys(store.days).length} days of data, ${store.suggestions.length} suggestions`);
    }
  } catch {
    console.log("[Analytics] No prior data found, starting fresh");
  }
}

// Persist every 5 minutes
setInterval(persistToDisk, 5 * 60 * 1000);
