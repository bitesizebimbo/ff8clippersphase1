#!/usr/bin/env node
// Exports the dashboard as one self-contained HTML file — styles, fonts,
// thumbnails, and charts all inlined — that opens anywhere with no server,
// e.g. to email or drop into a shared drive.
//
// It's a snapshot: the page is rendered in a real browser exactly as a
// visitor sees it, then frozen. Charts and numbers are all there, but
// filters, tabs, and the detail drawer don't work in the exported file.
//
// Run against a running dashboard (npm run dev, or npm run build && npm start):
//   npm run export:html
// Options:
//   --url <url>      page to export (default http://localhost:3000). Include
//                    search params to export a specific view, e.g.
//                    "http://localhost:3000/?campaign=r14"
//   --out <path>     output file (default exports/dashboard-<date>.html)
//   --width <px>     viewport width (default 1440)

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { chromium } from "playwright";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const { values: args } = parseArgs({
  options: {
    url: { type: "string", default: "http://localhost:3000" },
    out: { type: "string" },
    width: { type: "string", default: "1440" },
  },
});

const today = new Date().toISOString().slice(0, 10);
const outPath = path.resolve(
  args.out ?? path.join(ROOT, "exports", `dashboard-${today}.html`),
);

const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: Number(args.width), height: 900 },
  });
  await page.goto(args.url, { waitUntil: "networkidle" });

  // Thumbnails are loading="lazy": scroll the whole page so every one
  // loads, then wait for them before freezing anything.
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 600) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 150));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForLoadState("networkidle");
  await page.evaluate(() =>
    Promise.all(
      [...document.images].map((img) =>
        img.complete
          ? null
          : new Promise((r) => {
              img.addEventListener("load", r, { once: true });
              img.addEventListener("error", r, { once: true });
            }),
      ),
    ),
  );

  const html = await page.evaluate(async () => {
    const toDataUrl = async (url) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${res.status} ${url}`);
      const blob = await res.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      });
    };

    // Stylesheets → inline <style>, with their url(...) assets (fonts)
    // inlined as data URLs.
    for (const link of document.querySelectorAll('link[rel="stylesheet"]')) {
      const cssUrl = link.href;
      let css = await (await fetch(cssUrl)).text();
      const refs = [...css.matchAll(/url\((['"]?)([^'")]+)\1\)/g)];
      for (const [whole, , ref] of refs) {
        if (ref.startsWith("data:") || ref.startsWith("#")) continue;
        try {
          const dataUrl = await toDataUrl(new URL(ref, cssUrl).href);
          css = css.replaceAll(whole, `url("${dataUrl}")`);
        } catch {
          // Leave a reference we couldn't fetch as-is; it just won't load.
        }
      }
      const style = document.createElement("style");
      style.textContent = css;
      link.replaceWith(style);
    }

    // Loaded images → data URLs. Ones that failed are removed, so the
    // placeholder art under them shows, same as on the live page.
    for (const img of document.querySelectorAll("img")) {
      if (!img.complete || img.naturalWidth === 0) {
        img.remove();
        continue;
      }
      try {
        img.src = await toDataUrl(img.currentSrc || img.src);
        img.removeAttribute("srcset");
        img.removeAttribute("loading");
      } catch {
        img.remove();
      }
    }

    // Drop everything that only matters to the running app.
    document
      .querySelectorAll(
        'script, link[rel="preload"], link[rel="modulepreload"], link[rel="prefetch"], link[as], next-route-announcer, nextjs-portal',
      )
      .forEach((el) => el.remove());

    // External links (the "open post" CTAs) should still work.
    document.querySelectorAll("a[href^='/']").forEach((a) => {
      a.href = new URL(a.getAttribute("href"), location.href).href;
    });

    return "<!DOCTYPE html>\n" + document.documentElement.outerHTML;
  });

  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, html);
  console.log(
    `Exported ${args.url} → ${path.relative(process.cwd(), outPath)} (${(html.length / 1024 / 1024).toFixed(1)} MB)`,
  );
} finally {
  await browser.close();
}
