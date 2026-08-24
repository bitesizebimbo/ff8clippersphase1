import { formatCompactNumber, formatDate, formatPercent } from "@/lib/formatters";
import type { ContentItem } from "@/lib/types";
import { ContentThumbnail } from "./ContentThumbnail";
import { PlatformBadge } from "./PlatformBadge";

export function ContentTable({
  items,
  onSelect,
}: {
  items: ContentItem[];
  onSelect: (id: string) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-border">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border bg-surface-muted text-left text-xs font-medium uppercase tracking-wide text-foreground-subtle">
            <th className="px-3.5 py-2.5 font-medium">Content</th>
            <th className="px-3.5 py-2.5 font-medium">Platform</th>
            <th className="px-3.5 py-2.5 font-medium">Published</th>
            <th className="px-3.5 py-2.5 text-right font-medium">Views</th>
            <th className="px-3.5 py-2.5 text-right font-medium">Engagements</th>
            <th className="px-3.5 py-2.5 text-right font-medium">ER</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-b border-border last:border-0 hover:bg-surface-muted">
              <td className="px-3.5 py-2">
                <button
                  type="button"
                  onClick={() => onSelect(item.id)}
                  className="flex items-center gap-3 text-left"
                >
                  <ContentThumbnail
                    seed={item.thumbnailSeed}
                    creator={item.creator}
                    platform={item.platform}
                    size="sm"
                    className="h-11 w-8 shrink-0"
                  />
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-foreground">{item.title}</span>
                    <span className="block truncate text-xs text-foreground-subtle">{item.caption}</span>
                  </span>
                </button>
              </td>
              <td className="px-3.5 py-2">
                <PlatformBadge platform={item.platform} />
              </td>
              <td className="whitespace-nowrap px-3.5 py-2 text-foreground-muted">
                {formatDate(item.publishDate)}
              </td>
              <td
                className="whitespace-nowrap px-3.5 py-2 text-right tabular-nums font-medium text-foreground"
                title={formatCompactNumber(item.views)}
              >
                {formatCompactNumber(item.views)}
              </td>
              <td className="whitespace-nowrap px-3.5 py-2 text-right tabular-nums font-medium text-foreground">
                {formatCompactNumber(item.totalEngagements)}
              </td>
              <td className="whitespace-nowrap px-3.5 py-2 text-right tabular-nums font-medium text-foreground">
                {formatPercent(item.engagementRate)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
