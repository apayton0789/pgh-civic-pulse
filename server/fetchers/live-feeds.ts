/**
 * Live Data Feeds — Self-sustaining, zero-credit data pipeline.
 * 
 * Fetches from free public sources on a server-side timer:
 *   - YouTube RSS feeds (Atom XML) for governance meeting videos
 *   - Post-Gazette RSS for local news
 *   - PublicSource RSS for civic journalism
 *   - EngagePGH for development projects
 *   - LegiScan public API for PA legislation (optional, free tier)
 * 
 * Runs every 30 minutes via setInterval inside the Express server.
 * No AI, no external APIs with keys, no credits consumed.
 */

import { storage } from "../storage.js";
import { parseRSS, type FeedItem } from "./rss-parser.js";
import { downloadTranscript, analyzeTranscript } from "./transcript-extractor.js";
import type { InsertNewsItem, InsertMeeting, UpcomingMeeting, TranscriptAnalysis } from "../../shared/schema.js";

// ── YouTube Channel Registry (using @handles, fetched via yt-dlp) ───
const YOUTUBE_CHANNELS: Array<{
  handle: string;
  governingBody: string;
  defaultMeetingType: string;
}> = [
  {
    handle: "@CityChannelPittsburgh",
    governingBody: "Pittsburgh City Council",
    defaultMeetingType: "Regular Meeting",
  },
  {
    handle: "@accounciltv",
    governingBody: "Allegheny County Council",
    defaultMeetingType: "Regular Meeting",
  },
  {
    handle: "@pittsburghpublicschools",
    governingBody: "Pittsburgh Public Schools Board",
    defaultMeetingType: "Board Meeting",
  },
];

// ── News RSS Feed Registry ───────────────────────────────────────────
const NEWS_FEEDS: Array<{
  url: string;
  source: string;
  categoryRules: Array<{ pattern: RegExp; category: string }>;
}> = [
  {
    url: "https://www.post-gazette.com/rss/local",
    source: "Pittsburgh Post-Gazette",
    categoryRules: [
      { pattern: /school|education|pps|teacher/i, category: "Education" },
      { pattern: /zone|zoning|planning|development|build|construct|permit/i, category: "Development" },
      { pattern: /transit|prt|bus|light rail|port authority/i, category: "Infrastructure/Transit" },
      { pattern: /water|sewer|pwsa|stormwater/i, category: "Infrastructure" },
      { pattern: /budget|tax|revenue|deficit|spend/i, category: "Government/Budget" },
      { pattern: /police|fire|crime|arrest|shoot|stab/i, category: "Public Safety" },
      { pattern: /council|mayor|county|ordinance|vote|elect/i, category: "Government" },
      { pattern: /business|company|hire|layoff|employ|startup|tech/i, category: "Business" },
      { pattern: /housing|rent|evict|afford|homeless/i, category: "Development/Housing" },
      { pattern: /state|harrisburg|legislat|governor|shapiro/i, category: "State/Regional" },
    ],
  },
  {
    url: "https://www.publicsource.org/feed/",
    source: "PublicSource",
    categoryRules: [
      { pattern: /school|education|pps|teacher/i, category: "Education" },
      { pattern: /zone|zoning|planning|development|build/i, category: "Development" },
      { pattern: /transit|prt|bus/i, category: "Infrastructure/Transit" },
      { pattern: /budget|tax|revenue/i, category: "Government/Budget" },
      { pattern: /police|safety|crime/i, category: "Public Safety" },
      { pattern: /council|mayor|county|government|vote/i, category: "Government" },
      { pattern: /business|economy|employ/i, category: "Business" },
      { pattern: /housing|rent|evict|afford/i, category: "Development/Housing" },
      { pattern: /state|harrisburg|legislat|governor/i, category: "State/Regional" },
      { pattern: /health|hospital|opioid|mental/i, category: "Health" },
    ],
  },
];

