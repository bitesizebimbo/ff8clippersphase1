import capturedThumbnails from "@/data/thumbnails.json";

// Meta (Instagram) has no public thumbnail endpoint we can call without a
// Meta developer app token, so its thumbnails are screenshots captured
// ahead of time by scripts/capture-meta-thumbnails.mjs, saved under
// public/thumbnails/ and indexed in data/thumbnails.json by post key.
// TikTok's oEmbed stopped returning thumbnail URLs in Oct 2026, so its
// covers are captured the same way, by scripts/capture-tiktok-thumbnails.mjs.
//
// Keep instagramShortcode() and tiktokKey() in sync with the copies in those
// scripts — the manifest keys they write are what this module looks up.

const manifest: Record<string, string> = capturedThumbnails;

const INSTAGRAM_POST_PATH = /^\/(?:[\w.]+\/)?(?:reels?|p|tv)\/([\w-]+)/;

/** The post's shortcode, e.g. "DcbLqrlyogi" — stable across share links (?igsh=, ?igsi=). */
export function instagramShortcode(url: string): string | null {
  try {
    const u = new URL(url);
    if (!/(^|\.)instagram\.com$/.test(u.hostname)) return null;
    return u.pathname.match(INSTAGRAM_POST_PATH)?.[1] ?? null;
  } catch {
    return null;
  }
}

/**
 * Manifest key for a TikTok post: its video id for full links
 * (tiktok.com/@user/video/<id>), else the short link's host and path
 * (vt.tiktok.com/ZS…), ignoring share-tracking query strings.
 */
export function tiktokKey(url: string): string | null {
  try {
    const u = new URL(url);
    if (!/(^|\.)tiktok\.com$/.test(u.hostname)) return null;
    const videoId = u.pathname.match(/\/(?:video|photo)\/(\d+)/)?.[1];
    return `tt:${videoId ?? u.hostname + u.pathname.replace(/\/+$/, "")}`;
  } catch {
    return null;
  }
}

/** Public path of a pre-captured thumbnail for this post, if one exists. */
export function capturedThumbnailFor(url: string): string | null {
  const shortcode = instagramShortcode(url);
  if (shortcode) return manifest[`ig:${shortcode}`] ?? null;
  const tiktok = tiktokKey(url);
  return tiktok ? (manifest[tiktok] ?? null) : null;
}
