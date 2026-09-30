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
//                (and have Google Chrome installed — it's what plays the videos)
// Run:           npm run capture:meta-thumbnails
// Options:
//   --url <post url>   capture just this post (repeatable); skips the sheets
//   --force            re-capture posts that already have a screenshot
//   --limit <n>        only try the first n posts (handy for a test run)
//   --headed           show the browser window, to watch or debug it
//   --delay <seconds>  base wait between posts (default 8; each wait is a
//                      random 1–2× this). Raise it if Instagram pushes back.
//
// If Instagram rate-limits the run (429, or bounces to its login page), the
// script backs off — waits 5, then 10, then 20 minutes and retries the same
// post — and stops cleanly if it's still blocked, keeping everything
// captured so far. Just run it again later to continue.
//
// Reading the sheets uses the same service account as the dashboard
// (GOOGLE_SHEETS_CLIENT_EMAIL / GOOGLE_SHEETS_PRIVATE_KEY, read from
// .env.local if present). Without those, it uses the saved link list in
// data/meta-post-links.txt instead (one post URL per line — refresh it when
// new posts are added). Needs Node 22.18+ (imports lib/campaigns.ts).

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { JWT } from "google-auth-library";
import { chromium } from "playwright";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const THUMBNAIL_DIR = path.join(ROOT, "public", "thumbnails");
const MANIFEST_PATH = path.join(ROOT, "data", "thumbnails.json");
const SAVED_LINKS_PATH = path.join(ROOT, "data", "meta-post-links.txt");
// A full-page screenshot of every post that fails, to see what went wrong.
const DEBUG_DIR = path.join(ROOT, "capture-debug");

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
    delay: { type: "string", default: "8" },
  },
});
const limit = args.limit ? Number(args.limit) : Infinity;
const delayMs = Number(args.delay) * 1000;

