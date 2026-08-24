import { formatCompactNumber, formatDate, formatPercent } from "@/lib/formatters";
import type { ContentItem } from "@/lib/types";
import { ContentThumbnail } from "./ContentThumbnail";

export function ContentCard({
  item,
  onSelect,
}: {
  item: ContentItem;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(item.id)}
      className="group flex flex-col overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface text-left shadow-[var(--shadow-card)] transition-shadow hover:shadow-[var(--shadow-elevated)]"
    >
      <ContentThumbnail
        seed={item.thumbnailSeed}
        creator={item.creator}
        platform={item.platform}
        className="w-full"
      />
      <div className="flex flex-1 flex-col gap-2 p-3.5">
        <div>
          <p className="truncate text-sm font-medium text-foreground">{item.title}</p>
          <p className="mt-0.5 text-xs text-foreground-subtle">{formatDate(item.publishDate)}</p>
        </div>
        <dl className="mt-auto grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
          <div>
            <dt className="text-foreground-subtle">Views</dt>
            <dd className="tabular-nums font-semibold text-foreground">
              {formatCompactNumber(item.views)}
            </dd>
          </div>
          <div>
            <dt className="text-foreground-subtle">Engagements</dt>
            <dd className="tabular-nums font-semibold text-foreground">
              {formatCompactNumber(item.totalEngagements)}
            </dd>
          </div>
          <div className="col-span-2">
            <dt className="text-foreground-subtle">Engagement Rate</dt>
            <dd className="tabular-nums font-semibold text-foreground">
              {formatPercent(item.engagementRate)}
            </dd>
          </div>
        </dl>
      </div>
    </button>
  );
}
