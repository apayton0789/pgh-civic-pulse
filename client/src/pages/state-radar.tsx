import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Landmark,
  Gavel,
  Users,
  Building2,
  Globe,
  BookOpen,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Calendar,
  DollarSign,
  AlertTriangle,
  Vote,
  Droplets,
  Factory,
  Home,
  Bus,
  Shield,
  FileText,
} from "lucide-react";

// ---- Types (matching state_radar.json shape) ----

interface SessionDates {
  [month: string]: string[] | string;
  notes: string;
}

interface Legislature {
  session: string;
  session_end: string;
  house_reconvenes: string;
  senate_reconvenes: string;
  budget_deadline: string;
  primary_election: string;
  split_control: string;
  key_notes: string[];
  house_session_dates: SessionDates;
  senate_session_dates: SessionDates;
}

interface Bill {
  category: string;
  bill_number: string;
  session: string;
  title: string;
  short_description: string;
  status: string;
  url?: string;
  pittsburgh_impact?: string;
  notes?: string;
  sponsor?: string;
  sponsors?: string[];
  source?: string;
}

interface CountyEO {
  date: string;
  title: string;
}

interface GovernorAction {
  type: string;
  id?: string;
  date?: string;
  title: string;
  description?: string;
  pittsburgh_impact?: string;
  budget_ask?: string;
  total?: string;
  key_items?: string[];
  source?: string;
  notes?: string;
  county_eos?: CountyEO[];
}

interface GovernorInitiatives {
  governor: string;
  lieutenant_governor: string;
  key_actions: GovernorAction[];
}

interface Legislator {
  name: string;
  party: string;
  district: number;
  county: string;
  role?: string;
  notes?: string;
  email?: string;
  website?: string;
  committees?: string[];
}

interface Committee {
  chamber: string;
  name: string;
  url: string;
  relevance: string;
  chair?: string;
  notes?: string;
  notable_members?: string[];
  minority_members?: string[];
  recent_votes?: string[];
}

interface MeetingSchedule {
  [key: string]: string | boolean | string[];
}

interface ConsentDecree {
  program: string;
  plant_expansion: string;
  major_projects: string[];
  grow_program: string;
}

interface PublicComment {
  status: string;
  subject: string;
  hearing_date: string;
  location: string;
  written_comment_deadline?: string;
  notes?: string;
  source?: string;
}

interface RegionalBody {
  name: string;
  type: string;
  website: string;
  role: string;
  coverage?: string;
  initiatives?: string[];
  current_initiatives?: string[];
  priorities?: string[];
  accomplishments?: string[];
  meeting_schedule?: string | MeetingSchedule;
  board_meeting_schedule?: MeetingSchedule;
  consent_decree?: ConsentDecree;
  fee_update?: string;
  public_comment_opportunities?: PublicComment[];
}

interface DataSource {
  name: string;
  url: string;
  description: string;
  features?: string[];
  notes?: string;
  bill_search_url?: string;
  committee_url?: string;
  api_url?: string;
  api_docs_url?: string;
}

interface Delegation {
  notes: string;
  sources: string[];
  state_senators: Legislator[];
  state_representatives: Legislator[];
}

interface StateRadarData {
  pa_legislature: Legislature;
  active_bills: Bill[];
  governor_initiatives: GovernorInitiatives;
  key_committees: Committee[];
  allegheny_delegation: Delegation;
  regional_bodies: RegionalBody[];
  data_sources: DataSource[];
}

// ---- Helpers ----

function billStatusBadge(status: string) {
  const s = status.toLowerCase();
  if (s.includes("enacted") || s.includes("signed"))
    return "bg-green-600 text-white";
  if (s.includes("stalled") || s.includes("blocked"))
    return "bg-red-500 text-white";
  if (s.includes("introduced"))
    return "bg-yellow-500 text-black";
  if (s.includes("committee") || s.includes("referred"))
    return "bg-blue-500 text-white";
  if (s.includes("passed"))
    return "bg-emerald-500 text-white";
  return "bg-muted text-muted-foreground";
}

