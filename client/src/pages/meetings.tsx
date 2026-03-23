import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { MeetingCard } from "@/components/meeting-card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { Meeting } from "@shared/schema";

const FILTERS = [
  "All",
  "County",
  "City",
  "Schools",
  "Zoning",
  "Planning",
  "URA",
  "HACP",
  "Transit",
  "PWSA",
] as const;
type Filter = (typeof FILTERS)[number];

function matchesFilter(m: Meeting, filter: Filter): boolean {
  if (filter === "All") return true;
  const lower = m.governingBody.toLowerCase();
  if (filter === "County")
    return lower.includes("county") && !lower.includes("port authority");
  if (filter === "City") return lower.includes("city council");
  if (filter === "Schools")
    return lower.includes("school") || lower.includes("pps");
  if (filter === "Zoning") return lower.includes("zoning");
  if (filter === "Planning") return lower.includes("planning commission");
  if (filter === "URA")
    return lower.includes("ura") || lower.includes("urban redevelopment");
  if (filter === "HACP")
    return lower.includes("housing authority") || lower.includes("hacp");
  if (filter === "Transit")
    return lower.includes("port authority") || lower.includes("regional transit");
  if (filter === "PWSA")
    return lower.includes("water") || lower.includes("pwsa");
  return true;
}

export default function Meetings() {
  const [filter, setFilter] = useState<Filter>("All");

  const { data: meetings = [], isLoading } = useQuery<Meeting[]>({
    queryKey: ["/api/meetings"],
  });

  const sorted = [...meetings]
    .filter((m) => matchesFilter(m, filter))
    .sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="p-4 space-y-4" data-testid="meetings-page">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-bold">Meetings</h2>
          <p className="text-xs text-muted-foreground">
            {sorted.length} meeting{sorted.length !== 1 ? "s" : ""}
            {filter !== "All" ? ` (${filter})` : ""}
          </p>
        </div>
      </div>

      {/* Filter chips — wraps on small screens */}
      <div className="flex flex-wrap gap-1" data-testid="meeting-filters">
        {FILTERS.map((f) => (
          <button
            key={f}
            data-testid={`filter-${f.toLowerCase()}`}
            onClick={() => setFilter(f)}
            className={cn(
              "px-3 py-1 rounded-md text-xs font-medium transition-colors",
              filter === f
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            {f}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          No meetings found for the selected filter.
        </p>
      ) : (
        <div className="space-y-2">
          {sorted.map((m) => (
            <MeetingCard key={m.id} meeting={m} expandable />
          ))}
        </div>
      )}
    </div>
  );
}
