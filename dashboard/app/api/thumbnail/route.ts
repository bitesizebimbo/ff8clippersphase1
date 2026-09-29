// Serves a content post's real preview image, so the library grid can show
// an actual thumbnail instead of the generic color-plus-initial
// placeholder. Used directly as an <img src> — it responds with the image
// itself (or a redirect to it), never JSON. Per platform:
//
// - YouTube's thumbnail CDN URL is a deterministic function of the video
//   ID, so this just redirects to it — no upstream call, can't fail.
// - TikTok has no such pattern; its real CDN thumbnail URL is only
//   available via TikTok's own oEmbed endpoint, and that URL is *signed and
//   expires within days*. Handing it to the browser (as this route used to)
//   meant cached thumbnails went dead and fell back to the placeholder. So
//   this fetches a fresh signed URL, downloads the image server-side and
//   serves the bytes itself — whatever the browser/CDN caches is the image,
//   which never expires.
// - Meta (Instagram) thumbnails don't go through here at all: they're
//   pre-captured screenshots served from public/thumbnails/ (see
//   lib/thumbnails.ts).
//
// Every failure path is a 404, which the <img>'s onError turns back into
// the placeholder: a missing thumbnail is never worse than what was there.

const TIKTOK_OEMBED_HOSTS = new Set(["tiktok.com", "www.tiktok.com", "vt.tiktok.com", "vm.tiktok.com"]);

// The served image never changes, so browsers keep it a week and a shared
// CDN a month.
const IMAGE_CACHE_CONTROL = "public, max-age=604800, s-maxage=2592000, stale-while-revalidate=2592000";

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

async function tikTokThumbnail(url: string): Promise<Response | null> {
  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    return null;
  }
  if (!TIKTOK_OEMBED_HOSTS.has(hostname)) return null;

  try {
    const oembed = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`, {
      signal: AbortSignal.timeout(5000),
      // Signed thumbnail URLs stay valid for a few days, so a few hours of
      // caching the oEmbed lookup is safe and saves repeat calls.
      next: { revalidate: 21_600 },
    });
    if (!oembed.ok) return null;
    const { thumbnail_url } = (await oembed.json()) as { thumbnail_url?: string };
    if (typeof thumbnail_url !== "string") return null;

    const image = await fetch(thumbnail_url, { signal: AbortSignal.timeout(8000), cache: "no-store" });
    const contentType = image.headers.get("content-type") ?? "";
    if (!image.ok || !contentType.startsWith("image/")) return null;

    return new Response(await image.arrayBuffer(), {
      headers: { "Content-Type": contentType, "Cache-Control": IMAGE_CACHE_CONTROL },
    });
  } catch (err) {
    console.warn(`[thumbnail] TikTok thumbnail failed for ${url}`, err);
    return null;
  }
}

function notFound() {
  // Short cache so a transient TikTok failure doesn't stick for long.
  return new Response(null, { status: 404, headers: { "Cache-Control": "public, max-age=3600" } });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");
  const platform = searchParams.get("platform");
  if (!url) return notFound();

  if (platform === "YouTube") {
    const thumbnailUrl = youTubeThumbnailUrl(url);
    if (!thumbnailUrl) return notFound();
    return new Response(null, {
      status: 307,
      headers: { Location: thumbnailUrl, "Cache-Control": IMAGE_CACHE_CONTROL },
    });
  }

  if (platform === "TikTok") {
    return (await tikTokThumbnail(url)) ?? notFound();
  }

  return notFound();
}
