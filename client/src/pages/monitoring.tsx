import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Eye, ArrowUp, CalendarDays } from "lucide-react";
import type { BriefingItem } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

function confidenceBadgeClass(level: BriefingItem["confidenceLevel"]) {
  switch (level) {
    case "high": return "border-green-400/50 text-green-600 dark:text-green-400";
    case "medium": return "border-yellow-400/50 text-yellow-600 dark:text-yellow-400";
    case "low": return "border-orange-400/50 text-orange-600 dark:text-orange-400";
    default: return "border-gray-400/40 text-gray-500";
  }
}

function govBadgeClass(level: BriefingItem["governmentLevel"]) {
  switch (level) {
    case "local": return "border-blue-400/40 text-blue-600 dark:text-blue-400";
    case "county": return "border-indigo-400/40 text-indigo-600 dark:text-indigo-400";
    case "state": return "border-purple-400/40 text-purple-600 dark:text-purple-400";
    case "regional": return "border-teal-400/40 text-teal-600 dark:text-teal-400";
    default: return "border-gray-400/40 text-gray-500";
  }
}

export default function Monitoring() {
  const { data: items = [], isLoading } = useQuery<BriefingItem[]>({
    queryKey: ["/api/briefing/items"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/briefing/items");
      return res.json();
    },
  });

  const [promoted, setPromoted] = useState<Set<string>>(new Set());

  // Filter: low importance or low urgency
  const monitorItems = items.filter(
    (i) => (i.importanceScore <= 4 || i.urgencyScore <= 3) && !promoted.has(i.id)
  );

  // Group by topicArea
  const grouped: Record<string, BriefingItem[]> = {};
  for (const item of monitorItems) {
    const key = item.topicArea || "General";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(item);
  }

  if (isLoading) {
    return (
      <div className="p-4 space-y-4 max-w-3xl">
        <Skeleton className="h-8 w-48" />
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-40 w-full rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="p-4 space-y-5 max-w-3xl" data-testid="monitoring-page">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Eye className="h-5 w-5 text-teal-500" />
          Monitoring
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Lower-priority items — worth tracking but not requiring immediate action
        </p>
        <Badge variant="outline" className="text-xs mt-2">
          {monitorItems.length} items under monitoring
        </Badge>
      </div>

      {monitorItems.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Eye className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No items currently in monitoring queue.</p>
        </div>
      )}

      <div className="space-y-5">
        {Object.entries(grouped).map(([topic, topicItems]) => (
          <div key={topic}>
            <h3
              className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-1"
              data-testid={`group-header-${topic}`}
            >
              {topic}
            </h3>
            <div className="space-y-2">
              {topicItems.map((item) => (
                <Card
                  key={item.id}
                  className="hover:shadow-sm transition-shadow"
                  data-testid={`monitor-card-${item.id}`}
                >
                  <CardContent className="px-3 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Badge
                            variant="outline"
                            className={`text-xs px-1.5 py-0 ${govBadgeClass(item.governmentLevel)}`}
                          >
                            {item.governmentLevel}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={`text-xs px-1.5 py-0 ${confidenceBadgeClass(item.confidenceLevel)}`}
                          >
                            {item.confidenceLevel} confidence
                          </Badge>
                          <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                            <CalendarDays className="h-3 w-3" />
                            {item.date}
                          </span>
                        </div>
                        <p
                          className="text-sm font-medium leading-snug line-clamp-2"
                          data-testid={`text-headline-${item.id}`}
                        >
                          {item.headline}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="shrink-0 gap-1 text-xs"
                        data-testid={`button-promote-${item.id}`}
                        onClick={() => setPromoted((prev) => new Set([...prev, item.id]))}
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                        Promote
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>

      {promoted.size > 0 && (
        <div className="rounded-lg border border-green-200 bg-green-50 dark:bg-green-900/20 px-3 py-2.5">
          <p className="text-sm text-green-700 dark:text-green-300 font-medium">
            {promoted.size} item(s) promoted to attention for this session.
          </p>
        </div>
      )}
    </div>
  );
}
