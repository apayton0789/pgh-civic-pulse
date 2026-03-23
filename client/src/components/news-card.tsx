import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarDays, ExternalLink, MapPin, Megaphone } from "lucide-react";
import { useState } from "react";
import type { NewsItem } from "@shared/schema";
import { FeedbackForm } from "@/components/feedback-form";

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

interface NewsCardProps {
  item: NewsItem;
  compact?: boolean;
}

export function NewsCard({ item, compact = false }: NewsCardProps) {
  const [showFeedback, setShowFeedback] = useState(false);
  if (compact) {
    return (
      <div className="flex items-start gap-2 py-1.5" data-testid={`news-compact-${item.id}`}>
        <span className="text-xs text-muted-foreground whitespace-nowrap mt-0.5">
          {item.date}
        </span>
        <span className="text-sm leading-snug">{item.headline}</span>
      </div>
    );
  }

  return (
    <Card data-testid={`news-card-${item.id}`}>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="text-xs px-2 py-0.5">
                {item.source}
              </Badge>
              {item.category && (
                <Badge variant="secondary" className="text-xs px-2 py-0.5">
                  {item.category}
                </Badge>
              )}
            </div>
            {item.url ? (
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block group"
                data-testid={`news-link-${item.id}`}
              >
                <h3 className="text-base font-semibold leading-snug group-hover:text-primary transition-colors">
                  {item.headline}
                </h3>
              </a>
            ) : (
              <h3 className="text-base font-semibold leading-snug">{item.headline}</h3>
            )}
          </div>
          {item.url && (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-muted-foreground hover:text-primary transition-colors mt-1"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
        </div>

        {item.summary && cleanText(item.summary) && (
          <p className="text-sm text-foreground/70 leading-relaxed">
            {cleanText(item.summary)}
          </p>
        )}

        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <CalendarDays className="h-3.5 w-3.5" />
            {item.date}
          </span>
          {item.geographicTags && item.geographicTags.length > 0 && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {item.geographicTags.join(", ")}
            </span>
          )}
          <button
            onClick={() => setShowFeedback(true)}
            className="flex items-center gap-1 text-primary/70 hover:text-primary transition-colors ml-auto"
            data-testid={`feedback-news-${item.id}`}
          >
            <Megaphone className="h-3.5 w-3.5" />
            Submit Comment
          </button>
        </div>
      </CardContent>

      <FeedbackForm
        open={showFeedback}
        onClose={() => setShowFeedback(false)}
        defaultCategory="general"
        prefill={{ topic: item.headline }}
      />
    </Card>
  );
}
