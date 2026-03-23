import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy, Mail, Check, ExternalLink } from "lucide-react";
import { useState } from "react";

interface ShareDialogProps {
  type: string;
  id: number;
  onClose: () => void;
}

interface ShareData {
  summary: string;
  title: string;
  type: string;
}

export function ShareDialog({ type, id, onClose }: ShareDialogProps) {
  const [copied, setCopied] = useState(false);

  const { data: shareData, isLoading } = useQuery<ShareData>({
    queryKey: ["/api/share", type, id],
    queryFn: async () => {
      const res = await fetch(`/api/share/${type}/${id}`);
      if (!res.ok) throw new Error("Failed to fetch share data");
      return res.json();
    },
  });

  const handleCopy = async () => {
    if (!shareData) return;
    try {
      await navigator.clipboard.writeText(shareData.summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for sandboxed environments
      const textarea = document.createElement("textarea");
      textarea.value = shareData.summary;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand("copy");
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // silent fail
      }
      document.body.removeChild(textarea);
    }
  };

  const handleEmail = () => {
    if (!shareData) return;
    const subject = encodeURIComponent(`PGH Civic Pulse: ${shareData.title}`);
    const body = encodeURIComponent(shareData.summary);
    window.open(`mailto:?subject=${subject}&body=${body}`, "_blank");
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md" data-testid="share-dialog">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">Share</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-2">
            <div className="h-4 bg-muted animate-pulse rounded w-3/4" />
            <div className="h-20 bg-muted animate-pulse rounded" />
          </div>
        ) : shareData ? (
          <div className="space-y-4">
            {/* Preview */}
            <div className="bg-muted/50 rounded-lg p-3 text-xs leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto font-mono" data-testid="share-preview">
              {shareData.summary}
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 gap-2 text-xs"
                onClick={handleCopy}
                data-testid="button-copy-share"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-green-600" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    Copy to Clipboard
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 gap-2 text-xs"
                onClick={handleEmail}
                data-testid="button-email-share"
              >
                <Mail className="h-3.5 w-3.5" />
                Email
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Unable to generate share content.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
