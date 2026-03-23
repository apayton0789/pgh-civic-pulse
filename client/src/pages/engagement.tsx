import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Megaphone,
  Clock,
  ExternalLink,
  MapPin,
  Users,
  MessageSquare,
  Calendar,
  AlertTriangle,
  Landmark,
  Globe,
  Mail,
  FileText,
  Video,
} from "lucide-react";

// --- Types ---

interface ActiveOpportunity {
  type: string;
  agency?: string;
  subject?: string;
  status?: string;
  comment_period?: string;
  hearing_date?: string;
  meeting_date?: string;
  date?: string;
  how_to_comment?: string[] | string;
  how_to_find?: string;
  deadline?: string;
  location?: string;
  description?: string;
  source?: string;
  registration?: string;
  testimony_limit?: string;
  notes?: string;
  pittsburgh_items?: string;
  next_meetings?: string[];
  engage_pgh_urls?: string[];
}

interface CommissionMeeting {
  date: string;
  time: string;
  type: string;
  format: string;
  notes?: string;
}

interface Commission {
  name: string;
  how_to_comment: string;
  next_meeting: CommissionMeeting;
  website: string;
  meeting_schedule: string;
}

interface EngagementData {
  active_opportunities: ActiveOpportunity[];
  commissions: Commission[];
}

// --- Helpers ---

const STATUS_ORDER: Record<string, number> = {
  "OPEN NOW": 0,
  UPCOMING: 1,
  ONGOING: 2,
};

function getStatusRank(status?: string): number {
  if (!status) return 99;
  const upper = status.toUpperCase();
  for (const [key, rank] of Object.entries(STATUS_ORDER)) {
    if (upper.startsWith(key)) return rank;
  }
  return 99;
}

function statusColor(status?: string): string {
  if (!status) return "bg-muted text-muted-foreground";
  const upper = status.toUpperCase();
  if (upper.startsWith("OPEN NOW")) return "bg-green-600 text-white";
  if (upper.startsWith("UPCOMING")) return "bg-yellow-500 text-black";
  if (upper.startsWith("ONGOING")) return "bg-blue-600 text-white";
  if (upper.startsWith("EXPECTED")) return "bg-purple-600 text-white";
  if (upper.startsWith("RECENT")) return "bg-muted text-muted-foreground";
  return "bg-muted text-muted-foreground";
}

