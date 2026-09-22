import "server-only";

import { JWT } from "google-auth-library";
import type { RawContentRecord } from "./types";

// Fetches one campaign's rows from a Google Sheet, using a service account
// with read-only access (shared to that specific sheet — see the dashboard
// README's "Adding a campaign" section for setup steps). Never throws on a
// missing/misconfigured credential or an unreachable sheet: a campaign whose
// sheet isn't wired up yet should just not appear, not break the dashboard
// for every other campaign.

const SHEETS_READONLY_SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";

const PLATFORM_MAP: Record<string, string> = {
  Tiktok: "TikTok",
  Youtube: "YouTube",
};

// Required: the dashboard can't do much without these. "No" and "Tanggal"
// also accept a newer schema's names via COLUMN_ALIASES below — every
// campaign sheet in use right now uses "Content ID"/"Date" rather than the
// original "No"/"Tanggal".
const EXPECTED_COLUMNS = [
  "No",
  "Tanggal",
  "Link Post",
  "Views",
  "Like",
  "Comment",
  "Save",
  "Share",
  "Product",
  "Content Type",
  "Platform",
];

// "Username" and "Approach" are read when present (str() below already
// defaults to "" for any column that isn't found) but aren't in
// EXPECTED_COLUMNS — several campaigns' sheets simply don't track these, and
// that's not worth warning about.

// Column names some sheets use instead of our canonical ones. Checked in
// order after the canonical name itself.
const COLUMN_ALIASES: Record<string, string[]> = {
  No: ["Content ID"],
  Tanggal: ["Date"],
};

const MONTH_ABBR: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

// publishDate must end up as an ISO "YYYY-MM-DD" string — every date
// comparison in the app (range filters, chart bucketing) assumes that
// format. The Sheets API returns a date cell's *formatted display value*
// (e.g. "24-Aug-26"), not an ISO string, so it needs normalizing here
// rather than at every call site.
function normalizeDateValue(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  const dMonY = trimmed.match(/^(\d{1,2})[-/]([A-Za-z]{3,})[-/](\d{2,4})$/);
  if (dMonY) {
    const [, day, monName, yearRaw] = dMonY;
    const month = MONTH_ABBR[monName.slice(0, 3).toLowerCase()];
    if (month) {
      const year = yearRaw.length === 2 ? `20${yearRaw}` : yearRaw;
      return `${year}-${month}-${day.padStart(2, "0")}`;
    }
  }

  // Fallback for other formats (e.g. "8/24/2026", "Aug 24, 2026").
  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return trimmed;
}

