import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { useHashLocation } from "wouter/use-hash-location";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { SourceTrailPanel } from "@/components/source-trail-panel";
import { InfographicBlock } from "@/components/infographic-block";
import {
  Zap,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Calendar,
  MessageSquare,
  BarChart3,
  Shield,
  Eye,
  ExternalLink,
  Filter,
  Video,
  X,
} from "lucide-react";
import type { BriefingItem } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

const INITIAL_SHOW = 15;

function compositeScore(item: BriefingItem): number {
  const hasVideo = item.sources.some(s => s.sourceType === "video");
  const hasTranscriptAnalysis = item.evidenceBullets.length >= 3;
  const qualityScore =
    item.importanceScore * 0.2 +
    item.urgencyScore * 0.2 +
    item.localRelevance * 0.15 +
    item.influenceability * 0.15 +
    (item.confidenceLevel === "high" ? 0.5 : 0);

  // Recency boost
  const now = Date.now();
  const daysOld = Math.max(0, (now - new Date(item.date).getTime()) / (1000 * 60 * 60 * 24));
  const recencyBoost = daysOld <= 1 ? 10
    : daysOld <= 3 ? 8
    : daysOld <= 7 ? 5
    : daysOld <= 14 ? 3
    : daysOld <= 30 ? 1
    : 0;

  // Video + transcript analysis strongly preferred
  const videoBoost = hasVideo ? 5 : 0;
  const transcriptBoost = hasTranscriptAnalysis ? 3 : 0;

  return qualityScore + recencyBoost + videoBoost + transcriptBoost;
}

function urgencyBadgeClass(urgency: BriefingItem["urgency"]) {
  switch (urgency) {
    case "critical": return "bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700";
    case "high": return "bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-700";
    case "medium": return "bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-700";
    case "low": return "bg-gray-100 text-gray-600 border-gray-300 dark:bg-gray-800/50 dark:text-gray-400 dark:border-gray-600";
  }
}

function govLevelBadgeClass(level: BriefingItem["governmentLevel"]) {
  switch (level) {
    case "local": return "border-blue-400/50 text-blue-600 dark:text-blue-400";
    case "county": return "border-indigo-400/50 text-indigo-600 dark:text-indigo-400";
    case "state": return "border-purple-400/50 text-purple-600 dark:text-purple-400";
    case "regional": return "border-teal-400/50 text-teal-600 dark:text-teal-400";
    case "federal": return "border-rose-400/50 text-rose-600 dark:text-rose-400";
  }
}

function confidenceBadge(level: BriefingItem["confidenceLevel"]) {
  switch (level) {
    case "high": return <Badge variant="outline" className="text-[10px] px-1 py-0 border-emerald-400/50 text-emerald-600 dark:text-emerald-400"><Shield className="h-2.5 w-2.5 mr-0.5 inline" />High confidence</Badge>;
    case "medium": return <Badge variant="outline" className="text-[10px] px-1 py-0 border-yellow-400/50 text-yellow-600 dark:text-yellow-400">Medium confidence</Badge>;
    case "low": return <Badge variant="outline" className="text-[10px] px-1 py-0 border-gray-400/50 text-gray-500">Low confidence</Badge>;
  }
}

// ── Filter Bar ────────────────────────────────────────────────

interface Filters {
  dateFrom: string;
  dateTo: string;
  govLevel: string;
  sourceType: string;
  urgency: string;
  videoOnly: boolean;
}

const DEFAULT_FILTERS: Filters = {
  dateFrom: "",
  dateTo: "",
  govLevel: "all",
  sourceType: "all",
  urgency: "all",
  videoOnly: false,
};

