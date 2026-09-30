import "server-only";

import { JWT } from "google-auth-library";
import { DASHBOARD_GROUPS, type DashboardGroup } from "./campaigns";
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

// "Username", "Approach", "CXP", "Comms Focus", and "Hook Theme" are read
// when present (str() below already defaults to "" for any column that
// isn't found) but aren't in EXPECTED_COLUMNS — several campaigns' sheets
// simply don't track these, and that's not worth warning about.

// Column names some sheets use instead of our canonical ones. Checked in
// order after the canonical name itself.
const COLUMN_ALIASES: Record<string, string[]> = {
  No: ["Content ID"],
  Tanggal: ["Date"],
};

// Keyed by a month name's first three letters. English plus the Indonesian
// names whose prefix differs (Mei, Agustus, Oktober, Desember) — FF8 Phase
// 1's sheet writes dates in Indonesian, e.g. "6 Agustus 2026".
const MONTH_ABBR: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
  mei: "05", agu: "08", okt: "10", des: "12",
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

  // "24-Aug-26", "24/Aug/2026", "6 Agustus 2026"
  const dMonY = trimmed.match(/^(\d{1,2})[-/\s]+([A-Za-z]{3,})[-/\s]+(\d{2,4})$/);
  if (dMonY) {
    const [, day, monName, yearRaw] = dMonY;
    const month = MONTH_ABBR[monName.slice(0, 3).toLowerCase()];
    if (month) {
      const year = yearRaw.length === 2 ? `20${yearRaw}` : yearRaw;
      return `${year}-${month}-${day.padStart(2, "0")}`;
    }
  }

  // "9/27/2026" — US month/day/year, as the sheets' slash dates are.
  // Parsed by hand: new Date() below would read it as *local* midnight, and
  // toISOString() can then shift it a day back in timezones ahead of UTC.
  const mdy = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy) {
    const [, month, day, year] = mdy;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  // Fallback for other formats (e.g. "Aug 24, 2026").
  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  // Unparseable text (a placeholder like "TBD", a stray note, a formula
  // error) must NOT be returned as-is: callers treat any non-empty
  // publishDate as a real date. Text sorts after every ISO date string
  // ("2026-..." starts with a digit, any letter is a higher code point),
  // so a passthrough value here used to sort as the "newest" content and
  // collect its own bogus bucket at the far right edge of the trend chart
  // — silently summing real view counts from otherwise-undated rows into
  // a fake future spike. Treating it as "no date" (same as a blank cell)
  // correctly drops the row instead.
  return "";
}

// The sheets' "Week" column holds reporting weeks like "W35" (also accept
// "Week 35", "WK35" or a bare 35). Anything else ("#N/A ()", blank) is no week.
function parseWeekNumber(raw: string): number | undefined {
  const m = raw.trim().match(/^(?:w(?:ee)?k?\s*)?(\d{1,2})$/i);
  if (!m) return undefined;
  const week = Number(m[1]);
  return week >= 1 && week <= 53 ? week : undefined;
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

// One client per group — each group reads with its own service account.
const cachedClients = new Map<DashboardGroup, JWT>();

// The private key env var is pasted by hand into Vercel, and the easy
// mistakes all make OpenSSL reject it ("DECODER routines::unsupported"),
// silently emptying every campaign. Accept the common variants:
// - escaped "\n" instead of real newlines (single-line paste)
// - surrounding quotes copied along with it
// - Windows "\r\n" line endings
// - the whole service-account JSON file instead of just its private_key
function normalizePrivateKey(raw: string): string {
  let key = raw.trim();
  if (key.startsWith("{")) {
    try {
      const parsed = JSON.parse(key) as { private_key?: unknown };
      if (typeof parsed.private_key === "string") key = parsed.private_key.trim();
    } catch {
      // Not JSON after all — use it as-is.
    }
  }
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1);
  }
  return key.replace(/\\n/g, "\n").replace(/\r\n/g, "\n").trim() + "\n";
}

function getAuthClient(group: DashboardGroup): JWT | null {
  const { emailEnv, keyEnv } = DASHBOARD_GROUPS[group];
  // A group without its own key falls back to the Clippers (default) key,
  // for setups with only one key — the sheets then need sharing with it.
  const fallback = DASHBOARD_GROUPS.clippers;
  const clientEmail = process.env[emailEnv] ?? process.env[fallback.emailEnv];
  const privateKeyRaw = process.env[keyEnv] ?? process.env[fallback.keyEnv];
  if (!clientEmail || !privateKeyRaw) return null;
  let client = cachedClients.get(group);
  if (!client) {
    client = new JWT({
      email: clientEmail,
      key: normalizePrivateKey(privateKeyRaw),
      scopes: [SHEETS_READONLY_SCOPE],
    });
    cachedClients.set(group, client);
  }
  return client;
}

export interface SheetCampaignSource {
  campaignId: string;
  group: DashboardGroup;
  spreadsheetId: string;
  sheetName: string;
}

