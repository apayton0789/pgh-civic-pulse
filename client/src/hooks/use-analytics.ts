/**
 * Lightweight client-side analytics hook.
 * Generates a random session ID per tab, tracks page views and feature clicks.
 * Fires-and-forgets POST requests — no blocking, no error handling needed.
 */

import { useEffect, useRef } from "react";
import { useHashLocation } from "wouter/use-hash-location";

// Generate a random session ID per tab (persists across route changes but not page refreshes)
const SESSION_ID = Math.random().toString(36).slice(2) + Date.now().toString(36);

function sendEvent(endpoint: string, data: Record<string, string>): void {
  try {
    fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, sessionId: SESSION_ID }),
    }).catch(() => {}); // fire-and-forget
  } catch {
    // silently fail
  }
}

/** Track page view on route change */
export function usePageViewTracker(): void {
  const [location] = useHashLocation();
  const lastRoute = useRef("");

  useEffect(() => {
    const route = location || "/";
    if (route !== lastRoute.current) {
      lastRoute.current = route;
      sendEvent("/api/analytics/pageview", { route });
    }
  }, [location]);
}

/** Track a feature click */
export function trackFeature(feature: string): void {
  sendEvent("/api/analytics/event", { feature });
}
