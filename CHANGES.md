# PGH Civic Pulse — Overhaul Changes

## Summary

Complete overhaul of the PGH Civic Pulse dashboard replacing the section-based briefing with a resident-action-focused workflow built around `BriefingItem` — a scored, evidence-backed data unit that connects civic events to resident engagement opportunities.

---

## Files Modified

### `shared/schema.ts`
Added 5 new TypeScript interfaces (additive, no existing types removed):

- `SourceCitation` — Single source with type, confidence, URL, optional quote, speaker, video timestamp
- `EvidenceBullet` — One factual claim with inline source references
- `BriefingItem` — Core data unit: scored, evidence-backed, infographic-ready civic item
- `FeedbackOpportunity` — Structured feedback workflow tied to a BriefingItem
- `StrategyAnswers` — User's position-development answers (React state only, not persisted)

### `client/src/components/sidebar-nav.tsx`
Replaced `navItems` array and updated imports:

| Old | New |
|-----|-----|
| Dashboard (LayoutDashboard) | Today (Zap) |
| Meetings (CalendarDays) | What Changed (RefreshCw) |
| News (Newspaper) | Feedback (MessageSquare) |
| Projects (Construction) | My Position (Target) |
| Calendar (CalendarPlus) | Draft Response (PenTool) |
| Engagement (Megaphone) | Monitoring (Eye) |
| State Radar (Landmark) | Source Trail (FileSearch) |
| Briefing (FileText) | Calendar (CalendarPlus) |

### `client/src/App.tsx`
- Added imports for all 7 new pages
- Added new routes: `/`, `/changed`, `/feedback`, `/position`, `/draft`, `/monitoring`, `/sources`, `/calendar`
- Legacy routes (`/dashboard`, `/meetings`, `/news`, `/developments`, `/engagement`, `/state-radar`, `/briefing`) remain accessible via direct URL

---

## New Files

### `server/briefing-engine.ts`
Core transformation engine that converts raw storage data into `BriefingItem[]`:

- `generateBriefingItems(meetings, news, developments, transcripts)` — main entry point with 5-min in-memory cache
- Transforms each **meeting** into a BriefingItem with:
  - Sources from YouTube video URL + meeting record
  - Evidence bullets from summaryBullets + transcript action items + contention
  - Video timestamps from timedSegments
  - Scoring: importanceScore based on contention count + topics; urgencyScore based on contention + public comment themes; influenceability based on public comment detection
- Transforms each **news item** into a BriefingItem with:
  - Source from news URL
  - Evidence from summary sentences
  - Scoring boosted for Government/Safety categories
- Transforms each **development** into a BriefingItem with:
  - `feedbackOpportunity: true` when `commentDeadline` is in the future
  - High influenceability score for items with deadlines
- Exports: `getRecentlyChangedItems()`, `getFeedbackItems()`, `getMonitoringItems()`, `getAllSources()`
- Auto-creates `FeedbackOpportunity` records for eligible items

### `server/draft-engine.ts`
Zero-AI template-based draft generator:

- `generateDrafts(item: BriefingItem, strategy: StrategyAnswers): GeneratedDrafts`
- Produces: `positionSummary`, `email`, `publicComment`, `talkingPoints[]`, `oralTestimony`
- All drafts include source citation footnotes from the briefing item's sources
- Tone (collaborative/firm/urgent) and speaking-as role are fully interpolated into templates

### `client/src/components/source-trail-panel.tsx`
Reusable collapsible panel for displaying `SourceCitation[]`:

- Grouped by type: Primary/Meeting Records/Government Docs → Secondary → Video
- Per-source: title (linked), type badge, confidence badge, date, quote, video timestamp with "Watch clip" link
- Props: `sources`, `defaultOpen`, `className`

### `client/src/components/infographic-block.tsx`
Visual card for a briefing item's infographic data block:

- Category-colored left border (driven by `item.categoryColor`)
- Displays: `displayHeadline`, `oneLineSummary`, `keyStatOrQuote`, `infographicCaption`, `callToAction`, source link
- "Copy Data" button generates formatted plain-text ready for sharing

### `client/src/pages/today.tsx`
"What Needs Attention Today" — primary entry point

