import { useQuery, useMutation } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Wifi, WifiOff } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface FeedStatusData {
  timestamp: string;
  youtubeVideos: number;
  newsArticles: number;
  engageProjects: number;
  transcriptsProcessed: number;
  errors: string[];
}

export function FeedStatus() {
  const { data } = useQuery<FeedStatusData>({
    queryKey: ["/api/feed-status"],
    refetchInterval: 60_000, // Check every minute
  });

  const refreshMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/feed-refresh");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/feed-status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/meetings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/news"] });
      queryClient.invalidateQueries({ queryKey: ["/api/developments"] });
    },
  });

  if (!data) return null;

  const isActive = data.timestamp !== "never";
  const lastUpdated = isActive
    ? new Date(data.timestamp).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })
    : "Never";

  const hasErrors = data.errors.length > 0;

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground" data-testid="feed-status">
      {isActive ? (
        <Wifi className="h-3 w-3 text-green-500" />
      ) : (
        <WifiOff className="h-3 w-3 text-red-500" />
      )}
      <span>Live feeds: {lastUpdated}</span>
      {hasErrors && (
        <Badge variant="outline" className="text-[10px] px-1 py-0 border-amber-500/50 text-amber-500">
          {data.errors.length} error{data.errors.length > 1 ? "s" : ""}
        </Badge>
      )}
      <button
        onClick={() => refreshMutation.mutate()}
        disabled={refreshMutation.isPending}
        className="p-0.5 rounded hover:bg-muted transition-colors disabled:opacity-50"
        title="Refresh feeds now"
        data-testid="button-refresh-feeds"
      >
        <RefreshCw className={`h-3 w-3 ${refreshMutation.isPending ? "animate-spin" : ""}`} />
      </button>
    </div>
  );
}