// A1 notation requires a sheet name to be single-quoted whenever it isn't a
// bare alphanumeric/underscore identifier (spaces, punctuation, a leading
// digit — exactly what real-world tab names tend to have, e.g. "1. RNPL -
// Performance"). Quoting is always valid even when not strictly required,
// so just always quote and escape any literal quote by doubling it.
function toA1SheetRange(sheetName: string): string {
  return `'${sheetName.replace(/'/g, "''")}'`;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

let cachedClient: JWT | null = null;

function getAuthClient(): JWT | null {
  const clientEmail = process.env.GOOGLE_SHEETS_CLIENT_EMAIL;
  const privateKeyRaw = process.env.GOOGLE_SHEETS_PRIVATE_KEY;
  if (!clientEmail || !privateKeyRaw) return null;
  if (cachedClient) return cachedClient;
  cachedClient = new JWT({
    email: clientEmail,
    // Vercel env vars are single-line; a key pasted with escaped \n needs
    // un-escaping. A literal multi-line paste already has real newlines and
    // this replace is a no-op either way.
    key: privateKeyRaw.replace(/\\n/g, "\n"),
    scopes: [SHEETS_READONLY_SCOPE],
  });
  return cachedClient;
}

export interface SheetCampaignSource {
  campaignId: string;
  spreadsheetId: string;
  sheetName: string;
}

export async function fetchSheetCampaignRecords(
  source: SheetCampaignSource,
): Promise<RawContentRecord[]> {
  const client = getAuthClient();
  if (!client) {
    console.warn(
      `[google-sheets] Skipping campaign "${source.campaignId}": ` +
        "GOOGLE_SHEETS_CLIENT_EMAIL / GOOGLE_SHEETS_PRIVATE_KEY not configured.",
    );
    return [];
  }

  let accessToken: string | null | undefined;
  try {
    const tokenResponse = await client.authorize();
    accessToken = tokenResponse.access_token;
  } catch (err) {
    console.error(
      `[google-sheets] campaign "${source.campaignId}": failed to authorize service account`,
      err,
    );
    return [];
  }
  if (!accessToken) return [];

  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${source.spreadsheetId}` +
    `/values/${encodeURIComponent(toA1SheetRange(source.sheetName))}`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      // Auto-updates: re-fetch at most every 5 minutes rather than on every request.
      next: { revalidate: 300 },
    });
  } catch (err) {
    console.error(`[google-sheets] campaign "${source.campaignId}": network error`, err);
    return [];
  }

  if (!res.ok) {
    console.error(
      `[google-sheets] campaign "${source.campaignId}": fetch failed (${res.status} ${res.statusText}). ` +
        "Check that the sheet is shared with the service account's client email.",
    );
    return [];
  }

  const data = (await res.json()) as { values?: string[][] };
  return mapRowsToRecords(data.values ?? [], source.campaignId);
}

// Header matching is case/whitespace-insensitive: "Content Type", "content type",
// and "Content  Type" (double space) all resolve to the same column. Sheets
// get hand-edited by different people over time, and a cosmetic header
// difference shouldn't be able to silently zero out a whole column.
function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, " ");
}

function mapRowsToRecords(rows: string[][], campaignId: string): RawContentRecord[] {
  if (rows.length < 2) return [];

  const idx: Record<string, number> = {};
  rows[0].forEach((h, i) => {
    idx[normalizeHeader(h)] = i;
  });

  const resolveIndex = (key: string): number | undefined => {
    for (const name of [key, ...(COLUMN_ALIASES[key] ?? [])]) {
      const i = idx[normalizeHeader(name)];
      if (i !== undefined) return i;
    }
    return undefined;
  };

  const missing = EXPECTED_COLUMNS.filter((col) => resolveIndex(col) === undefined);
  if (missing.length > 0) {
    console.warn(
      `[google-sheets] campaign "${campaignId}": missing expected column(s): ${missing.join(", ")}. ` +
        "Those fields will default to empty/zero for every row.",
    );
  }

  const str = (row: string[], key: string): string => {
    const i = resolveIndex(key);
    return i !== undefined ? (row[i] ?? "").trim() : "";
  };
  const num = (row: string[], key: string): number => {
    const v = str(row, key);
    if (v === "") return 0;
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  return rows
    .slice(1)
    .filter((row) => row.some((cell) => cell.trim() !== ""))
    .map((row, i) => {
      const rowNo = str(row, "No") || String(i + 1);
      const platform = PLATFORM_MAP[str(row, "Platform")] ?? str(row, "Platform");
      const product = str(row, "Product");
      const approach = str(row, "Approach");
      const contentType = str(row, "Content Type");
      const username = str(row, "Username");

      return {
        id: `${campaignId}-${rowNo}`,
        campaignId,
        title: `${contentType} · ${product}`,
        caption: username ? `@${username} on ${platform}` : `${platform} post`,
        creator: username,
        platform,
        contentUrl: str(row, "Link Post").replace(/\.+$/, ""),
        publishDate: normalizeDateValue(str(row, "Tanggal")),
        product,
        approach,
        contentType,
        views: num(row, "Views"),
        likes: num(row, "Like"),
        comments: num(row, "Comment"),
        shares: num(row, "Share"),
        saves: num(row, "Save"),
        thumbnailSeed: slugify(`${username}-${rowNo}`),
      };
    })
    .filter((record) => record.publishDate !== "");
}
