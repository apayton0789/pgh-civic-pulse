/**
 * YouTube Transcript Extractor — zero credits, zero API keys.
 *
 * Uses yt-dlp to download auto-generated captions, then applies
 * pattern-based analysis to extract structured meeting data:
 *   - Proclamations, ceremonial items
 *   - Mayoral/executive announcements
 *   - Votes with what-was-voted-on context
 *   - Presentations and reports
 *   - Budget/financial items with amounts
 *   - Appointments and confirmations
 *   - Public comment detection
 *   - Meeting character classification
 *   - One-liner summary for card display
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";

export interface MeetingActionItem {
  type: 'proclamation' | 'announcement' | 'vote' | 'presentation' | 'budget' | 'appointment' | 'public_comment' | 'discussion';
  icon: string;
  summary: string;
  detail?: string;
}

export type MeetingCharacter = 'legislative' | 'ceremonial' | 'committee' | 'public_hearing' | 'special' | 'work_session';

export interface MeetingSummary {
  oneLiner: string;
  actionItems: MeetingActionItem[];
  duration: string;
  publicInput: string | null;
  meetingCharacter: MeetingCharacter;
  // backward compat
  opening?: string;
  keyDiscussions?: Array<{ topic: string; context: string }>;
  decisions?: Array<{ description: string; voteType: string }>;
}

export interface TimedSegment {
  startMs: number;
  endMs: number;
  text: string;
}

export interface TranscriptAnalysis {
  videoId: string;
  videoUrl: string;
  transcriptLength: number;
  rawTranscriptPath: string | null;
  votes: VoteEvent[];
  billNumbers: string[];
  publicCommentDetected: boolean;
  publicCommentCount: number;
  topicKeywords: Record<string, number>;
  speakerCount: number;
  timedSegments: TimedSegment[];
  meetingSummary: MeetingSummary;
  extractedAt: string;
}

export interface VoteEvent {
  type: string;
  context: string;
  position: number;
}

const TRANSCRIPT_DIR = "/tmp/pgh-transcripts";

const KEYWORD_CATEGORIES: Record<string, string[]> = {
  budget: ["budget", "fiscal", "revenue", "expenditure", "appropriation", "deficit", "surplus", "millage"],
  tax: ["tax", "taxation", "assessment", "levy", "mill rate"],
  zoning: ["zoning", "zone", "variance", "conditional use", "special exception", "overlay district"],
  development: ["development", "redevelopment", "construction", "demolition", "renovation", "build"],
  housing: ["housing", "affordable", "tenant", "landlord", "eviction", "rent", "shelter", "homeless"],
  transit: ["transit", "bus", "light rail", "prt", "port authority", "route", "fare", "ridership"],
  infrastructure: ["infrastructure", "road", "bridge", "water main", "sewer", "stormwater", "paving"],
  police: ["police", "officer", "law enforcement", "public safety", "crime", "patrol"],
  education: ["school", "education", "student", "teacher", "curriculum", "graduation"],
  ordinance: ["ordinance", "resolution", "bill", "legislation", "amendment", "enact", "repeal"],
  contract: ["contract", "bid", "rfp", "vendor", "procurement", "awarded"],
  grant: ["grant", "funding", "federal funds", "state funds", "cdbg", "arpa"],
  environment: ["environment", "pollution", "clean water", "air quality", "pfas", "lead", "asbestos"],
  health: ["health", "hospital", "mental health", "opioid", "overdose"],
};

interface Json3Event {
  tStartMs?: number;
  dDurationMs?: number;
  segs?: Array<{ utf8?: string; tOffsetMs?: number }>;
}

/** Fetch captions directly from YouTube's public timedtext endpoint
 *  as a fallback when yt-dlp is blocked by YouTube's cloud-IP throttling. */
