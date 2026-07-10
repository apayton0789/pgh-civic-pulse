import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronUp, ExternalLink, Video, FileText, Globe, BookOpen, Landmark } from "lucide-react";
import type { SourceCitation } from "@shared/schema";
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

function SourceItem({ source }: { source: SourceCitation }) {
  return (
    <div
      className="py-2.5 border-b last:border-b-0 space-y-1.5"
      data-testid={`source-item-${source.id}`}
    >
      <div className="flex items-start gap-2">
        <span className={cn("shrink-0 mt-0.5", sourceTypeBadgeClass(source.sourceType))}>
          {sourceTypeIcon(source.sourceType)}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
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
          <div className="flex items-center gap-2 flex-wrap mt-0.5">
            <Badge
              variant="outline"
              className={cn("text-xs px-1.5 py-0 gap-1", sourceTypeBadgeClass(source.sourceType))}
            >
              {sourceTypeIcon(source.sourceType)}
              {source.sourceType.replace("_", " ")}
            </Badge>
            <Badge className={cn("text-xs px-1.5 py-0", confidenceBadgeClass(source.confidenceLevel))}>
              {source.confidenceLevel} confidence
            </Badge>
            <span className="text-xs text-muted-foreground">{source.publishedDate}</span>
            {source.agendaItem && (
              <span className="text-xs text-muted-foreground">• {source.agendaItem}</span>
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
          <span>Video: {source.videoTimestamp}</span>
          {source.videoTimestampSeconds && source.url && (
            <a
              href={`${source.url}&t=${source.videoTimestampSeconds[0]}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-red-500 hover:text-red-400 font-medium"
              data-testid={`link-video-ts-${source.id}`}
            >
              Watch clip →
            </a>
          )}
        </div>
      )}
    </div>
  );
}

interface SourceTrailPanelProps {
  sources: SourceCitation[];
  defaultOpen?: boolean;
  className?: string;
}

export function SourceTrailPanel({ sources, defaultOpen = false, className }: SourceTrailPanelProps) {
  const [open, setOpen] = useState(defaultOpen);

  if (sources.length === 0) return null;

  // Group by type
  const primary = sources.filter((s) => s.sourceType === "primary" || s.sourceType === "meeting_record" || s.sourceType === "government_document");
  const secondary = sources.filter((s) => s.sourceType === "secondary");
  const video = sources.filter((s) => s.sourceType === "video");

  return (
    <Collapsible open={open} onOpenChange={setOpen} className={className}>
      <CollapsibleTrigger
        data-testid="source-trail-toggle"
        className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors w-full text-left py-1"
      >
        <FileText className="h-3.5 w-3.5" />
        Evidence & Sources ({sources.length})
        {open ? <ChevronUp className="h-3.5 w-3.5 ml-auto" /> : <ChevronDown className="h-3.5 w-3.5 ml-auto" />}
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="mt-2 rounded-md border bg-muted/20 px-3 py-1 space-y-0">
          {primary.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground py-2">
                Primary Sources
              </p>
              {primary.map((s) => (
                <SourceItem key={s.id} source={s} />
              ))}
            </div>
          )}
          {secondary.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground py-2">
                Secondary Reporting
              </p>
              {secondary.map((s) => (
                <SourceItem key={s.id} source={s} />
              ))}
            </div>
          )}
          {video.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground py-2">
                Video / Audio
              </p>
              {video.map((s) => (
                <SourceItem key={s.id} source={s} />
              ))}
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
