"use client";

import { useState } from "react";
import { Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { capturedThumbnailFor } from "@/lib/thumbnails";
import { PlatformBadge } from "./PlatformBadge";
import type { Platform } from "@/lib/types";

// Platforms app/api/thumbnail/route.ts can serve a real image for.
const ROUTE_SUPPORTED_PLATFORMS = new Set(["YouTube", "TikTok"]);

// Where this post's real thumbnail comes from, if anywhere: a pre-captured
// screenshot (Meta — see lib/thumbnails.ts), else the thumbnail route.
// Anything else skips the request entirely and keeps the placeholder.
export function thumbnailSrc(contentUrl: string, platform: Platform): string | null {
  const captured = capturedThumbnailFor(contentUrl);
  if (captured) return captured;
  if (!ROUTE_SUPPORTED_PLATFORMS.has(platform)) return null;
  return `/api/thumbnail?url=${encodeURIComponent(contentUrl)}&platform=${encodeURIComponent(platform)}`;
}

// Placeholder shown while a real thumbnail is loading, or permanently for
// any post a real thumbnail couldn't be resolved for (unsupported
// platform, no screenshot captured yet, the route 404ed, etc.) — a muted
// duotone field plus the creator's initial, deterministic from the content
// id, so the library still reads as a visual grid and every card is
// visually distinct even without a real image.
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
  const src = thumbnailSrc(contentUrl, platform);
  // Keyed by src so a remounted/reused instance for another post retries.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const [from, to] = PALETTES[hashSeed(seed) % PALETTES.length];
  const initial = creator.replace(/^@/, "").charAt(0).toUpperCase() || "?";
  const showImage = src !== null && failedSrc !== src;

  return (
    <div
      className={cn(
        "relative flex aspect-[9/16] items-center justify-center overflow-hidden rounded-[var(--radius-md)]",
        className,
      )}
      // The placeholder stays underneath the image, so it's what shows while
      // the image loads and if it never does.
      style={{ background: `linear-gradient(160deg, ${from}, ${to})` }}
    >
      <span
        className={cn(
          "font-semibold text-foreground/25",
          size === "lg" ? "text-6xl" : size === "sm" ? "text-2xl" : "text-4xl",
        )}
        aria-hidden
      >
        {initial}
      </span>
      {showImage && (
        // eslint-disable-next-line @next/next/no-img-element -- per-post remote/captured image, not a static asset worth optimizing
        <img
          src={src}
          alt=""
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover"
          onError={() => setFailedSrc(src)}
        />
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
