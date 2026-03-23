import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Megaphone,
} from "lucide-react";
import type { FeedbackTemplate, GeneratedFeedback } from "@shared/schema";

type Step = "select" | "questions" | "preview";

interface FeedbackFormProps {
  open: boolean;
  onClose: () => void;
  /** Pre-select a template by category (e.g. "legislation", "zoning", "budget") */
  defaultCategory?: string;
  /** Pre-fill answers (e.g. bill number from meeting context) */
  prefill?: Record<string, string>;
}

export function FeedbackForm({ open, onClose, defaultCategory, prefill }: FeedbackFormProps) {
  const [step, setStep] = useState<Step>("select");
  const [selectedTemplate, setSelectedTemplate] = useState<FeedbackTemplate | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [generated, setGenerated] = useState<GeneratedFeedback | null>(null);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const { data: templates = [] } = useQuery<FeedbackTemplate[]>({
    queryKey: ["/api/feedback/templates"],
  });

  const reset = () => {
    setStep("select");
    setSelectedTemplate(null);
    setAnswers({});
    setGenerated(null);
    setGenerating(false);
    setCopied(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSelectTemplate = (template: FeedbackTemplate) => {
    setSelectedTemplate(template);
    // Apply prefill if provided
    const initial: Record<string, string> = {};
    if (prefill) {
      for (const q of template.questions) {
        if (prefill[q.id]) initial[q.id] = prefill[q.id];
      }
    }
    setAnswers(initial);
    setStep("questions");
  };

  const handleGenerate = async () => {
    if (!selectedTemplate) return;
    setGenerating(true);
    try {
      const res = await apiRequest("POST", "/api/feedback/generate", {
        templateId: selectedTemplate.id,
        answers,
      });
      const data: GeneratedFeedback = await res.json();
      setGenerated(data);
      setStep("preview");
    } catch (err) {
      console.error("Failed to generate feedback:", err);
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!generated) return;
    const text = `Subject: ${generated.subject}\n\n${generated.body}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: create a temporary textarea
      const el = document.createElement("textarea");
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    if (!generated) return;
    const text = `Subject: ${generated.subject}\n\n${generated.body}`;
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `public-comment-${generated.templateId}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isValid = () => {
    if (!selectedTemplate) return false;
    return selectedTemplate.questions
      .filter((q) => q.required)
      .every((q) => answers[q.id]?.trim());
  };

  // Filter templates by default category if provided
  const displayTemplates = defaultCategory
    ? [
        ...templates.filter((t) => t.category === defaultCategory),
        ...templates.filter((t) => t.category !== defaultCategory),
      ]
    : templates;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent
        className="max-w-lg max-h-[85vh] overflow-y-auto"
        data-testid="feedback-dialog"
      >
        {/* ── Step 1: Template Selection ─── */}
        {step === "select" && (
          <>
            <DialogHeader>
              <DialogTitle className="text-base flex items-center gap-2">
                <Megaphone className="h-4 w-4" />
                Have Your Say
              </DialogTitle>
              <DialogDescription>
                Choose a comment template to get started.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2" data-testid="template-list">
              {displayTemplates.map((template) => (
                <button
                  key={template.id}
                  data-testid={`template-${template.id}`}
                  onClick={() => handleSelectTemplate(template)}
                  className="w-full text-left rounded-md border p-3 hover:bg-muted/50 transition-colors space-y-1"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{template.name}</span>
                    <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                      {template.category}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{template.description}</p>
                </button>
              ))}
            </div>
          </>
        )}

        {/* ── Step 2: Questions ─── */}
        {step === "questions" && selectedTemplate && (
          <>
            <DialogHeader>
              <DialogTitle className="text-base">{selectedTemplate.name}</DialogTitle>
              <DialogDescription>{selectedTemplate.description}</DialogDescription>
            </DialogHeader>
            <div className="space-y-3" data-testid="feedback-questions">
              {selectedTemplate.questions.map((q) => (
                <div key={q.id}>
                  <label className="text-xs font-medium mb-1 block">
                    {q.label}
                    {q.required && <span className="text-red-500 ml-0.5">*</span>}
                  </label>
                  {q.type === "select" && q.options ? (
                    <select
                      data-testid={`input-${q.id}`}
                      value={answers[q.id] || ""}
                      onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="">Select...</option>
                      {q.options.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : q.type === "textarea" ? (
                    <textarea
                      data-testid={`input-${q.id}`}
                      value={answers[q.id] || ""}
                      onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                      placeholder={q.placeholder}
                      rows={3}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
                    />
                  ) : (
                    <input
                      data-testid={`input-${q.id}`}
                      type="text"
                      value={answers[q.id] || ""}
                      onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                      placeholder={q.placeholder}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  )}
                </div>
              ))}
            </div>
            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStep("select")}
                data-testid="btn-back-templates"
              >
                <ChevronLeft className="h-3 w-3 mr-1" />
                Back
              </Button>
              <Button
                size="sm"
                disabled={!isValid() || generating}
                onClick={handleGenerate}
                data-testid="btn-generate"
              >
                {generating ? "Generating..." : "Preview Letter"}
                <ChevronRight className="h-3 w-3 ml-1" />
              </Button>
            </DialogFooter>
          </>
        )}

        {/* ── Step 3: Preview ─── */}
        {step === "preview" && generated && (
          <>
            <DialogHeader>
              <DialogTitle className="text-base flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                Your Letter is Ready
              </DialogTitle>
              <DialogDescription>
                Review, copy, or download your comment.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2" data-testid="feedback-preview">
              <div className="rounded-md bg-muted/50 border p-3">
                <p className="text-xs font-semibold text-muted-foreground mb-1">Subject</p>
                <p className="text-sm font-medium">{generated.subject}</p>
              </div>
              <div className="rounded-md bg-muted/50 border p-3 max-h-60 overflow-y-auto">
                <p className="text-xs font-semibold text-muted-foreground mb-1">Letter</p>
                <pre className="text-xs whitespace-pre-wrap font-sans leading-relaxed">
                  {generated.body}
                </pre>
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStep("questions")}
                data-testid="btn-back-edit"
              >
                <ChevronLeft className="h-3 w-3 mr-1" />
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
                data-testid="btn-download"
              >
                <Download className="h-3 w-3 mr-1" />
                Download
              </Button>
              <Button
                size="sm"
                onClick={handleCopy}
                data-testid="btn-copy"
              >
                <Copy className="h-3 w-3 mr-1" />
                {copied ? "Copied!" : "Copy"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
