#!/usr/bin/env node
// Exports the dashboard as one self-contained, fully interactive HTML file
// — data, code, styles, fonts, and thumbnails all inlined — that opens
// anywhere with no server, e.g. to email or drop into a shared drive.
//
// It runs the same DashboardShell as the live site, over a snapshot of the
// data taken at export time: filters, tabs, compare mode, the detail drawer
// and "Load more" all work. The current view is kept in the URL hash, so a
// link like dashboard.html#campaign=r14&platform=TikTok opens that view.
//
// Run (needs a production build and the Google Sheets credentials, read
// from .env.local if present):
//   npm run build && npm run export:html
// Options:
//   --view <params>  view the file opens on when there's no hash, as search
//                    params, e.g. "campaign=r14" or "mode=all"
//   --out <path>     output file (default exports/dashboard-<date>.html)
//   --port <n>       port for the temporary server used to fetch
//                    thumbnails (default 3999)

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs, promisify } from "node:util";
import { execFile } from "node:child_process";
import * as esbuild from "esbuild";
import { chromium } from "playwright";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const NEXT_DIR = path.join(ROOT, ".next");
const BUILT_PAGE = path.join(NEXT_DIR, "server", "app", "index.html");

const { values: args } = parseArgs({
  options: {
    view: { type: "string", default: "" },
    out: { type: "string" },
    port: { type: "string", default: "3999" },
  },
});

const today = new Date().toISOString().slice(0, 10);
const outPath = path.resolve(
  args.out ?? path.join(ROOT, "exports", `dashboard-${today}.html`),
);

if (!existsSync(BUILT_PAGE)) {
  console.error("No production build found — run `npm run build` first.");
  process.exit(1);
}
if (existsSync(path.join(ROOT, ".env.local"))) {
  process.loadEnvFile(path.join(ROOT, ".env.local"));
}

// "server-only" throws outside a React Server Component build; the data
// loader is only ever run from Node here, so stub it out.
const stubServerOnly = {
  name: "stub-server-only",
  setup(build) {
    build.onResolve({ filter: /^server-only$/ }, () => ({
      path: "server-only",
      namespace: "stub",
    }));
    build.onLoad({ filter: /.*/, namespace: "stub" }, () => ({ contents: "" }));
  },
};

// next/navigation → the hash-backed stand-in in scripts/export/.
const standInNavigation = {
  name: "stand-in-next-navigation",
  setup(build) {
    build.onResolve({ filter: /^next\/navigation$/ }, () => ({
      path: path.join(ROOT, "scripts", "export", "next-navigation.ts"),
    }));
  },
};

// ContentThumbnail asks thumbnailSrc() for a server URL; in the export,
// swap that for the inlined image, or null (→ placeholder) if there isn't one.
const inlineThumbnails = {
  name: "inline-thumbnails",
  setup(build) {
    build.onLoad({ filter: /components[\\/]dashboard[\\/]ContentThumbnail\.tsx$/ }, async (a) => {
      const source = await readFile(a.path, "utf8");
      const call = "const src = thumbnailSrc(contentUrl, platform);";
      if (!source.includes(call)) {
        throw new Error(`ContentThumbnail.tsx no longer contains \`${call}\` — update scripts/export-html.mjs.`);
      }
      return {
        loader: "tsx",
        contents: source.replace(
          call,
          "const serverSrc = thumbnailSrc(contentUrl, platform);\n" +
            "  const src = serverSrc ? (window as any).__EXPORTED_THUMBNAILS__[serverSrc] ?? null : null;",
        ),
      };
    });
  },
};

// Inside node_modules so the bundled loader resolves the project's packages.
const tmpDir = path.join(ROOT, "node_modules", ".cache", "dashboard-export");
await mkdir(tmpDir, { recursive: true });