function billStatusLabel(status: string): string {
  const s = status.toLowerCase();
  if (s.includes("enacted")) return "ENACTED";
  if (s.includes("stalled") || s.includes("blocked")) return "STALLED";
  if (s.includes("introduced")) return "Introduced";
  if (s.includes("passed house")) return "Passed House";
  if (s.includes("passed senate")) return "Passed Senate";
  if (s.includes("committee")) return "In Committee";
  return "Pending";
}

function partyBadge(party: string) {
  if (party === "D") return "bg-blue-600 text-white";
  if (party === "R") return "bg-red-600 text-white";
  return "bg-muted text-muted-foreground";
}

function chamberBadge(chamber: string) {
  return chamber === "House"
    ? "bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/30"
    : "bg-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-500/30";
}

function actionTypeBadge(type: string) {
  const t = type.toLowerCase();
  if (t.includes("executive order")) return "bg-amber-500 text-black";
  if (t.includes("budget")) return "bg-green-600 text-white";
  if (t.includes("housing")) return "bg-teal-600 text-white";
  if (t.includes("administrative")) return "bg-sky-600 text-white";
  if (t.includes("county")) return "bg-purple-600 text-white";
  return "bg-muted text-muted-foreground";
}

function bodyTypeBadge(type: string) {
  const t = type.toLowerCase();
  if (t.includes("mpo") || t.includes("planning")) return "bg-blue-600 text-white";
  if (t.includes("economic") || t.includes("public-private")) return "bg-amber-600 text-white";
  if (t.includes("wastewater") || t.includes("sanitary")) return "bg-cyan-600 text-white";
  if (t.includes("redevelopment")) return "bg-purple-600 text-white";
  if (t.includes("health")) return "bg-green-600 text-white";
  if (t.includes("collaboration") || t.includes("municipal")) return "bg-teal-600 text-white";
  return "bg-muted text-muted-foreground";
}

function categoryIcon(category: string) {
  const c = category.toLowerCase();
  if (c.includes("transit")) return Bus;
  if (c.includes("housing") || c.includes("zoning") || c.includes("source of income")) return Home;
  if (c.includes("property tax") || c.includes("school funding")) return DollarSign;
  if (c.includes("water") || c.includes("pwsa")) return Droplets;
  if (c.includes("environment") || c.includes("permitting")) return Factory;
  if (c.includes("senate bill")) return FileText;
  return Gavel;
}

// ---- Component ----