async function fetchTimedTextDirect(videoId: string, outputPath: string): Promise<boolean> {
  const json3Path = `${outputPath}.en.json3`;
  // First, get the list of caption tracks
  const listUrl = `https://www.youtube.com/api/timedtext?type=list&v=${videoId}`;
  try {
    // Try direct English auto-generated captions (most common format)
    const attempts = [
      `https://www.youtube.com/api/timedtext?lang=en&v=${videoId}&kind=asr&fmt=json3`,
      `https://www.youtube.com/api/timedtext?lang=en&v=${videoId}&fmt=json3`,
    ];
    for (const url of attempts) {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      });
      if (!res.ok) continue;
      const body = await res.text();
      // Empty body or non-JSON means no captions at this URL
      if (!body || body.length < 20) continue;
      try {
        const parsed = JSON.parse(body);
        if (parsed?.events && Array.isArray(parsed.events)) {
          fs.writeFileSync(json3Path, body);
          return true;
        }
      } catch {
        // not JSON — keep trying
      }
    }
  } catch {
    // network error — fall through
  }
  return false;
}

export async function downloadTranscript(videoUrl: string): Promise<string | null> {
  if (!fs.existsSync(TRANSCRIPT_DIR)) {
    fs.mkdirSync(TRANSCRIPT_DIR, { recursive: true });
  }

  const videoIdMatch = videoUrl.match(/(?:v=|\/)([\w-]{11})/);
  if (!videoIdMatch) return null;
  const videoId = videoIdMatch[1];

  const outputPath = path.join(TRANSCRIPT_DIR, videoId);
  const json3Path = `${outputPath}.en.json3`;

  if (fs.existsSync(json3Path)) {
    return parseJson3ToText(json3Path).text;
  }

  // Attempt 1: yt-dlp (works reliably outside cloud IPs)
  try {
    execSync(
      `yt-dlp --skip-download --write-auto-subs --sub-lang en --sub-format json3 -o "${outputPath}" "${videoUrl}" 2>/dev/null`,
      { timeout: 30000 }
    );

    if (fs.existsSync(json3Path)) {
      return parseJson3ToText(json3Path).text;
    }
  } catch {
    // fall through to direct fetch
  }

  // Attempt 2: direct YouTube timedtext endpoint (works from cloud IPs)
  try {
    const ok = await fetchTimedTextDirect(videoId, outputPath);
    if (ok && fs.existsSync(json3Path)) {
      return parseJson3ToText(json3Path).text;
    }
  } catch (err) {
    console.error(`[Transcript] Direct fetch failed for ${videoId}:`, (err as Error).message);
  }

  console.error(`[Transcript] No captions available for ${videoId} via any method`);
  return null;
}

function parseJson3ToText(filePath: string): { text: string; segments: TimedSegment[]; speakerChanges: number; totalDurationMs: number } {
  const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  const events: Json3Event[] = data.events || [];

  const parts: string[] = [];
  const segments: TimedSegment[] = [];
  let speakerChanges = 0;

  const timedWords: Array<{ text: string; startMs: number }> = [];
  let lastEndMs = 0;

  for (const event of events) {
    const eventStart = event.tStartMs ?? 0;
    for (const seg of event.segs || []) {
      const text = seg.utf8 || "";
      if (!text.trim() || text === "\n") continue;
      const wordStart = eventStart + (seg.tOffsetMs ?? 0);

      if (timedWords.length > 0 && wordStart - lastEndMs > 2000) {
        speakerChanges++;
      }

      timedWords.push({ text: text.trim(), startMs: wordStart });
      lastEndMs = wordStart + (event.dDurationMs ?? 0);
      parts.push(text.trim());
    }
  }

  const totalDurationMs = lastEndMs;

  if (timedWords.length > 0) {
    const SEGMENT_MS = 30000;
    let segStart = timedWords[0].startMs;
    let segWords: string[] = [];

    for (const tw of timedWords) {
      if (tw.startMs - segStart >= SEGMENT_MS && segWords.length > 0) {
        segments.push({ startMs: segStart, endMs: tw.startMs, text: segWords.join(" ") });
        segStart = tw.startMs;
        segWords = [];
      }
      segWords.push(tw.text);
    }
    if (segWords.length > 0) {
      segments.push({ startMs: segStart, endMs: totalDurationMs, text: segWords.join(" ") });
    }
  }

  return { text: parts.join(" "), segments, speakerChanges, totalDurationMs };
}

