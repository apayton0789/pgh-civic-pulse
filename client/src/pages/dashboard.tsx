import { useQuery } from "@tanstack/react-query";
import { KpiCard } from "@/components/kpi-card";
import { FeedStatus } from "@/components/feed-status";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CalendarDays,
  Newspaper,
  FileText,
  MapPin,
  Clock,
  AlertTriangle,
  Landmark,
  TrendingUp,
} from "lucide-react";
import type { Meeting, ContentionItem } from "@shared/schema";
import type { NewsItem } from "@shared/schema";

interface ActivityEntry {
  count: number;
  items: Array<{ title: string; type: string; date: string; source: string }>;
}

type ActivityMap = Record<string, ActivityEntry>;

// Body badge colors (compact, matching meeting-card.tsx)
function bodyBadgeClass(body: string): string {
  const l = body.toLowerCase();
  if (l.includes("county") && !l.includes("port authority")) return "bg-blue-600 text-white";
  if (l.includes("city council")) return "bg-[hsl(47,95%,55%)] text-[hsl(215,25%,12%)]";
  if (l.includes("school") || l.includes("pps")) return "bg-green-600 text-white";
  if (l.includes("zoning")) return "bg-orange-600 text-white";
  if (l.includes("planning commission")) return "bg-amber-600 text-white";
  if (l.includes("ura") || l.includes("urban redevelopment")) return "bg-purple-600 text-white";
  if (l.includes("housing") || l.includes("hacp")) return "bg-teal-600 text-white";
  if (l.includes("port authority") || l.includes("regional transit")) return "bg-sky-600 text-white";
  if (l.includes("water") || l.includes("pwsa")) return "bg-cyan-600 text-white";
  return "bg-muted text-muted-foreground";
}

function shortBodyLabel(body: string): string {
  const l = body.toLowerCase();
  if (l.includes("county") && !l.includes("port authority")) return "County";
  if (l.includes("city council")) return "City";
  if (l.includes("school") || l.includes("pps")) return "Schools";
  if (l.includes("zoning")) return "Zoning";
  if (l.includes("planning")) return "Planning";
  if (l.includes("ura") || l.includes("urban redevelopment")) return "URA";
  if (l.includes("housing") || l.includes("hacp")) return "HACP";
  if (l.includes("port authority") || l.includes("regional transit")) return "Transit";
  if (l.includes("water") || l.includes("pwsa")) return "PWSA";
  // Shorten remaining long names
  const short = body.split("(")[0].trim();
  if (short.length > 15) return short.split(" ").slice(0, 2).join(" ");
  return short;
}

