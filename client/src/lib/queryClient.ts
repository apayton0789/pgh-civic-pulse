import { QueryClient, QueryFunction } from "@tanstack/react-query";
import type { AddressLocation, Meeting, NewsItem, Development } from "@shared/schema";

/**
 * Static-site data layer.
 *
 * This app used to be a fullstack Node/Express + React app that hit `/api/*`
 * REST endpoints. It's now a static site on GitHub Pages: all data is
 * pre-generated as JSON files under `client/public/data/` by
 * `scripts/generate-data.ts` (run via a GitHub Actions workflow).
 *
 * To avoid rewriting every page/component that calls `apiRequest("GET", "/api/...")`
 * or uses `useQuery({ queryKey: ["/api/..."] })`, we keep the same call sites but
 * resolve each API-shaped path to the corresponding static JSON file, relative to
 * the Vite base path (so it works at `/pgh-civic-pulse/` on GitHub Pages as well
 * as locally).
 */

// Vite injects import.meta.env.BASE_URL based on the `base` config option.
// Falls back to "./" for safety if not running under Vite.
const BASE_URL: string = (import.meta as any)?.env?.BASE_URL ?? "./";

function dataUrl(file: string): string {
  const base = BASE_URL.endsWith("/") ? BASE_URL : `${BASE_URL}/`;
  return `${base}data/${file}`;
}

