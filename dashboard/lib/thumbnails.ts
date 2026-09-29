import capturedThumbnails from "@/data/thumbnails.json";

// Meta (Instagram) has no public thumbnail endpoint we can call without a
// Meta developer app token, so its thumbnails are screenshots captured
// ahead of time by scripts/capture-meta-thumbnails.mjs, saved under
// public/thumbnails/ and indexed in data/thumbnails.json by post key.
//
// Keep instagramShortcode() in sync with the copy in that script — the
// manifest keys it writes are what this module looks up.

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

/** Public path of a pre-captured screenshot for this post, if one exists. */
export function capturedThumbnailFor(url: string): string | null {
  const shortcode = instagramShortcode(url);
  return shortcode ? (manifest[`ig:${shortcode}`] ?? null) : null;
}