// ── Pittsburgh Neighborhood Keywords (for auto-geo-tagging) ──────────
const PGH_NEIGHBORHOODS: Record<string, string[]> = {
  "Downtown": ["downtown", "market square", "ppp district", "cultural district", "point state park"],
  "Strip District": ["strip district", "smallman", "penn avenue strip"],
  "Lawrenceville": ["lawrenceville", "butler street"],
  "East Liberty": ["east liberty", "eastside bond", "penn circle"],
  "Shadyside": ["shadyside", "walnut street shop"],
  "Squirrel Hill": ["squirrel hill", "forward avenue", "murray avenue"],
  "Oakland": ["oakland", "university of pittsburgh", "carnegie mellon", "upmc"],
  "South Side": ["south side", "east carson", "south side flats", "south side slopes"],
  "North Side": ["north side", "north shore", "allegheny commons"],
  "Bloomfield": ["bloomfield", "liberty avenue bloom"],
  "Point Breeze": ["point breeze"],
  "Homewood": ["homewood"],
  "Hazelwood": ["hazelwood", "hazelwood green"],
  "Hill District": ["hill district", "lower hill", "upper hill", "centre avenue hill"],
  "Central Business District": ["central business district", "cbd", "grant street"],
  "Garfield": ["garfield", "penn avenue garfield"],
  "Manchester": ["manchester"],
  "Brookline": ["brookline"],
  "Carrick": ["carrick"],
  "Mount Washington": ["mount washington", "grandview"],
  "Beechview": ["beechview"],
  "Highland Park": ["highland park"],
  "Morningside": ["morningside"],
  "Regent Square": ["regent square"],
  "Central Oakland": ["central oakland"],
  "Bluff": ["bluff", "duquesne university"],
  "Uptown": ["uptown", "fifth avenue uptown"],
  "Polish Hill": ["polish hill"],
  "Troy Hill": ["troy hill"],
  "Spring Hill": ["spring hill"],
  "Perry South": ["perry south"],
  "Perry North": ["perry north"],
  "Brighton Heights": ["brighton heights"],
  "Elliott": ["elliott"],
  "Sheraden": ["sheraden"],
  "Crafton Heights": ["crafton heights"],
  "Banksville": ["banksville"],
  "Overbrook": ["overbrook"],
  "Stanton Heights": ["stanton heights"],
  "Larimer": ["larimer"],
  "Lincoln-Lemington-Belmar": ["lincoln-lemington", "lemington"],
  "Greenfield": ["greenfield"],
  "Glen Hazel": ["glen hazel"],
};

const AC_MUNICIPALITIES: string[] = [
  "PITTSBURGH", "PENN HILLS", "MCCANDLESS", "SHALER", "BETHEL PARK",
  "ROSS", "PLUM", "MOUNT LEBANON", "NORTH VERSAILLES", "WILKINSBURG",
  "MONROEVILLE", "BALDWIN", "WEST MIFFLIN", "MCKEESPORT", "MOON",
  "ROBINSON", "HAMPTON", "SOUTH FAYETTE", "NORTH FAYETTE", "SCOTT",
  "UPPER ST. CLAIR", "WHITEHALL", "PINE", "MARSHALL", "CRANBERRY",
  "WHITE OAK", "RICHLAND", "SWISSVALE", "MUNHALL", "BRADDOCK",
  "CLAIRTON", "DUQUESNE", "HOMESTEAD", "RANKIN", "CARNEGIE",
  "DORMONT", "CASTLE SHANNON", "BRENTWOOD", "PLEASANT HILLS",
  "SOUTH PARK", "JEFFERSON HILLS", "ELIZABETH", "FORWARD",
  "MCKEES ROCKS", "STOWE", "MILLVALE", "ETNA", "RESERVE",
  "O'HARA", "FOX CHAPEL", "ASPINWALL", "BLAWNOX", "VERONA",
  "OAKMONT", "EDGEWOOD", "FOREST HILLS", "CHURCHILL",
  "TURTLE CREEK", "EAST PITTSBURGH", "NORTH BRADDOCK", "CHALFANT",
  "PITCAIRN", "WALL", "TRAFFORD", "WEST HOMESTEAD", "WEST MIFFLIN",
  "WHITAKER", "LIBERTY", "PORT VUE", "GLASSPORT", "DRAVOSBURG",
  "WEST ELIZABETH", "LINCOLN", "VERSAILLES", "EAST MCKEESPORT",
  "SPRINGDALE", "CHESWICK", "HARMAR", "FRAZER", "INDIANA",
  "HARRISON", "BRACKENRIDGE", "TARENTUM", "EAST DEER",
  "ALLEGHENY", "ALIQUIPPA", "SEWICKLEY", "CORAOPOLIS",
  "LEETSDALE", "EDGEWORTH", "ALEPPO", "KILBUCK", "OHIO",
  "BEN AVON", "EMSWORTH", "BELLEVUE", "AVALON",
];