- Fetches from `/api/briefing/items`
- Sorts by composite score: `importance×0.3 + urgency×0.3 + localRelevance×0.2 + influenceability×0.2`
- KPI row: Total Items, Critical count, Deadlines Today, High Importance
- Per-item card: urgency badge (color-coded), government level badge, headline, oneLineSummary, whyItMatters, actionNeeded + deadline, collapsible SourceTrailPanel, collapsible evidence bullets, video timestamp links, collapsible InfographicBlock, "Take Action" button (→ `/feedback?id=X`)

### `client/src/pages/what-changed.tsx`
Timeline view of items with `date >= yesterday`

- Fetches from `/api/briefing/changed`
- Grouped by: Today / Yesterday / Earlier
- Vertical timeline with dots; "NEW" vs "UPDATED" indicator
- Shows: headline, whatChanged, urgency badge, category badge, date

### `client/src/pages/feedback-opportunities.tsx`
Lists items where `feedbackOpportunity: true`

- Fetches from `/api/briefing/feedback`
- Per card: urgency badge, deadline badge, headline, receiving body, submission method
- Expandable background section: bodyPower, whoAffected, likelyConsequences, SourceTrailPanel
- "Develop My Position" button → `/position?id=X`

### `client/src/pages/develop-position.tsx`
Full guided position-development workflow

- Gets `id` from hash query string (`?id=X`)
- Displays briefing item as context (with SourceTrailPanel)
- 7-field strategy form: whatMatters, desiredOutcome, mostAffected, strongestFact, strongestValue, tone (select), speakingAs (select)
- "Generate Drafts" → POST `/api/feedback/generate-drafts`
- Results in tabs: Position Summary | Email | Public Comment | Talking Points | Oral Testimony
- Per-tab copy button

### `client/src/pages/draft-response.tsx`
Quick draft generation without full workflow

- Lists recent feedback opportunities; user selects one
- "Quick Draft" → generates with DEFAULT_STRATEGY
- "Full Position Workflow" → navigates to `/position?id=X`
- Draft tabs: Email | Public Comment | Talking Points | Oral Testimony

### `client/src/pages/monitoring.tsx`
Lower-priority items (`importanceScore <= 4 OR urgencyScore <= 3`)

- Fetches from `/api/briefing/items`, client-side filters
- Grouped by `topicArea`
- Compact cards: headline, date, governmentLevel badge, confidence badge
- "Promote" button removes item from monitoring list (session-state only)

### `client/src/pages/source-trail.tsx`
Searchable, filterable evidence panel for all sources

- Fetches from `/api/sources`
- Filters: text search (title + quote), sourceType, confidenceLevel
- Grouped: Primary Sources → Secondary Reporting → Video / Audio
- Per source: title (linked), type badge, confidence badge, date, quote, video timestamp

---

## New API Endpoints (additive — all existing routes preserved)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/briefing/items` | All BriefingItems sorted by composite score |
| GET | `/api/briefing/changed` | Items where date >= yesterday |
| GET | `/api/briefing/feedback` | `{ items: BriefingItem[], opportunities: FeedbackOpportunity[] }` for items with feedbackOpportunity=true |
| GET | `/api/sources` | All SourceCitations across all items (deduplicated) |
| POST | `/api/feedback/generate-drafts` | `{ briefingItemId, strategy }` → `{ positionSummary, email, publicComment, talkingPoints, oralTestimony }` |

---

## Build Result

```
✓ Client: 498.62 kB JS, 94.84 kB CSS (built in 16.35s)
✓ Server: 854.8 kB CJS bundle
✓ No TypeScript errors
✓ No build errors (PostCSS notice is pre-existing, not caused by this PR)
```

---

## Architecture Notes

- **In-memory cache** in `briefing-engine.ts`: 5-minute TTL, invalidated on next request after expiry. This prevents repeated re-computation on every page load.
- **Zero AI**: All draft generation is pure template string interpolation — no LLM calls.
- **No new dependencies**: Uses existing shadcn/ui components only.
- **No localStorage**: All state is React state. Strategy answers in DevelopPosition are ephemeral session state.
- **Hash routing preserved**: All new routes use `useHashLocation()` compatible paths.
- **`apiRequest` used exclusively**: No raw `fetch()` calls in any new page.