export default function Dashboard() {
  const { data: meetings = [] } = useQuery<Meeting[]>({
    queryKey: ["/api/meetings"],
  });

  const { data: news = [] } = useQuery<NewsItem[]>({
    queryKey: ["/api/news"],
  });

  const { data: geoResponse } = useQuery<{ activity: ActivityMap; markers: Array<{ lat: number; lon: number; address: string; neighborhood: string; title: string; type: string; meetingId?: number }> }>({
    queryKey: ["/api/geo-activity"],
  });

  const geoActivity = geoResponse?.activity;

  // KPI calculations
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentMeetings = meetings.filter(
    (m) => new Date(m.date) >= thirtyDaysAgo
  );

  const activeBills = new Set(
    meetings.flatMap((m) => m.billsMentioned || [])
  ).size;

  const contentionCount = meetings.reduce(
    (sum, m) => sum + ((m.contention as ContentionItem[] | null) || []).length,
    0
  );

  const geoAreaCount = geoActivity ? Object.keys(geoActivity).length : 0;

  // Unique governing bodies
  const uniqueBodies = new Set(meetings.map((m) => m.governingBody)).size;

  // Governing bodies breakdown
  const bodyBreakdown: Record<string, number> = {};
  for (const m of meetings) {
    const label = shortBodyLabel(m.governingBody);
    bodyBreakdown[label] = (bodyBreakdown[label] || 0) + 1;
  }
  const sortedBodies = Object.entries(bodyBreakdown)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  // Top active neighborhoods
  const topAreas = geoActivity
    ? Object.entries(geoActivity)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 8)
    : [];

  // Recent activity feed: mix meetings and news, sort by date desc, take 10
  const activityFeed = [
    ...meetings.map((m) => ({
      id: `m-${m.id}`,
      type: "meeting" as const,
      title: m.title,
      date: m.date,
      source: m.governingBody,
      contention: ((m.contention as ContentionItem[] | null) || []).length,
    })),
    ...news.map((n) => ({
      id: `n-${n.id}`,
      type: "news" as const,
      title: n.headline,
      date: n.date,
      source: n.source,
      contention: 0,
    })),
  ]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 10);

  return (
    <div className="space-y-4 p-4" data-testid="dashboard-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold">Dashboard</h2>
          <p className="text-xs text-muted-foreground">
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
        <FeedStatus />
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3" data-testid="kpi-row">
        <KpiCard
          title="Meetings"
          value={recentMeetings.length}
          icon={CalendarDays}
          description="Last 30 days"
        />
        <KpiCard
          title="News Items"
          value={news.length}
          icon={Newspaper}
        />
        <KpiCard
          title="Bills & Cases"
          value={activeBills}
          icon={FileText}
        />
        <KpiCard
          title="Debates"
          value={contentionCount}
          icon={AlertTriangle}
          description="Across meetings"
        />
        <KpiCard
          title="Bodies Tracked"
          value={uniqueBodies}
          icon={Landmark}
          description="Governing bodies"
        />
      </div>

      {/* Split View: Governing Bodies + Recent Activity */}
      <div className="grid lg:grid-cols-2 gap-2 sm:gap-3">
        {/* Governing Bodies Breakdown */}
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Landmark className="h-4 w-4" />
              Meetings by Governing Body
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="space-y-2">
              {sortedBodies.map(([label, count]) => {
                const maxCount = sortedBodies[0]?.[1] || 1;
                return (
                  <div key={label} className="flex items-center gap-3">
                    <span className="text-xs font-medium w-24 text-right shrink-0 text-foreground/80 truncate">
                      {label}
                    </span>
                    <div className="flex-1 bg-muted/50 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="h-full bg-primary/60 rounded-full transition-all"
                        style={{ width: `${Math.max(4, (count / maxCount) * 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground font-mono w-6 text-right">
                      {count}
                    </span>
                  </div>
                );
              })}
              {sortedBodies.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">
                  No meetings loaded yet
                </p>
              )}
            </div>

            {/* Active neighborhoods */}
            {topAreas.length > 0 && (
              <div className="mt-4 pt-3 border-t">
                <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 mb-2">
                  <TrendingUp className="h-3 w-3" />
                  Most Active Areas
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {topAreas.map(([area, data]) => (
                    <Badge key={area} variant="outline" className="text-xs px-2 py-0.5">
                      {area} <span className="ml-1 text-muted-foreground/60">{data.count}</span>
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity Feed */}
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Recent Activity
              <Badge variant="outline" className="text-xs px-2 py-0.5 ml-auto">
                {uniqueBodies} bodies tracked
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3" data-testid="activity-feed">
            <div className="space-y-2">
              {activityFeed.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-2 py-2 border-b last:border-b-0"
                  data-testid={`feed-item-${item.id}`}
                >
                  <Badge
                    className={`text-[10px] px-1.5 py-0 mt-0.5 shrink-0 ${
                      item.type === "meeting"
                        ? bodyBadgeClass(item.source)
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {item.type === "meeting" ? shortBodyLabel(item.source) : "NEWS"}
                  </Badge>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium leading-snug line-clamp-2">
                      {item.title}
                    </p>
                    <div className="flex items-center gap-2">
                      <p className="text-[10px] text-muted-foreground">
                        {item.date}
                      </p>
                      {item.contention > 0 && (
                        <span className="text-[10px] text-orange-500 flex items-center gap-0.5">
                          <AlertTriangle className="h-2.5 w-2.5" />
                          {item.contention}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {activityFeed.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">
                  No recent activity
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