export function analyzeTranscript(
  transcript: string,
  videoUrl: string
): TranscriptAnalysis {
  const videoIdMatch = videoUrl.match(/(?:v=|\/)([\w-]{11})/);
  const videoId = videoIdMatch ? videoIdMatch[1] : "unknown";
  const lower = transcript.toLowerCase();

  const json3Path = path.join(TRANSCRIPT_DIR, `${videoId}.en.json3`);
  let segments: TimedSegment[] = [];
  let speakerChanges = 0;
  let totalDurationMs = 0;

  if (fs.existsSync(json3Path)) {
    const parsed = parseJson3ToText(json3Path);
    segments = parsed.segments;
    speakerChanges = parsed.speakerChanges;
    totalDurationMs = parsed.totalDurationMs;
  }

  // ── Vote Detection ─────────────────────────────────────────
  const votes: VoteEvent[] = [];
  const votePatterns: Array<{ pattern: RegExp; type: string }> = [
    { pattern: /all\s+(?:those\s+)?in\s+favor/gi, type: "voice_vote" },
    { pattern: /roll\s+call\s+vote/gi, type: "roll_call" },
    { pattern: /motion\s+(?:passed|carried|approved|failed|denied|defeated)/gi, type: "motion" },
    { pattern: /vote\s+(?:was|is)\s+\d+[\s-]+\d+/gi, type: "roll_call" },
    { pattern: /(?:yeas?|ayes?)\s+\d+[\s,]+(?:nays?|nos?)\s+\d+/gi, type: "roll_call" },
    { pattern: /(?:motion to\s+(?:approve|adopt|table|defer|amend|reconsider))/gi, type: "motion" },
    { pattern: /second(?:ed)?\s+the\s+motion/gi, type: "motion" },
    { pattern: /passes?\s+unanimously/gi, type: "voice_vote" },
    { pattern: /motion\s+carries/gi, type: "motion" },
    { pattern: /(?:moved|move)\s+(?:to\s+)?(?:approve|adopt|accept|table|deny|reject)/gi, type: "motion" },
    { pattern: /(?:the\s+)?(?:ayes|nays)\s+have\s+it/gi, type: "voice_vote" },
    { pattern: /(?:without\s+objection)/gi, type: "voice_vote" },
  ];

  for (const { pattern, type } of votePatterns) {
    let match;
    while ((match = pattern.exec(transcript)) !== null) {
      const start = Math.max(0, match.index - 100);
      const end = Math.min(transcript.length, match.index + match[0].length + 100);
      votes.push({
        type,
        context: transcript.slice(start, end).replace(/\s+/g, " ").trim(),
        position: match.index,
      });
    }
  }

  const dedupedVotes = votes.filter((v, i) =>
    !votes.some((other, j) => j < i && Math.abs(v.position - other.position) < 50)
  );

  // ── Bill/Ordinance Numbers ─────────────────────────────────
  const billNumbers: string[] = [];
  const billPatterns = [
    /(?:bill|ordinance|resolution)\s+(?:number\s+)?#?\s*(\d[\d-]+)/gi,
    /(?:number\s+)(\d{4,}[-/]\d+)/gi,
  ];
  for (const pattern of billPatterns) {
    let match;
    while ((match = pattern.exec(transcript)) !== null) {
      const num = match[1];
      if (!billNumbers.includes(num)) billNumbers.push(num);
    }
  }

  // ── Public Comment Detection ───────────────────────────────
  const publicCommentMarkers = [
    "public comment", "citizen comment", "audience comment",
    "sign up to speak", "signed up to speak", "three minutes",
    "two minutes to speak",
  ];
  let publicCommentCount = 0;
  for (const marker of publicCommentMarkers) {
    publicCommentCount += (lower.match(new RegExp(marker, "g")) || []).length;
  }
  const speakerMentions = (lower.match(/(?:next speaker|the speaker|our speaker|speaker number)/g) || []).length;

  // ── Topic Keyword Frequency ────────────────────────────────
  const topicKeywords: Record<string, number> = {};
  for (const [category, keywords] of Object.entries(KEYWORD_CATEGORIES)) {
    let count = 0;
    for (const kw of keywords) {
      count += (lower.match(new RegExp(`\\b${kw}\\b`, "g")) || []).length;
    }
    if (count > 0) topicKeywords[category] = count;
  }

  // ── Save plain text ────────────────────────────────────────
  let rawPath: string | null = null;
  try {
    rawPath = path.join(TRANSCRIPT_DIR, `${videoId}.txt`);
    fs.writeFileSync(rawPath, transcript);
  } catch {
    rawPath = null;
  }

  // ── Generate Summary ───────────────────────────────────────
  const meetingSummary = generateSummary(transcript, dedupedVotes, topicKeywords, publicCommentCount + speakerMentions, totalDurationMs, billNumbers);

  return {
    videoId,
    videoUrl,
    transcriptLength: transcript.length,
    rawTranscriptPath: rawPath,
    votes: dedupedVotes,
    billNumbers,
    publicCommentDetected: publicCommentCount > 0,
    publicCommentCount: publicCommentCount + speakerMentions,
    topicKeywords,
    speakerCount: Math.max(1, speakerChanges),
    timedSegments: segments,
    meetingSummary,
    extractedAt: new Date().toISOString(),
  };
}

