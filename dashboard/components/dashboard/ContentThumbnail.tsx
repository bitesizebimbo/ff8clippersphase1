import { Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { PlatformBadge } from "./PlatformBadge";
import type { Platform } from "@/lib/types";

// The source dataset has no thumbnail images, only post URLs. Rather than
// fabricate fake image URLs (which would 404 or, worse, silently hotlink an
// unrelated image), each card gets a deterministic placeholder generated
// from the content id: a muted duotone field plus the creator's initial, so
// the library still reads as a visual grid and every card is visually
// distinct without pretending to be a real screenshot.
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
  className,
  size = "md",
}: {
  seed: string;
  creator: string;
  platform: Platform;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const [from, to] = PALETTES[hashSeed(seed) % PALETTES.length];
  const initial = creator.replace(/^@/, "").charAt(0).toUpperCase() || "?";

  return (
    <div
      className={cn(
        "relative flex aspect-[9/16] items-center justify-center overflow-hidden rounded-[var(--radius-md)]",
        className,
      )}
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
      <span className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
        <Play className="h-8 w-8 fill-foreground/80 text-foreground/80" aria-hidden />
      </span>
      <div className="absolute left-2 top-2">
        <PlatformBadge platform={platform} />
      </div>
    </div>
  );
}
