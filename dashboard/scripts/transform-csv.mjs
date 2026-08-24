#!/usr/bin/env node
// One-off ingestion script: transforms the ingested wiki CSV export into the
// typed JSON dataset the dashboard's data layer reads. Re-run this whenever
// raw/wiki data is refreshed. See README.md "Replacing mock data" for how to
// swap this out for a live API instead.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CSV_PATH = path.join(__dirname, "../../wiki/data/ff8_clippers_phase1.csv");
const OUT_PATH = path.join(__dirname, "../data/content.json");

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c === "\r") {
      // skip
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const raw = readFileSync(CSV_PATH, "utf-8");
const rows = parseCsv(raw).filter((r) => r.length > 1);
const header = rows[0];
const idx = Object.fromEntries(header.map((h, i) => [h.trim(), i]));

const PLATFORM_MAP = {
  Tiktok: "TikTok",
  Youtube: "YouTube",
};

function slugify(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

const items = rows.slice(1).map((r) => {
  const num = (key) => {
    const v = (r[idx[key]] ?? "").trim();
    if (v === "") return 0;
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };
  const str = (key) => (r[idx[key]] ?? "").trim();

  const no = str("No");
  const platform = PLATFORM_MAP[str("Platform")] ?? str("Platform");
  const product = str("Product");
  const approach = str("Approach");
  const contentType = str("Content Type");
  const username = str("Username");

  return {
    id: `ff8-${no}`,
    title: `${contentType} · ${product}`,
    caption: `@${username} on ${platform}`,
    creator: username,
    platform,
    contentUrl: str("Link Post").replace(/\.+$/, ""),
    publishDate: str("Tanggal"),
    product,
    approach,
    contentType,
    views: num("Views"),
    likes: num("Like"),
    comments: num("Comment"),
    shares: num("Share"),
    saves: num("Save"),
    thumbnailSeed: slugify(`${username}-${no}`),
  };
});

writeFileSync(OUT_PATH, JSON.stringify(items, null, 2) + "\n");
console.log(`Wrote ${items.length} content items to ${OUT_PATH}`);
