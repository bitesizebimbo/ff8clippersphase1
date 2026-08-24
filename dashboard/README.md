# Content Performance Dashboard

A client-facing analytics dashboard for the **Samsung Galaxy Z Fold8 / Z Fold8
Ultra / Z Flip8** creator-seeding campaign ("FF8 Clippers Phase 1"). Built with
Next.js (App Router), TypeScript, Tailwind CSS, Radix UI primitives, and
Recharts.

## Running it

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Other scripts: `npm run build` (production build), `npm run start` (serve the
production build), `npm run lint`, `npx tsc --noEmit` (typecheck).

## Project structure

```
app/
  layout.tsx          Root layout, fonts, metadata
  page.tsx             Entry point — wraps DashboardShell in <Suspense>
  globals.css          Design tokens (colors, radii, shadows) via Tailwind v4 @theme

components/
  dashboard/           Feature components (one concern each, see below)
  ui/                  Small reusable primitives (Button, Badge, Tabs, Popover,
                        MultiSelect, Sheet/drawer, Skeleton) built on Radix UI

lib/
  types.ts             All domain types (ContentItem, DailyPerformanceRecord,
                        DashboardFilters, ClassificationBreakdown, ...)
  analytics.ts          Pure calculation layer: engagement math, daily/weekly
                        aggregation, classification aggregation. Every number
                        shown in the UI is derived here — nothing is
                        hand-computed inside a component.
  filters.ts           Date-range resolution (presets → concrete ISO ranges)
                        and record filtering.
  formatters.ts        Number/date/percent formatting (compact "12.4M" style,
                        exact values, signed deltas).
  data.ts               The data-access abstraction (see "Replacing mock
                        data" below).
  use-dashboard-state.ts  Single hook holding all dashboard UI state, backed
                        by URL search params.
  utils.ts              `cn()` classname helper.

data/
  content.json          The ingested dataset (483 content items), generated
                        by scripts/transform-csv.mjs from the wiki CSV export.

scripts/
  transform-csv.mjs     Re-run this after raw/wiki data changes to regenerate
                        data/content.json: `node scripts/transform-csv.mjs`
```

### Dashboard components

| Component | Responsibility |
|---|---|
| `DashboardShell` | Orchestrates state → data-layer calls → child components. The only component that calls `lib/data.ts`. |
| `DashboardHeader` | Title, campaign name, "data through" timestamp, date range picker slot. |
| `DateRangePicker` | Presets (Last 7/30/90 Days, This Month, Last Month, All Time) + custom range. |
| `FilterBar` | Product / Approach / Content Type / Platform multi-selects + search. |
| `KPIOverview` / `KPICard` | Headline metrics, with period-over-period deltas when a real previous period exists. |
| `PerformanceChart` | Daily/weekly trend, metric switcher, engagement-rate overlay. |
| `ClassificationPerformance` | Ranked breakdown by one of the four classification dimensions. |
| `ContentLibrary` / `ContentCard` / `ContentTable` | Grid/table content browser with sort, pagination, and empty state. |
| `ContentDetailDrawer` | Side drawer (full-screen on mobile) with full metrics, classifications, and the external link CTA. |
| `ContentThumbnail` | Deterministic placeholder art (see "On thumbnails" below). |
| `EmptyState`, `DashboardSkeleton` | Empty and loading states. |

## Data model

```ts
interface ContentItem {
  id: string;
  title: string;
  caption: string;
  creator: string;
  platform: string;           // "TikTok" | "YouTube" | ...
  contentUrl: string;
  publishDate: string;        // ISO date
  product: string;
  approach: string;
  contentType: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves?: number;
  totalEngagements: number;   // derived, never trusted from source
  engagementRate: number;     // derived, 0..1
}
```

`totalEngagements` and `engagementRate` are **always** computed by
`lib/analytics.ts` (`calculateTotalEngagements`, `calculateEngagementRate`)
from the raw counters — the raw dataset's fields are never read for these,
so the UI can't show numbers that disagree with each other.

```ts
interface DailyPerformanceRecord {
  date: string;        // observation date
  contentId: string;
  views: number; likes: number; comments: number; shares: number; saves?: number;
}
```

`getPerformanceTimeline()` aggregates these into `TimelinePoint[]` for the
trend chart, either daily (`aggregateByDate`) or weekly
(`aggregateByWeek`, Monday-start ISO weeks). **Weekly engagement rate is
always `sum(engagements) / sum(views)` for the week, never an average of
daily rates** — averaging rates would silently over-weight low-view days.