// ── Helper: Auto-assign geographic tags from text ────────────────────
function extractGeoTags(text: string): string[] {
  const tags: string[] = [];
  const lower = text.toLowerCase();

  // Check neighborhoods (Title Case)
  for (const [neighborhood, keywords] of Object.entries(PGH_NEIGHBORHOODS)) {
    if (keywords.some((k) => lower.includes(k))) {
      tags.push(neighborhood);
    }
  }

  // Check municipalities (ALL CAPS)
  for (const muni of AC_MUNICIPALITIES) {
    if (lower.includes(muni.toLowerCase())) {
      tags.push(muni);
    }
  }

  // Always add PITTSBURGH if we found any PGH neighborhood
  if (tags.length > 0 && !tags.includes("PITTSBURGH")) {
    // Check if any tag is a neighborhood (Title Case = city neighborhood)
    const hasNeighborhood = tags.some((t) => t[0] === t[0].toUpperCase() && t[0] !== t[0].toLowerCase() && !AC_MUNICIPALITIES.includes(t));
    if (hasNeighborhood) tags.push("PITTSBURGH");
  }

  return [...new Set(tags)];
}

// ── Helper: Clean RSS summary text ──────────────────────────────────
function cleanSummary(text: string): string {
  if (!text) return "";
  return text
    .replace(/<!\[CDATA\[/g, "")
    .replace(/\]\]>/g, "")
    .replace(/&lt;!\[CDATA\[\]\]&gt;/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
}

// ── Helper: Classify news category from title/description ────────────
function classifyNews(
  title: string,
  description: string,
  rules: Array<{ pattern: RegExp; category: string }>
): string {
  const combined = `${title} ${description}`;
  for (const rule of rules) {
    if (rule.pattern.test(combined)) return rule.category;
  }
  return "General";
}

// ── Helper: Parse YouTube video title to extract meeting info ────────
function parseYouTubeTitle(
  title: string,
  defaultBody: string,
  defaultType: string
): { governingBody: string; meetingType: string; date: string } {
  // Patterns like: "Pittsburgh City Council Regular Meeting - 3/17/26"
  // "Allegheny County Council Regular Meeting - March 10, 2026"
  // "Policy Workshop - March 10, 2026"
  // "Land Bank Board of Directors Meeting - 3/13/26"

  let governingBody = defaultBody;
  let meetingType = defaultType;

  // Try to extract governing body from title
  const bodyPatterns: Array<{ pattern: RegExp; body: string; type?: string }> = [
    { pattern: /pittsburgh city council/i, body: "Pittsburgh City Council" },
    { pattern: /allegheny county council/i, body: "Allegheny County Council" },
    { pattern: /zoning board/i, body: "Pittsburgh Zoning Board of Adjustment", type: "Regular Hearing" },
    { pattern: /planning commission/i, body: "Pittsburgh Planning Commission" },
    { pattern: /ura board|urban redevelopment/i, body: "Urban Redevelopment Authority (URA) Board" },
    { pattern: /land bank/i, body: "Pittsburgh Land Bank" },
    { pattern: /school board|pps board/i, body: "Pittsburgh Public Schools Board" },
    { pattern: /policy workshop/i, body: "Pittsburgh Public Schools Board", type: "Policy Workshop" },
    { pattern: /progress monitoring/i, body: "Pittsburgh Public Schools Board", type: "Progress Monitoring" },
    { pattern: /hacp|housing authority/i, body: "Housing Authority of Pittsburgh (HACP)" },
    { pattern: /pwsa|water.*sewer/i, body: "Pittsburgh Water and Sewer Authority (PWSA)" },
    { pattern: /prt board|regional transit.*board/i, body: "Pittsburgh Regional Transit" },
    { pattern: /art commission|pacd/i, body: "Pittsburgh Art Commission (PACD)" },
    { pattern: /historic review/i, body: "Pittsburgh Historic Review Commission (HRC)" },
    { pattern: /equal opportunity|eorc/i, body: "City of Pittsburgh Equal Opportunity Review Commission (EORC)" },
    { pattern: /civil service commission/i, body: "Pittsburgh Civil Service Commission" },
    { pattern: /human relations|chr\b/i, body: "Pittsburgh Commission on Human Relations (CHR)" },
    { pattern: /ethics (hearing )?board/i, body: "Pittsburgh Ethics Hearing Board" },
    { pattern: /pension.*board|cmptf/i, body: "Pittsburgh Comprehensive Municipal Pension Trust Fund Board" },
    { pattern: /parking authority/i, body: "Pittsburgh Parking Authority Board" },
    { pattern: /sports.*exhibition|sea\b/i, body: "Sports & Exhibition Authority (SEA)" },
    { pattern: /stadium authority/i, body: "Stadium Authority of the City of Pittsburgh" },
    { pattern: /task force.*disabilit|cctfd/i, body: "Pittsburgh-Allegheny County Task Force on Disabilities (CCTFD)" },
    { pattern: /citizens police|cprb/i, body: "Pittsburgh Citizens Police Review Board (CPRB)" },
    { pattern: /lgbtqia|lgbtq.*commission/i, body: "City of Pittsburgh LGBTQIA+ Commission" },
    { pattern: /alcosan/i, body: "Allegheny County Sanitary Authority (ALCOSAN)" },
  ];

  for (const bp of bodyPatterns) {
    if (bp.pattern.test(title)) {
      governingBody = bp.body;
      if (bp.type) meetingType = bp.type;
      break;
    }
  }

  // Extract meeting type from title
  const typePatterns: Array<{ pattern: RegExp; type: string }> = [
    { pattern: /regular meeting/i, type: "Regular Meeting" },
    { pattern: /special meeting/i, type: "Special Meeting" },
    { pattern: /public hearing/i, type: "Public Hearing" },
    { pattern: /regular hearing/i, type: "Regular Hearing" },
    { pattern: /committee meeting/i, type: "Committee Meeting" },
    { pattern: /work session/i, type: "Work Session" },
    { pattern: /board meeting/i, type: "Board Meeting" },
    { pattern: /budget hearing/i, type: "Budget Hearing" },
  ];

  for (const tp of typePatterns) {
    if (tp.pattern.test(title)) {
      meetingType = tp.type;
      break;
    }
  }

  // Extract date from title — handle "3/17/26" and "March 10, 2026" formats
  let date = "";
  const shortDate = title.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (shortDate) {
    const month = shortDate[1].padStart(2, "0");
    const day = shortDate[2].padStart(2, "0");
    let year = shortDate[3];
    if (year.length === 2) year = `20${year}`;
    date = `${year}-${month}-${day}`;
  } else {
    const longDate = title.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})/i);
    if (longDate) {
      const months: Record<string, string> = {
        january: "01", february: "02", march: "03", april: "04",
        may: "05", june: "06", july: "07", august: "08",
        september: "09", october: "10", november: "11", december: "12",
      };
      const month = months[longDate[1].toLowerCase()] || "01";
      const day = longDate[2].padStart(2, "0");
      date = `${longDate[3]}-${month}-${day}`;
    }
  }

  return { governingBody, meetingType, date };
}