function FilterBar({
  filters,
  onChange,
  govLevels,
  sourceTypes,
}: {
  filters: Filters;
  onChange: (f: Filters) => void;
  govLevels: string[];
  sourceTypes: string[];
}) {
  const hasActiveFilter = filters.dateFrom || filters.dateTo ||
    filters.govLevel !== "all" || filters.sourceType !== "all" ||
    filters.urgency !== "all" || filters.videoOnly;

  return (
    <div className="rounded-lg border bg-card p-3 space-y-3" data-testid="filter-bar">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold flex items-center gap-1.5">
          <Filter className="h-4 w-4" />
          Filters
        </p>
        {hasActiveFilter && (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-6 px-2"
            onClick={() => onChange(DEFAULT_FILTERS)}
            data-testid="button-clear-filters"
          >
            <X className="h-3 w-3 mr-1" />
            Clear
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
        {/* Date from */}
        <div>
          <label className="text-xs text-muted-foreground block mb-1">From</label>
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => onChange({ ...filters, dateFrom: e.target.value })}
            className="w-full rounded-md border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/50"
            data-testid="filter-date-from"
          />
        </div>

        {/* Date to */}
        <div>
          <label className="text-xs text-muted-foreground block mb-1">To</label>
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => onChange({ ...filters, dateTo: e.target.value })}
            className="w-full rounded-md border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/50"
            data-testid="filter-date-to"
          />
        </div>

        {/* Government level */}
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Gov Level</label>
          <select
            value={filters.govLevel}
            onChange={(e) => onChange({ ...filters, govLevel: e.target.value })}
            className="w-full rounded-md border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/50"
            data-testid="filter-gov-level"
          >
            <option value="all">All levels</option>
            {govLevels.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </div>

        {/* Source type */}
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Source Type</label>
          <select
            value={filters.sourceType}
            onChange={(e) => onChange({ ...filters, sourceType: e.target.value })}
            className="w-full rounded-md border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/50"
            data-testid="filter-source-type"
          >
            <option value="all">All sources</option>
            {sourceTypes.map((t) => (
              <option key={t} value={t}>{t.replace("_", " ")}</option>
            ))}
          </select>
        </div>

        {/* Urgency */}
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Urgency</label>
          <select
            value={filters.urgency}
            onChange={(e) => onChange({ ...filters, urgency: e.target.value })}
            className="w-full rounded-md border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/50"
            data-testid="filter-urgency"
          >
            <option value="all">All</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>

        {/* Video only toggle */}
        <div className="flex items-end">
          <button
            onClick={() => onChange({ ...filters, videoOnly: !filters.videoOnly })}
            className={`w-full rounded-md border px-2 py-1.5 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
              filters.videoOnly
                ? "bg-red-50 border-red-300 text-red-700 dark:bg-red-900/30 dark:border-red-700 dark:text-red-300"
                : "bg-background hover:bg-muted/50"
            }`}
            data-testid="filter-video-only"
          >
            <Video className="h-3.5 w-3.5" />
            {filters.videoOnly ? "Video Sources On" : "Video Sources"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Briefing Card ─────────────────────────────────────────────

function BriefingItemCard({ item, rank }: { item: BriefingItem; rank: number }) {
  const [, navigate] = useHashLocation();
  const [detailOpen, setDetailOpen] = useState(false);
  const hasVideo = item.sources.some(s => s.sourceType === "video");

  return (
    <Card className="overflow-hidden" data-testid={`briefing-card-${item.id}`}>
      <CardContent className="p-4 space-y-3">
        {/* Top row */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-mono font-bold text-muted-foreground w-5 shrink-0">
            #{rank}
          </span>
          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${urgencyBadgeClass(item.urgency)}`}>
            {item.urgency === "critical" && <AlertTriangle className="h-3 w-3 mr-1" />}
            {item.urgency}
          </span>
          <Badge variant="outline" className={`text-xs px-1.5 py-0 ${govLevelBadgeClass(item.governmentLevel)}`}>
            {item.governmentLevel}
          </Badge>
          <Badge variant="outline" className="text-xs px-1.5 py-0">
            {item.categoryTag}
          </Badge>
          {hasVideo && (
            <Badge variant="outline" className="text-xs px-1.5 py-0 border-red-400/50 text-red-600 dark:text-red-400 gap-0.5">
              <Video className="h-2.5 w-2.5" /> Video
            </Badge>
          )}
          {confidenceBadge(item.confidenceLevel)}
          <span className="ml-auto text-xs text-muted-foreground">{item.date}</span>
        </div>

        {/* Headline + summary */}
        <div>
          <h3 className="text-base font-semibold leading-snug">{item.headline}</h3>
          <p className="text-sm text-foreground/70 mt-1 leading-relaxed">{item.oneLineSummary}</p>
        </div>

        {/* Why it matters */}
        <div className="rounded-md bg-muted/30 border border-muted px-3 py-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">Why it matters</p>
          <p className="text-sm leading-relaxed">{item.whyItMatters}</p>
        </div>

        {/* What changed */}
        <p className="text-sm">
          <span className="font-medium text-primary">What changed: </span>
          {item.whatChanged}
        </p>

        {/* Action needed */}
        <div className="flex items-start gap-2 rounded-md bg-primary/5 border border-primary/10 px-3 py-2">
          <MessageSquare className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">{item.actionNeeded}</p>
            {item.deadline && (
              <p className="text-sm flex items-center gap-1 text-orange-600 dark:text-orange-400 font-medium mt-0.5">
                <Calendar className="h-3.5 w-3.5" />
                Deadline: {item.deadline}
              </p>
            )}
          </div>
        </div>

        {/* Always-visible sources */}
        <div className="rounded-md border bg-muted/20 px-3 py-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
            Sources ({item.sources.length})
          </p>
          <div className="space-y-1">
            {item.sources.map((src, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <span className="text-xs font-mono text-muted-foreground mt-0.5 shrink-0">[{i + 1}]</span>
                {src.url && src.url !== "#" ? (
                  <a
                    href={src.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline flex items-center gap-1 text-sm leading-snug"
                    data-testid={`source-link-${item.id}-${i}`}
                  >
                    <ExternalLink className="h-3 w-3 shrink-0" />
                    {src.title}
                  </a>
                ) : (
                  <span className="text-sm text-foreground/70">{src.title}</span>
                )}
                <Badge variant="outline" className="text-[10px] px-1 py-0 shrink-0 ml-auto">
                  {src.sourceType.replace("_", " ")}
                </Badge>
              </div>
            ))}
          </div>
          {item.sources.some(s => s.quote) && (
            <div className="mt-2 pt-2 border-t border-muted space-y-1">
              {item.sources.filter(s => s.quote).map((src, i) => (
                <blockquote key={i} className="text-xs text-foreground/60 italic pl-3 border-l-2 border-muted-foreground/20">
                  "{src.quote}"
                  {src.speaker && <span className="not-italic font-medium"> — {src.speaker}</span>}
                </blockquote>
              ))}
            </div>
          )}
        </div>

        {/* Expandable detail */}
        <Collapsible open={detailOpen} onOpenChange={setDetailOpen}>
          <CollapsibleTrigger
            className="flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors w-full text-left py-1"
          >
            <Eye className="h-3.5 w-3.5" />
            Evidence, Timestamps & Infographic
            {detailOpen ? <ChevronUp className="h-3.5 w-3.5 ml-auto" /> : <ChevronDown className="h-3.5 w-3.5 ml-auto" />}
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3 mt-2">
            {item.evidenceBullets.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1">
                  <BarChart3 className="h-3 w-3" />
                  Evidence ({item.evidenceBullets.length})
                </p>
                <ul className="space-y-1.5 pl-1">
                  {item.evidenceBullets.map((bullet, i) => {
                    const srcRefs = item.sources.filter((s) => bullet.sourceIds.includes(s.id));
                    return (
                      <li key={i} className="text-sm flex items-start gap-2">
                        <span className="text-primary mt-1 shrink-0">•</span>
                        <span>
                          {bullet.text}
                          {srcRefs.map((s, j) => (
                            s.url && s.url !== "#" ? (
                              <a key={j} href={s.url} target="_blank" rel="noopener noreferrer"
                                className="text-xs text-primary hover:underline ml-1">[{s.title.slice(0, 30)}]</a>
                            ) : null
                          ))}
                          {bullet.videoRef && (
                            <span className="text-xs text-red-500 font-medium ml-1">{bullet.videoRef}</span>
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {item.videoTimestamps && item.videoTimestamps.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Video / Hearing Timestamps
                </p>
                <div className="space-y-1">
                  {item.videoTimestamps.map((vt, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      {vt.url ? (
                        <a href={vt.url} target="_blank" rel="noopener noreferrer"
                          className="text-red-500 hover:text-red-400 font-mono text-xs font-medium flex items-center gap-1">
                          <ExternalLink className="h-3 w-3" />[{vt.timestamp}]
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground font-mono">[{vt.timestamp}]</span>
                      )}
                      <span className="text-xs text-foreground/70 truncate">{vt.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <SourceTrailPanel sources={item.sources} defaultOpen={true} />
            <InfographicBlock item={item} />
          </CollapsibleContent>
        </Collapsible>

        {/* CTA */}
        {item.feedbackOpportunity && (
          <Button size="sm" variant="default" onClick={() => navigate(`/position/${encodeURIComponent(item.id)}`)} className="w-full gap-2">
            <MessageSquare className="h-3.5 w-3.5" />
            Take Action — Submit Feedback
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main Page ─────────────────────────────────────────────────

export default function Today() {
  const [showAll, setShowAll] = useState(false);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);

  const { data: items = [], isLoading } = useQuery<BriefingItem[]>({
    queryKey: ["/api/briefing/items"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/briefing/items");
      return res.json();
    },
  });

  // Derive filter options from data
  const govLevels = useMemo(() => [...new Set(items.map(i => i.governmentLevel))].sort(), [items]);
  const sourceTypes = useMemo(() => {
    const types = new Set<string>();
    items.forEach(i => i.sources.forEach(s => types.add(s.sourceType)));
    return [...types].sort();
  }, [items]);

  // Apply filters
  const filtered = useMemo(() => {
    return items.filter(item => {
      if (filters.dateFrom && item.date < filters.dateFrom) return false;
      if (filters.dateTo && item.date > filters.dateTo) return false;
      if (filters.govLevel !== "all" && item.governmentLevel !== filters.govLevel) return false;
      if (filters.urgency !== "all" && item.urgency !== filters.urgency) return false;
      if (filters.sourceType !== "all") {
        const hasType = item.sources.some(s => s.sourceType === filters.sourceType);
        if (!hasType) return false;
      }
      if (filters.videoOnly) {
        const hasVideo = item.sources.some(s => s.sourceType === "video");
        if (!hasVideo) return false;
      }
      return true;
    });
  }, [items, filters]);

  const sorted = [...filtered].sort((a, b) => compositeScore(b) - compositeScore(a));

  // KPIs (from filtered set)
  const totalItems = sorted.length;
  const highCount = sorted.filter(i => i.urgency === "high" || i.urgency === "critical").length;
  const feedbackCount = sorted.filter(i => i.feedbackOpportunity).length;
  const videoCount = sorted.filter(i => i.sources.some(s => s.sourceType === "video")).length;

  const displayed = showAll ? sorted : sorted.slice(0, INITIAL_SHOW);
  const remaining = sorted.length - INITIAL_SHOW;

  if (isLoading) {
    return (
      <div className="p-4 space-y-4 max-w-3xl">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
        </div>
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-48 w-full rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 max-w-3xl" data-testid="today-page">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Zap className="h-5 w-5 text-yellow-500" />
          What Needs Attention Today
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </p>
      </div>

      {/* Filter bar */}
      <FilterBar
        filters={filters}
        onChange={setFilters}
        govLevels={govLevels}
        sourceTypes={sourceTypes}
      />

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-lg border bg-card px-3 py-2">
          <p className="text-xs text-muted-foreground">Showing</p>
          <p className="text-xl font-bold">{totalItems}</p>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 px-3 py-2">
          <p className="text-xs text-red-600 dark:text-red-400">Critical / High</p>
          <p className="text-xl font-bold text-red-700 dark:text-red-300">{highCount}</p>
        </div>
        <div className="rounded-lg border border-orange-200 bg-orange-50 dark:bg-orange-900/20 px-3 py-2">
          <p className="text-xs text-orange-600 dark:text-orange-400">Feedback Open</p>
          <p className="text-xl font-bold text-orange-700 dark:text-orange-300">{feedbackCount}</p>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50/50 dark:bg-red-900/10 px-3 py-2">
          <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
            <Video className="h-3 w-3" /> Video Evidence
          </p>
          <p className="text-xl font-bold text-red-700 dark:text-red-300">{videoCount}</p>
        </div>
      </div>

      {/* Items */}
      {sorted.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Zap className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">
            {items.length > 0
              ? "No items match your filters. Try adjusting the filter criteria."
              : "No briefing items available. Check back after data loads."}
          </p>
          {items.length > 0 && (
            <Button variant="outline" size="sm" className="mt-2" onClick={() => setFilters(DEFAULT_FILTERS)}>
              Clear filters
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {displayed.map((item, i) => (
              <BriefingItemCard key={item.id} item={item} rank={i + 1} />
            ))}
          </div>
          {!showAll && remaining > 0 && (
            <Button variant="outline" className="w-full" onClick={() => setShowAll(true)}>
              Show {remaining} more items
            </Button>
          )}
          {showAll && remaining > 0 && (
            <Button variant="ghost" className="w-full text-muted-foreground" onClick={() => setShowAll(false)}>
              Show top {INITIAL_SHOW} only
            </Button>
          )}
        </>
      )}
    </div>
  );
}
