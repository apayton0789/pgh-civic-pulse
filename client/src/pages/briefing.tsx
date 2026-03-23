import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Building2,
  Landmark,
  School,
  HardHat,
  Briefcase,
  Shield,
  CalendarDays,
  ExternalLink,
  Gavel,
  MapPinned,
  Home,
  Bus,
  Droplets,
  AlertTriangle,
  Vote,
  Newspaper,
  TrendingUp,
  Clock,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Warehouse,
  Users,
  Scale,
  FileText,
  Play,
} from "lucide-react";
import type { Meeting, NewsItem, ContentionItem, TranscriptAnalysis, MeetingActionItem } from "@shared/schema";
import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

/** Strip residual CDATA/HTML from RSS summaries */
function cleanText(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .replace(/<!\[CDATA\[/g, "")
    .replace(/\]\]>/g, "")
    .replace(/&lt;!?\[?CDATA\[?\]?\]?&gt;/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

interface BriefingSection {
  title: string;
  meetings?: Meeting[];
  news?: NewsItem[];
}

interface BriefingResponse {
  generated: string;
  narrative: string;
  topDevelopments: Array<{
    headline: string;
    body: string;
    source: string;
    category: string;
  }>;
  sections: Record<string, BriefingSection>;
}

const sectionMeta: Record<
  string,
  { icon: typeof Building2; color: string; accent: string }
> = {
  county: {
    icon: Landmark,
    color: "text-blue-500",
    accent: "border-l-blue-500",
  },
  city: {
    icon: Building2,
    color: "text-[hsl(47,95%,45%)]",
    accent: "border-l-[hsl(47,95%,45%)]",
  },
  schools: {
    icon: School,
    color: "text-green-500",
    accent: "border-l-green-500",
  },
  zoning: {
    icon: Gavel,
    color: "text-orange-500",
    accent: "border-l-orange-500",
  },
  planning: {
    icon: MapPinned,
    color: "text-amber-500",
    accent: "border-l-amber-500",
  },
  ura: {
    icon: HardHat,
    color: "text-purple-500",
    accent: "border-l-purple-500",
  },
  housing: {
    icon: Home,
    color: "text-teal-500",
    accent: "border-l-teal-500",
  },
  transit: { icon: Bus, color: "text-sky-500", accent: "border-l-sky-500" },
  water: {
    icon: Droplets,
    color: "text-cyan-500",
    accent: "border-l-cyan-500",
  },
  landBank: {
    icon: Warehouse,
    color: "text-emerald-500",
    accent: "border-l-emerald-500",
  },
  commissions: {
    icon: Users,
    color: "text-indigo-500",
    accent: "border-l-indigo-500",
  },
  landUse: {
    icon: HardHat,
    color: "text-orange-500",
    accent: "border-l-orange-500",
  },
  business: {
    icon: Briefcase,
    color: "text-purple-500",
    accent: "border-l-purple-500",
  },
  safety: { icon: Shield, color: "text-red-500", accent: "border-l-red-500" },
  stateRadar: {
    icon: Scale,
    color: "text-rose-500",
    accent: "border-l-rose-500",
  },
};

// ── Action item type color (strong contrast) ─────────────────
function actionTypeColor(type: MeetingActionItem["type"]): string {
  switch (type) {
    case "proclamation": return "text-purple-700 dark:text-purple-300";
    case "announcement": return "text-blue-700 dark:text-blue-300";
    case "vote": return "text-emerald-700 dark:text-emerald-300";
    case "presentation": return "text-amber-700 dark:text-amber-300";
    case "budget": return "text-cyan-700 dark:text-cyan-300";
    case "appointment": return "text-indigo-700 dark:text-indigo-300";
    case "public_comment": return "text-orange-700 dark:text-orange-300";
    case "discussion": return "text-foreground/80";
    default: return "text-foreground/80";
  }
}

// ── Meeting item with transcript summary ─────────────────────

function MeetingTranscriptSummary({ meeting }: { meeting: Meeting }) {
  const { data: transcript } = useQuery<TranscriptAnalysis>({
    queryKey: ["/api/meetings", meeting.id, "transcript"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/meetings/${meeting.id}/transcript`);
      if (!res.ok) throw new Error("No transcript");
      return res.json();
    },
    retry: false,
    staleTime: Infinity,
    enabled: !!meeting.youtubeUrl,
  });

  if (!transcript?.meetingSummary) return null;

  const { meetingSummary } = transcript;

  return (
    <div className="mt-2 space-y-2">
      {/* One-liner */}
      {meetingSummary.oneLiner && (
        <div className="rounded-md bg-primary/5 border border-primary/10 px-3 py-2">
          <p className="text-sm font-medium leading-relaxed text-foreground">
            {meetingSummary.oneLiner}
          </p>
        </div>
      )}

      {/* Action items */}
      {meetingSummary.actionItems.length > 0 && (
        <div className="space-y-1 border-l-2 border-primary/30 pl-3">
          {meetingSummary.actionItems.slice(0, 5).map((item, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="text-sm leading-none mt-0.5 shrink-0">{item.icon}</span>
              <div className="flex-1 min-w-0">
                <span className={cn("text-sm font-medium leading-snug", actionTypeColor(item.type))}>
                  {item.summary}
                </span>
                {item.detail && (
                  <p className="text-xs text-foreground/60 leading-relaxed mt-0.5 line-clamp-2">
                    {item.detail}
                  </p>
                )}
              </div>
            </div>
          ))}
          {meetingSummary.actionItems.length > 5 && (
            <span className="text-xs text-primary/70 font-medium pl-6">
              +{meetingSummary.actionItems.length - 5} more actions
            </span>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
        {meetingSummary.duration !== "Unknown" && (
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {meetingSummary.duration}
          </span>
        )}
        {transcript.speakerCount > 1 && (
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            ~{transcript.speakerCount} speakers
          </span>
        )}
        {transcript.votes.length > 0 && (
          <span className="flex items-center gap-1">
            <Vote className="h-3 w-3" />
            {transcript.votes.length} vote{transcript.votes.length !== 1 ? "s" : ""}
          </span>
        )}
        {transcript.billNumbers.length > 0 && (
          <span className="flex items-center gap-1">
            <FileText className="h-3 w-3" />
            {transcript.billNumbers.length} bill{transcript.billNumbers.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>
    </div>
  );
}

function MeetingBriefingItem({ meeting }: { meeting: Meeting }) {
  const contentionItems =
    (meeting.contention as ContentionItem[] | null) || [];

  return (
    <div className="py-3 border-b last:border-b-0">
      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
        <Badge variant="outline" className="text-xs px-2 py-0.5">
          {meeting.meetingType}
        </Badge>
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <CalendarDays className="h-3 w-3" />
          {meeting.date}
        </span>
        {contentionItems.length > 0 && (
          <Badge
            variant="outline"
            className="text-xs px-2 py-0.5 border-orange-500/50 text-orange-600 dark:text-orange-400 gap-1"
          >
            <AlertTriangle className="h-3 w-3" />
            {contentionItems.length} debate
            {contentionItems.length !== 1 ? "s" : ""}
          </Badge>
        )}
        {meeting.youtubeUrl && (
          <a
            href={meeting.youtubeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-red-500 hover:text-red-400 text-xs flex items-center gap-0.5 font-medium"
          >
            <Play className="h-3 w-3" />
            Watch
          </a>
        )}
      </div>
      <p className="text-base font-semibold mb-1">{meeting.title}</p>

      {/* Transcript-based summary (zero AI, from cached analysis) */}
      <MeetingTranscriptSummary meeting={meeting} />

      {/* Fallback: summary bullets if no transcript */}
      {!meeting.youtubeUrl && meeting.summaryBullets && meeting.summaryBullets.length > 0 && (
        <ul className="space-y-1 pl-3 mt-2">
          {meeting.summaryBullets.slice(0, 4).map((bullet, i) => (
            <li
              key={i}
              className="text-sm text-foreground/70 leading-relaxed list-disc"
            >
              {bullet}
            </li>
          ))}
          {meeting.summaryBullets.length > 4 && (
            <li className="text-xs text-muted-foreground list-none">
              +{meeting.summaryBullets.length - 4} more...
            </li>
          )}
        </ul>
      )}

      {contentionItems.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {contentionItems.slice(0, 2).map((c, i) => (
            <div
              key={i}
              className="rounded-lg border border-orange-500/20 bg-orange-50/50 dark:bg-orange-950/20 px-3 py-2"
            >
              <p className="text-sm font-semibold flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 text-orange-500" />
                {c.topic}
              </p>
              {c.vote_split && (
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Vote className="h-3 w-3" />
                  {c.vote_split}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function NewsBriefingItem({ item }: { item: NewsItem }) {
  return (
    <div className="py-3 border-b last:border-b-0">
      <div className="flex items-center gap-2 mb-1">
        <Badge variant="outline" className="text-xs px-2 py-0.5">
          {item.source}
        </Badge>
        {item.category && (
          <Badge variant="secondary" className="text-xs px-2 py-0.5">
            {item.category}
          </Badge>
        )}
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <CalendarDays className="h-3 w-3" />
          {item.date}
        </span>
      </div>
      <div className="flex items-start gap-2">
        {item.url ? (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-base font-semibold flex-1 hover:text-primary transition-colors"
          >
            {item.headline}
          </a>
        ) : (
          <p className="text-base font-semibold flex-1">{item.headline}</p>
        )}
        {item.url && (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-muted-foreground hover:text-primary"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        )}
      </div>
      {item.summary && cleanText(item.summary) && (
        <p className="text-sm text-foreground/70 mt-1.5 leading-relaxed line-clamp-3">
          {cleanText(item.summary)}
        </p>
      )}
    </div>
  );
}

function NarrativeLede({
  meetings,
  news,
}: {
  meetings: Meeting[];
  news: NewsItem[];
}) {
  const totalMeetings = meetings.length;
  const totalNews = news.length;
  const contentionCount = meetings.reduce(
    (sum, m) => sum + ((m.contention as ContentionItem[] | null) || []).length,
    0
  );

  const bodies = [...new Set(meetings.map((m) => m.governingBody))];

  const sortedMeetings = [...meetings].sort((a, b) =>
    b.date.localeCompare(a.date)
  );
  const sortedNews = [...news].sort((a, b) => b.date.localeCompare(a.date));

  const topMeetings = sortedMeetings.slice(0, 3);
  const topNews = sortedNews.slice(0, 3);

  const contentious = meetings.filter(
    (m) => ((m.contention as ContentionItem[] | null) || []).length > 0
  );

  const geoTags: Record<string, number> = {};
  [...meetings, ...news].forEach((item) => {
    const tags =
      "geographicTags" in item ? (item.geographicTags as string[]) || [] : [];
    tags.forEach((t) => {
      geoTags[t] = (geoTags[t] || 0) + 1;
    });
  });
  const hotspots = Object.entries(geoTags)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <Card
      className="border-l-4 border-l-[hsl(var(--sidebar-primary))] bg-gradient-to-br from-background to-muted/30"
      data-testid="briefing-narrative"
    >
      <CardContent className="pt-5 pb-4 px-5">
        {/* Lead headline */}
        <div className="flex items-start gap-3 mb-4">
          <Newspaper className="h-5 w-5 text-[hsl(var(--sidebar-primary))] mt-0.5 shrink-0" />
          <div>
            <h3 className="text-lg font-bold leading-snug mb-2">
              This Week in Pittsburgh Governance
            </h3>
            <p className="text-sm text-foreground/80 leading-relaxed">
              {totalMeetings > 0 && (
                <>
                  <span className="text-foreground font-semibold">
                    {totalMeetings} meeting
                    {totalMeetings !== 1 ? "s" : ""}
                  </span>{" "}
                  across {bodies.length} governing{" "}
                  {bodies.length !== 1 ? "bodies" : "body"} tracked this
                  period.{" "}
                </>
              )}
              {totalNews > 0 && (
                <>
                  <span className="text-foreground font-semibold">
                    {totalNews} news{" "}
                    {totalNews !== 1 ? "stories" : "story"}
                  </span>{" "}
                  from local outlets.{" "}
                </>
              )}
              {contentionCount > 0 && (
                <>
                  <span className="text-orange-600 dark:text-orange-400 font-semibold">
                    {contentionCount} debate
                    {contentionCount !== 1 ? "s" : ""}
                  </span>{" "}
                  flagged with split votes or contention.
                </>
              )}
            </p>
          </div>
        </div>

        {/* Top stories grid */}
        <div className="grid md:grid-cols-2 gap-4 mb-4">
          {topMeetings.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <CalendarDays className="h-3 w-3" />
                Recent Meetings
              </p>
              {topMeetings.map((m, i) => {
                const hasContention =
                  ((m.contention as ContentionItem[] | null) || []).length > 0;
                return (
                  <div
                    key={i}
                    className="flex items-start gap-2 py-2 border-l-2 border-muted-foreground/20 pl-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium leading-snug line-clamp-2">
                        {m.title}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-xs text-muted-foreground">
                          {m.governingBody} — {m.date}
                        </span>
                        {hasContention && (
                          <AlertTriangle className="h-3 w-3 text-orange-500" />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {topNews.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Newspaper className="h-3 w-3" />
                Breaking & Recent
              </p>
              {topNews.map((n, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 py-2 border-l-2 border-muted-foreground/20 pl-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-snug line-clamp-2">
                      {n.headline}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-xs text-muted-foreground">
                        {n.source} — {n.date}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Activity hotspots */}
        {hotspots.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap pt-3 border-t">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              Active areas:
            </span>
            {hotspots.map(([tag, count]) => (
              <Badge
                key={tag}
                variant="outline"
                className="text-xs px-2 py-0.5"
              >
                {tag}{" "}
                <span className="ml-1 text-muted-foreground/60">{count}</span>
              </Badge>
            ))}
          </div>
        )}

        {/* Contention callout */}
        {contentious.length > 0 && (
          <div className="mt-3 pt-3 border-t">
            <p className="text-xs font-semibold uppercase tracking-wider text-orange-600 dark:text-orange-400 flex items-center gap-1.5 mb-2">
              <AlertTriangle className="h-3.5 w-3.5" />
              Contention Watch
            </p>
            <div className="space-y-1.5">
              {contentious.slice(0, 3).map((m, i) => {
                const items =
                  (m.contention as ContentionItem[] | null) || [];
                return (
                  <div
                    key={i}
                    className="rounded-lg border border-orange-500/20 bg-orange-50/40 dark:bg-orange-950/20 px-3 py-2"
                  >
                    <p className="text-sm font-medium">
                      {m.governingBody}: {items[0]?.topic}
                    </p>
                    {items[0]?.vote_split && (
                      <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                        <Vote className="h-3 w-3" />
                        {items[0].vote_split}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CollapsibleSection({
  sectionKey,
  section,
}: {
  sectionKey: string;
  section: BriefingSection;
}) {
  const [expanded, setExpanded] = useState(false);
  const meta = sectionMeta[sectionKey] || {
    icon: Building2,
    color: "text-muted-foreground",
    accent: "border-l-muted",
  };
  const Icon = meta.icon;
  const hasMeetings = section.meetings && section.meetings.length > 0;
  const hasNews = section.news && section.news.length > 0;
  const itemCount =
    (section.meetings?.length || 0) + (section.news?.length || 0);

  if (!hasMeetings && !hasNews) return null;

  const previewText = section.meetings?.[0]?.title || section.news?.[0]?.headline || "";

  return (
    <Card
      className={`border-l-4 ${meta.accent} transition-all`}
      data-testid={`briefing-section-${sectionKey}`}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left"
        data-testid={`briefing-toggle-${sectionKey}`}
      >
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Icon className={`h-4 w-4 ${meta.color}`} />
            {section.title}
            <Badge
              variant="outline"
              className="text-xs px-2 py-0.5 ml-auto mr-2"
            >
              {itemCount} {itemCount === 1 ? "item" : "items"}
            </Badge>
            {expanded ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </CardTitle>
          {!expanded && previewText && (
            <p className="text-sm text-foreground/60 line-clamp-1 mt-1 pl-6">
              {previewText}
            </p>
          )}
        </CardHeader>
      </button>
      {expanded && (
        <CardContent className="px-4 pb-3 pt-0">
          {section.meetings?.map((m) => (
            <MeetingBriefingItem key={m.id} meeting={m} />
          ))}
          {section.news?.map((n) => (
            <NewsBriefingItem key={n.id} item={n} />
          ))}
        </CardContent>
      )}
    </Card>
  );
}

export default function Briefing() {
  const { data: briefing, isLoading } = useQuery<BriefingResponse>({
    queryKey: ["/api/briefing"],
  });

  if (isLoading) {
    return (
      <div className="p-4 space-y-4 max-w-4xl">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-xl" />
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (!briefing) {
    return (
      <div className="p-4">
        <p className="text-sm text-muted-foreground">
          Failed to load briefing.
        </p>
      </div>
    );
  }

  const allMeetings = Object.values(briefing.sections)
    .flatMap((s) => s.meetings || []);
  const allNews = Object.values(briefing.sections)
    .flatMap((s) => s.news || []);
  const seenMeetingIds = new Set<number>();
  const uniqueMeetings = allMeetings.filter((m) => {
    if (seenMeetingIds.has(m.id)) return false;
    seenMeetingIds.add(m.id);
    return true;
  });
  const seenNewsIds = new Set<number>();
  const uniqueNews = allNews.filter((n) => {
    if (seenNewsIds.has(n.id)) return false;
    seenNewsIds.add(n.id);
    return true;
  });

  const displaySections = [
    "county",
    "city",
    "schools",
    "zoning",
    "planning",
    "ura",
    "housing",
    "landBank",
    "commissions",
    "transit",
    "water",
    "stateRadar",
    "landUse",
    "business",
    "safety",
  ] as const;

  return (
    <div className="p-4 space-y-4 max-w-4xl" data-testid="briefing-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Civic Briefing</h2>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Generated{" "}
            {new Date(briefing.generated).toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
      </div>

      {/* News-style narrative lede */}
      <NarrativeLede meetings={uniqueMeetings} news={uniqueNews} />

      {/* Section cards — collapsible */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 px-1">
          <ArrowRight className="h-3 w-3" />
          By Governing Body
        </p>
        {displaySections.map((key) => {
          const section = briefing.sections[key];
          if (!section) return null;
          return (
            <CollapsibleSection
              key={key}
              sectionKey={key}
              section={section}
            />
          );
        })}
      </div>
    </div>
  );
}
