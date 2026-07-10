import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useHashLocation } from "wouter/use-hash-location";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { SourceTrailPanel } from "@/components/source-trail-panel";
import {
  MessageSquare,
  Target,
  Calendar,
  Building2,
  Users,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";
import type { BriefingItem, FeedbackOpportunity } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

interface FeedbackResponse {
  items: BriefingItem[];
  opportunities: FeedbackOpportunity[];
}

function FeedbackCard({
  item,
  opportunity,
}: {
  item?: BriefingItem;
  opportunity?: FeedbackOpportunity;
}) {
  const [, navigate] = useHashLocation();
  const [bgOpen, setBgOpen] = useState(false);

  const displayItem = item;
  const opp = opportunity;
  if (!displayItem && !opp) return null;

  const headline = displayItem?.displayHeadline || opp?.issue || "";
  const receivingBody = displayItem?.keyStakeholders[0] || opp?.receivingBody || "";
  const deadline = displayItem?.feedbackDeadline || opp?.deadline || "";
  const urgency = displayItem?.urgency || "medium";
  const id = displayItem?.id || opp?.briefingItemId || "";
  const sources = displayItem?.sources || opp?.sources || [];
  const bodyPower = opp?.bodyPower || `${receivingBody} has authority over this matter.`;
  const whoAffected = opp?.whoAffected || displayItem?.keyStakeholders || [];
  const consequences = opp?.likelyConsequences || displayItem?.whyItMatters || "";
  const submissionMethod = opp?.submissionMethod || "written comment or public testimony";
  const submissionUrl = opp?.submissionUrl;

  const urgencyBg = urgency === "critical" || urgency === "high"
    ? "border-l-orange-500"
    : "border-l-muted-foreground/30";

  return (
    <Card
      className={`border-l-4 ${urgencyBg}`}
      data-testid={`feedback-card-${id}`}
    >
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start gap-2 flex-wrap">
          {urgency === "critical" || urgency === "high" ? (
            <Badge variant="outline" className="text-xs border-orange-400/50 text-orange-600 dark:text-orange-400 gap-1">
              <AlertTriangle className="h-3 w-3" />
              {urgency}
            </Badge>
          ) : null}
          {deadline && (
            <Badge variant="outline" className="text-xs border-red-400/50 text-red-600 dark:text-red-400 gap-1">
              <Calendar className="h-3 w-3" />
              Deadline: {deadline}
            </Badge>
          )}
        </div>

        <div>
          <h3 className="text-base font-semibold leading-snug" data-testid={`text-headline-${id}`}>
            {headline}
          </h3>
          <div className="flex items-center gap-1.5 mt-1 text-sm text-muted-foreground">
            <Building2 className="h-3.5 w-3.5 shrink-0" />
            <span>{receivingBody}</span>
          </div>
          {submissionMethod && (
            <p className="text-sm text-muted-foreground mt-0.5">
              Submission: {submissionMethod}
              {submissionUrl && (
                <a
                  href={submissionUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-1 text-primary hover:text-primary/80 inline-flex items-center gap-0.5"
                  data-testid={`link-submission-${id}`}
                >
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </p>
          )}
        </div>

        {/* Background — expandable */}
        <Collapsible open={bgOpen} onOpenChange={setBgOpen}>
          <CollapsibleTrigger
            data-testid={`toggle-background-${id}`}
            className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors w-full text-left py-1"
          >
            Background & Context
            {bgOpen ? <ChevronUp className="h-3.5 w-3.5 ml-auto" /> : <ChevronDown className="h-3.5 w-3.5 ml-auto" />}
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-2 space-y-2.5 rounded-md border bg-muted/20 p-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                  What this body controls
                </p>
                <p className="text-sm">{bodyPower}</p>
              </div>
              {whoAffected.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5 flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    Who is affected
                  </p>
                  <div className="flex gap-1.5 flex-wrap">
                    {whoAffected.map((who, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {who}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {consequences && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-0.5">
                    Likely consequences
                  </p>
                  <p className="text-sm text-foreground/80">{consequences}</p>
                </div>
              )}
              {sources.length > 0 && (
                <SourceTrailPanel sources={sources} defaultOpen={false} />
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* CTA */}
        <Button
          variant="default"
          size="sm"
          className="w-full gap-2"
          data-testid={`button-develop-position-${id}`}
          onClick={() => navigate(`/position/${encodeURIComponent(id)}`)}
        >
          <Target className="h-3.5 w-3.5" />
          Develop My Position
        </Button>
      </CardContent>
    </Card>
  );
}

export default function FeedbackOpportunities() {
  const { data, isLoading } = useQuery<FeedbackResponse>({
    queryKey: ["/api/briefing/feedback"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/briefing/feedback");
      return res.json();
    },
  });

  const items = data?.items || [];
  const opportunities = data?.opportunities || [];

  // Build a map from briefingItemId to opportunity
  const oppMap = new Map<string, FeedbackOpportunity>();
  for (const opp of opportunities) {
    oppMap.set(opp.briefingItemId, opp);
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
    <div className="p-4 space-y-5 max-w-3xl" data-testid="feedback-opportunities-page">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-green-500" />
          Feedback Opportunities
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Issues where your voice can make a difference right now
        </p>
      </div>

      {items.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No active feedback opportunities at this time.</p>
        </div>
      )}

      <div className="space-y-4">
        {items.map((item) => (
          <FeedbackCard
            key={item.id}
            item={item}
            opportunity={oppMap.get(item.id)}
          />
        ))}
      </div>
    </div>
  );
}
