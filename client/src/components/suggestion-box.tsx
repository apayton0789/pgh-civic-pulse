import { useState } from "react";
import { MessageCircle, Send, X, ChevronDown } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { trackFeature } from "@/hooks/use-analytics";

const CATEGORIES = [
  { value: "feature", label: "Feature Request" },
  { value: "bug", label: "Bug Report" },
  { value: "data", label: "Data / Coverage" },
  { value: "general", label: "General Feedback" },
];

export function SuggestionBox() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [category, setCategory] = useState("general");
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);

  const handleSubmit = async () => {
    if (!text.trim()) return;
    setSending(true);
    trackFeature("suggestion_submitted");
    try {
      await apiRequest("POST", "/api/suggestions", { text: text.trim(), category });
      setSubmitted(true);
      setText("");
      setTimeout(() => {
        setSubmitted(false);
        setOpen(false);
      }, 2000);
    } catch {
      // silently fail
    } finally {
      setSending(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => { setOpen(true); trackFeature("suggestion_box_opened"); }}
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
        {submitted ? (
          <div className="text-center py-6">
            <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
              Thank you for your feedback.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Your suggestion has been recorded.
            </p>
          </div>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              Help improve PGH Civic Pulse. Suggestions are anonymous and stored locally.
            </p>

            {/* Category selector */}
            <div className="relative">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full appearance-none rounded-md border bg-background px-3 py-2 text-sm pr-8 focus:outline-none focus:ring-2 focus:ring-primary/50"
                data-testid="select-suggestion-category"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
            </div>

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
                disabled={!text.trim() || sending}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid="button-submit-suggestion"
              >
                <Send className="h-3.5 w-3.5" />
                {sending ? "Sending..." : "Submit"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