try {
  // 1. Data — the same loadAllContent() app/page.tsx renders from.
  console.log("Loading campaign data…");
  const loaderPath = path.join(tmpDir, "load-data.mjs");
  await esbuild.build({
    entryPoints: [path.join(ROOT, "scripts", "export", "load-data.ts")],
    outfile: loaderPath,
    bundle: true,
    platform: "node",
    format: "esm",
    packages: "external",
    plugins: [stubServerOnly],
    logLevel: "error",
  });
  const dataPath = path.join(tmpDir, "data.json");
  await promisify(execFile)(process.execPath, [loaderPath, dataPath], {
    cwd: ROOT,
  });
  const data = JSON.parse(await readFile(dataPath, "utf8"));
  if (data.campaigns.length === 0) {
    throw new Error(
      "No campaign returned any data — check the Google Sheets credentials.",
    );
  }
  console.log(
    `  ${data.content.length} posts across ${data.campaigns.map((c) => c.id).join(", ")}`,
  );

  // 2. Thumbnails — fetched through a temporary production server (for the
  //    thumbnail route and captured screenshots), downscaled to card size.
  const thumbnails = await captureThumbnails(data.content);

  // 3. App code — DashboardShell bundled for the browser.
  console.log("Bundling dashboard…");
  const bundle = await esbuild.build({
    entryPoints: [path.join(ROOT, "scripts", "export", "entry.tsx")],
    bundle: true,
    write: false,
    minify: true,
    format: "iife",
    platform: "browser",
    target: "es2020",
    jsx: "automatic",
    define: { "process.env.NODE_ENV": '"production"' },
    plugins: [standInNavigation, inlineThumbnails],
    logLevel: "error",
  });
  const js = bundle.outputFiles[0].text;

  // 4. Styles and fonts — straight from the production build, so they're
  //    exactly what the live site ships.
  const builtPage = await readFile(BUILT_PAGE, "utf8");
  const htmlClass = builtPage.match(/<html[^>]*class="([^"]*)"/)[1];
  const bodyClass = builtPage.match(/<body[^>]*class="([^"]*)"/)[1];
  const title = builtPage.match(/<title>([^<]*)<\/title>/)?.[1] ?? "Dashboard";
  let css = "";
  for (const [, href] of builtPage.matchAll(
    /<link rel="stylesheet" href="([^"]+)"/g,
  )) {
    const cssPath = path.join(NEXT_DIR, href.replace(/^\/_next\//, ""));
    // Fonts are referenced relative to the stylesheet (url(../media/…)).
    css += await replaceAsync(
      await readFile(cssPath, "utf8"),
      /url\((['"]?)([^'")]+\.woff2)\1\)/g,
      async (_, __, ref) => {
        const bytes = await readFile(path.resolve(path.dirname(cssPath), ref));
        return `url("data:font/woff2;base64,${bytes.toString("base64")}")`;
      },
    );
  }

  // 5. Assemble.
  const embed = (value) => JSON.stringify(value).replace(/</g, "\\u003c");
  const html = `<!DOCTYPE html>
<html lang="en" class="${htmlClass}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>${css}</style>
</head>
<body class="${bodyClass}">
<div id="root" style="display:contents"></div>
<script type="application/json" id="dashboard-data">${embed(data)}</script>
<script>
window.__EXPORTED_THUMBNAILS__ = ${embed(thumbnails)};
if (!location.hash && ${embed(args.view)}) history.replaceState(null, "", "#" + ${embed(args.view)});
</script>
<script>${js.replace(/<\/script/gi, "<\\/script")}</script>
</body>
</html>
`;
  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, html);
  console.log(
    `Exported → ${path.relative(process.cwd(), outPath)} (${(html.length / 1024 / 1024).toFixed(1)} MB)`,
  );
} finally {
  await rm(tmpDir, { recursive: true, force: true });
}

async function captureThumbnails(content) {
  const bundled = await esbuild.build({
    stdin: {
      contents:
        'export { thumbnailSrc } from "@/components/dashboard/ContentThumbnail";',
      resolveDir: ROOT,
      loader: "ts",
    },
    bundle: true,
    write: false,
    format: "iife",
    globalName: "exported",
    jsx: "automatic",
    define: { "process.env.NODE_ENV": '"production"' },
    logLevel: "error",
  });
  // Evaluate thumbnailSrc() in Node for every post (it's a pure function).
  const { thumbnailSrc } = new Function(
    `${bundled.outputFiles[0].text}; return exported;`,
  )();
  const sources = [
    ...new Set(
      content.map((c) => thumbnailSrc(c.contentUrl, c.platform)).filter(Boolean),
    ),
  ];
  console.log(`Fetching ${sources.length} thumbnails…`);

  const origin = `http://localhost:${args.port}`;
  const server = spawn(
    path.join(ROOT, "node_modules", ".bin", "next"),
    ["start", "-p", args.port],
    { cwd: ROOT, stdio: "ignore" },
  );
  const browser = await chromium.launch();
  try {
    for (let i = 0; ; i++) {
      try {
        await fetch(origin);
        break;
      } catch {
        if (i > 60) throw new Error("Next server didn't start.");
        await new Promise((r) => setTimeout(r, 500));
      }
    }
    const page = await browser.newPage();
    await page.goto(`${origin}/favicon.ico`);
    return await page.evaluate(async (sources) => {
      const WIDTH = 200;
      const out = {};
      const shrink = (src) =>
        new Promise((resolve) => {
          const img = new Image();
          const timer = setTimeout(() => resolve(null), 30000);
          img.onload = () => {
            clearTimeout(timer);
            const scale = Math.min(1, WIDTH / img.naturalWidth);
            const canvas = document.createElement("canvas");
            canvas.width = Math.round(img.naturalWidth * scale);
            canvas.height = Math.round(img.naturalHeight * scale);
            canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL("image/jpeg", 0.6));
          };
          img.onerror = () => {
            clearTimeout(timer);
            resolve(null);
          };
          img.src = src;
        });
      const queue = [...sources];
      await Promise.all(
        Array.from({ length: 8 }, async () => {
          while (queue.length) {
            const src = queue.shift();
            const dataUrl = await shrink(src);
            if (dataUrl) out[src] = dataUrl;
          }
        }),
      );
      return out;
    }, sources);
  } finally {
    await browser.close();
    server.kill();
  }
}

async function replaceAsync(str, regex, fn) {
  const parts = [];
  let last = 0;
  for (const m of str.matchAll(regex)) {
    parts.push(str.slice(last, m.index), await fn(...m));
    last = m.index + m[0].length;
  }
  parts.push(str.slice(last));
  return parts.join("");
}
