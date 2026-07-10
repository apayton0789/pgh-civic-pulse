import { useQuery } from "@tanstack/react-query";
import { Wifi, WifiOff } from "lucide-react";

interface GeneratedAt {
  timestamp: string;
}

/**
 * Static-site replacement for the old live "feed status" indicator.
 * There's no running server anymore, so instead of polling /api/feed-status
 * and offering an in-app refresh button, this now just displays the
 * timestamp of the last data generation (from ./data/generated-at.json).
 *
 * For actually refreshing data, see <GetUpdatesButton /> which links to the
 * GitHub Actions workflow.
 */
export function FeedStatus() {
  const { data } = useQuery<GeneratedAt>({
    queryKey: ["/api/feed-status"],
  });

  if (!data) return null;

  const isActive = !!data.timestamp && data.timestamp !== "never";
  const lastUpdated = isActive
    ? new Date(data.timestamp).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })
    : "Never";

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground" data-testid="feed-status">
      {isActive ? (
        <Wifi className="h-3 w-3 text-green-500" />
      ) : (
        <WifiOff className="h-3 w-3 text-red-500" />
      )}
      <span>Data last refreshed: {lastUpdated}</span>
    </div>
  );
}
