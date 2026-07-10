import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CalendarDays,
  Youtube,
  AlertTriangle,
  MessageSquare,
  Vote,
  Share2,
  FileText,
  BarChart3,
  Users,
  Megaphone,
  Clock,
  Play,
  ChevronRight,
  X,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Meeting, ContentionItem, TranscriptAnalysis, MeetingActionItem, TimedSegment } from "@shared/schema";
import { cn } from "@/lib/utils";
import { ShareDialog } from "@/components/share-dialog";
import { FeedbackForm } from "@/components/feedback-form";

// ── Meeting character emoji map ──────────────────────────────
const CHARACTER_ICON: Record<string, string> = {
  legislative: "\u2696\uFE0F",   // ⚖️
  ceremonial: "\u{1F3DB}\uFE0F", // 🏛️
  committee: "\u{1F465}",        // 👥
  public_hearing: "\u{1F4E2}",   // 📢
  special: "\u26A1",             // ⚡
  work_session: "\u{1F4DD}",    // 📝
};

// ── Governing body color mapping ─────────────────────────────
function bodyColor(body: string) {
  const lower = body.toLowerCase();
  if (lower.includes("county") && !lower.includes("port authority"))
    return "bg-blue-600 text-white";
  if (lower.includes("city council"))
    return "bg-[hsl(47,95%,55%)] text-[hsl(215,25%,12%)]";
  if (lower.includes("school") || lower.includes("pps"))
    return "bg-green-600 text-white";
  if (lower.includes("zoning"))
    return "bg-orange-600 text-white";
  if (lower.includes("planning commission"))
    return "bg-amber-600 text-white";
  if (lower.includes("ura") || lower.includes("urban redevelopment"))
    return "bg-purple-600 text-white";
  if (lower.includes("housing") || lower.includes("hacp"))
    return "bg-teal-600 text-white";
  if (lower.includes("port authority") || lower.includes("regional transit"))
    return "bg-sky-600 text-white";
  if (lower.includes("water") || lower.includes("pwsa"))
    return "bg-cyan-600 text-white";
  return "bg-muted text-muted-foreground";
}

function bodyLabel(body: string): string {
  const lower = body.toLowerCase();
  if (lower.includes("county") && !lower.includes("port authority")) return "County";
  if (lower.includes("city council")) return "City";
  if (lower.includes("school") || lower.includes("pps")) return "Schools";
  if (lower.includes("zoning")) return "Zoning";
  if (lower.includes("planning commission")) return "Planning";
  if (lower.includes("ura") || lower.includes("urban redevelopment")) return "URA";
  if (lower.includes("housing") || lower.includes("hacp")) return "HACP";
  if (lower.includes("port authority") || lower.includes("regional transit")) return "Transit";
  if (lower.includes("water") || lower.includes("pwsa")) return "PWSA";
  return body;
}

// ── Action item type color (stronger contrast) ──────────────
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

function actionTypeBg(type: MeetingActionItem["type"]): string {
  switch (type) {
    case "proclamation": return "bg-purple-50 dark:bg-purple-950/30";
    case "announcement": return "bg-blue-50 dark:bg-blue-950/30";
    case "vote": return "bg-emerald-50 dark:bg-emerald-950/30";
    case "presentation": return "bg-amber-50 dark:bg-amber-950/30";
    case "budget": return "bg-cyan-50 dark:bg-cyan-950/30";
    case "appointment": return "bg-indigo-50 dark:bg-indigo-950/30";
    case "public_comment": return "bg-orange-50 dark:bg-orange-950/30";
    case "discussion": return "bg-muted/50";
    default: return "bg-muted/50";
  }
}

// ── Format milliseconds to MM:SS ────────────────────────────
function formatTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

// ── Small sub-components ─────────────────────────────────────

function ContentionBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <Badge
      variant="outline"
      className="text-xs px-2 py-0.5 border-orange-500/50 text-orange-600 dark:text-orange-400 gap-1"
    >
      <AlertTriangle className="h-3 w-3" />
      {count} debate{count !== 1 ? "s" : ""}
    </Badge>
  );
}

// ── Action item line (bigger text) ──────────────────────────
function ActionItemLine({ item }: { item: MeetingActionItem }) {
  return (
    <div className="flex items-start gap-2" data-testid="action-item">
      <span className="text-sm leading-none mt-0.5 shrink-0">{item.icon}</span>
      <span className={cn("text-sm leading-snug font-medium", actionTypeColor(item.type))}>
        {item.summary}
      </span>
    </div>
  );
}

