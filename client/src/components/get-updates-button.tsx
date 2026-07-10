import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw, ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface GeneratedAt {
  timestamp: string;
}

const WORKFLOW_URL =
  "https://github.com/apayton0789/pgh-civic-pulse/actions/workflows/refresh-data.yml";
const AUTO_REFRESH_MS = 5 * 60 * 1000; // 5 minutes

/**
 * GetUpdatesButton
 *
 * This is a static site on GitHub Pages, so there's no server to hit for a
 * live refresh. Data is refreshed by the "Refresh Data" GitHub Actions
 * workflow, which the user triggers manually (or which runs on a daily
 * schedule).
 *
 * Triggering `workflow_dispatch` from the browser would require embedding a
 * GitHub Personal Access Token client-side, which is unsafe for a public
 * static site. Instead, this button opens a modal that links to the Actions
 * page with instructions to click "Run workflow" there. After the modal
 * opens, the page auto-reloads after 5 minutes to pick up fresh data once
 * the workflow (and the deploy that follows it) completes.
 */
export function GetUpdatesButton() {
  const [open, setOpen] = useState(false);

  const { data } = useQuery<GeneratedAt>({
    queryKey: ["/api/feed-status"],
  });

  const lastUpdated = data?.timestamp && data.timestamp !== "never"
    ? new Date(data.timestamp).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })
    : "Unknown";

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      window.location.reload();
    }, AUTO_REFRESH_MS);
    return () => clearTimeout(timer);
  }, [open]);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5 text-xs"
        onClick={() => setOpen(true)}
        data-testid="button-get-updates"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        Get Updates
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md" data-testid="get-updates-dialog">
          <DialogHeader>
            <DialogTitle className="text-base">Refresh Civic Data</DialogTitle>
            <DialogDescription>
              Data last refreshed: <span className="font-medium">{lastUpdated}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              This site's data (meetings, transcripts, news, developments) is refreshed by a
              GitHub Actions workflow, not by this page directly. Click below to open the
              workflow on GitHub, then click <span className="font-medium">"Run workflow"</span>{" "}
              to pull fresh data.
            </p>
            <a
              href={WORKFLOW_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full rounded-md bg-primary text-primary-foreground px-4 py-2.5 text-sm font-medium hover:bg-primary/90 transition-colors"
              data-testid="link-run-workflow"
            >
              <ExternalLink className="h-4 w-4" />
              Open "Refresh Data" Workflow on GitHub
            </a>
            <p className="text-xs text-muted-foreground">
              The workflow takes a few minutes to fetch new videos, transcripts, and news, then
              the site redeploys automatically. This page will auto-refresh in 5 minutes to check
              for updates.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
