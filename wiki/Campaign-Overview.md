# Campaign Overview

## What this is

Row-level tracking of creator/influencer posts ("clippers") promoting the
Samsung Galaxy **Z Fold8**, **Z Fold8 Ultra**, and **Z Flip8** during Phase 1
of the campaign. Each row is one published post with its engagement metrics
at time of capture.

- **Date range:** 2026-08-06 to 2026-08-13 (8 days)
- **Total posts tracked:** 483
- **Unique creators:** 310
- **Platforms:** TikTok (429 posts), YouTube (54 posts, all Shorts)
- **Total views:** 20,666,196
- **Total likes:** 26,078
- **Total comments:** 554
- **Total saves:** 2,846
- **Total shares:** 489

## Schema (source columns)

| Column | Meaning |
|---|---|
| `No` | Row sequence number |
| `Tanggal` | Post date (Indonesian for "date") |
| `Username` | Creator's handle on the platform |
| `Link Post` | URL to the published post |
| `Views` | View count |
| `Like` | Like count |
| `Comment` | Comment count |
| `Save` | Save/bookmark count |
| `Share` | Share count |
| `Product` | Product(s) featured — `Z Fold8`, `Z Fold8 Ultra`, or a multi-product mention |
| `Approach` | Campaign angle/partner tag — `CC`, `Telkomsel`, `Finance +`, `CTA PO Only` |
| `Content Type` | `Clippers` (creator clip/reaction content), `AI` (AI-generated/assisted content), or `HQ Localized` (high-quality localized brand content) |
| `Platform` | `Tiktok` or `Youtube` |

## Data quality notes

- Row `No = 310` (Excel row 312) has a corrupted date cell (`#VALUE!` /
  invalid serial `6707536`) in the source workbook. Based on the surrounding
  rows (same creator `putra.jefri0`, adjacent rows all dated 2026-08-09),
  this was normalized to **2026-08-09** in the CSV export.
- One `Save` value is blank in the source; treated as `0` in the CSV export.
- `Product` has a combined value (`Z Fold8 Ultra, Fold8, Flip8`) for 15 posts
  that mention multiple products in one piece of content — these are kept as
  a distinct category rather than split, to stay faithful to the source.
- `raw/readme` and `wiki/readme` in the original repo were empty placeholders.

See [Performance Breakdown](Performance-Breakdown.md) and
[Creator Leaderboard](Creator-Leaderboard.md) for the full stats.
