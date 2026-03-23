import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { NewsCard } from "@/components/news-card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { NewsItem } from "@shared/schema";

export default function News() {
  const [filter, setFilter] = useState("All");

  const { data: news = [], isLoading } = useQuery<NewsItem[]>({
    queryKey: ["/api/news"],
  });

  // Extract unique categories
  const categories = useMemo(() => {
    const cats = new Set<string>();
    news.forEach((n) => {
      if (n.category) cats.add(n.category);
    });
    return ["All", ...Array.from(cats).sort()];
  }, [news]);

  const sorted = [...news]
    .filter((n) => filter === "All" || n.category === filter)
    .sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="p-4 space-y-4" data-testid="news-page">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-bold">News</h2>
          <p className="text-xs text-muted-foreground">
            {sorted.length} article{sorted.length !== 1 ? "s" : ""}
            {filter !== "All" ? ` (${filter})` : ""}
          </p>
        </div>

        <div className="flex gap-1 flex-wrap" data-testid="news-filters">
          {categories.map((cat) => (
            <button
              key={cat}
              data-testid={`filter-${cat.toLowerCase().replace(/\s+/g, "-")}`}
              onClick={() => setFilter(cat)}
              className={cn(
                "px-3 py-1 rounded-md text-xs font-medium transition-colors",
                filter === cat
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          No news found for the selected category.
        </p>
      ) : (
        <div className="space-y-2">
          {sorted.map((item) => (
            <NewsCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