// ─────────────────────────────────────────────────────────────
// Smart pattern-based summarizer — zero AI
// ─────────────────────────────────────────────────────────────

/**
 * Clean auto-generated caption text: remove filler words, repeated words,
 * broken fragments, and normalize spacing.
 */
function cleanCaptionText(text: string): string {
  return text
    // Remove >> speaker markers from YouTube captions
    .replace(/>>/g, '')
    // Remove common filler words/sounds (must be whole words)
    .replace(/\b(?:uh|um|uh huh|hmm|huh|ah|oh|er|you know|I mean|sort of|kind of|right so|so so|and and)\b/gi, '')
    // Remove leading demonstratives that are filler in captions
    .replace(/^\s*(?:that|this|the|a)\s+(?=\w)/i, '')
    // Remove garbled caption fragments (1-2 char nonsense at word boundaries)
    .replace(/\b[a-z]{1,2}\b(?=\s+[a-z])/gi, (match) => {
      // Keep real 1-2 letter words: I, a, an, at, be, by, do, go, he, if, in, is, it, me, my, no, of, on, or, so, to, up, us, we
      const realWords = new Set(['i', 'a', 'an', 'at', 'be', 'by', 'do', 'go', 'he', 'if', 'in', 'is', 'it', 'me', 'my', 'no', 'of', 'on', 'or', 'so', 'to', 'up', 'us', 'we', 'am', 'as', 'ok']);
      return realWords.has(match.toLowerCase()) ? match : '';
    })
    // Collapse multiple spaces
    .replace(/\s{2,}/g, ' ')
    // Remove orphan punctuation from filler removal
    .replace(/\s+,/g, ',')
    .replace(/,\s*,/g, ',')
    .replace(/\.\s*\./g, '.')
    // Clean up leading/trailing punctuation artifacts
    .replace(/^[.,;:\s]+/, '')
    .replace(/[.,;:\s]+$/, '')
    .trim();
}

/**
 * Extract a meaningful subject from transcript context around a match.
 * Looks for the first complete phrase that's meaningful (not procedural filler).
 */
function extractMeaningfulSubject(text: string, maxLen: number = 100): string {
  const cleaned = cleanCaptionText(text);
  // Split into sentences/phrases
  const phrases = cleaned.split(/[.!?;]/).map(s => s.trim()).filter(s => s.length > 8);
  
  // Skip purely procedural or self-introduction phrases
  const procedural = /^(can i get|do i have|all those|let's|okay|alright|thank you|thanks|yes|no|i'll|we'll|please|good (?:morning|afternoon|evening)|first of all|second|I move|I second|so moved|commissioner|mister (?:chair|president)|madam (?:chair|president)|my name is|I am|I'm \w+ \w+$)/i;
  
  for (const phrase of phrases) {
    if (!procedural.test(phrase) && phrase.length > 10) {
      return phrase.length > maxLen ? phrase.slice(0, maxLen - 3) + '...' : phrase;
    }
  }
  
  // If all phrases are procedural, take the longest one
  const longest = phrases.sort((a, b) => b.length - a.length)[0];
  if (longest) return longest.length > maxLen ? longest.slice(0, maxLen - 3) + '...' : longest;
  return cleaned.slice(0, maxLen);
}