/** Map an /api/* path (with optional params already substituted) to a static JSON file. */
function resolveStaticFile(apiPath: string): string | null {
  const path = apiPath.split("?")[0];

  const exact: Record<string, string> = {
    "/api/briefing/items": "briefing-items.json",
    "/api/briefing/changed": "briefing-changed.json",
    "/api/briefing/feedback": "briefing-feedback.json",
    "/api/sources": "sources.json",
    "/api/meetings": "meetings.json",
    "/api/news": "news.json",
    "/api/developments": "developments.json",
    "/api/upcoming-meetings": "upcoming-meetings.json",
    "/api/upcoming": "upcoming-meetings.json",
    "/api/engagement": "engagement.json",
    "/api/commissions": "commissions.json",
    "/api/state-radar": "state_radar.json",
    "/api/feed-status": "generated-at.json",
  };

  if (exact[path]) return exact[path];

  // /api/meetings/:id/transcript -> transcript is embedded inline in meetings.json;
  // handled specially in getQueryFn/apiRequest below, not via a direct file map.
  return null;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

/** Cache of fetched static JSON files, keyed by resolved URL, to avoid refetching. */
const staticCache = new Map<string, Promise<any>>();

async function fetchStaticJson(file: string): Promise<any> {
  const url = dataUrl(file);
  if (!staticCache.has(url)) {
    staticCache.set(
      url,
      fetch(url).then(async (res) => {
        await throwIfResNotOk(res);
        return res.json();
      })
    );
  }
  return staticCache.get(url)!;
}

/**
 * Compute the geo-activity aggregation client-side (used to be /api/geo-activity).
 * Mirrors the logic previously in server/routes.ts.
 */
async function getGeoActivity() {
  const [meetings, news, developments]: [Meeting[], NewsItem[], Development[]] = await Promise.all([
    fetchStaticJson("meetings.json"),
    fetchStaticJson("news.json"),
    fetchStaticJson("developments.json"),
  ]);

  const activityMap: Record<string, { count: number; items: Array<{ title: string; type: string; date: string; source: string }> }> = {};

  for (const m of meetings) {
    for (const tag of m.geographicTags || []) {
      const key = tag.toLowerCase().trim();
      if (!activityMap[key]) activityMap[key] = { count: 0, items: [] };
      activityMap[key].count++;
      activityMap[key].items.push({
        title: m.title,
        type: "meeting",
        date: m.date,
        source: m.governingBody,
      });
    }
  }

  for (const n of news) {
    for (const tag of n.geographicTags || []) {
      const key = tag.toLowerCase().trim();
      if (!activityMap[key]) activityMap[key] = { count: 0, items: [] };
      activityMap[key].count++;
      activityMap[key].items.push({
        title: n.headline,
        type: "news",
        date: n.date,
        source: n.source,
      });
    }
  }

  for (const d of developments) {
    for (const tag of d.geographicTags || []) {
      const key = tag.toLowerCase().trim();
      if (!activityMap[key]) activityMap[key] = { count: 0, items: [] };
      activityMap[key].count++;
      activityMap[key].items.push({
        title: d.title,
        type: "development",
        date: d.commentDeadline || "",
        source: d.source || "Development",
      });
    }
  }

  for (const key of Object.keys(activityMap)) {
    activityMap[key].items.sort((a, b) => b.date.localeCompare(a.date));
    activityMap[key].items = activityMap[key].items.slice(0, 5);
  }

  const markers: Array<{
    lat: number;
    lon: number;
    address: string;
    neighborhood: string;
    title: string;
    type: string;
    meetingId?: number;
  }> = [];

  for (const m of meetings) {
    const locs = (m.addressLocations as AddressLocation[] | null) || [];
    for (const loc of locs) {
      if (loc.lat && loc.lon) {
        markers.push({
          lat: loc.lat,
          lon: loc.lon,
          address: loc.address,
          neighborhood: loc.neighborhood || "",
          title: m.title,
          type: "meeting",
          meetingId: m.id,
        });
      }
    }
  }

  return { activity: activityMap, markers };
}

/**
 * apiRequest — kept for backward compatibility with call sites written for the
 * old Express API. GET requests are redirected to static JSON files. POST/PUT/etc.
 * requests that used to hit removed endpoints (analytics, suggestions, feedback
 * generation, draft generation) now throw — those call sites have been updated
 * to use client-side utilities instead (see draft-generator.ts, feedback-templates.ts).
 */
export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  if (method.toUpperCase() === "GET") {
    const result = await resolveGet(url);
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  throw new Error(
    `apiRequest: ${method} ${url} is not available in the static build. ` +
      `This app now runs entirely as static files on GitHub Pages \u2014 mutating ` +
      `endpoints have been replaced with client-side utilities or removed.`
  );
}

async function resolveGet(url: string): Promise<any> {
  // /api/meetings/:id/transcript -> read transcript field from meetings.json
  const transcriptMatch = url.match(/^\/api\/meetings\/(\d+)\/transcript$/);
  if (transcriptMatch) {
    const meetings: Array<Meeting & { transcript?: any }> = await fetchStaticJson("meetings.json");
    const meeting = meetings.find((m) => m.id === Number(transcriptMatch[1]));
    if (!meeting?.transcript) {
      throw new Error(`404: Transcript not available`);
    }
    return meeting.transcript;
  }

  // /api/meetings/:id -> single meeting lookup from meetings.json
  const meetingMatch = url.match(/^\/api\/meetings\/(\d+)$/);
  if (meetingMatch) {
    const meetings: Meeting[] = await fetchStaticJson("meetings.json");
    const meeting = meetings.find((m) => m.id === Number(meetingMatch[1]));
    if (!meeting) throw new Error("404: Not found");
    return meeting;
  }

  // /api/news/:id
  const newsMatch = url.match(/^\/api\/news\/(\d+)$/);
  if (newsMatch) {
    const news: NewsItem[] = await fetchStaticJson("news.json");
    const item = news.find((n) => n.id === Number(newsMatch[1]));
    if (!item) throw new Error("404: Not found");
    return item;
  }

  // /api/developments/:id
  const devMatch = url.match(/^\/api\/developments\/(\d+)$/);
  if (devMatch) {
    const developments: Development[] = await fetchStaticJson("developments.json");
    const dev = developments.find((d) => d.id === Number(devMatch[1]));
    if (!dev) throw new Error("404: Not found");
    return dev;
  }

  // /api/geo-activity -> computed client-side
  if (url === "/api/geo-activity") {
    return getGeoActivity();
  }

  const file = resolveStaticFile(url);
  if (file) {
    return fetchStaticJson(file);
  }

  throw new Error(`404: No static data available for ${url}`);
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const url = queryKey.join("/");
    try {
      return await resolveGet(url);
    } catch (err) {
      const message = (err as Error).message || "";
      if (unauthorizedBehavior === "returnNull" && message.startsWith("401")) {
        return null;
      }
      throw err;
    }
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
