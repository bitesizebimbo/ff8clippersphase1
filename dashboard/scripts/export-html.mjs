#!/usr/bin/env node
// Exports the dashboard as ONE self-contained HTML file: same UI and
// interactivity (campaign switcher, filters, charts, content cards), with
// the live sheet data as of now and every thumbnail embedded. It opens from
// disk with no internet, login or server, so it can be emailed or shared.
//
// Run from the dashboard folder:
//   npm run export:html -- --name "Clippers Project Dashboard Sep 30" --date "30 Sep 2026"
// Output: exports/<name>.html (gitignored)
//
// Needs the same Google Sheets credentials as the dashboard
// (GOOGLE_SHEETS_CLIENT_EMAIL / GOOGLE_SHEETS_PRIVATE_KEY, or .env.local).
// Campaigns whose sheet can't be read are left out, and the run says so.
//
// How it works: the app is copied to a temp folder and patched for offline
// use (static export, URL state via the history API, thumbnails looked up
// from an embedded map, a snapshot title), built with `next build`, then
// every script, stylesheet and font is inlined into index.html.

import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { chromium } from "playwright";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { values: args } = parseArgs({
  options: {
    name: { type: "string", default: `Clippers Project Dashboard ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short" }).split(" ").reverse().join(" ")}` },
    date: { type: "string", default: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) },
    keep: { type: "boolean", default: false },
  },
});
try {
  process.loadEnvFile(path.join(ROOT, ".env.local"));
} catch {
  // No .env.local — use whatever is already in the environment.
}
if (!process.env.GOOGLE_SHEETS_CLIENT_EMAIL || !process.env.GOOGLE_SHEETS_PRIVATE_KEY) {
  console.error("GOOGLE_SHEETS_CLIENT_EMAIL / GOOGLE_SHEETS_PRIVATE_KEY are not set (environment or .env.local).");
  process.exit(1);
}

const run = (cmd, argv, opts = {}) => execFileSync(cmd, argv, { stdio: "inherit", env: process.env, ...opts });
const step = (msg) => console.log(`\n▸ ${msg}`);

// ---------------------------------------------------------------------------
step("Copying the app to a temp folder");
const work = mkdtempSync(path.join(tmpdir(), "dashboard-export-"));
const SKIP = new Set(["node_modules", ".next", "out", "exports", "capture-debug", ".env.local"]);
for (const entry of readdirSync(ROOT)) {
  if (!SKIP.has(entry)) cpSync(path.join(ROOT, entry), path.join(work, entry), { recursive: true });
}
// Turbopack refuses a symlinked node_modules; hard links are fast and cheap.
try {
  run("cp", ["-al", path.join(ROOT, "node_modules"), path.join(work, "node_modules")], { stdio: "ignore" });
} catch {
  run("cp", ["-a", path.join(ROOT, "node_modules"), path.join(work, "node_modules")]);
}
rmSync(path.join(work, "app/api"), { recursive: true, force: true });
rmSync(path.join(work, "public/thumbnails"), { recursive: true, force: true });

// ---------------------------------------------------------------------------
step("Patching the copy for offline use");
function edit(file, pairs) {
  const p = path.join(work, file);
  let s = readFileSync(p, "utf8");
  for (const [from, to] of pairs) {
    if (!s.includes(from)) throw new Error(`export-html: expected text not found in ${file}:\n${from}`);
    s = s.replace(from, to);
  }
  writeFileSync(p, s);
}
edit("next.config.ts", [["  /* config options here */", '  output: "export",\n  images: { unoptimized: true },']]);
edit("app/page.tsx", [["export const revalidate = 300;\n", ""]]);
edit("app/layout.tsx", [["  title: `Content Performance | ${groupTitle}`,", `  title: ${JSON.stringify(args.name)},`]]);
edit("components/dashboard/DashboardHeader.tsx", [
  ["          Content Performance", "          Clippers Project Dashboard"],
  ["          Understand how your seeded content is performing.", `          Snapshot as of ${args.date}.`],
]);
edit("lib/use-dashboard-state.ts", [[
  "      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });",
  '      window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);',
]]);
{
  const p = path.join(work, "components/dashboard/ContentThumbnail.tsx");
  let s = readFileSync(p, "utf8");
  s = s.replace('import { capturedThumbnailFor } from "@/lib/thumbnails";', 'import snapshotThumbnails from "@/data/snapshot-thumbs.json";');
  s = s.replace(/\/\/ Platforms app\/api\/thumbnail\/route\.ts can serve a real image for\.\nconst ROUTE_SUPPORTED_PLATFORMS = [^\n]*\n/, "");
  s = s.replace(
    /function thumbnailSrc\(contentUrl: string, platform: Platform\): string \| null \{[\s\S]*?\n\}/,
    "const SNAPSHOT_THUMBNAILS: Record<string, string> = snapshotThumbnails;\nfunction thumbnailSrc(contentUrl: string, platform: Platform): string | null {\n  void platform;\n  return SNAPSHOT_THUMBNAILS[contentUrl] ?? null;\n}",
  );
  if (!s.includes("SNAPSHOT_THUMBNAILS")) throw new Error("export-html: couldn't patch ContentThumbnail.tsx");
  writeFileSync(p, s);
}

