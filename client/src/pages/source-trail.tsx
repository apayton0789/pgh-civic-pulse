import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileSearch, ExternalLink, Video, FileText, Globe, BookOpen, Landmark, Search } from "lucide-react";
import type { SourceCitation } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

function sourceTypeIcon(type: SourceCitation["sourceType"]) {
  switch (type) {
    case "video": return <Video className="h-3.5 w-3.5" />;
    case "meeting_record": return <Landmark className="h-3.5 w-3.5" />;
    case "government_document": return <FileText className="h-3.5 w-3.5" />;
    case "primary": return <BookOpen className="h-3.5 w-3.5" />;
    case "secondary": return <Globe className="h-3.5 w-3.5" />;
    default: return <Globe className="h-3.5 w-3.5" />;
  }
}

function sourceTypeBadgeClass(type: SourceCitation["sourceType"]) {
  switch (type) {
    case "video": return "border-red-500/40 text-red-600 dark:text-red-400";
    case "meeting_record": return "border-blue-500/40 text-blue-600 dark:text-blue-400";
    case "government_document": return "border-purple-500/40 text-purple-600 dark:text-purple-400";
    case "primary": return "border-green-500/40 text-green-600 dark:text-green-400";
    case "secondary": return "border-gray-500/40 text-gray-600 dark:text-gray-400";
    default: return "border-gray-400/40 text-gray-500";
  }
}

function confidenceBadgeClass(level: SourceCitation["confidenceLevel"]) {
  switch (level) {
    case "high": return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300";
    case "medium": return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300";
    case "low": return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300";
    case "inference": return "bg-gray-100 text-gray-600 dark:bg-gray-800/60 dark:text-gray-400";
    default: return "bg-gray-100 text-gray-600";
  }
}

const SOURCE_TYPE_OPTIONS: Array<{ value: SourceCitation["sourceType"] | "all"; label: string }> = [
  { value: "all", label: "All Types" },
  { value: "meeting_record", label: "Meeting Records" },
  { value: "government_document", label: "Government Documents" },
  { value: "primary", label: "Primary Sources" },
  { value: "secondary", label: "Secondary Reporting" },
  { value: "video", label: "Video / Audio" },
];