## KPI definitions

- **Total Views** — sum of `views` across all content matching the active filters and date range.
- **Total Engagements** — `likes + comments + shares + (saves ?? 0)`.
- **Engagement Rate** — `totalEngagements / views`, `0` when views is `0` (never divides by zero).
- **Period-over-period deltas** on the three primary KPI cards only render when a genuine previous-equivalent period exists **inside the dataset's own date bounds** (`resolvePreviousPeriod` in `lib/filters.ts`). If the selected range already touches the earliest available date, no delta is shown — a comparison is never fabricated.

## Assumptions worth knowing about

The source data is a single-phase, 8-day creator-seeding campaign (6–13 Aug
2026), captured as **one cumulative snapshot per post**, not day-by-day
observations. A few product decisions follow from that:

1. **Time series is publish-date-based.** Since there's no per-day
   observation data, each `ContentItem` currently produces exactly one
   `DailyPerformanceRecord`, dated at its `publishDate`. The trend chart is
   therefore "views/engagements of posts published on day X," not "views
   accrued on day X." The data model and `getPerformanceTimeline()` fully
   support genuine multi-day observations, though — if a live API starts
   supplying daily snapshots per `contentId`, no UI or aggregation code
   needs to change.
2. **Date presets are anchored to the dataset's latest date, not the
   wall-clock date.** This is a bounded historical campaign; anchoring
   "Last 7 Days" to today's real date would show an empty dashboard. Presets
   resolve relative to `max(publishDate)` in the data (see
   `resolveDatePreset` in `lib/filters.ts`). A preset like "Last Month" can
   legitimately return zero results if the campaign doesn't span into the
   previous calendar month — that's correct, not a bug.
3. **"Data through" instead of a live "last updated" clock.** The header
   shows the latest date present in the dataset rather than a fabricated
   live-sync timestamp, since this is a static ingested export, not a
   polling connection.
4. **On thumbnails.** The source data has no thumbnail images — only post
   URLs. Rather than invent fake image URLs (which would either 404 or
   hotlink an unrelated image), each card renders a deterministic muted
   gradient placeholder seeded from the content id, with the creator's
   initial and a platform badge. This is also why there's no "broken
   thumbnail" state to handle — the placeholder can't fail to load.
5. **Titles/captions are synthesized**, since the source has no per-post
   title or caption column: title is `"{Content Type} · {Product}"`,
   caption is `"@{creator} on {platform}"`. Search still matches against
   creator handle, product, and content id.
6. **Single light theme in v1** (no dark mode), by design choice given
   scope — the token structure in `app/globals.css` (`--background`,
   `--foreground`, etc.) is ready for a dark variant to be added later.

## Replacing mock data with a real API

Every screen reads through `lib/data.ts` — never through `data/content.json`
directly:

```ts
getDashboardSummary(filters)
getContentPerformance(filters)
getPerformanceTimeline(filters, granularity)
getClassificationPerformance(dimension, filters)
getContentById(id)
getFilterOptions()
getDatasetDateBounds()
```

To swap in a live backend (REST, Supabase, BigQuery, Google Sheets,
Airtable, ...):

1. Replace the module-level `CONTENT` array in `lib/data.ts` with a fetch
   call (e.g. move the exported functions into async Server Actions or
   `route.ts` handlers that hit your API, or fetch once in a Server
   Component and pass the array down).
2. Keep every function's signature the same — `DashboardShell` and every
   child component only depend on these function signatures and the types
   in `lib/types.ts`, not on the JSON file.
3. If your API starts providing true daily observations per content item,
   populate `DailyPerformanceRecord[]` accordingly (one entry per
   `contentId` per observation date) — `aggregateByDate`/`aggregateByWeek`
   in `lib/analytics.ts` need no changes.
4. To re-derive `data/content.json` from a refreshed raw export in the
   meantime, edit and re-run `scripts/transform-csv.mjs`.

## Notes

- Filter/sort/search/chart state is stored in the URL (`?platform=TikTok&range=last7&sort=views-desc&...`), so any filtered view is a shareable link.
- The dashboard is read-only in v1 (per the brief's assumptions) — there is no write path.
- v1 architecture assumes TikTok/YouTube as the platforms in play, but nothing is hardcoded to a fixed platform list beyond the `PlatformBadge` style map, which falls back to a neutral badge for any unrecognized platform string.
