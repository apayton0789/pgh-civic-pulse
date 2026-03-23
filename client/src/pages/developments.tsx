import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExternalLink, MapPin, Clock, Share2, CheckCircle, AlertCircle, Construction, Megaphone } from "lucide-react";
import { useState } from "react";
import { ShareDialog } from "@/components/share-dialog";
import { FeedbackForm } from "@/components/feedback-form";

interface Development {
  id: number;
  externalId: string;
  title: string;
  description: string;
  status: string | null;
  projectType: string | null;
  address: string | null;
  url: string | null;
  keyDetails: string | null;
  commentDeadline: string | null;
  geographicTags: string[] | null;
  source: string | null;
}

const STATUS_STYLES: Record<string, { bg: string; text: string; icon: typeof CheckCircle }> = {
  "Active": { bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-800 dark:text-green-300", icon: CheckCircle },
  "Under Review": { bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-800 dark:text-amber-300", icon: Clock },
  "Open for Comment": { bg: "bg-purple-100 dark:bg-purple-900/30", text: "text-purple-800 dark:text-purple-300", icon: AlertCircle },
  "Open Projects (Seeking Feedback)": { bg: "bg-purple-100 dark:bg-purple-900/30", text: "text-purple-800 dark:text-purple-300", icon: AlertCircle },
};

const TYPE_COLORS: Record<string, string> = {
  "Development": "border-purple-400 dark:border-purple-600",
  "Zoning": "border-orange-400 dark:border-orange-600",
  "Infrastructure": "border-sky-400 dark:border-sky-600",
  "Community Plan": "border-teal-400 dark:border-teal-600",
};

function getStatusStyle(status: string | null) {
  return STATUS_STYLES[status || "Active"] || STATUS_STYLES["Active"];
}

export default function Developments() {
  const { data: developments = [], isLoading } = useQuery<Development[]>({
    queryKey: ["/api/developments"],
  });

  const [filter, setFilter] = useState<string>("all");
  const [shareItem, setShareItem] = useState<{ type: string; id: number } | null>(null);
  const [feedbackDev, setFeedbackDev] = useState<Development | null>(null);

  const projectTypes = Array.from(new Set(developments.map((d) => d.projectType).filter(Boolean))) as string[];

  const filtered = filter === "all"
    ? developments
    : developments.filter((d) => d.projectType === filter);

  // Items with open comment deadlines first
  const sorted = [...filtered].sort((a, b) => {
    if (a.commentDeadline && !b.commentDeadline) return -1;
    if (!a.commentDeadline && b.commentDeadline) return 1;
    return (a.title || "").localeCompare(b.title || "");
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 bg-muted animate-pulse rounded w-48" />
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-40 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5" data-testid="developments-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight" data-testid="text-page-title">
            Development & Infrastructure
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Active projects from EngagePGH and city planning
          </p>
        </div>
        <Badge variant="outline" className="text-xs">
          {developments.length} projects
        </Badge>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <button
          data-testid="filter-all"
          onClick={() => setFilter("all")}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
            filter === "all"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
        >
          All ({developments.length})
        </button>
        {projectTypes.map((type) => {
          const count = developments.filter((d) => d.projectType === type).length;
          return (
            <button
              key={type}
              data-testid={`filter-${type.toLowerCase().replace(/\s/g, "-")}`}
              onClick={() => setFilter(type)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                filter === type
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {type} ({count})
            </button>
          );
        })}
      </div>

      {/* Development Cards */}
      <div className="grid gap-4">
        {sorted.map((dev) => {
          const statusStyle = getStatusStyle(dev.status);
          const StatusIcon = statusStyle.icon;
          const borderColor = TYPE_COLORS[dev.projectType || "Development"] || "border-border";

          return (
            <Card
              key={dev.id}
              data-testid={`card-development-${dev.id}`}
              className={`border-l-4 ${borderColor}`}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <CardTitle className="text-sm font-semibold leading-tight">
                        {dev.title}
                      </CardTitle>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${statusStyle.bg} ${statusStyle.text}`}>
                        <StatusIcon className="h-3 w-3" />
                        {dev.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Construction className="h-3 w-3" />
                        {dev.projectType}
                      </span>
                      {dev.address && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {dev.address}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      data-testid={`feedback-development-${dev.id}`}
                      onClick={() => setFeedbackDev(dev)}
                      className="p-1.5 rounded-md hover:bg-muted transition-colors"
                      title="Provide Feedback"
                    >
                      <Megaphone className="h-3.5 w-3.5 text-primary/70" />
                    </button>
                    <button
                      data-testid={`share-development-${dev.id}`}
                      onClick={() => setShareItem({ type: "development", id: dev.id })}
                      className="p-1.5 rounded-md hover:bg-muted transition-colors"
                      title="Share"
                    >
                      <Share2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                    {dev.url && (
                      <a
                        href={dev.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-md hover:bg-muted transition-colors"
                        title="View source"
                      >
                        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                      </a>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0 space-y-2">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {dev.description}
                </p>

                {dev.commentDeadline && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                    <AlertCircle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
                      Public Comment Deadline: {new Date(dev.commentDeadline).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                    </span>
                  </div>
                )}

                {dev.keyDetails && (
                  <div className="text-[11px] text-muted-foreground/80 leading-relaxed bg-muted/40 rounded-md px-2.5 py-2">
                    {dev.keyDetails}
                  </div>
                )}

                {/* Geo tags */}
                {dev.geographicTags && dev.geographicTags.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {dev.geographicTags.filter((t) => t !== "PITTSBURGH").map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-[10px] py-0">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {shareItem && (
        <ShareDialog
          type={shareItem.type}
          id={shareItem.id}
          onClose={() => setShareItem(null)}
        />
      )}

      <FeedbackForm
        open={!!feedbackDev}
        onClose={() => setFeedbackDev(null)}
        defaultCategory={feedbackDev?.projectType === "Zoning" ? "zoning" : "general"}
        prefill={feedbackDev ? {
          topic: feedbackDev.title,
          property_address: feedbackDev.address || "",
          case_number: feedbackDev.externalId || "",
        } : undefined}
      />
    </div>
  );
}
