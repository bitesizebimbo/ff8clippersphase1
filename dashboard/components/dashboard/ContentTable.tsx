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
      <table className="w-full table-fixed border-collapse text-sm sm:table-auto sm:min-w-[720px]">
        <thead>
          <tr className="border-b border-border bg-surface-muted text-left text-xs font-medium uppercase tracking-wide text-foreground-subtle">
            {/* Phones keep Content, Views and ER; the rest show from sm up. */}
            <th className="px-3 py-2.5 font-medium sm:px-3.5">Content</th>
            <th className="hidden px-3.5 py-2.5 font-medium sm:table-cell">Platform</th>
            <th className="hidden px-3.5 py-2.5 font-medium sm:table-cell">Published</th>
            <th className="w-[72px] px-2 py-2.5 text-right font-medium sm:w-auto sm:px-3.5">Views</th>
            <th className="hidden px-3.5 py-2.5 text-right font-medium sm:table-cell">Engagements</th>
            <th className="w-[60px] px-2 py-2.5 text-right font-medium sm:w-auto sm:px-3.5">ER</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-b border-border last:border-0 hover:bg-surface-muted">
              <td className="px-3 py-2 sm:px-3.5">
                <button
                  type="button"
                  onClick={() => onSelect(item.id)}
                  className="flex w-full min-w-0 items-center gap-3 text-left"
                >
                  <ContentThumbnail
                    seed={item.thumbnailSeed}
                    creator={item.creator}
                    platform={item.platform}
                    contentUrl={item.contentUrl}
                    size="sm"
                    className="h-11 w-8 shrink-0"
                  />
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-foreground">{item.title}</span>
                    <span className="block truncate text-xs text-foreground-subtle">{item.caption}</span>
                  </span>
                </button>
              </td>
              <td className="hidden px-3.5 py-2 sm:table-cell">
                <PlatformBadge platform={item.platform} />
              </td>
              <td className="hidden whitespace-nowrap px-3.5 py-2 text-foreground-muted sm:table-cell">
                {formatDate(item.publishDate)}
              </td>
              <td
                className="whitespace-nowrap px-2 py-2 text-right tabular-nums font-medium text-foreground sm:px-3.5"
                title={formatCompactNumber(item.views)}
              >
                {formatCompactNumber(item.views)}
              </td>
              <td className="hidden whitespace-nowrap px-3.5 py-2 text-right tabular-nums font-medium text-foreground sm:table-cell">
                {formatCompactNumber(item.totalEngagements)}
              </td>
              <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums font-medium text-foreground sm:px-3.5">
                {formatPercent(item.engagementRate)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
