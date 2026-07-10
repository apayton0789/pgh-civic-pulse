# GitHub Pages Migration

This document summarizes the migration of PGH Civic Pulse from a runtime Node.js +
Express + React app to a static site on **GitHub Pages**, with data refreshed by a
manually-triggered **GitHub Actions** workflow.

Repo: https://github.com/apayton0789/pgh-civic-pulse
Live site: **https://apayton0789.github.io/pgh-civic-pulse/**

## Summary of changes

### 1. Standalone data generator — `scripts/generate-data.ts` (new)

- Seeds initial data from `client/public/data/seed_data.json` (same logic as the old
  `seedData()` in `server/routes.ts`).
- Runs `runAllFetchers()` from `server/fetchers/live-feeds.ts` to pull fresh YouTube
  videos (via `yt-dlp`), transcripts, RSS news, and EngagePGH development projects.
- Runs `generateBriefingItems()` from `server/briefing-engine.ts` to score and rank
  BriefingItems.
- Writes all output JSON files to `client/public/data/`:
  `briefing-items.json`, `briefing-changed.json`, `briefing-feedback.json`,
  `sources.json`, `meetings.json` (with `transcript` embedded inline per meeting),
  `news.json`, `developments.json`, `upcoming-meetings.json`, `generated-at.json`.
- Added `"generate-data": "tsx scripts/generate-data.ts"` script to `package.json`.
  `tsx` was already a devDependency (`^4.20.5`), satisfying the "install tsx" requirement.

### 2. Sort bug fix — `server/briefing-engine.ts` + `client/src/pages/today.tsx`

Previously, any item with a YouTube video source got a flat +5 score boost even with
zero evidence bullets (i.e. no real transcript content). Fixed in both the server-side
`sortScore()` (used by `generate-data.ts`) and the client-side `compositeScore()`
(used for live re-sorting after filters are applied):

- Video boost (+5) now requires **both** a video source **and** `evidenceBullets.length >= 2`.
- Items with **zero** evidence bullets now get a **-3 penalty** instead of no penalty.
- The existing "richer transcript analysis" bonus (+3 for `evidenceBullets.length >= 3`)
  is unchanged.

### 3. Static React app — reads from pre-generated JSON

- `client/src/lib/queryClient.ts` was rewritten. `useQuery`/`apiRequest` call sites were
  **not** individually rewritten — instead, the query layer resolves any `/api/*`-shaped
  path to the matching static JSON file under `./data/` (relative to the Vite `base`
  path, so it works both locally and at `/pgh-civic-pulse/` on Pages):
  - `/api/briefing/items` → `briefing-items.json`
  - `/api/briefing/changed` → `briefing-changed.json`
  - `/api/briefing/feedback` → `briefing-feedback.json`
  - `/api/sources` → `sources.json`
  - `/api/meetings`, `/api/meetings/:id` → `meetings.json` (filtered client-side)
  - `/api/meetings/:id/transcript` → reads the embedded `transcript` field from `meetings.json`
  - `/api/news`, `/api/news/:id` → `news.json`
  - `/api/developments`, `/api/developments/:id` → `developments.json`
  - `/api/upcoming-meetings` → `upcoming-meetings.json`
  - `/api/engagement` → `engagement.json` (pre-existing static file, unchanged)
  - `/api/commissions` → `commissions.json` (pre-existing static file, unchanged)
  - `/api/state-radar` → `state_radar.json` (pre-existing static file, unchanged)
  - `/api/feed-status` → `generated-at.json` (repurposed to show last-refresh time)
  - `/api/geo-activity` → computed client-side from `meetings.json`/`news.json`/`developments.json`
    (mirrors the old server-side aggregation in `server/routes.ts`)
- `client/src/components/share-dialog.tsx`: the old `/api/share/:type/:id` endpoint was
  server-computed; that logic is now ported to run client-side against the static JSON.
- `client/src/lib/draft-generator.ts` (new): ported from `server/draft-engine.ts`. Same
  template-based logic (no AI), runs entirely in the browser. Used by
  `develop-position.tsx` and `draft-response.tsx` instead of `POST /api/feedback/generate-drafts`.
- `client/src/lib/feedback-templates.ts` (new): ported from `server/feedback-templates.ts`.
  Used by `feedback-form.tsx` instead of `POST /api/feedback/generate`.
- `client/src/components/suggestion-box.tsx`: the old `POST /api/suggestions` endpoint
  is gone. The suggestion box now opens a pre-filled GitHub issue:
  `https://github.com/apayton0789/pgh-civic-pulse/issues/new?labels=suggestion&title=...&body=...`
- `client/src/hooks/use-analytics.ts`: analytics POST calls removed; both exported
  functions (`usePageViewTracker`, `trackFeature`) are now no-ops so call sites in
  `App.tsx` and `suggestion-box.tsx` didn't need to change.
