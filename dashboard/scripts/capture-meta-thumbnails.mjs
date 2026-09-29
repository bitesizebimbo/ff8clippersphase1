#!/usr/bin/env node
// Captures a thumbnail screenshot for every Meta (Instagram) post in the
// live campaign sheets, so the dashboard can show a real preview instead of
// the placeholder. Instagram has no public thumbnail API (its oEmbed needs
// a Meta developer app token), so this does what a person would: open the
// post in a real browser, close the login/cookie popups, and screenshot the
// video.
//
// Output:
//   public/thumbnails/ig-<shortcode>.jpg   one screenshot per post
//   data/thumbnails.json                   manifest read by lib/thumbnails.ts
//
// Posts that already have a screenshot are skipped, so re-running after new
// posts are added only captures the new ones. Commit both outputs and
// redeploy for the dashboard to pick them up.
//
// Setup (once):  npm install && npx playwright install chromium
// Run:           npm run capture:meta-thumbnails
// Options:
//   --url <post url>   capture just this post (repeatable); skips the sheets
//   --force            re-capture posts that already have a screenshot
//   --limit <n>        stop after n captures (handy for a test run)
//   --headed           show the browser window, to watch or debug it
//
// Reading the sheets uses the same service account as the dashboard
// (GOOGLE_SHEETS_CLIENT_EMAIL / GOOGLE_SHEETS_PRIVATE_KEY, read from
// .env.local if present). Needs Node 22.18+ (imports lib/campaigns.ts).

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { JWT } from "google-auth-library";
import { chromium } from "playwright";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const THUMBNAIL_DIR = path.join(ROOT, "public", "thumbnails");
const MANIFEST_PATH = path.join(ROOT, "data", "thumbnails.json");

// Keep in sync with lib/thumbnails.ts — the manifest keys written here are
// what it looks up.
const INSTAGRAM_POST_PATH = /^\/(?:[\w.]+\/)?(?:reels?|p|tv)\/([\w-]+)/;

function instagramShortcode(url) {
  try {
    const u = new URL(url);
    if (!/(^|\.)instagram\.com$/.test(u.hostname)) return null;
    return u.pathname.match(INSTAGRAM_POST_PATH)?.[1] ?? null;
  } catch {
    return null;
  }
}

const { values: args } = parseArgs({
  options: {
    url: { type: "string", multiple: true },
    force: { type: "boolean", default: false },
    limit: { type: "string" },
    headed: { type: "boolean", default: false },
  },
});
const limit = args.limit ? Number(args.limit) : Infinity;

// ---------------------------------------------------------------------------
// Which posts to capture

