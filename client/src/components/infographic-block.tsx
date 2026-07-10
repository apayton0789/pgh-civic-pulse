import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, Check, ExternalLink } from "lucide-react";
import type { BriefingItem } from "@shared/schema";
import { cn } from "@/lib/utils";

interface InfographicBlockProps {
  item: BriefingItem;
  className?: string;
}

export function InfographicBlock({ item, className }: InfographicBlockProps) {
  const [copied, setCopied] = useState(false);

  const copyText = [
    `📌 ${item.displayHeadline}`,
    ``,
    item.oneLineSummary,
    ``,
    `📊 Key stat: ${item.keyStatOrQuote}`,
    ``,
    `💡 Why it matters: ${item.whyItMatters}`,
    ``,
    `✅ Action: ${item.callToAction}`,
    ``,
    `🔗 Source: ${item.strongestSourceLabel}`,
    item.strongestSourceUrl !== "#" ? `   ${item.strongestSourceUrl}` : "",
    ``,
    `— PGH Civic Pulse`,
  ].filter(Boolean).join("\n");

  function handleCopy() {
    navigator.clipboard.writeText(copyText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div
      className={cn(
        "rounded-lg border-l-4 bg-gradient-to-br from-background to-muted/20 p-4 space-y-3",
        className
      )}
      style={{ borderLeftColor: item.categoryColor }}
      data-testid={`infographic-block-${item.id}`}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span
              className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold text-white"
              style={{ backgroundColor: item.categoryColor }}
            >
              {item.categoryTag}
            </span>
            <Badge variant="outline" className="text-xs px-1.5 py-0">
              {item.governmentLevel}
            </Badge>
          </div>
          <h4 className="text-base font-semibold leading-snug">{item.displayHeadline}</h4>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          data-testid={`button-copy-infographic-${item.id}`}
          className="shrink-0 h-8 gap-1.5"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-green-500" />
              <span className="text-xs text-green-500">Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              <span className="text-xs">Copy</span>
            </>
          )}
        </Button>
      </div>

      {/* One-line summary */}
      <p className="text-sm text-foreground/80 leading-relaxed">{item.oneLineSummary}</p>

      {/* Key stat / quote */}
      <div className="rounded-md bg-muted/40 px-3 py-2 border border-muted">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
          Key Fact
        </p>
        <p className="text-sm font-medium">{item.keyStatOrQuote}</p>
      </div>

      {/* Caption + source */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-muted">
        <span className="text-xs text-muted-foreground">{item.infographicCaption}</span>
        {item.strongestSourceUrl && item.strongestSourceUrl !== "#" && (
          <a
            href={item.strongestSourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 transition-colors shrink-0"
            data-testid={`link-source-${item.id}`}
          >
            Source <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>

      {/* Call to action */}
      <div className="text-xs font-medium text-foreground/70">
        Action: <span className="text-foreground">{item.callToAction}</span>
      </div>
    </div>
  );
}
