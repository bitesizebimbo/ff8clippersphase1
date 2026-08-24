import { cn } from "@/lib/utils";
import type { Platform } from "@/lib/types";

const PLATFORM_STYLE: Record<string, string> = {
  TikTok: "bg-platform-tiktok text-white",
  YouTube: "bg-platform-youtube text-white",
};

export function PlatformBadge({
  platform,
  className,
}: {
  platform: Platform;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium shadow-sm",
        PLATFORM_STYLE[platform] ?? "bg-foreground text-background",
        className,
      )}
    >
      {platform}
    </span>
  );
}