async function linksFromSheets() {
  try {
    process.loadEnvFile(path.join(ROOT, ".env.local"));
  } catch {
    // No .env.local — fall back to whatever is already in the environment.
  }
  const email = process.env.GOOGLE_SHEETS_CLIENT_EMAIL;
  const key = process.env.GOOGLE_SHEETS_PRIVATE_KEY;
  if (!email || !key) {
    throw new Error(
      "GOOGLE_SHEETS_CLIENT_EMAIL / GOOGLE_SHEETS_PRIVATE_KEY not set (add them to .env.local), " +
        "or pass posts directly with --url.",
    );
  }
  const client = new JWT({
    email,
    key: key.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  const { LIVE_CAMPAIGN_SOURCES } = await import("../lib/campaigns.ts");

  const links = [];
  for (const { name, sheet } of LIVE_CAMPAIGN_SOURCES) {
    const range = `'${sheet.sheetName.replace(/'/g, "''")}'`;
    try {
      const res = await client.request({
        url: `https://sheets.googleapis.com/v4/spreadsheets/${sheet.spreadsheetId}/values/${encodeURIComponent(range)}`,
      });
      const [header = [], ...rows] = res.data.values ?? [];
      const linkCol = header.indexOf("Link Post");
      if (linkCol === -1) {
        console.warn(`  ${name}: no "Link Post" column, skipped`);
        continue;
      }
      const found = rows.map((row) => String(row[linkCol] ?? "").trim()).filter(Boolean);
      console.log(`  ${name}: ${found.length} links`);
      links.push(...found);
    } catch (err) {
      console.warn(`  ${name}: couldn't read sheet (${err.message}), skipped`);
    }
  }
  return links;
}

// ---------------------------------------------------------------------------
// Capturing one post

// Everything Instagram may put over a logged-out post page: the cookie
// consent banner, the "Log in / Sign up" modal, and "Not now" prompts.
async function closePopups(page) {
  const buttons = [
    page.getByRole("button", { name: /^(allow all cookies|decline optional cookies|only allow essential cookies)$/i }),
    page.getByRole("button", { name: /^close$/i }),
    page.locator('[role="dialog"] svg[aria-label="Close"]').locator("xpath=ancestor::*[@role='button' or self::button][1]"),
    page.getByRole("button", { name: /^not now$/i }),
  ];
  for (const button of buttons) {
    const first = button.first();
    if (await first.isVisible().catch(() => false)) {
      await first.click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(500);
    }
  }
  await page.keyboard.press("Escape").catch(() => {});
}

async function capture(page, shortcode, outPath) {
  await page.goto(`https://www.instagram.com/reel/${shortcode}/`, {
    waitUntil: "domcontentloaded",
    timeout: 45_000,
  });
  // The login modal tends to appear a moment after load, not immediately.
  await page.waitForTimeout(3000);
  await closePopups(page);

  const video = page.locator("main video").first();
  await video.waitFor({ state: "visible", timeout: 15_000 });
  // Freeze on a real frame (not a black, still-loading one) so the
  // screenshot is stable.
  await video.evaluate(async (el) => {
    el.muted = true;
    const deadline = Date.now() + 8000;
    while (el.readyState < 2 && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    el.pause();
  });

  // A popup can still slide in late; close it again right before shooting.
  await closePopups(page);
  if (await page.locator('[role="dialog"]').first().isVisible().catch(() => false)) {
    throw new Error("a popup is still covering the post");
  }

  const box = await video.boundingBox();
  if (!box || box.width < 100 || box.height < 100) {
    throw new Error("video element not found at a usable size");
  }
  await video.screenshot({ path: outPath, type: "jpeg", quality: 80 });
}

// ---------------------------------------------------------------------------

async function main() {
  console.log(args.url ? "Using --url posts" : "Reading post links from the live sheets…");
  const links = args.url ?? (await linksFromSheets());
  const shortcodes = [...new Set(links.map(instagramShortcode).filter(Boolean))];

  const manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8").catch(() => "{}"));
  const todo = shortcodes.filter((code) => args.force || !manifest[`ig:${code}`]);
  console.log(
    `${shortcodes.length} Instagram posts, ${shortcodes.length - todo.length} already captured, ` +
      `${Math.min(todo.length, limit)} to capture.`,
  );
  if (todo.length === 0 || limit <= 0) return;

  await mkdir(THUMBNAIL_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: !args.headed });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    locale: "en-US",
  });
  const page = await context.newPage();

  const failures = [];
  let captured = 0;
  for (const code of todo) {
    if (captured >= limit) break;
    const file = `ig-${code}.jpg`;
    try {
      await capture(page, code, path.join(THUMBNAIL_DIR, file));
      manifest[`ig:${code}`] = `/thumbnails/${file}`;
      // Saved after every post, so an interrupted run keeps what it got.
      const sorted = Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)));
      await writeFile(MANIFEST_PATH, JSON.stringify(sorted, null, 2) + "\n");
      captured++;
      console.log(`  ✓ ${code}`);
    } catch (err) {
      failures.push(code);
      console.warn(`  ✗ ${code}: ${err.message.split("\n")[0]}`);
    }
    // Pace requests like a person browsing, to avoid being rate-limited.
    await page.waitForTimeout(1500 + Math.random() * 2000);
  }
  await browser.close();

  console.log(`\nCaptured ${captured}, failed ${failures.length}.`);
  if (failures.length) {
    console.log("Retry failed posts later (they're skipped until captured), or watch one with:");
    console.log(`  npm run capture:meta-thumbnails -- --headed --url https://www.instagram.com/reel/${failures[0]}/`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
