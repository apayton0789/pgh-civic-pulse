import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, CalendarDays } from "lucide-react";
import type { BriefingItem } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

const TODAY = new Date().toISOString().slice(0, 10);
const YESTERDAY = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

function urgencyBadgeClass(urgency: BriefingItem["urgency"]) {
  switch (urgency) {
    case "critical": return "bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-300";
    case "high": return "bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900/30 dark:text-orange-300";
    case "medium": return "bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-300";
    case "low": return "bg-gray-100 text-gray-600 border-gray-300 dark:bg-gray-800/50 dark:text-gray-400";
  }
}

function TimelineItem({ item, isNew }: { item: BriefingItem; isNew: boolean }) {
  return (
    <div
      className="flex gap-4 group"
      data-testid={`changed-item-${item.id}`}
    >
      {/* Timeline dot */}
      <div className="flex flex-col items-center shrink-0">
        <div
          className={`w-3 h-3 rounded-full border-2 mt-1.5 ${
            isNew ? "bg-primary border-primary" : "bg-muted-foreground/40 border-muted-foreground/40"
          }`}
        />
        <div className="w-0.5 bg-border flex-1 mt-1" />
      </div>

      {/* Content */}
      <div className="pb-5 flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1.5">
          <span
            className={`text-xs font-bold px-2 py-0.5 rounded-full ${
              isNew
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {isNew ? "NEW" : "UPDATED"}
          </span>
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${urgencyBadgeClass(item.urgency)}`}
          >
            {item.urgency}
          </span>
          <Badge variant="outline" className="text-xs px-1.5 py-0">
            {item.categoryTag}
          </Badge>
          <span className="text-xs text-muted-foreground flex items-center gap-1 ml-auto">
            <CalendarDays className="h-3 w-3" />
            {item.date}
          </span>
        </div>
        <h3 className="text-base font-semibold leading-snug mb-1" data-testid={`text-headline-${item.id}`}>
          {item.headline}
        </h3>
        <p className="text-sm text-foreground/70 leading-relaxed">
          {item.whatChanged}
        </p>
      </div>
    </div>
  );
}

export default function WhatChanged() {
  const { data: items = [], isLoading } = useQuery<BriefingItem[]>({
    queryKey: ["/api/briefing/changed"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/briefing/changed");
      return res.json();
    },
  });

  // Group by date
  const todayItems = items.filter((i) => i.date === TODAY);
  const yesterdayItems = items.filter((i) => i.date === YESTERDAY);
  const olderItems = items.filter((i) => i.date < YESTERDAY);

  if (isLoading) {
    return (
      <div className="p-4 space-y-4 max-w-3xl">
        <Skeleton className="h-8 w-48" />
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex gap-4">
            <Skeleton className="h-4 w-4 rounded-full shrink-0 mt-1" />
            <Skeleton className="h-24 flex-1 rounded-lg" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="p-4 space-y-5 max-w-3xl" data-testid="what-changed-page">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2">
          <RefreshCw className="h-5 w-5 text-blue-500" />
          What Changed
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Recent updates — today and yesterday
        </p>
      </div>

      {items.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <RefreshCw className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No recent changes. Check back soon.</p>
        </div>
      )}

      {todayItems.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5" />
            Today — {TODAY}
          </h3>
          <div>
            {todayItems.map((item) => (
              <TimelineItem key={item.id} item={item} isNew={true} />
            ))}
          </div>
        </div>
      )}

      {yesterdayItems.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5" />
            Yesterday — {YESTERDAY}
          </h3>
          <div>
            {yesterdayItems.map((item) => (
              <TimelineItem key={item.id} item={item} isNew={false} />
            ))}
          </div>
        </div>
      )}

      {olderItems.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Earlier
          </h3>
          <div>
            {olderItems.map((item) => (
              <TimelineItem key={item.id} item={item} isNew={false} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