const CONFIDENCE_OPTIONS: Array<{ value: SourceCitation["confidenceLevel"] | "all"; label: string }> = [
  { value: "all", label: "All Confidence" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
  { value: "inference", label: "Inference" },
];

function SourceRow({ source }: { source: SourceCitation }) {
  return (
    <div
      className="py-3 border-b last:border-b-0 space-y-1.5"
      data-testid={`source-row-${source.id}`}
    >
      <div className="flex items-start gap-2">
        <span className={cn("shrink-0 mt-0.5", sourceTypeBadgeClass(source.sourceType))}>
          {sourceTypeIcon(source.sourceType)}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2 flex-wrap">
            {source.url && source.url !== "#" ? (
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium hover:text-primary transition-colors flex items-center gap-1 group"
                data-testid={`link-source-${source.id}`}
              >
                {source.title}
                <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </a>
            ) : (
              <span className="text-sm font-medium">{source.title}</span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap mt-1">
            <Badge
              variant="outline"
              className={cn("text-xs px-1.5 py-0 gap-1", sourceTypeBadgeClass(source.sourceType))}
            >
              {sourceTypeIcon(source.sourceType)}
              <span>{source.sourceType.replace("_", " ")}</span>
            </Badge>
            <Badge className={cn("text-xs px-1.5 py-0", confidenceBadgeClass(source.confidenceLevel))}>
              {source.confidenceLevel}
            </Badge>
            <span className="text-xs text-muted-foreground">{source.publishedDate}</span>
            {source.agendaItem && (
              <span className="text-xs text-muted-foreground border-l pl-2">
                {source.agendaItem}
              </span>
            )}
          </div>
        </div>
      </div>

      {source.quote && (
        <blockquote className="ml-5 pl-3 border-l-2 border-muted-foreground/30 text-sm text-foreground/70 italic leading-relaxed">
          "{source.quote}"
          {source.speaker && (
            <span className="not-italic font-medium text-foreground/60"> — {source.speaker}</span>
          )}
        </blockquote>
      )}

      {source.videoTimestamp && (
        <div className="ml-5 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Video className="h-3 w-3 text-red-500" />
          <span>Timestamp: {source.videoTimestamp}</span>
          {source.videoTimestampSeconds && source.url && (
            <a
              href={`${source.url}&t=${source.videoTimestampSeconds[0]}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-red-500 hover:text-red-400 font-medium"
            >
              Watch →
            </a>
          )}
        </div>
      )}
    </div>
  );
}

export default function SourceTrail() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [confidenceFilter, setConfidenceFilter] = useState<string>("all");

  const { data: sources = [], isLoading } = useQuery<SourceCitation[]>({
    queryKey: ["/api/sources"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/sources");
      return res.json();
    },
  });

  // Filter
  const filtered = sources.filter((s) => {
    const matchSearch =
      !search ||
      s.title.toLowerCase().includes(search.toLowerCase()) ||
      (s.quote || "").toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === "all" || s.sourceType === typeFilter;
    const matchConf = confidenceFilter === "all" || s.confidenceLevel === confidenceFilter;
    return matchSearch && matchType && matchConf;
  });

  // Group by type
  const primary = filtered.filter(
    (s) => s.sourceType === "primary" || s.sourceType === "meeting_record" || s.sourceType === "government_document"
  );
  const secondary = filtered.filter((s) => s.sourceType === "secondary");
  const video = filtered.filter((s) => s.sourceType === "video");

  if (isLoading) {
    return (
      <div className="p-4 space-y-4 max-w-3xl">
        <Skeleton className="h-8 w-48" />
        <div className="flex gap-2">
          <Skeleton className="h-9 flex-1 rounded" />
          <Skeleton className="h-9 w-32 rounded" />
          <Skeleton className="h-9 w-32 rounded" />
        </div>
        {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-14 w-full rounded" />)}
      </div>
    );
  }

  return (
    <div className="p-4 space-y-5 max-w-3xl" data-testid="source-trail-page">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2">
          <FileSearch className="h-5 w-5 text-indigo-500" />
          Source Trail
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          All evidence sources across all briefing items — searchable, filterable, fully cited
        </p>
        <Badge variant="outline" className="text-xs mt-1">
          {filtered.length} sources
        </Badge>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap items-center">
        <div className="relative flex-1 min-w-40">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search sources..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9 text-sm"
            data-testid="input-search-sources"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-44 h-9 text-sm" data-testid="select-type-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SOURCE_TYPE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={confidenceFilter} onValueChange={setConfidenceFilter}>
          <SelectTrigger className="w-40 h-9 text-sm" data-testid="select-confidence-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CONFIDENCE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <FileSearch className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No sources match your filters.</p>
        </div>
      )}

      {/* Grouped sections */}
      {primary.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1.5">
            <Landmark className="h-3.5 w-3.5" />
            Primary Sources
            <Badge variant="outline" className="text-xs ml-1">{primary.length}</Badge>
          </h3>
          <div className="rounded-md border bg-card divide-y-0">
            {primary.map((s) => <SourceRow key={s.id} source={s} />)}
          </div>
        </div>
      )}

      {secondary.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1.5">
            <Globe className="h-3.5 w-3.5" />
            Secondary Reporting
            <Badge variant="outline" className="text-xs ml-1">{secondary.length}</Badge>
          </h3>
          <div className="rounded-md border bg-card">
            {secondary.map((s) => <SourceRow key={s.id} source={s} />)}
          </div>
        </div>
      )}

      {video.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1.5">
            <Video className="h-3.5 w-3.5 text-red-500" />
            Video / Audio
            <Badge variant="outline" className="text-xs ml-1">{video.length}</Badge>
          </h3>
          <div className="rounded-md border bg-card">
            {video.map((s) => <SourceRow key={s.id} source={s} />)}
          </div>
        </div>
      )}
    </div>
  );
}