function daysUntil(dateStr: string): number | null {
  // Parse dates like "April 14, 2026" or "2026-03-13"
  const parsed = new Date(dateStr);
  if (isNaN(parsed.getTime())) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  parsed.setHours(0, 0, 0, 0);
  return Math.ceil((parsed.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function urgencyClass(days: number | null): string {
  if (days === null || days < 0) return "";
  if (days < 7) return "text-red-500 font-semibold";
  if (days < 14) return "text-orange-500 font-semibold";
  return "text-muted-foreground";
}

function formatDeadlineLabel(days: number | null): string {
  if (days === null) return "";
  if (days < 0) return "Passed";
  if (days === 0) return "Today";
  if (days === 1) return "1 day left";
  return `${days} days left`;
}

function getEffectiveDate(item: ActiveOpportunity): string | null {
  return item.deadline || item.hearing_date || item.meeting_date || item.date || null;
}

function renderHowToComment(how: string[] | string | undefined) {
  if (!how) return null;
  const items = Array.isArray(how) ? how : [how];
  return (
    <ul className="space-y-1 text-sm text-muted-foreground mt-2">
      {items.map((line, i) => {
        // Detect URLs in the text and linkify them
        const urlMatch = line.match(/(https?:\/\/[^\s,)]+)/);
        return (
          <li key={i} className="flex items-start gap-2">
            <MessageSquare className="h-3.5 w-3.5 mt-0.5 shrink-0 text-steel-blue" />
            {urlMatch ? (
              <span>
                {line.slice(0, urlMatch.index)}
                <a
                  href={urlMatch[1]}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:underline"
                >
                  {urlMatch[1]}
                </a>
                {line.slice((urlMatch.index ?? 0) + urlMatch[1].length)}
              </span>
            ) : (
              <span>{line}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

// --- Components ---

function OpportunityCard({ item }: { item: ActiveOpportunity }) {
  const effectiveDate = getEffectiveDate(item);
  const days = effectiveDate ? daysUntil(effectiveDate) : null;
  const urgency = urgencyClass(days);
  const deadlineLabel = formatDeadlineLabel(days);

  return (
    <Card data-testid="opportunity-card" className="relative overflow-hidden">
      {/* Urgency bar */}
      {days !== null && days >= 0 && days < 14 && (
        <div
          className={`absolute top-0 left-0 right-0 h-1 ${days < 7 ? "bg-red-500" : "bg-orange-400"}`}
        />
      )}
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {item.status && (
                <Badge className={`${statusColor(item.status)} text-xs`}>
                  {item.status}
                </Badge>
              )}
              <span className="text-xs text-muted-foreground">{item.type}</span>
            </div>
            {item.agency && (
              <p className="text-xs font-medium text-muted-foreground">{item.agency}</p>
            )}
            <CardTitle className="text-base leading-snug">
              {item.subject || item.type}
            </CardTitle>
          </div>
          {effectiveDate && days !== null && days >= 0 && (
            <div className="text-right shrink-0">
              <div className="flex items-center gap-1">
                {days < 7 && <AlertTriangle className="h-3.5 w-3.5 text-red-500" />}
                <span className={`text-xs whitespace-nowrap ${urgency}`}>
                  {deadlineLabel}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">{effectiveDate}</p>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {item.description && (
          <p className="text-sm text-muted-foreground">{item.description}</p>
        )}

        {item.comment_period && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-3.5 w-3.5 shrink-0" />
            <span>Comment period: {item.comment_period}</span>
          </div>
        )}

        {item.location && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span>{item.location}</span>
          </div>
        )}

        {item.registration && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-3.5 w-3.5 shrink-0" />
            <span>{item.registration}</span>
          </div>
        )}

        {item.testimony_limit && (
          <p className="text-xs text-muted-foreground">
            Testimony limit: {item.testimony_limit}
          </p>
        )}

        {item.pittsburgh_items && (
          <p className="text-sm text-muted-foreground">
            <span className="font-medium">Pittsburgh items:</span> {item.pittsburgh_items}
          </p>
        )}

        {item.notes && (
          <p className="text-xs text-muted-foreground italic">{item.notes}</p>
        )}

        {renderHowToComment(item.how_to_comment)}

        {item.how_to_find && (
          <div className="flex items-center gap-2 text-sm">
            <Globe className="h-3.5 w-3.5 shrink-0" />
            <a
              href={item.how_to_find}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline break-all"
            >
              Find projects near you
            </a>
          </div>
        )}

        {item.next_meetings && item.next_meetings.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Upcoming meetings:</p>
            <ul className="text-xs text-muted-foreground space-y-0.5 ml-4 list-disc">
              {item.next_meetings.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          </div>
        )}

        {item.engage_pgh_urls && item.engage_pgh_urls.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">EngagePGH links:</p>
            <ul className="text-xs space-y-0.5">
              {item.engage_pgh_urls.map((url, i) => (
                <li key={i}>
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:underline break-all"
                  >
                    {url.replace("https://engage.pittsburghpa.gov/", "")}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        {item.source && (
          <a
            href={item.source}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-blue-500 hover:underline mt-1"
            data-testid="opportunity-source-link"
          >
            <ExternalLink className="h-3 w-3" />
            Source
          </a>
        )}
      </CardContent>
    </Card>
  );
}

function CommissionCard({ commission }: { commission: Commission }) {
  const days = daysUntil(commission.next_meeting.date);
  const deadlineLabel = days !== null && days >= 0 ? formatDeadlineLabel(days) : null;

  return (
    <Card data-testid="commission-card">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base leading-snug">{commission.name}</CardTitle>
          <Badge className="bg-green-600/15 text-green-600 border-green-600/30 text-[10px] shrink-0">
            Accepts Public Comment
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {/* Next meeting */}
        <div className="rounded-md bg-muted/50 p-3 space-y-1.5">
          <p className="text-xs font-medium">Next Meeting</p>
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-3.5 w-3.5 shrink-0" />
            <span>
              {commission.next_meeting.date} at {commission.next_meeting.time}
            </span>
            {deadlineLabel && (
              <Badge variant="outline" className="text-[10px] ml-auto">
                {deadlineLabel}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{commission.next_meeting.type}</p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3 shrink-0" />
            <span>{commission.next_meeting.format}</span>
          </div>
          {commission.next_meeting.notes && (
            <p className="text-[11px] text-muted-foreground italic">
              {commission.next_meeting.notes}
            </p>
          )}
        </div>

        {/* How to comment */}
        <div className="space-y-1">
          <p className="text-xs font-medium flex items-center gap-1">
            <MessageSquare className="h-3 w-3" />
            How to Comment
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {commission.how_to_comment}
          </p>
        </div>

        {/* Schedule */}
        <p className="text-[11px] text-muted-foreground">
          <Clock className="h-3 w-3 inline mr-1" />
          {commission.meeting_schedule}
        </p>

        {/* Website */}
        <a
          href={commission.website}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-blue-500 hover:underline"
          data-testid="commission-website-link"
        >
          <ExternalLink className="h-3 w-3" />
          Website
        </a>
      </CardContent>
    </Card>
  );
}

// --- Page ---

export default function Engagement() {
  const { data, isLoading } = useQuery<EngagementData>({
    queryKey: ["/api/engagement"],
  });

  const sortedOpportunities = (data?.active_opportunities ?? [])
    .slice()
    .sort((a, b) => getStatusRank(a.status) - getStatusRank(b.status));

  const commissions = data?.commissions ?? [];

  if (isLoading) {
    return (
      <div data-testid="engagement-page" className="p-6 space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div data-testid="engagement-page" className="p-6 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Megaphone className="h-5 w-5" />
          Public Engagement
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Comment Periods, Hearings, Town Halls, Feedback Opportunities
        </p>
      </div>

      {/* Active Opportunities */}
      <section data-testid="active-opportunities">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Landmark className="h-4 w-4" />
          Active Comment Periods &amp; Hearings
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          {sortedOpportunities.map((item, i) => (
            <OpportunityCard key={i} item={item} />
          ))}
        </div>
      </section>

      {/* Commissions */}
      <section data-testid="commissions-section">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Users className="h-4 w-4" />
          City Commissions with Public Comment
        </h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {commissions.map((commission, i) => (
            <CommissionCard key={i} commission={commission} />
          ))}
        </div>
      </section>

      {/* How to Engage Footer */}
      <section data-testid="how-to-engage">
        <Card className="border-dashed">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              How to Engage
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ul className="grid gap-3 sm:grid-cols-2">
              <li className="flex items-start gap-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4 mt-0.5 shrink-0 text-green-600" />
                Register to speak at meetings — most boards accept public comment at the start and end of each session
              </li>
              <li className="flex items-start gap-2 text-sm text-muted-foreground">
                <Mail className="h-4 w-4 mt-0.5 shrink-0 text-blue-500" />
                Submit written comments before deadlines — email is accepted by nearly every agency listed above
              </li>
              <li className="flex items-start gap-2 text-sm text-muted-foreground">
                <Video className="h-4 w-4 mt-0.5 shrink-0 text-red-500" />
                Watch livestreams on YouTube — City Council, CPRB, and CHR all broadcast meetings live
              </li>
              <li className="flex items-start gap-2 text-sm text-muted-foreground">
                <Globe className="h-4 w-4 mt-0.5 shrink-0 text-purple-500" />
                Track bills via{" "}
                <a
                  href="https://www.palegis.us"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:underline"
                >
                  palegis.us
                </a>
                {" "}and comment periods via{" "}
                <a
                  href="https://engage.pittsburghpa.gov"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:underline"
                >
                  EngagePGH
                </a>
              </li>
            </ul>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
