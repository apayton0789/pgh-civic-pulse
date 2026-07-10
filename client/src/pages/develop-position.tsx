import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useHashLocation } from "wouter/use-hash-location";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { SourceTrailPanel } from "@/components/source-trail-panel";
import { Target, PenTool, Loader2, Copy, Check } from "lucide-react";
import type { BriefingItem, StrategyAnswers } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

interface DraftResult {
  positionSummary: string;
  email: string;
  publicComment: string;
  talkingPoints: string[];
  oralTestimony: string;
}

function CopyButton({ text, testId }: { text: string; testId: string }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleCopy}
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

function DraftTextArea({ text, testId }: { text: string; testId: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-end">
        <CopyButton text={text} testId={testId} />
      </div>
      <Textarea
        readOnly
        value={text}
        className="font-mono text-sm leading-relaxed min-h-[200px] resize-y"
        data-testid={`textarea-${testId}`}
      />
    </div>
  );
}

export default function DevelopPosition(props: Record<string, any>) {
  const [location, navigate] = useHashLocation();
  // Extract id purely from the current hash location path
  const pathMatch = location.match(/^\/position\/(.+)$/);
  const itemId = pathMatch ? decodeURIComponent(pathMatch[1]) : '';

  const [answers, setAnswers] = useState<StrategyAnswers>({
    whatMatters: "",
    desiredOutcome: "",
    mostAffected: "",
    strongestFact: "",
    strongestValue: "",
    tone: "collaborative",
    speakingAs: "resident",
  });

  const [drafts, setDrafts] = useState<DraftResult | null>(null);

  const { data: items = [], isLoading } = useQuery<BriefingItem[]>({
    queryKey: ["/api/briefing/items"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/briefing/items");
      return res.json();
    },
  });

  const item = itemId ? items.find((i) => i.id === itemId) : null;

  // If no item selected, show a selection list
  if (!isLoading && !item) {
    const feedbackItems = items.filter(i => i.feedbackOpportunity);
    return (
      <div className="p-4 space-y-5 max-w-3xl" data-testid="position-select-page">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Develop My Position
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Select an issue to develop your position on
          </p>
        </div>
        {feedbackItems.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">No active feedback opportunities. Check the Today page for current items.</p>
        ) : (
          <div className="space-y-2">
            {feedbackItems.map((fi) => (
              <Card
                key={fi.id}
                className="cursor-pointer hover:border-primary/30 transition-colors"
                data-testid={`select-item-${fi.id}`}
                onClick={() => navigate(`/position/${encodeURIComponent(fi.id)}`)}
              >
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{fi.headline}</p>
                    <p className="text-xs text-muted-foreground truncate">{fi.oneLineSummary}</p>
                  </div>
                  <Badge variant="outline" className="text-xs shrink-0">{fi.governmentLevel}</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/feedback/generate-drafts", {
        briefingItemId: item?.id,
        strategy: answers,
      });
      return res.json() as Promise<DraftResult>;
    },
    onSuccess: (data) => {
      setDrafts(data);
    },
  });

  if (isLoading) {
    return (
      <div className="p-4 space-y-4 max-w-3xl">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!item) {
    return (
      <div className="p-4 text-muted-foreground text-sm">
        No briefing item found. Please navigate from the Feedback page.
      </div>
    );
  }

  return (
    <div className="p-4 space-y-5 max-w-3xl" data-testid="develop-position-page">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Target className="h-5 w-5 text-blue-500" />
          Develop My Position
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Work through your position on this issue before drafting a response
        </p>
      </div>

      {/* Context card */}
      <Card className="border-l-4 border-l-primary">
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-xs">{item.urgency}</Badge>
            <Badge variant="outline" className="text-xs">{item.categoryTag}</Badge>
          </div>
          <h3 className="text-base font-semibold" data-testid="text-item-headline">
            {item.displayHeadline}
          </h3>
          <p className="text-sm text-foreground/70">{item.oneLineSummary}</p>
          <p className="text-sm">{item.whyItMatters}</p>
          <SourceTrailPanel sources={item.sources} />
        </CardContent>
      </Card>

      {/* Strategy form */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <h3 className="text-base font-semibold">Your Strategy</h3>

          <div className="space-y-1.5">
            <Label htmlFor="whatMatters" className="text-sm">What matters most to you here?</Label>
            <Textarea
              id="whatMatters"
              data-testid="input-whatMatters"
              placeholder="e.g. Housing affordability for working families"
              value={answers.whatMatters}
              onChange={(e) => setAnswers({ ...answers, whatMatters: e.target.value })}
              className="min-h-[70px]"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="desiredOutcome" className="text-sm">What outcome do you want?</Label>
            <Textarea
              id="desiredOutcome"
              data-testid="input-desiredOutcome"
              placeholder="e.g. Vote no on the proposed zoning change"
              value={answers.desiredOutcome}
              onChange={(e) => setAnswers({ ...answers, desiredOutcome: e.target.value })}
              className="min-h-[70px]"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="mostAffected" className="text-sm">Who is most affected?</Label>
            <Textarea
              id="mostAffected"
              data-testid="input-mostAffected"
              placeholder="e.g. Renters in Lawrenceville, seniors on fixed incomes"
              value={answers.mostAffected}
              onChange={(e) => setAnswers({ ...answers, mostAffected: e.target.value })}
              className="min-h-[70px]"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="strongestFact" className="text-sm">What is the strongest factual argument?</Label>
            <Textarea
              id="strongestFact"
              data-testid="input-strongestFact"
              placeholder="e.g. The proposed development eliminates 80 affordable units with no replacement plan"
              value={answers.strongestFact}
              onChange={(e) => setAnswers({ ...answers, strongestFact: e.target.value })}
              className="min-h-[70px]"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="strongestValue" className="text-sm">What is the strongest values-based argument?</Label>
            <Textarea
              id="strongestValue"
              data-testid="input-strongestValue"
              placeholder="e.g. Pittsburgh should be a city where long-term residents can afford to stay"
              value={answers.strongestValue}
              onChange={(e) => setAnswers({ ...answers, strongestValue: e.target.value })}
              className="min-h-[70px]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm">Tone</Label>
              <Select
                value={answers.tone}
                onValueChange={(v) => setAnswers({ ...answers, tone: v as StrategyAnswers["tone"] })}
              >
                <SelectTrigger data-testid="select-tone">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="collaborative">Collaborative</SelectItem>
                  <SelectItem value="firm">Firm</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">Speaking as</Label>
              <Select
                value={answers.speakingAs}
                onValueChange={(v) => setAnswers({ ...answers, speakingAs: v as StrategyAnswers["speakingAs"] })}
              >
                <SelectTrigger data-testid="select-speakingAs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="individual">Individual</SelectItem>
                  <SelectItem value="resident">Resident</SelectItem>
                  <SelectItem value="organizer">Organizer</SelectItem>
                  <SelectItem value="direct_experience">Direct Experience</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            className="w-full gap-2"
            data-testid="button-generate-drafts"
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
          >
            {generateMutation.isPending ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</>
            ) : (
              <><PenTool className="h-4 w-4" /> Generate Drafts</>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Generated drafts */}
      {drafts && (
        <Card>
          <CardContent className="p-4">
            <h3 className="text-base font-semibold mb-3">Generated Drafts</h3>
            <Tabs defaultValue="position" data-testid="drafts-tabs">
              <TabsList className="flex flex-wrap h-auto gap-1 mb-4">
                <TabsTrigger value="position" data-testid="tab-position">Position Summary</TabsTrigger>
                <TabsTrigger value="email" data-testid="tab-email">Email</TabsTrigger>
                <TabsTrigger value="public-comment" data-testid="tab-public-comment">Public Comment</TabsTrigger>
                <TabsTrigger value="talking-points" data-testid="tab-talking-points">Talking Points</TabsTrigger>
                <TabsTrigger value="oral-testimony" data-testid="tab-oral-testimony">Oral Testimony</TabsTrigger>
              </TabsList>

              <TabsContent value="position">
                <DraftTextArea text={drafts.positionSummary} testId="copy-position" />
              </TabsContent>

              <TabsContent value="email">
                <DraftTextArea text={drafts.email} testId="copy-email" />
              </TabsContent>

              <TabsContent value="public-comment">
                <DraftTextArea text={drafts.publicComment} testId="copy-public-comment" />
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
                <DraftTextArea text={drafts.oralTestimony} testId="copy-oral-testimony" />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {generateMutation.isError && (
        <p className="text-sm text-red-500" data-testid="error-generate">
          Failed to generate drafts. Please try again.
        </p>
      )}
    </div>
  );
}
