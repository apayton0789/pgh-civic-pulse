import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useHashLocation } from "wouter/use-hash-location";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { PenTool, Loader2, Copy, Check, MessageSquare } from "lucide-react";
import type { BriefingItem, StrategyAnswers } from "@shared/schema";
import { generateDrafts } from "@/lib/draft-generator";

interface DraftResult {
  positionSummary: string;
  email: string;
  publicComment: string;
  talkingPoints: string[];
  oralTestimony: string;
}

const DEFAULT_STRATEGY: StrategyAnswers = {
  whatMatters: "Community wellbeing and transparent governance",
  desiredOutcome: "Ensure residents are heard and decisions reflect public interest",
  mostAffected: "Pittsburgh residents and affected neighborhood communities",
  strongestFact: "See source citations below for factual evidence",
  strongestValue: "Everyone deserves to live in a safe, affordable, well-governed city",
  tone: "collaborative",
  speakingAs: "resident",
};

function CopyButton({ text, testId }: { text: string; testId: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
      }}
      data-testid={testId}
      className="gap-1.5 h-7 text-xs"
    >
      {copied ? (
        <><Check className="h-3 w-3 text-green-500" /> Copied</>
      ) : (
        <><Copy className="h-3 w-3" /> Copy</>
      )}
    </Button>
  );
}

export default function DraftResponse() {
  const [, navigate] = useHashLocation();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<DraftResult | null>(null);

  const { data: feedbackData, isLoading } = useQuery<{ items: BriefingItem[] }>({
    queryKey: ["/api/briefing/feedback"],
  });

  const feedbackItems = feedbackData?.items || [];
  const selectedItem = feedbackItems.find((i) => i.id === selectedId) || feedbackItems[0];

  const generateMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const target = feedbackItems.find((i) => i.id === itemId);
      if (!target) throw new Error("Briefing item not found");
      // Runs entirely client-side now — ported from server/draft-engine.ts
      return generateDrafts(target, DEFAULT_STRATEGY) as DraftResult;
    },
    onSuccess: (data) => setDrafts(data),
  });

  if (isLoading) {
    return (
      <div className="p-4 space-y-4 max-w-3xl">
        <Skeleton className="h-8 w-48" />
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
      </div>
    );
  }

  return (
    <div className="p-4 space-y-5 max-w-3xl" data-testid="draft-response-page">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2">
          <PenTool className="h-5 w-5 text-purple-500" />
          Draft Response
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Quick draft generation using default strategy — or use My Position for a customized approach.
        </p>
      </div>

      {feedbackItems.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No feedback opportunities available right now.</p>
        </div>
      ) : (
        <>
          {/* Item selector */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Select an issue to draft a response for:</p>
            <div className="space-y-2">
              {feedbackItems.slice(0, 8).map((item) => {
                const isSelected = (selectedId || feedbackItems[0].id) === item.id;
                return (
                  <button
                    key={item.id}
                    data-testid={`select-item-${item.id}`}
                    onClick={() => {
                      setSelectedId(item.id);
                      setDrafts(null);
                    }}
                    className={`w-full text-left rounded-lg border px-3 py-2.5 transition-colors space-y-1 ${
                      isSelected
                        ? "bg-primary/5 border-primary"
                        : "hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-xs">{item.urgency}</Badge>
                      <Badge variant="outline" className="text-xs">{item.categoryTag}</Badge>
                    </div>
                    <p className="text-sm font-medium leading-snug">{item.displayHeadline}</p>
                    <p className="text-xs text-muted-foreground">{item.oneLineSummary.slice(0, 100)}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 flex-wrap">
            <Button
              className="gap-2"
              data-testid="button-quick-draft"
              onClick={() => {
                const id = selectedId || feedbackItems[0].id;
                generateMutation.mutate(id);
              }}
              disabled={generateMutation.isPending}
            >
              {generateMutation.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</>
              ) : (
                <><PenTool className="h-4 w-4" /> Quick Draft</>
              )}
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              data-testid="button-go-to-position"
              onClick={() => {
                const id = selectedId || feedbackItems[0].id;
                navigate(`/position/${encodeURIComponent(id)}`);
              }}
            >
              <MessageSquare className="h-4 w-4" />
              Full Position Workflow
            </Button>
          </div>

          {/* Generated drafts */}
          {drafts && (
            <Card>
              <CardContent className="p-4">
                {selectedItem && (
                  <div className="mb-3 p-2 rounded-md bg-muted/30 text-sm font-medium">
                    Re: {selectedItem.displayHeadline}
                  </div>
                )}
                <Tabs defaultValue="email" data-testid="draft-tabs">
                  <TabsList className="flex flex-wrap h-auto gap-1 mb-4">
                    <TabsTrigger value="email" data-testid="tab-email">Email</TabsTrigger>
                    <TabsTrigger value="public-comment" data-testid="tab-public-comment">Public Comment</TabsTrigger>
                    <TabsTrigger value="talking-points" data-testid="tab-talking-points">Talking Points</TabsTrigger>
                    <TabsTrigger value="oral-testimony" data-testid="tab-oral-testimony">Oral Testimony</TabsTrigger>
                  </TabsList>

                  <TabsContent value="email">
                    <div className="space-y-1.5">
                      <div className="flex justify-end">
                        <CopyButton text={drafts.email} testId="copy-email" />
                      </div>
                      <Textarea readOnly value={drafts.email} className="text-sm font-mono min-h-[200px]" />
                    </div>
                  </TabsContent>

                  <TabsContent value="public-comment">
                    <div className="space-y-1.5">
                      <div className="flex justify-end">
                        <CopyButton text={drafts.publicComment} testId="copy-public-comment" />
                      </div>
                      <Textarea readOnly value={drafts.publicComment} className="text-sm font-mono min-h-[200px]" />
                    </div>
                  </TabsContent>

                  <TabsContent value="talking-points">
                    <div className="space-y-1.5">
                      <div className="flex justify-end">
                        <CopyButton text={drafts.talkingPoints.join("\n")} testId="copy-talking-points" />
                      </div>
                      <ul className="space-y-2">
                        {drafts.talkingPoints.map((tp, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <span className="font-bold text-primary shrink-0">{i + 1}.</span>
                            <span>{tp}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </TabsContent>

                  <TabsContent value="oral-testimony">
                    <div className="space-y-1.5">
                      <div className="flex justify-end">
                        <CopyButton text={drafts.oralTestimony} testId="copy-oral-testimony" />
                      </div>
                      <Textarea readOnly value={drafts.oralTestimony} className="text-sm font-mono min-h-[200px]" />
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
