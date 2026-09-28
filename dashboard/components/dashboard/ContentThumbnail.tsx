"use client";

import { useEffect, useState } from "react";
import { Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { PlatformBadge } from "./PlatformBadge";
import type { Platform } from "@/lib/types";

// Real thumbnails are only resolvable for platforms we have a working
// strategy for (see app/api/thumbnail/route.ts) — anything else skips the
// fetch entirely and goes straight to the placeholder below.
const THUMBNAIL_SUPPORTED_PLATFORMS = new Set(["YouTube", "TikTok"]);

// Placeholder shown while a real thumbnail is loading, or permanently for
// any post a real thumbnail couldn't be resolved for (unsupported
// platform, the oEmbed call failed, etc.) — a muted duotone field plus the
// creator's initial, deterministic from the content id, so the library
// still reads as a visual grid and every card is visually distinct even
// without a real image.
const PALETTES = [
  ["#eef2ff", "#c7d2fe"],
  ["#f0fdfa", "#99f6e4"],
  ["#fdf4ff", "#f5d0fe"],
  ["#fff7ed", "#fed7aa"],
  ["#f0fdf4", "#bbf7d0"],
  ["#fef2f2", "#fecaca"],
  ["#f5f5f4", "#d6d3d1"],
] as const;

function hashSeed(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

// Module-level cache: content cards remount often (sorting, pagination,
// filtering), and a post's real thumbnail never changes within a session,
// so once resolved it's reused instead of re-fetched.
const thumbnailCache = new Map<string, string | null>();

function useResolvedThumbnail(contentUrl: string, platform: Platform): string | null {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(
    thumbnailCache.get(contentUrl) ?? null,
  );

  useEffect(() => {
    if (!THUMBNAIL_SUPPORTED_PLATFORMS.has(platform)) return;
    // Cache hits are covered by useState's lazy initializer above — list
    // items are keyed by content id, so contentUrl changing on an already-
    // mounted instance isn't a real case this needs to handle.
    if (thumbnailCache.has(contentUrl)) return;
    let cancelled = false;
    fetch(`/api/thumbnail?url=${encodeURIComponent(contentUrl)}&platform=${encodeURIComponent(platform)}`)
      .then((res) => (res.ok ? res.json() : { thumbnailUrl: null }))
      .then((data: { thumbnailUrl: string | null }) => {
        thumbnailCache.set(contentUrl, data.thumbnailUrl);
        if (!cancelled) setThumbnailUrl(data.thumbnailUrl);
      })
      .catch(() => {
        thumbnailCache.set(contentUrl, null);
      });
    return () => {
      cancelled = true;
    };
  }, [contentUrl, platform]);

  return thumbnailUrl;
}

export function ContentThumbnail({
  seed,
  creator,
  platform,
  contentUrl,
  className,
  size = "md",
}: {
  seed: string;
  creator: string;
  platform: Platform;
  contentUrl: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const resolvedThumbnail = useResolvedThumbnail(contentUrl, platform);
  const [imageFailed, setImageFailed] = useState(false);
  const [from, to] = PALETTES[hashSeed(seed) % PALETTES.length];
  const initial = creator.replace(/^@/, "").charAt(0).toUpperCase() || "?";
  const showImage = resolvedThumbnail && !imageFailed;

  return (
    <div
      className={cn(
        "relative flex aspect-[9/16] items-center justify-center overflow-hidden rounded-[var(--radius-md)]",
        className,
      )}
      style={showImage ? undefined : { background: `linear-gradient(160deg, ${from}, ${to})` }}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- external, unoptimizable CDN image (TikTok/YouTube), not a static asset
        <img
          src={resolvedThumbnail}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <span
          className={cn(
            "font-semibold text-foreground/25",
            size === "lg" ? "text-6xl" : size === "sm" ? "text-2xl" : "text-4xl",
          )}
          aria-hidden
        >
          {initial}
        </span>
      )}
      <span className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
        <Play className="h-8 w-8 fill-foreground/80 text-foreground/80 drop-shadow" aria-hidden />
      </span>
      <div className="absolute left-2 top-2">
        <PlatformBadge platform={platform} />
      </div>
    </div>
  );
}
