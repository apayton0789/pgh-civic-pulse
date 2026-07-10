/**
 * Static data generator for the GitHub Pages build.
 *
 * This script replaces the always-on Express server for production. It:
 *   1. Seeds initial data (same seed_data.json used by server/routes.ts)
 *   2. Runs the live fetchers (YouTube via yt-dlp, RSS news, EngagePGH, transcripts)
 *   3. Runs the briefing engine to score/rank BriefingItems
 *   4. Writes all the JSON files the static React app reads from `./data/*.json`
 *
 * Run via: npm run generate-data  (== tsx scripts/generate-data.ts)
 *
 * Requires yt-dlp to be available on PATH (installed by the GitHub Actions
 * runner before this script runs).
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { storage } from "../server/storage";
import { runAllFetchers } from "../server/fetchers/live-feeds";
import {
  generateBriefingItems,
  getRecentlyChangedItems,
  getFeedbackItems,
  getAllSources,
} from "../server/briefing-engine";
import type { TranscriptAnalysis, UpcomingMeeting } from "../shared/schema";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const DATA_OUT_DIR = path.join(ROOT, "client", "public", "data");

/** Strip residual CDATA/HTML from RSS summaries (mirrors server/routes.ts) */
function cleanSummary(text: string | null): string | null {
  if (!text) return null;
  const cleaned = text
    .replace(/<!\[CDATA\[/g, "")
    .replace(/\]\]>/g, "")
    .replace(/&lt;!?\[?CDATA\[?\]?\]?&gt;/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || null;
}

/** Seed initial data from client/public/data/seed_data.json (mirrors server/routes.ts seedData()) */
let upcomingMeetings: UpcomingMeeting[] = [];

async function seedData() {
  const possiblePaths = [
    path.join(ROOT, "client/public/data/seed_data.json"),
    path.join(ROOT, "dist/public/data/seed_data.json"),
  ];

  let seedContent: string | null = null;
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      seedContent = fs.readFileSync(p, "utf-8");
      break;
    }
  }

  if (!seedContent) {
    console.log("[generate-data] No seed data found, starting empty");
    return;
  }

  const seed = JSON.parse(seedContent);

  for (const m of seed.meetings || []) {
    await storage.createMeeting({
      externalId: m.id,
      governingBody: m.governing_body,
      meetingType: m.meeting_type,
      date: m.date,
      youtubeUrl: m.youtube_url,
      title: m.title,
      keyTopics: m.key_topics || [],
      billsMentioned: m.bills_mentioned || [],
      summaryBullets: m.summary_bullets || [],
      geographicTags: m.geographic_tags || [],
      contention: m.contention || [],
      publicCommentThemes: m.public_comment_themes || [],
      addressLocations: m.address_locations || [],
    });
  }

  for (const n of seed.news || []) {
    await storage.createNewsItem({
      externalId: n.id,
      headline: n.headline,
      source: n.source,
      date: n.date,
      url: n.url,
      summary: n.summary,
      geographicTags: n.geographic_tags || [],
      category: n.category || "General",
    });
  }

  for (const d of seed.developments || []) {
    await storage.createDevelopment({
      externalId: d.id,
      title: d.title,
      description: d.description,
      status: d.status,
      projectType: d.project_type,
      address: d.address,
      url: d.url,
      keyDetails: d.key_details,
      commentDeadline: d.comment_deadline,
      geographicTags: d.geographic_tags || [],
      source: d.source,
    });
  }

  upcomingMeetings = seed.upcoming_meetings || [];

  console.log(
    `[generate-data] Seeded ${seed.meetings?.length || 0} meetings, ${seed.news?.length || 0} news items, ${seed.developments?.length || 0} developments, and ${upcomingMeetings.length} upcoming meetings`
  );
}

function writeJson(filename: string, data: unknown) {
  const outPath = path.join(DATA_OUT_DIR, filename);
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2));
  console.log(`[generate-data] Wrote ${path.relative(ROOT, outPath)}`);
}

async function main() {
  console.log("[generate-data] Starting static data generation...");
  fs.mkdirSync(DATA_OUT_DIR, { recursive: true });

  // 1. Seed initial data
  await seedData();

  // 2. Run live fetchers (YouTube via yt-dlp, RSS news, EngagePGH, transcripts)
  // Loop until no more transcripts remain to be processed — each call handles ~5.
  console.log("[generate-data] Running live fetchers...");
  const firstResult = await runAllFetchers();
  console.log("[generate-data] Initial fetch:", firstResult);

  // Additional cycles process the transcript backlog for freshly-discovered videos.
  const MAX_TRANSCRIPT_CYCLES = 12;
  for (let cycle = 1; cycle <= MAX_TRANSCRIPT_CYCLES; cycle++) {
    const r = await runAllFetchers();
    console.log(`[generate-data] Transcript cycle ${cycle}: processed ${r.transcriptsProcessed}`);
    if (r.transcriptsProcessed === 0) break;
  }

  // 3. Gather context for the briefing engine
  const meetings = await storage.getMeetings();
  const rawNews = await storage.getNewsItems();
  const news = rawNews.map((n) => ({ ...n, summary: cleanSummary(n.summary) }));
  const developments = await storage.getDevelopments();

  const transcripts = new Map<number, TranscriptAnalysis>();
  for (const m of meetings) {
    const t = await storage.getTranscript(m.id);
    if (t) transcripts.set(m.id, t);
  }

  // 4. Run the briefing engine
  const { items, feedbackOpportunities } = generateBriefingItems(
    meetings,
    news as any,
    developments,
    transcripts
  );

  // 5. Write all JSON output files
  writeJson("briefing-items.json", items);
  writeJson("briefing-changed.json", getRecentlyChangedItems(items));
  writeJson("briefing-feedback.json", {
    items: getFeedbackItems(items),
    opportunities: feedbackOpportunities,
  });
  writeJson("sources.json", getAllSources(items));

  // Meetings with transcript embedded inline
  const meetingsWithTranscripts = await Promise.all(
    meetings.map(async (m) => {
      const transcript = await storage.getTranscript(m.id);
      return { ...m, transcript: transcript || null };
    })
  );
  writeJson("meetings.json", meetingsWithTranscripts);

  writeJson("news.json", news);
  writeJson("developments.json", developments);
  writeJson("upcoming-meetings.json", upcomingMeetings);

  writeJson("generated-at.json", { timestamp: new Date().toISOString() });

  console.log("[generate-data] Done.");
}

main().catch((err) => {
  console.error("[generate-data] Fatal error:", err);
  process.exit(1);
});
