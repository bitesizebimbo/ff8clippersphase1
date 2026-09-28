import { NextResponse } from "next/server";

// Resolves a content post URL to a real preview image, so the library grid
// can show an actual thumbnail instead of the generic color-plus-initial
// placeholder. Two very different strategies per platform:
//
// - YouTube's thumbnail CDN URL is a deterministic function of the video
//   ID, so it's computed directly here — no network call, can't fail.
// - TikTok has no such pattern; its real (signed, expiring) CDN thumbnail
//   URL is only available via TikTok's own oEmbed endpoint, so this makes
//   that one server-side call (oEmbed is a public embedding protocol meant
//   for exactly this, and doing it server-side avoids relying on TikTok's
//   CORS policy for browser fetches).
// - Any other platform (Instagram, etc.) has no supported path yet —
//   Instagram's oEmbed requires a Meta developer app token we don't have —
//   so it returns null and the caller keeps the placeholder.
//
// Every failure path returns `{ thumbnailUrl: null }` rather than an error
// status: a missing thumbnail should never be worse than the placeholder
// that was already there.

const TIKTOK_OEMBED_HOSTS = new Set(["tiktok.com", "www.tiktok.com", "vt.tiktok.com", "vm.tiktok.com"]);

function youTubeThumbnailUrl(url: string): string | null {
  let videoId: string | null = null;
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") {
      videoId = u.pathname.slice(1).split("/")[0] || null;
    } else if (u.hostname.endsWith("youtube.com")) {
      if (u.pathname === "/watch") {
        videoId = u.searchParams.get("v");
      } else if (u.pathname.startsWith("/shorts/") || u.pathname.startsWith("/embed/")) {
        videoId = u.pathname.split("/")[2] || null;
      }
    }
  } catch {
    return null;
  }
  if (!videoId || !/^[\w-]{6,15}$/.test(videoId)) return null;
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

async function tikTokThumbnailUrl(url: string): Promise<string | null> {
  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    return null;
  }
  if (!TIKTOK_OEMBED_HOSTS.has(hostname)) return null;

  const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`;
  try {
    const res = await fetch(oembedUrl, {
      signal: AbortSignal.timeout(5000),
      // Real thumbnails don't change; a day-long cache keeps repeat loads
      // of the same post from re-hitting TikTok's oEmbed endpoint.
      next: { revalidate: 86_400 },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { thumbnail_url?: string };
    return typeof data.thumbnail_url === "string" ? data.thumbnail_url : null;
  } catch (err) {
    console.warn(`[thumbnail] TikTok oEmbed failed for ${url}`, err);
    return null;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");
  const platform = searchParams.get("platform");

  if (!url) {
    return NextResponse.json({ thumbnailUrl: null }, { status: 400 });
  }

  let thumbnailUrl: string | null = null;
  if (platform === "YouTube") {
    thumbnailUrl = youTubeThumbnailUrl(url);
  } else if (platform === "TikTok") {
    thumbnailUrl = await tikTokThumbnailUrl(url);
  }

  return NextResponse.json(
    { thumbnailUrl },
    { headers: { "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800" } },
  );
}
