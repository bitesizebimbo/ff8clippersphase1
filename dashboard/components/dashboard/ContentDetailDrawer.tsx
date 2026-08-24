"use client";

import { ExternalLink } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  formatCompactNumber,
  formatDate,
  formatExactNumber,
  formatPercent,
} from "@/lib/formatters";
import type { ContentItem } from "@/lib/types";
import { ContentThumbnail } from "./ContentThumbnail";
import { PlatformBadge } from "./PlatformBadge";

export function ContentDetailDrawer({
  item,
  onOpenChange,
}: {
  item: ContentItem | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={item !== null} onOpenChange={onOpenChange}>
      {item && (
        <SheetContent title={item.title}>
          <div className="flex flex-col gap-6 overflow-y-auto p-6 pb-28">
            <div className="flex flex-col items-center gap-3 pt-2">
              <ContentThumbnail
                seed={item.thumbnailSeed}
                creator={item.creator}
                platform={item.platform}
                size="lg"
                className="w-40"
              />
              <div className="text-center">
                <p className="text-base font-semibold text-foreground">{item.title}</p>
                <p className="mt-0.5 text-sm text-foreground-muted">{item.caption}</p>
              </div>
            </div>

            <section aria-labelledby="drawer-performance">
              <h3
                id="drawer-performance"
                className="mb-3 text-xs font-medium uppercase tracking-wide text-foreground-subtle"
              >
                Content Performance
              </h3>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-[var(--radius-md)] border border-border bg-surface-muted/60 p-4 text-sm">
                <Metric label="Views" value={item.views} />
                <Metric label="Likes" value={item.likes} />
                <Metric label="Comments" value={item.comments} />
                <Metric label="Shares" value={item.shares} />
                <Metric label="Saves" value={item.saves ?? null} />
                <div />
                <div className="col-span-2 h-px bg-border" />
                <Metric label="Total Engagements" value={item.totalEngagements} emphasis />
                <div>
                  <dt className="text-foreground-subtle">Engagement Rate</dt>
                  <dd className="tabular-nums text-lg font-semibold text-foreground">
                    {formatPercent(item.engagementRate)}
                  </dd>
                </div>
              </dl>
            </section>

            <section aria-labelledby="drawer-classifications">
              <h3
                id="drawer-classifications"
                className="mb-3 text-xs font-medium uppercase tracking-wide text-foreground-subtle"
              >
                Classifications
              </h3>
              <dl className="flex flex-col gap-2.5 text-sm">
                <ClassRow label="Product" value={item.product} />
                <ClassRow label="Approach" value={item.approach} />
                <ClassRow label="Content Type" value={item.contentType} />
                <ClassRow
                  label="Platform"
                  value={<PlatformBadge platform={item.platform} />}
                />
                <ClassRow label="Published" value={formatDate(item.publishDate)} />
              </dl>
            </section>
          </div>

          <div className="sticky bottom-0 border-t border-border bg-surface p-4">
            <Button variant="primary" size="md" asChild className="w-full">
              <a
                href={item.contentUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Open original post on ${item.platform} (opens in a new tab)`}
              >
                Open on {item.platform}
                <ExternalLink className="h-4 w-4" aria-hidden />
              </a>
            </Button>
          </div>
        </SheetContent>
      )}
    </Sheet>
  );
}

function Metric({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: number | null;
  emphasis?: boolean;
}) {
  const display = value === null ? "—" : formatCompactNumber(value);
  return (
    <div>
      <dt className="text-foreground-subtle">{label}</dt>
      <dd
        title={value !== null ? formatExactNumber(value) : undefined}
        className={`tabular-nums font-semibold text-foreground ${emphasis ? "text-lg" : ""}`}
      >
        {display}
      </dd>
    </div>
  );
}

function ClassRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-foreground-muted">{label}</dt>
      <dd className="font-medium text-foreground">{value}</dd>
    </div>
  );
}