function generateSummary(
  transcript: string,
  votes: VoteEvent[],
  topicKeywords: Record<string, number>,
  publicCommentMentions: number,
  totalDurationMs: number,
  billNumbers: string[]
): MeetingSummary {
  const lower = transcript.toLowerCase();
  // Create a cleaned version for better context extraction
  const cleanedTranscript = cleanCaptionText(transcript);
  const cleanedLower = cleanedTranscript.toLowerCase();
  const actionItems: MeetingActionItem[] = [];

  // ── Proclamation / Ceremonial Detection ────────────────────
  const proclamationPatterns = [
    /proclamation\s+(?:recognizing|honoring|declaring|celebrating|in\s+(?:honor|recognition)\s+of)\s+(.{10,120}?)(?:\.|,|\s+whereas)/gi,
    /(?:whereas|now\s+therefore).{10,200}?(?:proclam|recogni|honor|commend|salut)/gi,
    /key\s+to\s+the\s+city/gi,
    /honorary\s+(?:citizen|member|degree|title)/gi,
    /(?:congratulations?|commend(?:ation|ing)?)\s+(?:to\s+)?(.{5,100}?)(?:\.|,|for)/gi,
  ];

  const proclamationSubjects: string[] = [];
  for (const pat of proclamationPatterns) {
    let m;
    while ((m = pat.exec(transcript)) !== null) {
      const subj = (m[1] || transcript.slice(m.index, m.index + 120)).replace(/\s+/g, " ").trim();
      const clean = subj.length > 100 ? subj.slice(0, 97) + "..." : subj;
      if (!proclamationSubjects.some((s) => s.toLowerCase() === clean.toLowerCase())) {
        proclamationSubjects.push(clean);
      }
    }
  }

  // More general whereas counting for ceremonial detection
  const whereasCount = (lower.match(/\bwhereas\b/g) || []).length;

  for (const subj of proclamationSubjects.slice(0, 4)) {
    actionItems.push({
      type: "proclamation",
      icon: "\u{1F3DB}\u{FE0F}", // 🏛️
      summary: `Proclamation: ${subj.slice(0, 110)}`,
    });
  }

  // ── Mayoral / Executive Announcements ──────────────────────
  const announcementPatterns = [
    /(?:pleased\s+to\s+announce|I'm\s+announcing|today\s+we\s+(?:are\s+)?(?:launch|announc|unveil))\s+(.{10,150}?)(?:\.|!)/gi,
    /(?:the\s+mayor|mayor's\s+office)\s+(?:has\s+)?(?:announced?|launch|unveil|introduc)\w*\s+(.{10,150}?)(?:\.|!)/gi,
    /executive\s+order\s+(.{5,100}?)(?:\.|,)/gi,
    /(?:new\s+initiative|launching\s+(?:a\s+)?new)\s+(.{10,120}?)(?:\.|,)/gi,
  ];

  const seenAnnouncements = new Set<string>();
  for (const pat of announcementPatterns) {
    let m;
    while ((m = pat.exec(transcript)) !== null) {
      const subj = (m[1] || "").replace(/\s+/g, " ").trim();
      if (subj.length > 5 && !seenAnnouncements.has(subj.slice(0, 40).toLowerCase())) {
        seenAnnouncements.add(subj.slice(0, 40).toLowerCase());
        actionItems.push({
          type: "announcement",
          icon: "\u{1F4E2}", // 📢
          summary: subj.length > 110 ? subj.slice(0, 107) + "..." : subj,
        });
      }
    }
  }

  // ── Votes — extract WHAT was voted on ──────────────────────
  const voteItems: MeetingActionItem[] = [];
  const seenVoteKeys = new Set<string>();

  for (const vote of votes.slice(0, 12)) {
    // Look further back (400 chars) for context about what was voted on
    const rawLookback = transcript.slice(Math.max(0, vote.position - 400), vote.position);
    const lookback = cleanCaptionText(rawLookback);
    const rawLookahead = transcript.slice(vote.position, Math.min(transcript.length, vote.position + 200));
    const lookahead = cleanCaptionText(rawLookahead);

    let subject = "";
    let outcome = "";

    // Check outcome in lookahead
    const outcomeMatch = lookahead.match(/(?:passes?\s+unanimously|passed|carried|approved|failed|denied|defeated|tabled|unanimously)/i);
    if (outcomeMatch) {
      const word = outcomeMatch[0].toLowerCase();
      if (/pass|carri|approv|unanim/.test(word)) outcome = "Approved";
      else if (/fail|deni|defeat/.test(word)) outcome = "Denied";
      else if (/table/.test(word)) outcome = "Tabled";
    }

    // Try to extract ordinance/bill reference
    const billRef = lookback.match(/(?:ordinance|bill|resolution)\s+(?:number\s+)?#?\s*[\d-]+/i);
    // Try to extract motion subject: "motion to approve X"
    const motionSubj = lookback.match(/(?:motion to\s+)(approve|adopt|table|defer|amend|deny|reject)\s+(.{5,120}?)$/i);
    // Try to find "approve the" / "adopt the" near the vote
    const approveThe = lookback.match(/(?:approve|adopt|accept|deny|reject)\s+(?:the\s+)?(.{10,100}?)$/i);
    // Try finding what the agenda item was about
    const agendaItem = lookback.match(/(?:agenda item|item number|next item|moving to)\s+(?:\d+[.,]?\s*)?(.{10,100}?)(?:\.|$)/i);

    if (motionSubj) {
      subject = `${motionSubj[1].charAt(0).toUpperCase() + motionSubj[1].slice(1)}: ${cleanCaptionText(motionSubj[2])}`;
    } else if (billRef) {
      subject = billRef[0];
    } else if (approveThe) {
      subject = cleanCaptionText(approveThe[1]);
    } else if (agendaItem) {
      subject = cleanCaptionText(agendaItem[1]);
    } else {
      // Extract the most meaningful phrase from lookback
      subject = extractMeaningfulSubject(lookback, 100);
    }

    // Skip if subject is still just procedural noise
    const isNoise = /^(can i get|do i have|let's|okay|yes|no|January|February|March|April|May|June|July|August|September|October|November|December)\s+(minutes|meeting)/i.test(subject.trim());
    const isTooShort = subject.replace(/\s+/g, '').length < 8;
    if (isTooShort || isNoise || /^(can i get|do i have|let's|okay|yes|no)$/i.test(subject.trim())) {
      // For minutes approval, label it clearly
      if (/minutes/i.test(subject)) {
        subject = "approval of meeting minutes";
      } else {
        subject = "procedural motion";
      }
    }

    const cleanSubject = subject.length > 100 ? subject.slice(0, 97) + "..." : subject;
    const key = cleanSubject.slice(0, 50).toLowerCase();

    if (!seenVoteKeys.has(key)) {
      seenVoteKeys.add(key);
      const prefix = outcome ? `${outcome}: ` : "Vote: ";
      voteItems.push({
        type: "vote",
        icon: "\u{1F4CB}", // 📋
        summary: `${prefix}${cleanSubject}`,
        detail: cleanCaptionText(vote.context.slice(0, 200)),
      });
    }
  }
  actionItems.push(...voteItems.slice(0, 6));

  // ── Presentations / Reports ────────────────────────────────
  const presentationPatterns = [
    /(?:presentation|report|update|briefing|overview)\s+(?:on|regarding|about|of)\s+(.{10,150}?)(?:\.|,|\s+and\s+|$)/gi,
  ];
  const seenPresentations = new Set<string>();
  for (const pat of presentationPatterns) {
    let m;
    while ((m = pat.exec(cleanedTranscript)) !== null) {
      const rawSubj = (m[1] || "").replace(/\s+/g, " ").trim();
      const subj = cleanCaptionText(rawSubj);
      // Skip if subject is too short, single word, or just filler
      if (subj.length < 10 || !subj.includes(' ')) continue;
      const key = subj.slice(0, 40).toLowerCase();
      if (!seenPresentations.has(key)) {
        seenPresentations.add(key);
        actionItems.push({
          type: "presentation",
          icon: "\u{1F3A4}", // 🎤
          summary: `Presentation: ${subj.length > 95 ? subj.slice(0, 92) + "..." : subj}`,
        });
      }
    }
  }

  // ── Budget / Financial Items ───────────────────────────────
  const budgetPatterns = [
    /(?:appropriation|budget\s+amendment|contract)\s+(?:of|for)\s+\$?([\d,]+(?:\.\d+)?(?:\s*(?:million|thousand|billion))?)\s+(.{5,100}?)(?:\.|,)/gi,
    /expenditure\s+of\s+\$?([\d,]+(?:\.\d+)?(?:\s*(?:million|thousand|billion))?)/gi,
  ];
  const seenBudget = new Set<string>();
  for (const pat of budgetPatterns) {
    let m;
    while ((m = pat.exec(transcript)) !== null) {
      const amount = m[1];
      const purpose = (m[2] || "").replace(/\s+/g, " ").trim();
      const key = `${amount}-${purpose.slice(0, 30)}`.toLowerCase();
      if (!seenBudget.has(key)) {
        seenBudget.add(key);
        actionItems.push({
          type: "budget",
          icon: "\u{1F4B0}", // 💰
          summary: purpose ? `$${amount} — ${purpose.slice(0, 80)}` : `Appropriation of $${amount}`,
        });
      }
    }
  }

  // ── Appointments / Confirmations ───────────────────────────
  const appointmentPatterns = [
    /(?:appoint(?:ed|ment|ing)?|confirm(?:ed|ation)?|nominat(?:ed|ion)?|swearing\s+in)\s+(?:of\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)(?:\s+(?:to|as|for)\s+(.{5,80}?))?(?:\.|,)/g,
  ];
  const seenAppts = new Set<string>();
  for (const pat of appointmentPatterns) {
    let m;
    while ((m = pat.exec(cleanedTranscript)) !== null) {
      const who = (m[1] || "").replace(/\s+/g, " ").trim();
      const role = cleanCaptionText(m[2] || "").trim();
      // Require a proper name (at least 2 capitalized words)
      if (!/^[A-Z][a-z]+\s+[A-Z]/.test(who)) continue;
      const key = who.slice(0, 30).toLowerCase();
      if (who.length > 3 && !seenAppts.has(key)) {
        seenAppts.add(key);
        actionItems.push({
          type: "appointment",
          icon: "\u{1F465}", // 👥
          summary: role ? `Appointment: ${who.slice(0, 50)} — ${role.slice(0, 50)}` : `Appointment: ${who.slice(0, 100)}`,
        });
      }
    }
  }

  // ── Public Comment as action item ──────────────────────────
  let publicInput: string | null = null;
  if (publicCommentMentions > 0) {
    const pcIdx = lower.indexOf("public comment");
    if (pcIdx !== -1) {
      const pcContext = transcript.slice(Math.max(0, pcIdx - 30), Math.min(transcript.length, pcIdx + 150)).replace(/\s+/g, " ").trim();
      publicInput = `Public comment period (${publicCommentMentions} mention${publicCommentMentions !== 1 ? "s" : ""}): ${pcContext}`;
    } else {
      publicInput = `Public input detected (${publicCommentMentions} mention${publicCommentMentions !== 1 ? "s" : ""})`;
    }
    actionItems.push({
      type: "public_comment",
      icon: "\u{1F5E3}\u{FE0F}", // 🗣️
      summary: `Public comment period — ${publicCommentMentions} mention${publicCommentMentions !== 1 ? "s" : ""}`,
    });
  }

  // ── Discussion topics (fallback if few other items) ────────
  if (actionItems.length < 3) {
    const sortedTopics = Object.entries(topicKeywords)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3 - actionItems.length);
    for (const [topic, count] of sortedTopics) {
      // Find a meaningful sentence near the first mention of this topic
      const topicLabel = topic.charAt(0).toUpperCase() + topic.slice(1);
      const keywords = KEYWORD_CATEGORIES[topic] || [];
      let context = "";
      for (const kw of keywords) {
        const idx = cleanedLower.indexOf(kw);
        if (idx !== -1) {
          const snippet = cleanedTranscript.slice(Math.max(0, idx - 40), Math.min(cleanedTranscript.length, idx + 100));
          context = extractMeaningfulSubject(snippet, 80);
          break;
        }
      }
      actionItems.push({
        type: "discussion",
        icon: "\u{1F4AC}", // 💬
        summary: context.length > 15 ? `${topicLabel}: ${context}` : `${topicLabel} discussed (${count} mentions)`,
      });
    }
  }

  // ── Meeting Character Classification ───────────────────────
  const meetingCharacter = classifyMeeting(lower, whereasCount, proclamationSubjects.length, votes.length);

  // ── Duration ───────────────────────────────────────────────
  let duration = "Unknown";
  if (totalDurationMs > 0) {
    const totalSec = Math.floor(totalDurationMs / 1000);
    const hours = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    duration = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  } else {
    const estimatedMins = Math.round(transcript.length / 750);
    if (estimatedMins > 0) {
      const hours = Math.floor(estimatedMins / 60);
      const mins = estimatedMins % 60;
      duration = hours > 0 ? `~${hours}h ${mins}m` : `~${mins}m`;
    }
  }

  // ── One-Liner Composition ──────────────────────────────────
  const oneLiner = composeOneLiner(actionItems, votes.length, proclamationSubjects.length, billNumbers);

  return {
    oneLiner,
    actionItems,
    duration,
    publicInput,
    meetingCharacter,
  };
}

function classifyMeeting(
  lower: string,
  whereasCount: number,
  proclamationCount: number,
  voteCount: number
): MeetingCharacter {
  if (lower.includes("public hearing")) return "public_hearing";
  if (lower.includes("special meeting") || lower.includes("special session")) return "special";
  if (lower.includes("work session") || lower.includes("workshop")) return "work_session";
  if (lower.includes("committee")) return "committee";
  if (whereasCount > 3 || proclamationCount >= 2) return "ceremonial";
  if (voteCount > 2) return "legislative";
  return "legislative";
}

function composeOneLiner(
  items: MeetingActionItem[],
  voteCount: number,
  proclamationCount: number,
  billNumbers: string[]
): string {
  const parts: string[] = [];

  if (voteCount > 0) {
    parts.push(`${voteCount} vote${voteCount !== 1 ? "s" : ""}`);
  }
  if (proclamationCount > 0) {
    const first = items.find((i) => i.type === "proclamation");
    if (first) {
      // Extract just the subject from "Proclamation: ..."
      const subj = first.summary.replace(/^Proclamation:\s*/i, "").slice(0, 50);
      parts.push(`proclamation: ${subj}`);
    } else {
      parts.push(`${proclamationCount} proclamation${proclamationCount !== 1 ? "s" : ""}`);
    }
  }
  if (billNumbers.length > 0 && parts.length < 2) {
    parts.push(`${billNumbers.length} bill${billNumbers.length !== 1 ? "s" : ""} referenced`);
  }

  const presentations = items.filter((i) => i.type === "presentation");
  if (presentations.length > 0 && parts.length < 2) {
    const subj = presentations[0].summary.replace(/^Presentation:\s*/i, "").slice(0, 50);
    parts.push(`presentation: ${subj}`);
  }

  const appointments = items.filter((i) => i.type === "appointment");
  if (appointments.length > 0 && parts.length < 2) {
    parts.push(`${appointments.length} appointment${appointments.length !== 1 ? 's' : ''}`);
  }

  const budgetItems = items.filter((i) => i.type === "budget");
  if (budgetItems.length > 0 && parts.length < 2) {
    parts.push(`${budgetItems.length} financial item${budgetItems.length !== 1 ? "s" : ""}`);
  }

  const publicComment = items.find((i) => i.type === "public_comment");
  if (publicComment && parts.length < 3) {
    parts.push("public comment");
  }

  if (parts.length === 0) {
    // Fallback: use top discussion topics as proper labels
    const discussions = items.filter((i) => i.type === "discussion").slice(0, 2);
    for (const d of discussions) {
      const topic = d.summary.replace(/^Discussion:\s*/i, "").replace(/\s+matters$/i, "");
      parts.push(topic.toLowerCase());
    }
  }

  if (parts.length === 0) {
    parts.push("meeting transcript available");
  }

  // Capitalize first letter
  let result = parts.join(", ");
  result = result.charAt(0).toUpperCase() + result.slice(1);
  return result.length > 100 ? result.slice(0, 97) + "..." : result;
}
