import { Bookmark, Eye, Gauge, Heart, Layers, MessageCircle, Share2, Zap } from "lucide-react";
import { KPICard } from "./KPICard";
import { formatCompactNumber, formatPercent, formatSignedPercent, formatSignedPoints } from "@/lib/formatters";
import type { DashboardSummary } from "@/lib/types";

export function KPIOverview({ summary }: { summary: DashboardSummary }) {
  const c = summary.comparison;

  return (
    <section aria-label="Key performance indicators" className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KPICard
          emphasis="primary"
          label="Total Views"
          value={formatCompactNumber(summary.totalViews)}
          exactValue={summary.totalViews}
          icon={Eye}
          delta={c?.deltaViewsPct}
          deltaLabel={c ? formatSignedPercent(c.deltaViewsPct) : undefined}
        />
        <KPICard
          emphasis="primary"
          label="Total Content"
          value={formatCompactNumber(summary.contentCount)}
          exactValue={summary.contentCount}
          icon={Layers}
        />
        <KPICard
          emphasis="primary"
          label="Total Engagements"
          value={formatCompactNumber(summary.totalEngagements)}
          exactValue={summary.totalEngagements}
          icon={Zap}
          delta={c?.deltaEngagementsPct}
          deltaLabel={c ? formatSignedPercent(c.deltaEngagementsPct) : undefined}
        />
        <KPICard
          emphasis="primary"
          label="Engagement Rate"
          value={formatPercent(summary.engagementRate)}
          icon={Zap}
          delta={c?.deltaEngagementRatePp}
          deltaLabel={c ? formatSignedPoints(c.deltaEngagementRatePp) : undefined}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <KPICard
          label="Avg Views / Content"
          value={formatCompactNumber(summary.averageViewsPerContent)}
          exactValue={summary.averageViewsPerContent}
          icon={Gauge}
        />
        <KPICard
          label="Likes"
          value={formatCompactNumber(summary.totalLikes)}
          exactValue={summary.totalLikes}
          icon={Heart}
        />
        <KPICard
          label="Comments"
          value={formatCompactNumber(summary.totalComments)}
          exactValue={summary.totalComments}
          icon={MessageCircle}
        />
        <KPICard
          label="Shares"
          value={formatCompactNumber(summary.totalShares)}
          exactValue={summary.totalShares}
          icon={Share2}
        />
        <KPICard
          label="Saves"
          value={formatCompactNumber(summary.totalSaves)}
          exactValue={summary.totalSaves}
          icon={Bookmark}
        />
      </div>
    </section>
  );
}