- `client/src/components/get-updates-button.tsx` (new): added to the sidebar
  (`sidebar-nav.tsx`). Shows the last-refreshed timestamp (from `generated-at.json`) and
  opens a modal linking to the `refresh-data.yml` workflow on GitHub with "Click Run
  workflow" instructions — this avoids embedding a GitHub PAT in the public static site.
  The modal auto-reloads the page after 5 minutes to pick up newly-deployed data.
- `client/src/components/feed-status.tsx`: simplified to a read-only "data last
  refreshed" indicator (no more in-app refresh button/mutation, since there's no
  server to call).

### 4. Vite configuration — `vite.config.ts`

- `base` changed from `"./"` to `"/pgh-civic-pulse/"` (the app uses hash-based routing
  via `wouter/use-hash-location`, so an absolute base path is safe).
- `build.outDir` changed from `dist/public` to repo-root `dist/`, so the Pages deploy
  workflow can upload it directly as the artifact.
- Added `client/public/.nojekyll` so GitHub Pages doesn't try to Jekyll-process the site.

### 5. GitHub Actions workflows (new)

- `.github/workflows/refresh-data.yml` — `workflow_dispatch` (manual "Run workflow"
  button) + a daily `cron` backup. Installs `yt-dlp`, runs `npm run generate-data`,
  and commits/pushes any changed JSON under `client/public/data/`.
- `.github/workflows/deploy-pages.yml` — triggered on push to `master` (path-filtered
  to `client/**`, `shared/**`, `scripts/**`, the workflow file itself, `package.json`,
  `vite.config.ts`) and via `workflow_dispatch`. Runs `npx vite build`, uploads `dist/`
  as the Pages artifact, and deploys via `actions/deploy-pages@v4`.

## What was NOT changed

- `server/` is left fully intact (`routes.ts`, `storage.ts`, `briefing-engine.ts`,
  `draft-engine.ts`, `feedback-templates.ts`, `fetchers/*`, etc.) for local dev
  reference (`npm run dev` still works against the in-memory Express server). It is
  not deployed to Pages.
- `shared/schema.ts` — all existing data models are unchanged.
- Existing pages/components/routes were not removed or restructured — only their data
  source changed (static JSON instead of REST calls), plus the three mutation-based
  features noted above (feedback generation, draft generation, suggestions) were
  ported to run client-side or replaced with a GitHub issue link.
- YouTube channel handles preserved as-is: `@CityChannelPittsburgh`, `@accounciltv`,
  `@pittsburghpublicschools`.

## Build & deploy verification

- **Local build:** `npm run generate-data && npx vite build --config vite.config.ts`
  completed successfully. Output verified at `dist/index.html`, `dist/assets/`,
  `dist/data/*.json`, and `dist/.nojekyll`, all under the `/pgh-civic-pulse/` base path.
  Smoke-tested by serving `dist/` locally at that path — index, JS bundle, and JSON data
  all returned HTTP 200.
- **GitHub Pages:** enabled via `gh api -X POST repos/apayton0789/pgh-civic-pulse/pages -f "build_type=workflow"`.
- **Initial `refresh-data.yml` run:** triggered via `gh workflow run refresh-data.yml`,
  completed successfully (`https://github.com/apayton0789/pgh-civic-pulse/actions/runs/29118740892`).
  Fetched 17 YouTube videos, 27 news items, 1 EngagePGH project, and 1 new transcript,
  then committed the refreshed JSON to `master`.
- **`deploy-pages.yml` runs:** the first run (triggered by the migration push itself)
  succeeded (`.../actions/runs/29118726703`). A second, manually-triggered run
  (`.../actions/runs/29118912484`) picked up the fresh data from the refresh run above.
- **Live verification:** `https://apayton0789.github.io/pgh-civic-pulse/` returns
  HTTP 200, and `https://apayton0789.github.io/pgh-civic-pulse/data/generated-at.json`
  reflects the latest refresh timestamp.

### Known limitation

Commits made by `refresh-data.yml` (as `github-actions[bot]`, using the default
`GITHUB_TOKEN`) do **not** automatically trigger `deploy-pages.yml`'s `push` trigger —
this is a standard GitHub Actions safeguard against workflow-triggering-workflow loops
when using the default token. As a result, after each data refresh, `deploy-pages.yml`
currently needs a manual `workflow_dispatch` (or a `workflow_run` trigger keyed off
`refresh-data.yml`'s completion) to actually publish the new data to Pages.

**Recommended follow-up:** either (a) add a `workflow_run` trigger to
`deploy-pages.yml` that fires on completion of `refresh-data.yml`, or (b) have
`refresh-data.yml` push using a personal access token/deploy key stored as a repo
secret instead of the default `GITHUB_TOKEN`, which would allow the normal `push`
trigger to fire.

## Final URLs

- Repo: https://github.com/apayton0789/pgh-civic-pulse
- Live site: **https://apayton0789.github.io/pgh-civic-pulse/**
- Refresh workflow: https://github.com/apayton0789/pgh-civic-pulse/actions/workflows/refresh-data.yml
- Deploy workflow: https://github.com/apayton0789/pgh-civic-pulse/actions/workflows/deploy-pages.yml
