#!/usr/bin/env node
// Saves a cover image for every TikTok post in the live campaign sheets, so
// the dashboard and the HTML export don't depend on TikTok at view time.
// TikTok's oEmbed stopped returning a thumbnail_url in Oct 2026; it still
// returns the video id, and the video's embed player still shows its cover
// as the <video> poster, so that's what this saves.
//
// Output (shared with capture-meta-thumbnails.mjs):
//   public/thumbnails/tt-<key>.jpg   one cover per post
//   data/thumbnails.json             manifest read by lib/thumbnails.ts
//
// Posts that already have a cover are skipped, so re-running after new posts
// are added only fetches the new ones. Commit both outputs and redeploy.
//
// Run:      npm run capture:tiktok-thumbnails
// Options:  --force       re-fetch posts that already have a cover
//           --limit <n>   only try the first n posts
//
// Reads the sheets with the same credentials as the dashboard (from
// .env.local if present) and the same DASHBOARD_GROUP. Needs Node 22.18+.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { JWT } from "google-auth-library";
import { chromium } from "playwright";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const THUMBNAIL_DIR = path.join(ROOT, "public", "thumbnails");
const MANIFEST_PATH = path.join(ROOT, "data", "thumbnails.json");

const { values: args } = parseArgs({
  options: {
    force: { type: "boolean", default: false },
    limit: { type: "string" },
  },
});
const limit = args.limit ? Number(args.limit) : Infinity;

// Keep in sync with tiktokKey() in lib/thumbnails.ts.
function tiktokKey(url) {
  try {
    const u = new URL(url);
    if (!/(^|\.)tiktok\.com$/.test(u.hostname)) return null;
    const videoId = u.pathname.match(/\/(?:video|photo)\/(\d+)/)?.[1];
    return `tt:${videoId ?? u.hostname + u.pathname.replace(/\/+$/, "")}`;
  } catch {
    return null;
  }
}

async function tiktokLinksFromSheets() {
  try {
    process.loadEnvFile(path.join(ROOT, ".env.local"));
  } catch {
    // No .env.local — use whatever is already in the environment.
  }
  const { DASHBOARD_GROUPS, LIVE_CAMPAIGN_SOURCES, dashboardGroup } = await import("../lib/campaigns.ts");
  const group = dashboardGroup();
  const { emailEnv, keyEnv } = DASHBOARD_GROUPS[group];
  const email = process.env[emailEnv] ?? process.env[DASHBOARD_GROUPS.clippers.emailEnv];
  const key = process.env[keyEnv] ?? process.env[DASHBOARD_GROUPS.clippers.keyEnv];
  if (!email || !key) throw new Error(`${emailEnv} / ${keyEnv} not set (add them to .env.local).`);
  const client = new JWT({
    email,
    key: key.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  const links = [];
  for (const { name, sheet } of LIVE_CAMPAIGN_SOURCES.filter((c) => c.group === group)) {
    const range = `'${sheet.sheetName.replace(/'/g, "''")}'`;
    try {
      const res = await client.request({
        url: `https://sheets.googleapis.com/v4/spreadsheets/${sheet.spreadsheetId}/values/${encodeURIComponent(range)}`,
      });
      const [header = [], ...rows] = res.data.values ?? [];
      const linkCol = header.findIndex((h) => String(h).trim().toLowerCase() === "link post");
      if (linkCol === -1) continue;
      const found = rows
        .map((row) => String(row[linkCol] ?? "").trim().replace(/\.+$/, ""))
        // Same rewrite as normalizeLink() in lib/google-sheets.ts.
        .map((l) => l.replace(/^https?:\/\/(?:www\.)?tt\.site\/t\/([\w-]+).*$/i, "https://vt.tiktok.com/$1/"))
        .filter((l) => tiktokKey(l));
      console.log(`  ${name}: ${found.length} TikTok links`);
      links.push(...found);
    } catch (err) {
      console.warn(`  ${name}: couldn't read sheet (${err.message}), skipped`);
    }
  }
  return links;
}

async function videoIdFor(url) {
  const res = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`, {
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) return null;
  return (await res.json()).embed_product_id ?? null;
}

async function main() {
  console.log("Reading post links from the live sheets…");
  const links = await tiktokLinksFromSheets();
  const byKey = new Map(links.map((l) => [tiktokKey(l), l]));

  const manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8").catch(() => "{}"));
  const pending = [...byKey].filter(([key]) => args.force || !manifest[key]);
  const todo = pending.slice(0, limit);
  console.log(`${byKey.size} TikTok posts, ${byKey.size - pending.length} already have a cover, ${todo.length} to fetch.`);
  if (todo.length === 0) return;

  await mkdir(THUMBNAIL_DIR, { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext({ locale: "en-US" });
  let saved = 0;
  const failed = [];
  const queue = [...todo];

  const saveManifest = () =>
    writeFile(
      MANIFEST_PATH,
      JSON.stringify(Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b))), null, 2) + "\n",
    );

  await Promise.all(
    Array.from({ length: 3 }, async () => {
      const page = await context.newPage();
      while (queue.length) {
        const [key, url] = queue.shift();
        try {
          const id = await videoIdFor(url);
          if (!id) throw new Error("TikTok doesn't recognise the link (deleted, private or region-locked)");
          await page.goto(`https://www.tiktok.com/embed/v2/${id}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
          const poster = await page
            .waitForFunction(() => document.querySelector("video[poster]")?.getAttribute("poster"), null, { timeout: 15_000 })
            .then((h) => h.jsonValue())
            .catch(() => null);
          if (!poster) throw new Error("no cover on the embed player");
          const img = await page.request.get(poster);
          if (!img.ok() || !(img.headers()["content-type"] ?? "").startsWith("image/")) {
            throw new Error(`cover download failed (${img.status()})`);
          }
          // Covers come full HD; shrink to card size (like the Instagram ones).
          const jpeg = await page.evaluate(async (b64) => {
            const bmp = await createImageBitmap(await (await fetch(`data:image/jpeg;base64,${b64}`)).blob());
            const scale = Math.min(1, 360 / bmp.width);
            const c = document.createElement("canvas");
            c.width = Math.round(bmp.width * scale);
            c.height = Math.round(bmp.height * scale);
            c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
            return c.toDataURL("image/jpeg", 0.8).split(",")[1];
          }, (await img.body()).toString("base64"));
          const file = `tt-${key.slice(3).replace(/[^\w-]+/g, "_")}.jpg`;
          await writeFile(path.join(THUMBNAIL_DIR, file), Buffer.from(jpeg, "base64"));
          manifest[key] = `/thumbnails/${file}`;
          await saveManifest();
          saved++;
          if (saved % 25 === 0) console.log(`  … ${saved} saved`);
        } catch (err) {
          failed.push(url);
          console.warn(`  ✗ ${url}: ${err.message.split("\n")[0]}`);
        }
      }
      await page.close();
    }),
  );
  await browser.close();
  console.log(`\nSaved ${saved}, failed ${failed.length}.`);
}

await main();