// Waits after Instagram rate-limits us, before retrying; when these run
// out, the run stops.
const BACKOFF_MINUTES = [5, 10, 20];

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
    const saved = await readFile(SAVED_LINKS_PATH, "utf8").catch(() => null);
    if (saved === null) {
      throw new Error(
        "GOOGLE_SHEETS_CLIENT_EMAIL / GOOGLE_SHEETS_PRIVATE_KEY not set (add them to .env.local), " +
          "or pass posts directly with --url.",
      );
    }
    const links = saved.split("\n").map((line) => line.trim()).filter(Boolean);
    console.log(`  No Google Sheets keys set — using the ${links.length} saved links in data/meta-post-links.txt`);
    return links;
  }
  const client = new JWT({
    email,
    key: key.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  const { LIVE_CAMPAIGN_SOURCES, dashboardGroup } = await import("../lib/campaigns.ts");
  // Same group (Clippers or OA) as the dashboard — the key only reads its
  // own group's sheets.
  const group = dashboardGroup();

  const links = [];
  for (const { name, sheet } of LIVE_CAMPAIGN_SOURCES.filter((c) => c.group === group)) {
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

class RateLimitedError extends Error {}

// Instagram's videos are H.264, which Playwright's bundled Chromium can't
// play (Instagram shows "Sorry, we're having trouble playing this video").
// Google Chrome can, so use the installed Chrome when there is one.
let usingBundledChromium = false;

async function launchBrowser() {
  const headless = !args.headed;
  try {
    return await chromium.launch({ channel: "chrome", headless });
  } catch {
    console.warn(
      "  Google Chrome not found — using Playwright's Chromium, which usually can't play Instagram videos.\n" +
        "  Install Chrome from https://www.google.com/chrome if posts fail with \"the video couldn't play\".",
    );
    usingBundledChromium = true;
    return chromium.launch({ headless });
  }
}

async function capture(page, shortcode, outPath) {
  let response;
  try {
    response = await page.goto(`https://www.instagram.com/reel/${shortcode}/`, {
      waitUntil: "domcontentloaded",
      timeout: 45_000,
    });
  } catch (err) {
    // Chromium reports an error-status page (e.g. 429) as a navigation failure.
    if (/ERR_HTTP_RESPONSE_CODE_FAILURE/.test(err.message)) throw new RateLimitedError("blocked by Instagram");
    throw err;
  }
  if (response?.status() === 429 || page.url().includes("/accounts/login")) {
    throw new RateLimitedError("Instagram is asking to log in / rate-limiting");
  }
  // The login modal tends to appear a moment after load, not immediately.
  await page.waitForTimeout(3000);
  await closePopups(page);

  // Instagram's layout varies (and changes), so rather than rely on one
  // selector, take the largest visible video on the page — or, if there's
  // no video, the largest portrait image (the reel's cover) — and mark it.
  const found = await page
    .waitForFunction(
      () => {
        const visibleArea = (el) => {
          const r = el.getBoundingClientRect();
          const style = getComputedStyle(el);
          if (style.visibility === "hidden" || style.display === "none" || r.width < 100 || r.height < 100) return 0;
          return r.width * r.height;
        };
        const pick = (els) => els.sort((a, b) => visibleArea(b) - visibleArea(a)).find((el) => visibleArea(el) > 0);
        const target =
          pick([...document.querySelectorAll("video")]) ??
          pick([...document.querySelectorAll("img")].filter((img) => img.naturalHeight > img.naturalWidth * 1.1));
        if (!target) return false;
        document.querySelectorAll("[data-capture-target]").forEach((el) => el.removeAttribute("data-capture-target"));
        target.setAttribute("data-capture-target", "");
        return target.tagName;
      },
      null,
      { timeout: 20_000, polling: 500 },
    )
    .then((handle) => handle.jsonValue())
    .catch(() => null);
  if (!found) throw new Error("couldn't find the reel's video or cover image on the page");
  const media = page.locator("[data-capture-target]").first();

  if (found === "VIDEO") {
    // Freeze on a real frame (not a black, still-loading one) so the
    // screenshot is stable.
    const playable = await media.evaluate(async (el) => {
      el.muted = true;
      el.play?.().catch(() => {});
      const deadline = Date.now() + 10_000;
      while (el.readyState < 2 && !el.error && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
      el.pause();
      return el.readyState >= 2;
    });
    // Never save a black "can't play this video" frame as a thumbnail.
    if (!playable) {
      throw new Error(
        "the video couldn't play" +
          (usingBundledChromium ? " — install Google Chrome, which can play Instagram videos" : ""),
      );
    }
  }

  // A popup can still slide in late; close it again right before shooting.
  await closePopups(page);
  if (await page.locator('[role="dialog"]').first().isVisible().catch(() => false)) {
    throw new Error("a popup is still covering the post");
  }

  await media.screenshot({ path: outPath, type: "jpeg", quality: 80 });
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
  const browser = await launchBrowser();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    locale: "en-US",
  });
  const page = await context.newPage();

  const failures = [];
  let captured = 0;
  let backoffStep = 0;
  let stoppedEarly = false;
  const total = Math.min(todo.length, limit);
  for (let i = 0; i < total; ) {
    const code = todo[i];
    const file = `ig-${code}.jpg`;
    try {
      await capture(page, code, path.join(THUMBNAIL_DIR, file));
      manifest[`ig:${code}`] = `/thumbnails/${file}`;
      // Saved after every post, so an interrupted run keeps what it got.
      const sorted = Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)));
      await writeFile(MANIFEST_PATH, JSON.stringify(sorted, null, 2) + "\n");
      captured++;
      backoffStep = 0;
      console.log(`  ✓ ${code} (${i + 1}/${total})`);
      i++;
    } catch (err) {
      if (err instanceof RateLimitedError) {
        if (backoffStep >= BACKOFF_MINUTES.length) {
          console.warn(`  ✗ ${code}: still blocked after backing off — stopping here.`);
          stoppedEarly = true;
          break;
        }
        const minutes = BACKOFF_MINUTES[backoffStep++];
        console.warn(`  … ${code}: ${err.message}; waiting ${minutes} min before retrying`);
        await page.waitForTimeout(minutes * 60_000);
        continue; // retry the same post
      }
      failures.push(code);
      console.warn(`  ✗ ${code}: ${err.message.split("\n")[0]}`);
      await mkdir(DEBUG_DIR, { recursive: true });
      await page.screenshot({ path: path.join(DEBUG_DIR, `${code}.png`) }).catch(() => {});
      i++;
    }
    // Space posts out like a person browsing, so the run stays well under
    // Instagram's rate limits.
    await page.waitForTimeout(delayMs * (1 + Math.random()));
  }
  await browser.close();

  console.log(`\nCaptured ${captured}, failed ${failures.length}.`);
  if (stoppedEarly) {
    console.log("Instagram kept blocking requests, so the run stopped early. Wait an hour or so and");
    console.log("run it again (captured posts are kept and skipped); a larger --delay helps.");
  }
  if (failures.length) {
    console.log(`What the page looked like for each failed post is saved in ${DEBUG_DIR}`);
    console.log("Retry failed posts later (they're skipped until captured), or watch one with:");
    console.log(`  npm run capture:meta-thumbnails -- --headed --url https://www.instagram.com/reel/${failures[0]}/`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