// ── Fetch Helpers ────────────────────────────────────────────────────

async function fetchWithTimeout(url: string, timeoutMs = 15000): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "PGH-Civic-Pulse/1.0 (civic dashboard)" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

// ── Core Fetcher Functions ───────────────────────────────────────────

/** Fetch YouTube videos via yt-dlp (handles work, RSS channel_id feeds are deprecated) */
async function fetchYouTubeMeetings(): Promise<number> {
  const { execSync } = await import("child_process");
  let count = 0;

  for (const ch of YOUTUBE_CHANNELS) {
    try {
      // Use yt-dlp to list recent videos from channel
      const url = `https://www.youtube.com/${ch.handle}/videos`;
      const cmd = `yt-dlp --flat-playlist --print "%(id)s\t%(title)s\t%(upload_date)s" --playlist-items 1-10 "${url}" 2>/dev/null`;
      let output: string;
      try {
        output = execSync(cmd, { timeout: 30000, encoding: "utf-8" });
      } catch {
        console.log(`[LiveFeeds] yt-dlp failed for ${ch.handle}, skipping`);
        continue;
      }

      const lines = output.trim().split("\n").filter(Boolean);
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 21); // 3 weeks lookback

      for (const line of lines) {
        const [videoId, title, uploadDate] = line.split("\t");
        if (!videoId || !title) continue;

        const ytUrl = `https://www.youtube.com/watch?v=${videoId}`;

        const parsed = parseYouTubeTitle(title, ch.governingBody, ch.defaultMeetingType);
        if (!parsed.date && uploadDate && uploadDate !== "NA") {
          // Format: YYYYMMDD → YYYY-MM-DD
          parsed.date = `${uploadDate.slice(0, 4)}-${uploadDate.slice(4, 6)}-${uploadDate.slice(6, 8)}`;
        }
        if (!parsed.date) {
          parsed.date = new Date().toISOString().split("T")[0];
        }

        // Skip old videos
        if (new Date(parsed.date) < cutoff) continue;

        const meeting: InsertMeeting = {
          externalId: `yt-${videoId}`,
          governingBody: parsed.governingBody,
          meetingType: parsed.meetingType,
          date: parsed.date,
          youtubeUrl: ytUrl,
          title: `${parsed.governingBody} ${parsed.meetingType} — ${title}`,
          keyTopics: [],
          billsMentioned: [],
          summaryBullets: [],
          geographicTags: extractGeoTags(title),
          contention: [],
          publicCommentThemes: [],
          addressLocations: [],
        };

        await storage.createMeeting(meeting);
        count++;
      }
    } catch (err) {
      console.error(`[LiveFeeds] YouTube fetch error for ${ch.governingBody}:`, (err as Error).message);
    }
  }
  return count;
}