export default function StateRadar() {
  const { data } = useQuery<StateRadarData>({
    queryKey: ["/api/state-radar"],
  });

  const [sourcesOpen, setSourcesOpen] = useState(false);

  if (!data) {
    return (
      <div className="p-4 space-y-4" data-testid="state-radar-page">
        <div className="h-6 w-48 bg-muted animate-pulse rounded" />
        <div className="h-4 w-72 bg-muted animate-pulse rounded" />
        <div className="grid gap-3 mt-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  const { pa_legislature, active_bills, governor_initiatives, key_committees, allegheny_delegation, regional_bodies, data_sources } = data;

  // Group bills by category
  const billsByCategory: Record<string, Bill[]> = {};
  for (const bill of active_bills) {
    const cat = bill.category;
    if (!billsByCategory[cat]) billsByCategory[cat] = [];
    billsByCategory[cat].push(bill);
  }

  return (
    <div className="space-y-6 p-4 max-w-5xl" data-testid="state-radar-page">
      {/* 1. Header */}
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Landmark className="h-5 w-5" />
          State & Regional Radar
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          PA Legislature, Regional Bodies, Governor's Office
        </p>
      </div>

      {/* 2. Session Status Bar */}
      <Alert data-testid="session-status-bar">
        <Gavel className="h-4 w-4" />
        <AlertTitle className="text-sm font-semibold">
          {pa_legislature.session}
        </AlertTitle>
        <AlertDescription>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs mt-1">
            <span className="text-muted-foreground">{pa_legislature.split_control}</span>
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Senate reconvenes: <strong>{pa_legislature.senate_reconvenes}</strong>
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              House reconvenes: <strong>{pa_legislature.house_reconvenes}</strong>
            </span>
            <span className="flex items-center gap-1">
              <DollarSign className="h-3 w-3 text-green-600" />
              Budget deadline: <strong>{pa_legislature.budget_deadline}</strong>
            </span>
            <span className="flex items-center gap-1">
              <Vote className="h-3 w-3 text-blue-600" />
              Primary election: <strong>{pa_legislature.primary_election}</strong>
            </span>
          </div>
        </AlertDescription>
      </Alert>

      {/* 3. Active Legislation */}
      <section data-testid="active-legislation">
        <h3 className="text-lg font-semibold flex items-center gap-2 mb-3">
          <Gavel className="h-4 w-4" />
          Active Legislation
        </h3>
        <div className="space-y-5">
          {Object.entries(billsByCategory).map(([category, bills]) => {
            const Icon = categoryIcon(category);
            return (
              <div key={category}>
                <h4 className="text-sm font-semibold flex items-center gap-2 mb-2 text-muted-foreground">
                  <Icon className="h-3.5 w-3.5" />
                  {category}
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    {bills.length} bill{bills.length > 1 ? "s" : ""}
                  </Badge>
                </h4>
                <div className="grid gap-2">
                  {bills.map((bill) => (
                    <Card key={bill.bill_number} data-testid={`bill-${bill.bill_number.replace(/\s+/g, "-")}`}>
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-bold">
                                {bill.url ? (
                                  <a
                                    href={bill.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="hover:underline flex items-center gap-1"
                                    data-testid={`bill-link-${bill.bill_number.replace(/\s+/g, "-")}`}
                                  >
                                    {bill.bill_number}
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                ) : (
                                  bill.bill_number
                                )}
                              </span>
                              <Badge className={`text-[10px] px-1.5 py-0 ${billStatusBadge(bill.status)}`}>
                                {billStatusLabel(bill.status)}
                              </Badge>
                            </div>
                            <p className="text-xs font-medium mt-1">{bill.title}</p>
                            <p className="text-xs text-muted-foreground mt-1">{bill.short_description}</p>
                            {(bill.sponsor || bill.sponsors) && (
                              <p className="text-[10px] text-muted-foreground mt-1">
                                Sponsor: {bill.sponsor || bill.sponsors?.join(", ")}
                              </p>
                            )}
                            <p className="text-[10px] text-muted-foreground mt-0.5">{bill.status}</p>
                          </div>
                        </div>
                        {bill.pittsburgh_impact && (
                          <div className="mt-2 bg-[hsl(47,95%,55%)]/10 border border-[hsl(47,95%,55%)]/30 rounded px-2 py-1.5">
                            <p className="text-[10px] font-semibold text-[hsl(47,80%,40%)] dark:text-[hsl(47,95%,65%)]">
                              <AlertTriangle className="h-3 w-3 inline mr-1" />
                              Pittsburgh Impact
                            </p>
                            <p className="text-xs mt-0.5">{bill.pittsburgh_impact}</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 4. Governor's Initiatives */}
      <section data-testid="governor-initiatives">
        <h3 className="text-lg font-semibold flex items-center gap-2 mb-3">
          <Shield className="h-4 w-4" />
          Governor's Initiatives
        </h3>
        <p className="text-xs text-muted-foreground mb-3">
          {governor_initiatives.governor} &middot; Lt. Gov. {governor_initiatives.lieutenant_governor}
        </p>
        <div className="grid gap-3">
          {governor_initiatives.key_actions.map((action, i) => (
            <Card key={i} data-testid={`gov-action-${i}`}>
              <CardContent className="p-3">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <Badge className={`text-[10px] px-1.5 py-0 ${actionTypeBadge(action.type)}`}>
                    {action.type}
                  </Badge>
                  {action.id && (
                    <span className="text-[10px] text-muted-foreground font-mono">{action.id}</span>
                  )}
                  {action.date && (
                    <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                      <Calendar className="h-2.5 w-2.5" />
                      {action.date}
                    </span>
                  )}
                </div>
                <p className="text-sm font-semibold">{action.title}</p>
                {action.description && (
                  <p className="text-xs text-muted-foreground mt-1">{action.description}</p>
                )}
                {action.total && (
                  <p className="text-xs font-medium mt-1">
                    <DollarSign className="h-3 w-3 inline" />
                    {action.total}
                  </p>
                )}
                {action.key_items && (
                  <ul className="text-xs text-muted-foreground mt-1 space-y-0.5 list-disc list-inside">
                    {action.key_items.map((item, j) => (
                      <li key={j}>{item}</li>
                    ))}
                  </ul>
                )}
                {action.budget_ask && (
                  <div className="mt-2 bg-green-500/10 border border-green-500/30 rounded px-2 py-1">
                    <p className="text-[10px] font-semibold text-green-700 dark:text-green-400">
                      <DollarSign className="h-3 w-3 inline" /> Budget Ask
                    </p>
                    <p className="text-xs mt-0.5">{action.budget_ask}</p>
                  </div>
                )}
                {action.county_eos && (
                  <div className="mt-2 space-y-1">
                    <p className="text-[10px] text-muted-foreground">{action.notes}</p>
                    {action.county_eos.map((eo, j) => (
                      <div key={j} className="flex items-center gap-2 text-xs">
                        <span className="text-[10px] text-muted-foreground">{eo.date}</span>
                        <span>{eo.title}</span>
                      </div>
                    ))}
                  </div>
                )}
                {action.pittsburgh_impact && (
                  <div className="mt-2 bg-[hsl(47,95%,55%)]/10 border border-[hsl(47,95%,55%)]/30 rounded px-2 py-1.5">
                    <p className="text-[10px] font-semibold text-[hsl(47,80%,40%)] dark:text-[hsl(47,95%,65%)]">
                      <AlertTriangle className="h-3 w-3 inline mr-1" />
                      Pittsburgh Impact
                    </p>
                    <p className="text-xs mt-0.5">{action.pittsburgh_impact}</p>
                  </div>
                )}
                {action.source && (
                  <a
                    href={action.source}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-blue-500 hover:underline mt-1 inline-flex items-center gap-0.5"
                  >
                    Source <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* 5. Allegheny County Delegation */}
      <section data-testid="allegheny-delegation">
        <h3 className="text-lg font-semibold flex items-center gap-2 mb-3">
          <Users className="h-4 w-4" />
          Allegheny County Delegation
        </h3>
        <p className="text-xs text-muted-foreground mb-3">{allegheny_delegation.notes}</p>

        {/* State Senators */}
        <h4 className="text-sm font-semibold mb-2">
          State Senators ({allegheny_delegation.state_senators.length})
        </h4>
        <div className="grid gap-1.5 mb-4">
          {allegheny_delegation.state_senators.map((sen) => (
            <div
              key={sen.name}
              className="flex items-center gap-2 text-xs bg-muted/50 rounded px-3 py-2"
              data-testid={`senator-${sen.name.replace(/\s+/g, "-")}`}
            >
              <Badge className={`text-[10px] px-1.5 py-0 ${partyBadge(sen.party)}`}>
                {sen.party}
              </Badge>
              <span className="font-medium">{sen.name}</span>
              <span className="text-muted-foreground">Dist. {sen.district}</span>
              {sen.role && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  {sen.role}
                </Badge>
              )}
              {sen.notes && (
                <span className="text-muted-foreground text-[10px] ml-auto hidden sm:inline truncate max-w-[250px]">
                  {sen.notes}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* State Representatives */}
        <h4 className="text-sm font-semibold mb-2">
          State Representatives ({allegheny_delegation.state_representatives.length})
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {allegheny_delegation.state_representatives.map((rep) => (
            <div
              key={`${rep.name}-${rep.district}`}
              className="flex items-center gap-2 text-xs bg-muted/50 rounded px-3 py-2"
              data-testid={`rep-${rep.name.replace(/\s+/g, "-")}`}
            >
              <Badge className={`text-[10px] px-1.5 py-0 ${partyBadge(rep.party)}`}>
                {rep.party}
              </Badge>
              <span className="font-medium">{rep.name}</span>
              <span className="text-muted-foreground">Dist. {rep.district}</span>
              {rep.role && (
                <Badge variant="outline" className="text-[10px] px-1 py-0 text-[9px]">
                  {rep.role}
                </Badge>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* 6. Key Committees */}
      <section data-testid="key-committees">
        <h3 className="text-lg font-semibold flex items-center gap-2 mb-3">
          <Building2 className="h-4 w-4" />
          Key Committees
        </h3>
        <div className="grid gap-2">
          {key_committees.map((committee, i) => (
            <Card key={i} data-testid={`committee-${i}`}>
              <CardContent className="p-3">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${chamberBadge(committee.chamber)}`}>
                    {committee.chamber}
                  </Badge>
                  <a
                    href={committee.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-semibold hover:underline flex items-center gap-1"
                    data-testid={`committee-link-${i}`}
                  >
                    {committee.name}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  {committee.chair && (
                    <span className="text-[10px] text-muted-foreground">Chair: {committee.chair}</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{committee.relevance}</p>
                {committee.notes && (
                  <p className="text-[10px] text-muted-foreground mt-1 italic">{committee.notes}</p>
                )}
                {committee.recent_votes && committee.recent_votes.length > 0 && (
                  <div className="mt-2">
                    <p className="text-[10px] font-semibold text-muted-foreground mb-0.5">Recent Votes:</p>
                    <ul className="text-[10px] text-muted-foreground space-y-0.5 list-disc list-inside">
                      {committee.recent_votes.map((vote, j) => (
                        <li key={j}>{vote}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* 7. Regional Bodies */}
      <section data-testid="regional-bodies">
        <h3 className="text-lg font-semibold flex items-center gap-2 mb-3">
          <Globe className="h-4 w-4" />
          Regional Bodies
        </h3>
        <div className="grid gap-3">
          {regional_bodies.map((body, i) => (
            <Card key={i} data-testid={`regional-body-${i}`}>
              <CardHeader className="py-3 px-4 pb-0">
                <CardTitle className="text-sm flex items-center gap-2 flex-wrap">
                  <Badge className={`text-[10px] px-1.5 py-0 ${bodyTypeBadge(body.type)}`}>
                    {body.type.split("/")[0].trim().split("(")[0].trim()}
                  </Badge>
                  <a
                    href={body.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold hover:underline flex items-center gap-1"
                    data-testid={`regional-body-link-${i}`}
                  >
                    {body.name}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3 pt-2">
                <p className="text-xs text-muted-foreground">{body.role}</p>

                {/* Current initiatives or priorities */}
                {(body.current_initiatives || body.priorities) && (
                  <div className="mt-2">
                    <p className="text-[10px] font-semibold text-muted-foreground mb-0.5">
                      {body.priorities ? "Priorities" : "Current Initiatives"}:
                    </p>
                    <ul className="text-xs text-muted-foreground space-y-0.5 list-disc list-inside">
                      {(body.current_initiatives || body.priorities)!.map((item, j) => (
                        <li key={j}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Accomplishments (ACCD) */}
                {body.accomplishments && (
                  <div className="mt-2">
                    <p className="text-[10px] font-semibold text-muted-foreground mb-0.5">Accomplishments:</p>
                    <ul className="text-xs text-muted-foreground space-y-0.5 list-disc list-inside">
                      {body.accomplishments.map((item, j) => (
                        <li key={j}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Consent Decree (ALCOSAN) */}
                {body.consent_decree && (
                  <div className="mt-2 bg-cyan-500/10 border border-cyan-500/30 rounded px-2 py-1.5">
                    <p className="text-[10px] font-semibold text-cyan-700 dark:text-cyan-400">
                      <Droplets className="h-3 w-3 inline mr-1" />
                      Consent Decree — {body.consent_decree.program}
                    </p>
                    <p className="text-xs mt-0.5">{body.consent_decree.plant_expansion}</p>
                    <ul className="text-[10px] text-muted-foreground mt-1 space-y-0.5 list-disc list-inside">
                      {body.consent_decree.major_projects.map((proj, j) => (
                        <li key={j}>{proj}</li>
                      ))}
                    </ul>
                    <p className="text-xs mt-1">
                      <strong>GROW Program:</strong> {body.consent_decree.grow_program}
                    </p>
                  </div>
                )}

                {/* Fee Update (ACHD) */}
                {body.fee_update && (
                  <div className="mt-2 bg-amber-500/10 border border-amber-500/30 rounded px-2 py-1.5">
                    <p className="text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                      <DollarSign className="h-3 w-3 inline mr-1" />
                      Fee Update
                    </p>
                    <p className="text-xs mt-0.5">{body.fee_update}</p>
                  </div>
                )}

                {/* Public Comment Opportunities (ACHD) */}
                {body.public_comment_opportunities && body.public_comment_opportunities.length > 0 && (
                  <div className="mt-2">
                    <p className="text-[10px] font-semibold text-muted-foreground mb-0.5">Public Comment Opportunities:</p>
                    {body.public_comment_opportunities.map((pc, j) => (
                      <div key={j} className="text-xs text-muted-foreground mt-1 bg-muted/50 rounded px-2 py-1">
                        <Badge variant="outline" className="text-[9px] px-1 py-0 mr-1">
                          {pc.status}
                        </Badge>
                        {pc.subject} — {pc.hearing_date}
                      </div>
                    ))}
                  </div>
                )}

                {/* Meeting Schedule */}
                {body.meeting_schedule && typeof body.meeting_schedule === "string" && (
                  <p className="text-[10px] text-muted-foreground mt-2">
                    <Calendar className="h-3 w-3 inline mr-1" />
                    {body.meeting_schedule}
                  </p>
                )}
                {body.board_meeting_schedule && (
                  <p className="text-[10px] text-muted-foreground mt-2">
                    <Calendar className="h-3 w-3 inline mr-1" />
                    Board meetings: {(body.board_meeting_schedule as MeetingSchedule).frequency as string}
                    {(body.board_meeting_schedule as MeetingSchedule).upcoming &&
                      ` — Next: ${((body.board_meeting_schedule as MeetingSchedule).upcoming as string[]).join(", ")}`}
                  </p>
                )}
                {body.meeting_schedule && typeof body.meeting_schedule === "object" && (
                  <p className="text-[10px] text-muted-foreground mt-2">
                    <Calendar className="h-3 w-3 inline mr-1" />
                    See meeting schedule at website
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* 8. Data Sources (collapsed by default) */}
      <section data-testid="data-sources">
        <Collapsible open={sourcesOpen} onOpenChange={setSourcesOpen}>
          <CollapsibleTrigger
            className="flex items-center gap-2 text-lg font-semibold hover:text-muted-foreground transition-colors w-full"
            data-testid="data-sources-trigger"
          >
            {sourcesOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <BookOpen className="h-4 w-4" />
            Data Sources
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 ml-1">
              {data_sources.length}
            </Badge>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="grid gap-2 mt-3">
              {data_sources.map((source, i) => (
                <Card key={i} data-testid={`data-source-${i}`}>
                  <CardContent className="p-3">
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-semibold hover:underline flex items-center gap-1"
                    >
                      {source.name}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                    <p className="text-xs text-muted-foreground mt-1">{source.description}</p>
                    {source.features && (
                      <ul className="text-[10px] text-muted-foreground mt-1 space-y-0.5 list-disc list-inside">
                        {source.features.map((feat, j) => (
                          <li key={j}>{feat}</li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </section>
    </div>
  );
}