// ---------------------------------------------------------------------------
step("Reading every post from the live sheets");
writeFileSync(path.join(work, "_list-items.mts"), `
import { loadAllContent } from "./lib/load-content";
import { writeFileSync } from "node:fs";
const { content, campaigns } = await loadAllContent();
writeFileSync("_items.json", JSON.stringify({
  campaigns: campaigns.map((c) => c.name),
  items: [...new Map(content.map((c) => [c.contentUrl, [c.platform, c.contentUrl]])).values()],
}));
`);
run("npx", ["-y", "tsx", "--conditions=react-server", "_list-items.mts"], { cwd: work });
const { campaigns, items } = JSON.parse(readFileSync(path.join(work, "_items.json"), "utf8"));
console.log(`  campaigns: ${campaigns.join(", ")} | ${items.length} posts`);

// ---------------------------------------------------------------------------
step("Embedding thumbnails (downscaled)");
const manifest = JSON.parse(readFileSync(path.join(ROOT, "data/thumbnails.json"), "utf8"));
const IG = /^\/(?:[\w.]+\/)?(?:reels?|p|tv)\/([\w-]+)/;
async function imageBytes(platform, url) {
  let u;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (/(^|\.)instagram\.com$/.test(u.hostname)) {
    const file = manifest[`ig:${u.pathname.match(IG)?.[1]}`];
    return file ? readFileSync(path.join(ROOT, "public", file)) : null;
  }
  let imageUrl = null;
  if (platform === "YouTube") {
    const id = u.hostname === "youtu.be" ? u.pathname.slice(1).split("/")[0]
      : u.pathname === "/watch" ? u.searchParams.get("v") : u.pathname.split("/")[2];
    if (id) imageUrl = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
  } else if (platform === "TikTok") {
    const res = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`, { signal: AbortSignal.timeout(8000) });
    if (res.ok) imageUrl = (await res.json()).thumbnail_url ?? null;
  }
  if (!imageUrl) return null;
  const img = await fetch(imageUrl, { signal: AbortSignal.timeout(10_000) });
  return img.ok ? Buffer.from(await img.arrayBuffer()) : null;
}
let browser;
try {
  browser = await chromium.launch({ channel: "chrome" });
} catch {
  browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
}
const page = await browser.newPage();
const thumbs = {};
const queue = [...items];
let missing = 0;
await Promise.all(Array.from({ length: 8 }, async () => {
  while (queue.length) {
    const [platform, url] = queue.shift();
    try {
      const bytes = await imageBytes(platform, url);
      if (!bytes) {
        missing++;
        continue;
      }
      thumbs[url] = await page.evaluate(async (b64) => {
        const blob = await (await fetch(`data:image/jpeg;base64,${b64}`)).blob();
        const img = await createImageBitmap(blob);
        const W = 180, H = 320, c = document.createElement("canvas");
        c.width = W;
        c.height = H;
        const s = Math.max(W / img.width, H / img.height);
        c.getContext("2d").drawImage(img, (W - img.width * s) / 2, (H - img.height * s) / 2, img.width * s, img.height * s);
        return c.toDataURL("image/jpeg", 0.62);
      }, bytes.toString("base64"));
    } catch {
      missing++;
    }
  }
}));
await browser.close();
writeFileSync(path.join(work, "data/snapshot-thumbs.json"), JSON.stringify(thumbs));
console.log(`  ${Object.keys(thumbs).length} embedded, ${missing} without a thumbnail (placeholder shown)`);

// ---------------------------------------------------------------------------
step("Building the static export");
run("npx", ["next", "build"], { cwd: work });

// ---------------------------------------------------------------------------
step("Inlining scripts, styles and fonts into one file");
const out = path.join(work, "out");
let html = readFileSync(path.join(out, "index.html"), "utf8");
const read = (p) => readFileSync(path.join(out, p.replace(/^\//, "")), "utf8");
const CURRENT_SCRIPT = '"object"==typeof document?document.currentScript:void 0';
html = html.replace(/<script([^>]*\ssrc="(\/_next\/[^"]+)"[^>]*)><\/script>/g, (_, attrs, src) => {
  let js = read(src);
  // Turbopack chunks identify themselves by their <script src>; inline ones
  // pass their original path instead, which the runtime also accepts.
  js = js.split(CURRENT_SCRIPT).join(JSON.stringify(src.replace("/_next/", "")));
  // Next derives its asset prefix from document.currentScript.src; there is
  // none inline, and nothing is loaded from disk, so the prefix is "".
  const m = js.match(/getAssetPrefix",\{enumerable:!0,get:function\(\)\{return (\w+)\}\}\);/);
  if (m) {
    const fn = `function ${m[1]}(){`;
    const i = js.indexOf(fn, m.index);
    if (i !== -1) js = js.slice(0, i + fn.length) + 'return"";' + js.slice(i + fn.length);
  }
  js = js.split("</script").join("<\\/script");
  return `<script${/noModule/.test(attrs) ? " nomodule" : ""}>${js}</script>`;
});
html = html.replace(/<link rel="stylesheet" href="(\/_next\/[^"]+)"[^>]*\/>/g, (_, href) => {
  const css = read(href).replace(/url\((?:\/_next\/static|\.\.)\/media\/([^)]+\.woff2)\)/g, (_m, font) =>
    `url(data:font/woff2;base64,${readFileSync(path.join(out, "_next/static/media", font)).toString("base64")})`);
  return `<style>${css}</style>`;
});
html = html.replace(/<link rel="(?:preload|icon)"[^>]*\/>/g, "");
// React re-inserts the stylesheet, font preloads, chunk scripts and favicon
// from the RSC payload. Their content is already inline, so send those
// requests to empty inline data instead of files that don't exist offline.
const SHIM = `<script>(function(){var E=Element.prototype,S=E.setAttribute;
function fix(el,n,v){if(typeof v!=="string"||!/(^|\\/)_next\\/|\\.woff2($|\\?)|favicon\\.ico|(^|\\/)static\\/(chunks|media)\\//.test(v)||/^(data|blob|https?):/.test(v))return v;
if(n==="src")return "data:text/javascript,";if(n==="href")return /\\.css/.test(v)?"data:text/css,":"data:text/plain,";return v;}
E.setAttribute=function(n,v){return S.call(this,n,fix(this,n,v));};
[["src",HTMLScriptElement],["href",HTMLLinkElement]].forEach(function(p){var d=Object.getOwnPropertyDescriptor(p[1].prototype,p[0]);
Object.defineProperty(p[1].prototype,p[0],{get:d.get,set:function(v){d.set.call(this,fix(this,p[0],v));},configurable:true});});})();</script>`;
html = html.replace("<head>", `<head>${SHIM}`);
const leftover = html.match(/(?:src|href)="\/_next\/[^"]*"/g);
if (leftover) throw new Error(`export-html: unresolved asset references: ${leftover.slice(0, 3).join(", ")}`);

const exportsDir = path.join(ROOT, "exports");
mkdirSync(exportsDir, { recursive: true });
const dest = path.join(exportsDir, `${args.name}.html`);
writeFileSync(dest, html);
if (!args.keep) rmSync(work, { recursive: true, force: true });
console.log(`\n✓ ${dest} (${(Buffer.byteLength(html) / 1e6).toFixed(1)} MB) — campaigns: ${campaigns.join(", ")}`);
if (existsSync(dest) && args.keep) console.log(`  (build folder kept at ${work})`);