/** Fetch news RSS feeds and create NewsItem records */
async function fetchNewsFeeds(): Promise<number> {
  let count = 0;
  for (const feed of NEWS_FEEDS) {
    try {
      const xml = await fetchWithTimeout(feed.url);
      const parsed = parseRSS(xml);

      // Only process items from the last 7 days
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 7);

      for (const item of parsed.items) {
        const pubDate = new Date(item.pubDate);
        if (pubDate < cutoff) continue;

        const category = classifyNews(item.title, item.description, feed.categoryRules);
        const geoTags = extractGeoTags(`${item.title} ${item.description}`);

        const newsItem: InsertNewsItem = {
          externalId: `rss-${item.guid.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 80)}`,
          headline: item.title,
          source: feed.source,
          date: pubDate.toISOString().split("T")[0],
          url: item.link,
          summary: cleanSummary(item.description) || null,
          geographicTags: geoTags,
          category,
        };

        await storage.createNewsItem(newsItem);
        count++;
      }
    } catch (err) {
      console.error(`[LiveFeeds] News feed error for ${feed.source}:`, (err as Error).message);
    }
  }
  return count;
}

/** Fetch EngagePGH development projects (HTML scraping, no API needed) */
async function fetchEngagePGH(): Promise<number> {
  let count = 0;
  try {
    const html = await fetchWithTimeout("https://engage.pittsburghpa.gov/development-review", 20000);

    // Extract project tiles from the page HTML
    // EngagePGH uses structured project cards with titles, descriptions, and links
    const projectPattern = /<a[^>]*href="(\/[^"]*)"[^>]*>[\s\S]*?<h[23][^>]*>([^<]+)<\/h[23]>[\s\S]*?<p[^>]*>([^<]*)<\/p>/gi;
    let match;
    while ((match = projectPattern.exec(html)) !== null) {
      const url = `https://engage.pittsburghpa.gov${match[1]}`;
      const title = match[2].trim();
      const description = match[3].trim();

      if (!title || title.length < 5) continue;

      await storage.createDevelopment({
        externalId: `engage-${match[1].replace(/[^a-zA-Z0-9-]/g, "").slice(0, 80)}`,
        title,
        description: description || "Development project under review",
        status: "Under Review",
        projectType: "Development",
        address: null,
        url,
        keyDetails: null,
        commentDeadline: null,
        geographicTags: extractGeoTags(`${title} ${description}`),
        source: "EngagePGH",
      });
      count++;
    }
  } catch (err) {
    console.error("[LiveFeeds] EngagePGH fetch error:", (err as Error).message);
  }
  return count;
}

