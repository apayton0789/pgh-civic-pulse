# PGH Civic Pulse

A civic dashboard for tracking Pittsburgh-area government meetings, developments, and public feedback opportunities. Built to help residents keep up with what matters across local, county, regional, and state government without drowning in information.

## What it does

- **Pulls YouTube meeting recordings** from Pittsburgh government channels (City Channel Pittsburgh, Allegheny County Council TV, Pittsburgh Public Schools) via `yt-dlp`, auto-downloads captions, and extracts votes, bills, action items, and public-comment segments from transcripts.
- **Fetches RSS news feeds** from Pittsburgh Post-Gazette, PublicSource, TribLive, and Pittsburgh Business Times.
- **Scores and ranks items** by importance, urgency, local relevance, resident influenceability, recency, and source quality — surfacing what needs attention today.
- **Generates research-bullet briefings** with structured fields: headline, why-it-matters, what-changed, urgency, action, deadline, key stakeholders, evidence bullets, sources, video timestamps, and confidence level.
- **Provides source citations** for every claim — every card links to the original YouTube recording, news article, or government document.
- **Guides feedback drafting** through a strategy workflow (what matters, desired outcome, factual argument, values argument, tone) into position summaries, emails, public comments, talking points, and oral testimony.
- **Tracks usage analytics** and collects suggestions in-app.

## Live version

The current production deployment is available through Perplexity Computer at a permanent shareable URL.

## Tech stack

- **Backend:** Express + TypeScript, in-memory storage with disk persistence for analytics/suggestions
- **Frontend:** React 18 + Vite + Tailwind CSS v3 + shadcn/ui + TanStack Query v5
- **Routing:** wouter with hash routing (`useHashLocation`)
- **Data pipeline:** `yt-dlp` for YouTube video discovery + auto-captions; RSS parser (zero deps) for news feeds
- **Transcript analysis:** Custom regex-based vote/bill/action-item detection over auto-generated captions

## Project structure

```
client/                    React frontend
  src/
    pages/                 Today, What Changed, Take Action, Draft Response,
                           Monitoring, Source Trail, Calendar, Develop Position
    components/            Reusable UI: source-trail-panel, infographic-block,
                           suggestion-box, meeting-card, news-card, sidebar-nav
    lib/queryClient.ts     API client with __PORT_5000__ placeholder for deploy
server/                    Express backend
  routes.ts                All API endpoints
  storage.ts               In-memory storage layer
  briefing-engine.ts       Transforms meetings/news/developments into scored BriefingItems
  draft-engine.ts          Template-based draft generation (zero AI)
  analytics.ts             Lightweight usage tracking with disk persistence
  fetchers/
    live-feeds.ts          Main fetch orchestrator (runs every 30 min)
    rss-parser.ts          RSS/Atom parser
    transcript-extractor.ts YouTube caption analysis
shared/
  schema.ts                All types (BriefingItem, SourceCitation, EvidenceBullet, etc.)
```

## Development

```bash
npm install
npm run dev          # Starts Express + Vite on port 5000
```

Runtime dependency: `yt-dlp` must be installed and on PATH for YouTube video discovery.

## Build & deploy

```bash
npm run build        # Bundles client to dist/public and server to dist/index.cjs
NODE_ENV=production node dist/index.cjs
```

Server serves the static frontend and handles all `/api/*` routes on port 5000.

## Key API endpoints

- `GET /api/briefing/items` — All scored BriefingItems (sorted recency-first, video-boosted)
- `GET /api/briefing/changed` — Items from the last 2 days
- `GET /api/briefing/feedback` — Active feedback opportunities
- `POST /api/feedback/generate-drafts` — Generate templated drafts from strategy answers
- `GET /api/sources` — All source citations across items
- `POST /api/feed-refresh` — Trigger manual refresh of YouTube + RSS feeds
- `GET /api/meetings/:id/transcript` — Transcript analysis for a specific meeting
- `GET /api/analytics/summary` — Usage stats
- `POST /api/suggestions` — Submit user suggestion

## Design principles

- **Sources over summaries.** Every claim must be traceable to an original source. No unsourced facts.
- **Zero-AI drafting.** Draft generation is template-based to keep operating costs at zero and preserve reproducibility.
- **Recency first.** New content surfaces above older content of similar importance.
- **Video evidence preferred.** YouTube-transcribed meeting content ranks higher than secondary reporting.
- **Actionability.** Every item asks: what can you actually do about this?

## License

Built by [apayton0789](https://github.com/apayton0789) as a civic tech tool for Pittsburgh residents. Created with [Perplexity Computer](https://www.perplexity.ai/computer).
