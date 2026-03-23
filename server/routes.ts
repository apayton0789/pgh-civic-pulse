import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import type { AddressLocation, UpcomingMeeting } from "@shared/schema";
import fs from "fs";
import path from "path";
import { startFeedScheduler, getFeedStatus, runAllFetchers } from "./fetchers/live-feeds";
import { getTemplates, getTemplateById, generateFeedbackLetter } from "./feedback-templates";

/** Strip residual CDATA/HTML from RSS summaries */
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

export async function registerRoutes(server: Server, app: Express) {
  await seedData();

  // Start the self-sustaining live data pipeline (runs every 30 min, zero credits)
  startFeedScheduler();

  app.get("/api/meetings", async (_req, res) => {
    const meetings = await storage.getMeetings();
    res.json(meetings);
  });

  app.get("/api/meetings/:id", async (req, res) => {
    const meeting = await storage.getMeetingById(Number(req.params.id));
    if (!meeting) return res.status(404).json({ error: "Not found" });
    res.json(meeting);
  });

  app.get("/api/meetings/:id/transcript", async (req, res) => {
    const meetingId = Number(req.params.id);
    const meeting = await storage.getMeetingById(meetingId);
    if (!meeting) return res.status(404).json({ error: "Meeting not found" });
    const transcript = await storage.getTranscript(meetingId);
    if (!transcript) return res.status(404).json({ error: "Transcript not available", hasYoutube: !!meeting.youtubeUrl });
    res.json(transcript);
  });

  app.get("/api/news", async (_req, res) => {
    const news = await storage.getNewsItems();
    // Clean any CDATA/HTML artifacts from summaries
    const cleaned = news.map((n) => ({
      ...n,
      summary: cleanSummary(n.summary),
    }));
    res.json(cleaned);
  });

  app.get("/api/news/:id", async (req, res) => {
    const item = await storage.getNewsItemById(Number(req.params.id));
    if (!item) return res.status(404).json({ error: "Not found" });
    res.json(item);
  });

  app.get("/api/developments", async (_req, res) => {
    const developments = await storage.getDevelopments();
    res.json(developments);
  });

  app.get("/api/developments/:id", async (req, res) => {
    const dev = await storage.getDevelopmentById(Number(req.params.id));
    if (!dev) return res.status(404).json({ error: "Not found" });
    res.json(dev);
  });

  app.get("/api/upcoming-meetings", async (_req, res) => {
    res.json(upcomingMeetings);
  });

  app.get("/api/engagement", (_req, res) => {
    const possiblePaths = [
      path.join(process.cwd(), "client/public/data/engagement.json"),
      path.join(process.cwd(), "dist/public/data/engagement.json"),
    ];
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        return res.json(JSON.parse(fs.readFileSync(p, "utf-8")));
      }
    }
    res.status(404).json({ error: "engagement.json not found" });
  });

  app.get("/api/commissions", (_req, res) => {
    const possiblePaths = [
      path.join(process.cwd(), "client/public/data/commissions.json"),
      path.join(process.cwd(), "dist/public/data/commissions.json"),
    ];
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        return res.json(JSON.parse(fs.readFileSync(p, "utf-8")));
      }
    }
    res.status(404).json({ error: "commissions.json not found" });
  });

  app.get("/api/geography/:tag", async (req, res) => {
    const items = await storage.getItemsByGeography(req.params.tag);
    res.json(items);
  });

  app.get("/api/geo-activity", async (_req, res) => {
    const meetings = await storage.getMeetings();
    const news = await storage.getNewsItems();
    const developments = await storage.getDevelopments();
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

    // Build markers from meeting address_locations
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

    res.json({ activity: activityMap, markers });
  });

  app.get("/api/briefing", async (_req, res) => {
    const meetings = await storage.getMeetings();
    const rawNews = await storage.getNewsItems();
    const news = rawNews.map((n) => ({ ...n, summary: cleanSummary(n.summary) }));
    const developments = await storage.getDevelopments();

    const lower = (s: string) => s.toLowerCase();

    const countyMeetings = meetings.filter((m) =>
      lower(m.governingBody).includes("county") && !lower(m.governingBody).includes("port authority")
    );
    const cityMeetings = meetings.filter((m) =>
      lower(m.governingBody).includes("city council")
    );
    const schoolMeetings = meetings.filter((m) =>
      lower(m.governingBody).includes("school") || lower(m.governingBody).includes("pps")
    );
    const zoningMeetings = meetings.filter((m) =>
      lower(m.governingBody).includes("zoning")
    );
    const planningMeetings = meetings.filter((m) =>
      lower(m.governingBody).includes("planning commission")
    );
    const uraMeetings = meetings.filter((m) =>
      lower(m.governingBody).includes("ura") || lower(m.governingBody).includes("urban redevelopment")
    );
    const housingMeetings = meetings.filter((m) =>
      lower(m.governingBody).includes("housing authority") || lower(m.governingBody).includes("hacp")
    );
    const transitMeetings = meetings.filter((m) =>
      lower(m.governingBody).includes("port authority") || lower(m.governingBody).includes("regional transit")
    );
    const waterMeetings = meetings.filter((m) =>
      lower(m.governingBody).includes("water") || lower(m.governingBody).includes("pwsa")
    );
    // New: Land Bank meetings
    const landBankMeetings = meetings.filter((m) =>
      lower(m.governingBody).includes("land bank")
    );
    // New: City commissions (catch-all for Art Commission, HRC, EORC, Civil Service, CHR, Ethics, Pension, Parking Authority, SEA, Stadium Authority, Task Force, CPRB)
    const commissionKeywords = ["art commission", "pacd", "historic review", "hrc", "equal opportunity", "eorc", "civil service", "human relations", "chr", "ethics", "pension", "parking authority", "sports & exhibition", "sea", "stadium authority", "task force on disabilit", "cctfd", "citizens police", "cprb"];
    const commissionMeetings = meetings.filter((m) =>
      commissionKeywords.some((k) => lower(m.governingBody).includes(k))
    );
    // New: State-level news
    const stateNews = news.filter((n) =>
      ["State", "Legislature", "State/Regional", "Regional"].some(
        (cat) => (n.category || "").includes(cat)
      ) || lower(n.headline).includes("harrisburg") || lower(n.headline).includes("state legislat")
    );

    const landUseNews = news.filter((n) =>
      ["Development", "Zoning", "Land Use", "Infrastructure", "Housing", "Development/Zoning", "Development/Housing", "Development/Infrastructure", "Infrastructure/Transit"].some(
        (cat) => (n.category || "").includes(cat.split("/")[0]) || (n.category || "").includes(cat)
      )
    );
    const businessNews = news.filter((n) =>
      ["Business", "Economy", "Economic Development", "Business/Economy", "Business/Labor"].some(
        (cat) => (n.category || "").includes(cat.split("/")[0])
      )
    );
    const safetyNews = news.filter((n) =>
      ["Public Safety", "Safety"].includes(n.category || "")
    );

    res.json({
      generated: new Date().toISOString(),
      sections: {
        county: { title: "County Government", meetings: countyMeetings },
        city: { title: "City Government", meetings: cityMeetings },
        schools: { title: "Pittsburgh Public Schools", meetings: schoolMeetings },
        zoning: { title: "Zoning Board of Adjustment", meetings: zoningMeetings },
        planning: { title: "Planning Commission", meetings: planningMeetings },
        ura: { title: "Urban Redevelopment Authority", meetings: uraMeetings },
        housing: { title: "Housing Authority (HACP)", meetings: housingMeetings },
        landBank: { title: "Pittsburgh Land Bank", meetings: landBankMeetings },
        commissions: { title: "City Commissions & Boards", meetings: commissionMeetings },
        transit: { title: "Pittsburgh Regional Transit", meetings: transitMeetings },
        water: { title: "Water & Sewer Authority (PWSA)", meetings: waterMeetings },
        stateRadar: { title: "State & Regional", news: stateNews },
        landUse: { title: "Land Use & Development", news: landUseNews },
        business: { title: "Business & Economy", news: businessNews },
        safety: { title: "Public Safety", news: safetyNews },
        developments: { title: "Active Developments", developments },
        allNews: { title: "All Local News", news },
      },
    });
  });

  app.get("/api/share/:type/:id", async (req, res) => {
    const { type, id } = req.params;
    const numId = Number(id);

    if (type === "meeting") {
      const meeting = await storage.getMeetingById(numId);
      if (!meeting) return res.status(404).json({ error: "Not found" });
      const summary = `📋 ${meeting.governingBody} — ${meeting.meetingType} (${meeting.date})\n\n${meeting.title}\n\nKey Topics:\n${(meeting.keyTopics || []).map((t) => `• ${t}`).join("\n")}\n\nView full details on PGH Civic Pulse`;
      res.json({ summary, title: meeting.title, type: "meeting" });
    } else if (type === "news") {
      const item = await storage.getNewsItemById(numId);
      if (!item) return res.status(404).json({ error: "Not found" });
      const summary = `📰 ${item.headline}\n\nSource: ${item.source} (${item.date})\n\n${item.summary || ""}\n\nView full details on PGH Civic Pulse`;
      res.json({ summary, title: item.headline, type: "news" });
    } else if (type === "development") {
      const dev = await storage.getDevelopmentById(numId);
      if (!dev) return res.status(404).json({ error: "Not found" });
      const summary = `🏗️ ${dev.title}\n\nStatus: ${dev.status || "Active"}\nType: ${dev.projectType || "Development"}\n\n${dev.description}\n\n${dev.commentDeadline ? `⚠️ Comment Deadline: ${dev.commentDeadline}` : ""}\n\nView full details on PGH Civic Pulse`;
      res.json({ summary, title: dev.title, type: "development" });
    } else {
      res.status(400).json({ error: "Invalid type" });
    }
  });

  // ── Live Feed Status & Manual Refresh ────────────────────────────
  app.get("/api/feed-status", (_req, res) => {
    res.json(getFeedStatus());
  });

  app.post("/api/feed-refresh", async (_req, res) => {
    try {
      const result = await runAllFetchers();
      res.json({ ok: true, ...result });
    } catch (err) {
      res.status(500).json({ ok: false, error: (err as Error).message });
    }
  });

  // ── Feedback Templates (zero AI, template-based) ──────────────────
  app.get("/api/feedback/templates", (_req, res) => {
    res.json(getTemplates());
  });

  app.get("/api/feedback/templates/:id", (req, res) => {
    const template = getTemplateById(req.params.id);
    if (!template) return res.status(404).json({ error: "Template not found" });
    res.json(template);
  });

  app.post("/api/feedback/generate", (req, res) => {
    const { templateId, answers } = req.body;
    if (!templateId || !answers) {
      return res.status(400).json({ error: "templateId and answers required" });
    }
    try {
      const result = generateFeedbackLetter(templateId, answers);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  // State Radar — serves static JSON
  app.get("/api/state-radar", (_req, res) => {
    const possiblePaths = [
      path.join(process.cwd(), "client/public/data/state_radar.json"),
      path.join(process.cwd(), "dist/public/data/state_radar.json"),
    ];
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        const data = JSON.parse(fs.readFileSync(p, "utf-8"));
        return res.json(data);
      }
    }
    res.status(404).json({ error: "state_radar.json not found" });
  });
}

let upcomingMeetings: UpcomingMeeting[] = [];

async function seedData() {
  try {
    const possiblePaths = [
      path.join(process.cwd(), "client/public/data/seed_data.json"),
      path.join(process.cwd(), "dist/public/data/seed_data.json"),
    ];

    let seedContent: string | null = null;
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        seedContent = fs.readFileSync(p, "utf-8");
        break;
      }
    }

    if (!seedContent) {
      console.log("No seed data found, starting empty");
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

    console.log(`Seeded ${seed.meetings?.length || 0} meetings, ${seed.news?.length || 0} news items, ${seed.developments?.length || 0} developments, and ${upcomingMeetings.length} upcoming meetings`);
  } catch (err) {
    console.error("Error seeding data:", err);
  }
}