/** Fetch transcripts for meetings that have YouTube URLs but no transcript yet */
async function fetchTranscripts(): Promise<number> {
  // Skip when running in an environment (like GitHub Actions) where YouTube
  // blocks caption downloads. The UI still links each meeting to YouTube's
  // built-in transcript panel.
  if (process.env.SKIP_TRANSCRIPTS === "1") {
    return 0;
  }
  let count = 0;
  const meetings = await storage.getMeetings();
  
  // Only process meetings with YouTube URLs, limit to 5 per cycle to avoid long runs
  const needsTranscript: Array<{ id: number; url: string }> = [];
  for (const m of meetings) {
    if (!m.youtubeUrl) continue;
    const existing = await storage.getTranscript(m.id);
    if (existing) continue;
    needsTranscript.push({ id: m.id, url: m.youtubeUrl });
    if (needsTranscript.length >= 5) break; // batch limit per cycle
  }

  for (const { id, url } of needsTranscript) {
    try {
      const transcript = await downloadTranscript(url);
      if (transcript && transcript.length > 500) {
        const analysis = analyzeTranscript(transcript, url);
        // Map to schema-compatible TranscriptAnalysis
        const ta: TranscriptAnalysis = {
          videoId: analysis.videoId,
          transcriptLength: analysis.transcriptLength,
          votes: analysis.votes,
          billNumbers: analysis.billNumbers,
          publicCommentDetected: analysis.publicCommentDetected,
          publicCommentCount: analysis.publicCommentCount,
          topicKeywords: analysis.topicKeywords,
          speakerCount: analysis.speakerCount,
          timedSegments: analysis.timedSegments,
          meetingSummary: analysis.meetingSummary,
          extractedAt: analysis.extractedAt,
        };
        await storage.updateMeetingTranscript(id, ta);
        count++;
        console.log(`[LiveFeeds] Transcript extracted for meeting ${id} (${analysis.transcriptLength} chars, ${analysis.votes.length} votes)`);
      }
    } catch (err) {
      console.error(`[LiveFeeds] Transcript error for meeting ${id}:`, (err as Error).message);
    }
  }
  return count;
}

// ── Scheduler & Public API ───────────────────────────────────────────

let lastFetchResult: {
  timestamp: string;
  youtubeVideos: number;
  newsArticles: number;
  engageProjects: number;
  transcriptsProcessed: number;
  errors: string[];
} = {
  timestamp: "never",
  youtubeVideos: 0,
  newsArticles: 0,
  engageProjects: 0,
  transcriptsProcessed: 0,
  errors: [],
};

let fetchIntervalId: ReturnType<typeof setInterval> | null = null;

/** Run all fetchers once */
export async function runAllFetchers(): Promise<typeof lastFetchResult> {
  console.log("[LiveFeeds] Starting data fetch cycle...");
  const errors: string[] = [];

  let yt = 0, news = 0, engage = 0, transcripts = 0;
  try { yt = await fetchYouTubeMeetings(); } catch (e) { errors.push(`YouTube: ${(e as Error).message}`); }
  try { news = await fetchNewsFeeds(); } catch (e) { errors.push(`News: ${(e as Error).message}`); }
  try { engage = await fetchEngagePGH(); } catch (e) { errors.push(`EngagePGH: ${(e as Error).message}`); }
  try { transcripts = await fetchTranscripts(); } catch (e) { errors.push(`Transcripts: ${(e as Error).message}`); }

  lastFetchResult = {
    timestamp: new Date().toISOString(),
    youtubeVideos: yt,
    newsArticles: news,
    engageProjects: engage,
    transcriptsProcessed: transcripts,
    errors,
  };

  console.log(
    `[LiveFeeds] Fetch complete — ${yt} videos, ${news} news, ${engage} EngagePGH, ${transcripts} transcripts` +
    (errors.length > 0 ? ` (${errors.length} errors)` : "")
  );

  return lastFetchResult;
}

/** Get the last fetch result (for the /api/feed-status endpoint) */
export function getFeedStatus() {
  return lastFetchResult;
}

/** 
 * Start the automatic fetch scheduler.
 * Runs immediately on startup, then every intervalMs (default: 30 min).
 */
export function startFeedScheduler(intervalMs = 30 * 60 * 1000) {
  // Run immediately on startup (after a 5s delay to let the server settle)
  setTimeout(() => {
    runAllFetchers().catch((e) =>
      console.error("[LiveFeeds] Initial fetch failed:", e)
    );
  }, 5000);

  // Then run on interval
  fetchIntervalId = setInterval(() => {
    runAllFetchers().catch((e) =>
      console.error("[LiveFeeds] Scheduled fetch failed:", e)
    );
  }, intervalMs);

  console.log(`[LiveFeeds] Scheduler started — fetching every ${Math.round(intervalMs / 60000)} minutes`);
}

/** Stop the scheduler */
export function stopFeedScheduler() {
  if (fetchIntervalId) {
    clearInterval(fetchIntervalId);
    fetchIntervalId = null;
    console.log("[LiveFeeds] Scheduler stopped");
  }
}
