import { useState } from "react";
import { MessageCircle, X, ExternalLink } from "lucide-react";

const CATEGORIES = [
  { value: "feature", label: "Feature Request" },
  { value: "bug", label: "Bug Report" },
  { value: "data", label: "Data / Coverage" },
  { value: "general", label: "General Feedback" },
];

const REPO_ISSUE_BASE = "https://github.com/apayton0789/pgh-civic-pulse/issues/new";

/**
 * Suggestions used to POST to /api/suggestions, stored server-side in memory.
 * There's no server anymore, so this now opens a pre-filled GitHub issue
 * instead \u2014 suggestions become tracked, public issues on the repo.
 */
export function SuggestionBox() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [category, setCategory] = useState("general");

  const handleSubmit = () => {
    if (!text.trim()) return;
    const title = encodeURIComponent(`Suggestion: ${text.trim().slice(0, 60)}`);
    const body = encodeURIComponent(`${text.trim()}\n\n---\nCategory: ${category}`);
    const url = `${REPO_ISSUE_BASE}?labels=suggestion&title=${title}&body=${body}`;
    window.open(url, "_blank", "noopener,noreferrer");
    setText("");
    setOpen(false);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-50 flex items-center gap-2 px-4 py-2.5 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-all text-sm font-medium"
        data-testid="button-open-suggestions"
        title="Share a suggestion"
      >
        <MessageCircle className="h-4 w-4" />
        <span className="hidden sm:inline">Suggestions</span>
      </button>
    );
  }

  return (
    <div
      className="fixed bottom-4 right-4 z-50 w-80 bg-background border rounded-xl shadow-2xl overflow-hidden"
      data-testid="suggestion-box"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-primary text-primary-foreground">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4" />
          <span className="text-sm font-semibold">Share Your Thoughts</span>
        </div>
        <button
          onClick={() => setOpen(false)}
          className="p-1 rounded-md hover:bg-white/20 transition-colors"
          data-testid="button-close-suggestions"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Body */}
      <div className="p-4 space-y-3">
        <p className="text-xs text-muted-foreground">
          Help improve PGH Civic Pulse. Suggestions open a public issue on{" "}
          <a
            href="https://github.com/apayton0789/pgh-civic-pulse"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            GitHub
          </a>
          .
        </p>

        {/* Category selector */}
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full appearance-none rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          data-testid="select-suggestion-category"
        >
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>

        {/* Text input */}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="What would you like to see improved?"
          rows={3}
          maxLength={1000}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
          data-testid="input-suggestion-text"
        />

        {/* Character count + submit */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">
            {text.length}/1000
          </span>
          <button
            onClick={handleSubmit}
            disabled={!text.trim()}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="button-submit-suggestion"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Open GitHub Issue
          </button>
        </div>
      </div>
    </div>
  );
}
