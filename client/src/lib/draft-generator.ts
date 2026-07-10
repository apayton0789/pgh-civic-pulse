/**
 * Client-side draft generator — ported from server/draft-engine.ts for the
 * static GitHub Pages build. Same template-based logic, runs entirely in
 * the browser (no server round-trip).
 */
import type { BriefingItem, StrategyAnswers, SourceCitation } from "@shared/schema";

export interface GeneratedDrafts {
  positionSummary: string;
  email: string;
  publicComment: string;
  talkingPoints: string[];
  oralTestimony: string;
  sourcesCited: SourceCitation[];
}

function formatSourceFootnotes(sources: SourceCitation[]): string {
  if (sources.length === 0) return "";
  const lines = sources.slice(0, 4).map((s, i) =>
    `[${i + 1}] ${s.title}. Retrieved ${s.retrievedDate}. ${s.url}`
  );
  return "\n\nSources:\n" + lines.join("\n");
}

function toneOpener(tone: StrategyAnswers["tone"]): string {
  switch (tone) {
    case "collaborative": return "I write to share my perspective and work constructively toward a solution that serves our community.";
    case "firm": return "I write to formally register my position and urge decisive action on this matter.";
    case "urgent": return "I write with urgency because this issue demands immediate attention from our elected officials.";
  }
}

function speakingAsPhrase(speakingAs: StrategyAnswers["speakingAs"]): string {
  switch (speakingAs) {
    case "individual": return "As an individual citizen of Pittsburgh";
    case "resident": return "As a Pittsburgh resident directly affected by this issue";
    case "organizer": return "As a community organizer working with Pittsburgh residents";
    case "direct_experience": return "As someone with direct personal experience with this issue";
  }
}

function closingByTone(tone: StrategyAnswers["tone"]): string {
  switch (tone) {
    case "collaborative": return "I look forward to working together toward a positive outcome for Pittsburgh. Thank you for your service and your attention to this matter.";
    case "firm": return "I expect this matter to be addressed promptly and transparently. Residents are watching, and accountability matters.";
    case "urgent": return "Time is critical. I urge you to act now before this opportunity to make a difference is lost.";
  }
}

export function generateDrafts(
  item: BriefingItem,
  strategy: StrategyAnswers
): GeneratedDrafts {
  const sourcesCited = item.sources.slice(0, 4);
  const sourceFootnotes = formatSourceFootnotes(sourcesCited);
  const sourceInline = sourcesCited.length > 0
    ? ` (Source: ${sourcesCited[0].title})`
    : "";
  const speakingAs = speakingAsPhrase(strategy.speakingAs);
  const toneOpen = toneOpener(strategy.tone);
  const closingLine = closingByTone(strategy.tone);

  const keyFact = strategy.strongestFact.trim() || item.keyStatOrQuote;
  const keyValue = strategy.strongestValue.trim() || item.whyItMatters;
  const desiredOutcome = strategy.desiredOutcome.trim() || item.actionNeeded;
  const whatMatters = strategy.whatMatters.trim() || item.topicArea;
  const whoAffected = strategy.mostAffected.trim() || (item.keyStakeholders.join(", "));

  // ── Position Summary ──────────────────────────────────────────────────
  const positionSummary = [
    `Issue: ${item.displayHeadline}`,
    ``,
    `My Position:`,
    `${speakingAs}, I believe ${desiredOutcome}. The key factual basis for this position is: ${keyFact}${sourceInline}. The values that underpin this position are: ${keyValue}. This matters most because: ${whatMatters}.`,
    ``,
    `Who is most affected: ${whoAffected}.`,
    ``,
    `Recommended action: ${item.callToAction}.`,
    sourceFootnotes,
  ].filter((l) => l !== undefined).join("\n");

  // ── Email ─────────────────────────────────────────────────────────────
  const receivingBody = item.keyStakeholders[0] || "Pittsburgh City Council";
  const email = [
    `To: ${receivingBody}`,
    `Subject: Re: ${item.displayHeadline}`,
    ``,
    `Dear Members of ${receivingBody},`,
    ``,
    `${toneOpen}`,
    ``,
    `${speakingAs}, I am writing about: ${item.displayHeadline}.`,
    ``,
    `This issue matters to me because ${whatMatters}. ${keyValue}`,
    ``,
    `The strongest factual argument supporting my position is: ${keyFact}${sourceInline}.`,
    ``,
    `Most affected by this decision are: ${whoAffected}.`,
    ``,
    `I respectfully request that you: ${desiredOutcome}.`,
    ``,
    `${closingLine}`,
    ``,
    `Sincerely,`,
    `[Your Name]`,
    `[Your Address]`,
    `[Your Email / Phone]`,
    sourceFootnotes,
  ].join("\n");

  // ── Public Comment ────────────────────────────────────────────────────
  const publicComment = [
    `RE: ${item.displayHeadline}`,
    `Submitted to: ${receivingBody}`,
    `Date: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`,
    ``,
    `Statement of Position:`,
    ``,
    `${speakingAs}, I submit this public comment regarding ${item.displayHeadline}.`,
    ``,
    `Background: ${item.whyItMatters}`,
    ``,
    `Key Facts:`,
    ...item.evidenceBullets.slice(0, 4).map((b, i) => {
      const src = item.sources.find((s) => b.sourceIds.includes(s.id));
      return `• ${b.text}${src ? ` [${src.title}]` : ""}`;
    }),
    ``,
    `Strongest Evidence: ${keyFact}${sourceInline}`,
    ``,
    `Recommendation: ${desiredOutcome}`,
    ``,
    `${closingLine}`,
    sourceFootnotes,
  ].join("\n");

  // ── Talking Points ────────────────────────────────────────────────────
  const talkingPoints = [
    `${item.displayHeadline}: ${item.oneLineSummary}`,
    `Key fact: ${keyFact}${sourceInline}`,
    `Who is affected: ${whoAffected} — this is a community-wide concern.`,
    `My position: ${desiredOutcome}`,
    `Core value: ${keyValue}`,
  ];

  // Add one more from evidence bullets if available
  if (item.evidenceBullets.length > 0) {
    talkingPoints.push(`Additional evidence: ${item.evidenceBullets[0].text}`);
  }

  // ── Oral Testimony (~2 minutes / ~250-300 words) ──────────────────────
  const oralTestimony = [
    `[ORAL TESTIMONY — approximately 2 minutes]`,
    ``,
    `Good [morning/evening]. My name is [Your Name], and I am a resident of Pittsburgh${strategy.speakingAs === "organizer" ? " and a community organizer" : ""}.`,
    ``,
    `I'm here to speak about ${item.displayHeadline}.`,
    ``,
    `${toneOpen}`,
    ``,
    `${speakingAs}, this issue directly affects ${whoAffected}. Here is why it matters: ${keyValue}`,
    ``,
    `The facts support my position. ${keyFact}${sourceInline}. ${item.evidenceBullets.slice(0, 2).map((b) => b.text).join(" ")}`,
    ``,
    `What I am asking for is straightforward: ${desiredOutcome}.`,
    ``,
    `${closingLine}`,
    ``,
    `Thank you for your time.`,
    sourceFootnotes,
  ].join("\n");

  return {
    positionSummary,
    email,
    publicComment,
    talkingPoints,
    oralTestimony,
    sourcesCited,
  };
}