export async function fetchSheetCampaignRecords(
  source: SheetCampaignSource,
): Promise<RawContentRecord[]> {
  const client = getAuthClient(source.group);
  if (!client) {
    const { emailEnv, keyEnv } = DASHBOARD_GROUPS[source.group];
    console.warn(
      `[google-sheets] Skipping campaign "${source.campaignId}": ` +
        `${emailEnv} / ${keyEnv} not configured.`,
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

  // valueRenderOption=UNFORMATTED_VALUE: numeric cells come back as actual
  // numbers rather than their display text — without this, a cell showing
  // "412,100" arrives as the literal string "412,100", which Number()
  // rejects (comma) and we'd silently count as 0. dateTimeRenderOption is
  // only consulted when valueRenderOption isn't FORMATTED_VALUE; setting it
  // to FORMATTED_STRING keeps dates as readable text (e.g. "24-Aug-26")
  // instead of a raw Sheets serial-number, so normalizeDateValue below still
  // has a parseable string to work with.
  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${source.spreadsheetId}` +
    `/values/${encodeURIComponent(toA1SheetRange(source.sheetName))}` +
    `?valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING`;

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

  const data = (await res.json()) as { values?: SheetCellValue[][] };
  return mapRowsToRecords(data.values ?? [], source.campaignId);
}

// With valueRenderOption=UNFORMATTED_VALUE, a numeric cell is a JSON number
// and a checkbox cell is a JSON boolean — only text cells come back as
// strings. Every cell gets normalized to a trimmed string via cellToString
// before use.
type SheetCellValue = string | number | boolean | null;

function cellToString(cell: SheetCellValue | undefined): string {
  if (cell === undefined || cell === null) return "";
  return String(cell).trim();
}

// Header matching is case/whitespace-insensitive: "Content Type", "content type",
// and "Content  Type" (double space) all resolve to the same column. Sheets
// get hand-edited by different people over time, and a cosmetic header
// difference shouldn't be able to silently zero out a whole column.
function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, " ");
}

function mapRowsToRecords(rows: SheetCellValue[][], campaignId: string): RawContentRecord[] {
  if (rows.length < 2) return [];

  const idx: Record<string, number> = {};
  rows[0].forEach((h, i) => {
    idx[normalizeHeader(cellToString(h))] = i;
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

  const str = (row: SheetCellValue[], key: string): string => {
    const i = resolveIndex(key);
    return i !== undefined ? cellToString(row[i]) : "";
  };
  const num = (row: SheetCellValue[], key: string): number => {
    const v = str(row, key);
    if (v === "") return 0;
    const n = Number(v.replace(/,/g, ""));
    return Number.isFinite(n) ? n : 0;
  };

  const dataRows = rows
    .slice(1)
    .filter((row) => row.some((cell) => cellToString(cell) !== ""));

  const records = dataRows
    .map((row, i) => {
      const rowNo = str(row, "No") || String(i + 1);
      const platform = PLATFORM_MAP[str(row, "Platform")] ?? str(row, "Platform");
      const product = str(row, "Product");
      const approach = str(row, "Approach");
      const contentType = str(row, "Content Type");
      const cxp = str(row, "CXP");
      const commsFocus = str(row, "Comms Focus");
      const hookTheme = str(row, "Hook Theme");
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
        cxp,
        commsFocus,
        hookTheme,
        week: parseWeekNumber(str(row, "Week")),
        views: num(row, "Views"),
        likes: num(row, "Like"),
        comments: num(row, "Comment"),
        shares: num(row, "Share"),
        saves: num(row, "Save"),
        thumbnailSeed: slugify(`${username}-${rowNo}`),
      };
    });

  // ids key React lists, so they must be unique. A row pasted twice (same
  // Content ID) would otherwise collide — keep both rows, suffix the repeat.
  const idCounts = new Map<string, number>();
  const duplicateIds = new Set<string>();
  for (const record of records) {
    const seen = idCounts.get(record.id) ?? 0;
    idCounts.set(record.id, seen + 1);
    if (seen > 0) {
      duplicateIds.add(record.id);
      record.id = `${record.id}-${seen + 1}`;
    }
  }
  if (duplicateIds.size > 0) {
    console.warn(
      `[google-sheets] campaign "${campaignId}": duplicate Content ID(s) ${[...duplicateIds].join(", ")}; ` +
        "kept every row, with repeats given a suffixed id.",
    );
  }

  // Sheets pre-fill rows for scheduled posts (Content ID and planned date,
  // but no link yet, 0 views, "#N/A" lookups). Those aren't content yet:
  // counting them adds zero-view posts and pushes the dataset's latest date
  // into the future, which date presets like "Last 7 Days" anchor to. A row
  // that has views but is missing its link is still real data, so keep it.
  const posted = records.filter((record) => record.contentUrl !== "" || record.views > 0);
  const notYetPosted = records.length - posted.length;
  if (notYetPosted > 0) {
    console.info(
      `[google-sheets] campaign "${campaignId}": skipped ${notYetPosted} planned row(s) with no ` +
        "Link Post and no views yet.",
    );
  }

  const withDate = posted.filter((record) => record.publishDate !== "");
  const droppedForDate = posted.length - withDate.length;
  if (droppedForDate > 0) {
    console.warn(
      `[google-sheets] campaign "${campaignId}": dropped ${droppedForDate} row(s) with a ` +
        "missing or unparseable Tanggal/Date value. Their views/engagements are excluded entirely.",
    );
  }

  return withDate;
}