// ── Timed Segment List (timestamped discussion notes) ───────
function TimedSegmentList({ segments, youtubeUrl }: { segments: TimedSegment[]; youtubeUrl?: string | null }) {
  if (!segments || segments.length === 0) return null;

  // Group consecutive short segments into logical chunks (~2-3 min blocks)
  const chunks: Array<{ startMs: number; endMs: number; text: string }> = [];
  let current: { startMs: number; endMs: number; text: string } | null = null;

  for (const seg of segments) {
    if (!current) {
      current = { startMs: seg.startMs, endMs: seg.endMs, text: seg.text };
    } else if (seg.startMs - current.endMs < 120_000 && current.text.length < 600) {
      // Merge if gap < 2 min and chunk not too long
      current.endMs = seg.endMs;
      current.text += " " + seg.text;
    } else {
      chunks.push(current);
      current = { startMs: seg.startMs, endMs: seg.endMs, text: seg.text };
    }
  }
  if (current) chunks.push(current);

  // Build YouTube timestamp link
  function ytLink(ms: number) {
    if (!youtubeUrl) return null;
    const secs = Math.floor(ms / 1000);
    // Append &t= or ?t= depending on existing params
    const sep = youtubeUrl.includes("?") ? "&" : "?";
    return `${youtubeUrl}${sep}t=${secs}`;
  }

  return (
    <div className="space-y-1">
      <p className="text-sm font-semibold text-foreground flex items-center gap-1.5 mb-2">
        <Clock className="h-4 w-4 text-primary" />
        Timestamped Discussion Notes
      </p>
      <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
        {chunks.map((chunk, i) => {
          const link = ytLink(chunk.startMs);
          return (
            <div key={i} className="flex gap-3 group" data-testid={`segment-${i}`}>
              <div className="shrink-0 pt-0.5">
                {link ? (
                  <a
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-mono font-semibold text-primary hover:text-primary/80 bg-primary/10 hover:bg-primary/20 rounded px-1.5 py-0.5 transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Play className="h-2.5 w-2.5" />
                    {formatTimestamp(chunk.startMs)}
                  </a>
                ) : (
                  <span className="inline-flex text-xs font-mono font-semibold text-muted-foreground bg-muted/50 rounded px-1.5 py-0.5">
                    {formatTimestamp(chunk.startMs)}
                  </span>
                )}
              </div>
              <p className="text-sm leading-relaxed text-foreground/90 flex-1">
                {chunk.text}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Full Meeting Detail Modal ────────────────────────────────
function MeetingDetailModal({
  meeting,
  open,
  onClose,
}: {
  meeting: Meeting;
  open: boolean;
  onClose: () => void;
}) {
  const { data: transcript } = useQuery<TranscriptAnalysis>({
    queryKey: ["/api/meetings", meeting.id, "transcript"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/meetings/${meeting.id}/transcript`);
      if (!res.ok) throw new Error("No transcript");
      return res.json();
    },
    retry: false,
    staleTime: Infinity,
    enabled: open && !!meeting.youtubeUrl,
  });

  const contentionItems = (meeting.contention as ContentionItem[] | null) || [];
  const commentThemes = meeting.publicCommentThemes || [];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto p-0">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-background border-b px-5 py-4">
          <DialogHeader>
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <Badge className={cn("text-xs px-2 py-0.5", bodyColor(meeting.governingBody))}>
                {bodyLabel(meeting.governingBody)}
              </Badge>
              <Badge variant="outline" className="text-xs px-2 py-0.5">
                {meeting.meetingType}
              </Badge>
              <ContentionBadge count={contentionItems.length} />
              {transcript?.meetingSummary?.meetingCharacter && (
                <span className="text-sm" title={transcript.meetingSummary.meetingCharacter}>
                  {CHARACTER_ICON[transcript.meetingSummary.meetingCharacter] || ""}
                </span>
              )}
            </div>
            <DialogTitle className="text-lg font-bold leading-snug">
              {meeting.title}
            </DialogTitle>
            <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1 flex-wrap">
              <span className="flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5" />
                {meeting.date}
              </span>
              {meeting.youtubeUrl && (
                <a
                  href={meeting.youtubeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-red-500 hover:text-red-400 font-medium"
                >
                  <Youtube className="h-3.5 w-3.5" />
                  Watch Full Video
                </a>
              )}
              {transcript?.meetingSummary?.duration && transcript.meetingSummary.duration !== "Unknown" && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {transcript.meetingSummary.duration}
                </span>
              )}
            </div>
          </DialogHeader>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-5">
          {/* One-liner summary */}
          {transcript?.meetingSummary?.oneLiner && (
            <div className="rounded-lg bg-primary/5 border border-primary/10 p-4">
              <p className="text-base font-medium leading-relaxed text-foreground">
                {transcript.meetingSummary.oneLiner}
              </p>
            </div>
          )}

          {/* Action Items — full list */}
          {transcript?.meetingSummary?.actionItems && transcript.meetingSummary.actionItems.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
                <FileText className="h-4 w-4 text-primary" />
                Key Actions ({transcript.meetingSummary.actionItems.length})
              </p>
              <div className="space-y-2">
                {transcript.meetingSummary.actionItems.map((item, i) => (
                  <div key={i} className={cn("rounded-lg p-3 border", actionTypeBg(item.type))}>
                    <div className="flex items-start gap-2">
                      <span className="text-base leading-none mt-0.5 shrink-0">{item.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className={cn("text-sm font-semibold leading-snug", actionTypeColor(item.type))}>
                          {item.summary}
                        </p>
                        {item.detail && (
                          <p className="text-sm text-foreground/70 mt-1 leading-relaxed">
                            {item.detail}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Contention / Debates */}
          {contentionItems.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-orange-600 dark:text-orange-400 mb-2 flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4" />
                Debates & Contention
              </p>
              <div className="space-y-2">
                {contentionItems.map((item, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-orange-500/20 bg-orange-50/50 dark:bg-orange-950/20 p-3 space-y-1.5"
                  >
                    <p className="text-sm font-semibold leading-snug">{item.topic}</p>
                    <p className="text-sm leading-relaxed text-foreground/70">{item.description}</p>
                    {item.vote_split && (
                      <div className="flex items-center gap-1.5">
                        <Vote className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="text-sm font-mono font-medium">{item.vote_split}</span>
                      </div>
                    )}
                    {item.sides && (
                      <p className="text-xs text-muted-foreground leading-snug pl-5">{item.sides}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Public Comment Themes */}
          {commentThemes.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
                <MessageSquare className="h-4 w-4" />
                Public Comment Themes
              </p>
              <ul className="space-y-1">
                {commentThemes.map((theme, i) => (
                  <li key={i} className="text-sm leading-relaxed flex gap-2">
                    <span className="text-muted-foreground mt-0.5 shrink-0">&bull;</span>
                    <span className="text-foreground/80">{theme}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Vote Events */}
          {transcript && transcript.votes.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
                <Vote className="h-4 w-4 text-emerald-600" />
                {transcript.votes.length} Vote{transcript.votes.length !== 1 ? "s" : ""} Detected
              </p>
              <div className="space-y-2">
                {transcript.votes.slice(0, 8).map((v, i) => (
                  <div
                    key={i}
                    className="rounded-lg border bg-muted/30 px-3 py-2"
                  >
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-xs px-1.5 py-0 font-mono mb-1",
                        v.type === "roll_call" && "border-blue-500/50 text-blue-600 dark:text-blue-400",
                        v.type === "voice_vote" && "border-green-500/50 text-green-600 dark:text-green-400",
                        v.type === "motion" && "border-amber-500/50 text-amber-600 dark:text-amber-400"
                      )}
                    >
                      {v.type.replace("_", " ")}
                    </Badge>
                    <p className="text-sm leading-relaxed text-foreground/70 line-clamp-3">
                      &ldquo;...{v.context.slice(0, 250)}...&rdquo;
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Topic Frequency */}
          {transcript && Object.keys(transcript.topicKeywords).length > 0 && (() => {
            const topTopics = Object.entries(transcript.topicKeywords)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 8);
            const maxCount = topTopics[0]?.[1] || 1;
            return (
              <div>
                <p className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  Topic Frequency
                </p>
                <div className="space-y-1.5">
                  {topTopics.map(([topic, count]) => (
                    <div key={topic} className="flex items-center gap-3">
                      <span className="text-xs font-medium w-24 text-right shrink-0 capitalize text-foreground/80">
                        {topic}
                      </span>
                      <div className="flex-1 bg-muted/50 rounded-full h-2.5 overflow-hidden">
                        <div
                          className="h-full bg-primary/60 rounded-full transition-all"
                          style={{ width: `${Math.max(4, (count / maxCount) * 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground font-mono w-8 text-right">
                        {count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Stats bar */}
          {transcript && (
            <div className="flex items-center gap-4 flex-wrap py-2 border-t text-sm text-muted-foreground">
              {transcript.publicCommentDetected && (
                <span className="flex items-center gap-1">
                  <MessageSquare className="h-3.5 w-3.5" />
                  Public comment ({transcript.publicCommentCount} mentions)
                </span>
              )}
              {transcript.speakerCount > 1 && (
                <span className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" />
                  ~{transcript.speakerCount} speakers
                </span>
              )}
              {transcript.billNumbers.length > 0 && (
                <span className="flex items-center gap-1">
                  <FileText className="h-3.5 w-3.5" />
                  {transcript.billNumbers.length} bill{transcript.billNumbers.length !== 1 ? "s" : ""} mentioned
                </span>
              )}
              <span className="flex items-center gap-1">
                <FileText className="h-3.5 w-3.5" />
                {(transcript.transcriptLength / 1000).toFixed(0)}k chars
              </span>
            </div>
          )}

          {/* Key Topics & Bills */}
          {meeting.keyTopics && meeting.keyTopics.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-foreground mb-2">Key Topics</p>
              <div className="flex flex-wrap gap-1.5">
                {meeting.keyTopics.map((topic, i) => (
                  <Badge key={i} variant="secondary" className="text-xs px-2 py-0.5">
                    {topic}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {meeting.billsMentioned && meeting.billsMentioned.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-foreground mb-2">Bills & Cases</p>
              <div className="flex flex-wrap gap-1.5">
                {meeting.billsMentioned.map((bill, i) => (
                  <Badge key={i} variant="outline" className="text-xs px-2 py-0.5 font-mono">
                    {bill}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {meeting.geographicTags && meeting.geographicTags.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-foreground mb-2">Geographic Tags</p>
              <div className="flex flex-wrap gap-1.5">
                {meeting.geographicTags.map((tag, i) => (
                  <Badge
                    key={i}
                    variant="outline"
                    className="text-xs px-2 py-0.5 border-emerald-500/40 text-emerald-700 dark:text-emerald-400"
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Timestamped Discussion Notes */}
          {transcript?.timedSegments && transcript.timedSegments.length > 0 && (
            <TimedSegmentList segments={transcript.timedSegments} youtubeUrl={meeting.youtubeUrl} />
          )}

          {/* Summary Bullets (legacy data) */}
          {meeting.summaryBullets && meeting.summaryBullets.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-foreground mb-2">Summary Notes</p>
              <ul className="space-y-1">
                {meeting.summaryBullets.map((bullet, i) => (
                  <li key={i} className="text-sm leading-relaxed flex gap-2">
                    <span className="text-muted-foreground mt-0.5 shrink-0">&bull;</span>
                    <span className="text-foreground/80">{bullet}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Transcript fetch + inline summary (on card) ─────────────

function TranscriptSummary({ meetingId }: { meetingId: number }) {
  const { data: transcript, isLoading } = useQuery<TranscriptAnalysis>({
    queryKey: ["/api/meetings", meetingId, "transcript"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/meetings/${meetingId}/transcript`);
      if (!res.ok) throw new Error("No transcript");
      return res.json();
    },
    retry: false,
    staleTime: Infinity,
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-2">
        <FileText className="h-3.5 w-3.5 animate-pulse" />
        Loading transcript...
      </div>
    );
  }

  if (!transcript?.meetingSummary) return null;

  const { meetingSummary } = transcript;
  const previewItems = meetingSummary.actionItems.slice(0, 3);

  return (
    <>
      {/* One-liner */}
      {meetingSummary.oneLiner && (
        <p className="text-sm text-foreground/80 leading-relaxed mt-2.5" data-testid="meeting-oneliner">
          {meetingSummary.oneLiner}
          {meetingSummary.duration !== "Unknown" && (
            <span className="ml-2 text-xs text-muted-foreground">({meetingSummary.duration})</span>
          )}
        </p>
      )}

      {/* Preview action items */}
      {previewItems.length > 0 && (
        <div className="mt-2 space-y-1 border-l-2 border-primary/30 pl-3" data-testid="action-items-preview">
          {previewItems.map((item, i) => (
            <ActionItemLine key={i} item={item} />
          ))}
          {meetingSummary.actionItems.length > 3 && (
            <span className="text-xs text-primary/70 font-medium pl-6">
              +{meetingSummary.actionItems.length - 3} more actions
            </span>
          )}
        </div>
      )}
    </>
  );
}

// ── Main MeetingCard Component ───────────────────────────────

interface MeetingCardProps {
  meeting: Meeting;
  expandable?: boolean;
  compact?: boolean;
}

export function MeetingCard({
  meeting,
  expandable = true,
  compact = false,
}: MeetingCardProps) {
  const [detailOpen, setDetailOpen] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);

  const contentionItems = (meeting.contention as ContentionItem[] | null) || [];
  const hasPublicComment = (meeting.publicCommentThemes && meeting.publicCommentThemes.length > 0);

  if (compact) {
    return (
      <div className="flex items-start gap-2 py-1.5" data-testid={`meeting-compact-${meeting.id}`}>
        <span className="text-xs text-muted-foreground whitespace-nowrap mt-0.5">
          {meeting.date}
        </span>
        <span className="text-sm leading-snug">{meeting.title}</span>
      </div>
    );
  }

  return (
    <>
      <Card
        data-testid={`meeting-card-${meeting.id}`}
        className={cn(expandable && "cursor-pointer hover:border-primary/30 transition-colors")}
        onClick={() => expandable && setDetailOpen(true)}
      >
        <CardContent className="p-4">
          {/* ── Header Row ── */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge
                  className={cn("text-xs px-2 py-0.5", bodyColor(meeting.governingBody))}
                >
                  {bodyLabel(meeting.governingBody)}
                </Badge>
                <Badge variant="outline" className="text-xs px-2 py-0.5">
                  {meeting.meetingType}
                </Badge>
                <ContentionBadge count={contentionItems.length} />
              </div>
              <h3 className="text-base font-semibold leading-snug">{meeting.title}</h3>
              <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {meeting.date}
                </span>
                {meeting.youtubeUrl && (
                  <a
                    href={meeting.youtubeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-red-500 hover:text-red-400 font-medium"
                    onClick={(e) => e.stopPropagation()}
                    data-testid={`meeting-youtube-${meeting.id}`}
                  >
                    <Youtube className="h-3.5 w-3.5" />
                    Watch
                  </a>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); setShowShare(true); }}
                  className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                  data-testid={`share-meeting-${meeting.id}`}
                >
                  <Share2 className="h-3.5 w-3.5" />
                  Share
                </button>
                {hasPublicComment && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowFeedback(true); }}
                    className="flex items-center gap-1 text-primary/70 hover:text-primary transition-colors"
                    data-testid={`feedback-meeting-${meeting.id}`}
                  >
                    <Megaphone className="h-3.5 w-3.5" />
                    Have Your Say
                  </button>
                )}
              </div>
            </div>
            {expandable && (
              <div className="text-primary/60 mt-1">
                <ChevronRight className="h-5 w-5" />
              </div>
            )}
          </div>

          {/* ── Inline Summary (always visible, no click needed) ── */}
          {meeting.youtubeUrl && (
            <TranscriptSummary meetingId={meeting.id} />
          )}

          {/* View details hint */}
          {expandable && (
            <p className="text-xs text-primary/60 mt-3 font-medium flex items-center gap-1">
              <ChevronRight className="h-3 w-3" />
              Click to view full details & timestamped notes
            </p>
          )}
        </CardContent>
      </Card>

      {/* Detail Modal */}
      <MeetingDetailModal
        meeting={meeting}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
      />

      {showShare && (
        <ShareDialog
          type="meeting"
          id={meeting.id}
          onClose={() => setShowShare(false)}
        />
      )}

      <FeedbackForm
        open={showFeedback}
        onClose={() => setShowFeedback(false)}
        defaultCategory="legislation"
        prefill={{
          governing_body: meeting.governingBody,
          bill_number: (meeting.billsMentioned || [])[0] || "",
        }}
      />
    </>
  );
}
