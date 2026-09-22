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

const EXPECTED_COLUMNS = [
  "No",
  "Tanggal",
  "Username",
  "Link Post",
  "Views",
  "Like",
  "Comment",
  "Save",
  "Share",
  "Product",
  "Approach",
  "Content Type",
  "Platform",
];

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

  const missing = EXPECTED_COLUMNS.filter((col) => !(normalizeHeader(col) in idx));
  if (missing.length > 0) {
    console.warn(
      `[google-sheets] campaign "${campaignId}": missing expected column(s): ${missing.join(", ")}. ` +
        "Those fields will default to empty/zero for every row.",
    );
  }

  const str = (row: string[], key: string): string => {
    const i = idx[normalizeHeader(key)];
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
        caption: `@${username} on ${platform}`,
        creator: username,
        platform,
        contentUrl: str(row, "Link Post").replace(/\.+$/, ""),
        publishDate: str(row, "Tanggal"),
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
