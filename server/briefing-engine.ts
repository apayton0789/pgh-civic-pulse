import type {
  Meeting,
  NewsItem,
  Development,
  TranscriptAnalysis,
  ContentionItem,
  BriefingItem,
  FeedbackOpportunity,
  SourceCitation,
  EvidenceBullet,
} from "@shared/schema";

function getToday(): string { return new Date().toISOString().slice(0, 10); }
function getYesterday(): string { return new Date(Date.now() - 86400000).toISOString().slice(0, 10); }

/** Keyword patterns for tagging meetings/news by topic without a transcript.
 *  Runs against title + any available text. */
const KEYWORD_TAGS: Array<{ pattern: RegExp; tag: string }> = [
  { pattern: /\b(budget|fiscal|appropriation|deficit|surplus|millage|revenue)\b/i, tag: "Budget" },
  { pattern: /\b(zoning|variance|conditional use|overlay|rezoning)\b/i, tag: "Zoning" },
  { pattern: /\b(housing|tenant|landlord|eviction|affordable|rent|homeless)\b/i, tag: "Housing" },
  { pattern: /\b(transit|bus|light rail|prt|port authority|route|fare|ridership)\b/i, tag: "Transit" },
  { pattern: /\b(police|officer|law enforcement|shotspotter|patrol|crime)\b/i, tag: "Public Safety" },
  { pattern: /\b(water|sewer|stormwater|pwsa|paving|infrastructure|bridge)\b/i, tag: "Infrastructure" },
  { pattern: /\b(school|education|teacher|student|curriculum|superintendent)\b/i, tag: "Education" },
  { pattern: /\b(ice|immigration|non.?cooperation|sanctuary)\b/i, tag: "Immigration" },
  { pattern: /\b(climate|environment|green|emissions|air quality|pollut)\b/i, tag: "Climate" },
  { pattern: /\b(develop|redevelop|construction|demolition|urban)\b/i, tag: "Development" },
  { pattern: /\b(park|recreation|playground|trail|greenway)\b/i, tag: "Parks & Rec" },
  { pattern: /\b(public hearing|public comment|community input|community meeting)\b/i, tag: "Public Input" },
  { pattern: /\b(proclamation|ceremonial|honor|award|recognition)\b/i, tag: "Ceremonial" },
  { pattern: /\b(vote|resolution|ordinance|bill|legislation)\b/i, tag: "Legislation" },
  { pattern: /\b(nfl|draft|stadium|arena|sports)\b/i, tag: "Sports & Events" },
  { pattern: /\b(art|cultural|library|museum)\b/i, tag: "Arts & Culture" },
  { pattern: /\b(health|hospital|clinic|mental|behavioral)\b/i, tag: "Health" },
];

function extractKeywordTags(text: string): string[] {
  const found = new Set<string>();
  for (const { pattern, tag } of KEYWORD_TAGS) {
    if (pattern.test(text)) found.add(tag);
  }
  return [...found];
}

/** Build a YouTube transcript URL that opens the built-in transcript panel */
function youtubeTranscriptUrl(videoUrl: string): string {
  // YouTube's built-in transcript opens via the info panel. The reliable
  // pattern is to link to the video with a hint. Users click "Show transcript"
  // in the description panel.
  return videoUrl;
}

function msToTimestamp(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function governmentLevel(governingBody: string): BriefingItem["governmentLevel"] {
  const l = governingBody.toLowerCase();
  if (l.includes("county") && !l.includes("port authority")) return "county";
  if (l.includes("state") || l.includes("harrisburg") || l.includes("pa house") || l.includes("pa senate")) return "state";
  if (l.includes("regional") || l.includes("port authority") || l.includes("port of pittsburgh")) return "regional";
  return "local";
}

function topicArea(governingBody: string, keyTopics: string[]): string {
  const l = governingBody.toLowerCase();
  if (l.includes("zoning")) return "Zoning & Land Use";
  if (l.includes("planning")) return "Planning & Development";
  if (l.includes("housing") || l.includes("hacp")) return "Housing";
  if (l.includes("school") || l.includes("pps")) return "Education";
  if (l.includes("water") || l.includes("pwsa")) return "Water & Infrastructure";
  if (l.includes("transit") || l.includes("port authority")) return "Transit";
  if (l.includes("ura")) return "Economic Development";
  if (l.includes("land bank")) return "Land Use";
  if (l.includes("county")) return "County Government";
  if (l.includes("city council")) return "City Governance";
  if (keyTopics.length > 0) return keyTopics[0];
  return "Local Government";
}

function urgencyFromContention(
  contentionCount: number,
  hasTranscript: boolean,
  commentThemes: number
): BriefingItem["urgency"] {
  if (contentionCount >= 3) return "critical";
  if (contentionCount >= 2 || commentThemes >= 3) return "high";
  if (contentionCount >= 1 || hasTranscript) return "medium";
  return "low";
}

function categoryColor(urgency: BriefingItem["urgency"]): string {
  switch (urgency) {
    case "critical": return "#ef4444";
    case "high": return "#f97316";
    case "medium": return "#eab308";
    case "low": return "#6b7280";
  }
}

/** Map YouTube URL to a known channel name */
function youtubeChannelLabel(url: string, governingBody: string): string {
  const lower = governingBody.toLowerCase();
  if (lower.includes("county")) return "Allegheny County Council TV";
  if (lower.includes("city council") || lower.includes("city of pittsburgh")) return "City Channel Pittsburgh";
  if (lower.includes("school") || lower.includes("pps")) return "Pittsburgh Public Schools";
  if (lower.includes("ura")) return "Urban Redevelopment Authority";
  if (lower.includes("housing") || lower.includes("hacp")) return "Housing Authority of Pittsburgh";
  if (lower.includes("water") || lower.includes("pwsa")) return "PWSA Board";
  if (lower.includes("transit") || lower.includes("port authority")) return "Pittsburgh Regional Transit";
  if (lower.includes("planning")) return "City Channel Pittsburgh — Planning";
  if (lower.includes("zoning")) return "City Channel Pittsburgh — Zoning";
  if (lower.includes("land bank")) return "Pittsburgh Land Bank";
  return "Pittsburgh Government Channel";
}

function scoreFromMeeting(
  meeting: Meeting,
  transcript: TranscriptAnalysis | undefined
): { importance: number; urgency: number; relevance: number; influenceability: number } {
  const contention = ((meeting.contention as ContentionItem[] | null) || []).length;
  const themes = (meeting.publicCommentThemes || []).length;
  const topics = (meeting.keyTopics || []).length;
  const hasVideo = !!meeting.youtubeUrl;
  const hasTranscript = !!transcript;

  // Boost items that have video + transcript evidence (primary source)
  const videoBoost = hasVideo ? 2 : 0;
  const transcriptBoost = hasTranscript ? 2 : 0;

  const importance = Math.min(10, Math.max(1, 3 + contention * 2 + (topics > 3 ? 1 : 0) + videoBoost));
  const urgencyScore = Math.min(10, Math.max(1, 2 + contention * 2 + themes + (hasTranscript ? 1 : 0)));
  const relevance = Math.min(10, Math.max(1, 5 + (themes > 0 ? 2 : 0) + (contention > 0 ? 1 : 0) + (hasVideo ? 1 : 0)));
  const influenceability = Math.min(10, Math.max(1, 3 + themes * 2 + (transcript?.publicCommentDetected ? 2 : 0)));

  return { importance, urgency: urgencyScore, relevance, influenceability };
}

function scoreFromNews(news: NewsItem): {
  importance: number; urgency: number; relevance: number; influenceability: number;
} {
  const cat = (news.category || "").toLowerCase();
  let importance = 4;
  let urgencyScore = 3;
  let relevance = 6;
  let influenceability = 3;

  if (cat.includes("government") || cat.includes("city") || cat.includes("county")) {
    importance = 7; urgencyScore = 6; influenceability = 5;
  } else if (cat.includes("safety")) {
    importance = 8; urgencyScore = 8; relevance = 8;
  } else if (cat.includes("housing") || cat.includes("zoning")) {
    importance = 7; influenceability = 6;
  } else if (cat.includes("transit")) {
    importance = 6; urgencyScore = 5; influenceability = 5;
  } else if (cat.includes("education") || cat.includes("school")) {
    importance = 6; influenceability = 5;
  } else if (cat.includes("business") || cat.includes("economy")) {
    importance = 5;
  }

  return { importance, urgency: urgencyScore, relevance, influenceability };
}

let _itemsCache: BriefingItem[] | null = null;
let _feedbackCache: FeedbackOpportunity[] | null = null;
let _lastGenerated = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 min

export function invalidateBriefingCache() {
  _itemsCache = null;
  _feedbackCache = null;
  _lastGenerated = 0;
}

export function generateBriefingItems(
  meetings: Meeting[],
  news: NewsItem[],
  developments: Development[],
  transcripts: Map<number, TranscriptAnalysis>
): { items: BriefingItem[]; feedbackOpportunities: FeedbackOpportunity[] } {
  // Return cache if fresh
  if (_itemsCache && Date.now() - _lastGenerated < CACHE_TTL) {
    return { items: _itemsCache, feedbackOpportunities: _feedbackCache! };
  }

  const items: BriefingItem[] = [];
  const feedbackOpportunities: FeedbackOpportunity[] = [];

  // ── Meetings → BriefingItems ──────────────────────────────────────────
  for (const meeting of meetings) {
    const transcript = transcripts.get(meeting.id);
    const contention = ((meeting.contention as ContentionItem[] | null) || []);
    const themes = meeting.publicCommentThemes || [];
    const keyTopics = meeting.keyTopics || [];
    const summaryBullets = meeting.summaryBullets || [];

    const scores = scoreFromMeeting(meeting, transcript);
    const urgencyLevel = urgencyFromContention(contention.length, !!transcript, themes.length);
    const govLevel = governmentLevel(meeting.governingBody);
    const topic = topicArea(meeting.governingBody, keyTopics);
    const color = categoryColor(urgencyLevel);

    const sources: SourceCitation[] = [];
    const evidenceBullets: EvidenceBullet[] = [];
    const videoTimestamps: BriefingItem["videoTimestamps"] = [];

    // Primary video source
    if (meeting.youtubeUrl) {
      const channelName = youtubeChannelLabel(meeting.youtubeUrl, meeting.governingBody);
      const videoSrcId = `src-meeting-${meeting.id}-video`;
      sources.push({
        id: videoSrcId,
        title: `${channelName} — ${meeting.governingBody} Meeting — ${meeting.date}`,
        url: meeting.youtubeUrl,
        publishedDate: meeting.date,
        retrievedDate: getToday(),
        sourceType: "video",
        confidenceLevel: "high",
        speaker: channelName,
      });

      // Add timestamped segments if transcript
      if (transcript?.timedSegments) {
        const segments = transcript.timedSegments.slice(0, 3);
        for (const seg of segments) {
          const ts = msToTimestamp(seg.startMs);
          const te = msToTimestamp(seg.endMs);
          const label = seg.text.slice(0, 60).trim();
          videoTimestamps.push({
            label,
            timestamp: `${ts}–${te}`,
            url: meeting.youtubeUrl ? `${meeting.youtubeUrl}&t=${Math.floor(seg.startMs / 1000)}` : undefined,
          });
        }
      }
    }

    // Meeting record source
    const recordSrcId = `src-meeting-${meeting.id}-record`;
    sources.push({
      id: recordSrcId,
      title: `${meeting.title}`,
      url: meeting.youtubeUrl || `https://pittsburghpa.gov`,
      publishedDate: meeting.date,
      retrievedDate: getToday(),
      sourceType: "meeting_record",
      confidenceLevel: "high",
      agendaItem: meeting.meetingType,
    });

    // ── Build evidence bullets from ALL available sources ──────────
    const videoSrcId = meeting.youtubeUrl ? `src-meeting-${meeting.id}-video` : recordSrcId;

    // 1. Transcript action items (richest source)
    if (transcript?.meetingSummary?.actionItems) {
      for (const action of transcript.meetingSummary.actionItems.slice(0, 8)) {
        evidenceBullets.push({
          text: `${action.icon} ${action.summary}${action.detail ? ": " + action.detail : ""}`,
          sourceIds: [videoSrcId],
        });
      }
    }

    // 2. Vote events from transcript
    if (transcript?.votes && transcript.votes.length > 0) {
      for (const vote of transcript.votes.slice(0, 5)) {
        const ctx = vote.context.slice(0, 150).trim();
        evidenceBullets.push({
          text: `Vote (${vote.type.replace('_', ' ')}): ${ctx}`,
          sourceIds: [videoSrcId],
          videoRef: vote.position ? `[~${msToTimestamp(vote.position * 100)}]` : undefined,
        });
      }
    }

    // 3. Bills mentioned
    if (transcript?.billNumbers && transcript.billNumbers.length > 0) {
      const billList = transcript.billNumbers.slice(0, 10).join(', ');
      evidenceBullets.push({
        text: `Bills/items referenced: ${billList}`,
        sourceIds: [videoSrcId],
      });
    }

    // 4. Public comment detection
    if (transcript?.publicCommentDetected) {
      evidenceBullets.push({
        text: `Public comment period detected (${transcript.publicCommentCount} mentions)`,
        sourceIds: [videoSrcId],
      });
    }

    // 5. Summary bullets (from seed data or prior analysis)
    for (const bullet of summaryBullets.slice(0, 4)) {
      evidenceBullets.push({
        text: bullet,
        sourceIds: [recordSrcId],
      });
    }

    // 6. Contention evidence
    for (const c of contention.slice(0, 3)) {
      evidenceBullets.push({
        text: `Debate: ${c.topic}${c.vote_split ? ` — Vote: ${c.vote_split}` : ''}${c.description ? `. ${c.description}` : ''}`,
        sourceIds: [recordSrcId],
      });
    }

    // 7. Title-based keyword tags (works even without a transcript)
    const titleTags = extractKeywordTags(meeting.title);
    if (titleTags.length > 0 && evidenceBullets.length < 2) {
      // Only add title-based evidence if we don't already have rich transcript content
      evidenceBullets.push({
        text: `Topics from title: ${titleTags.join(", ")}. Full discussion available in the video recording.`,
        sourceIds: meeting.youtubeUrl ? [videoSrcId] : [recordSrcId],
      });
      evidenceBullets.push({
        text: `To read the full transcript: open the video on YouTube, then click “Show transcript” in the description panel.`,
        sourceIds: meeting.youtubeUrl ? [videoSrcId] : [recordSrcId],
      });
    }

    // ── Build richer summaries from transcript data ────────────────
    const voteCount = transcript?.votes?.length || 0;
    const billCount = transcript?.billNumbers?.length || 0;
    const speakerCount = transcript?.speakerCount || 0;
    const duration = transcript?.meetingSummary?.duration || '';
    const actionItems = transcript?.meetingSummary?.actionItems || [];

    // Build a substantive one-liner from actual transcript content
    let oneLiner: string;
    if (actionItems.length > 0) {
      const actionSummaries = actionItems.slice(0, 3).map(a => a.summary.slice(0, 60)).join('; ');
      oneLiner = `${voteCount > 0 ? voteCount + ' votes' : ''}${voteCount > 0 && billCount > 0 ? ', ' : ''}${billCount > 0 ? billCount + ' bills referenced' : ''}${(voteCount > 0 || billCount > 0) && actionItems.length > 0 ? '. ' : ''}Key actions: ${actionSummaries}`;
    } else if (summaryBullets.length > 0) {
      oneLiner = summaryBullets[0];
    } else if (keyTopics.length > 0) {
      oneLiner = `Topics discussed: ${keyTopics.join(', ')}.${duration ? ' Duration: ' + duration + '.' : ''}${speakerCount > 1 ? ' ~' + speakerCount + ' speakers.' : ''}`;
    } else {
      oneLiner = `${meeting.governingBody} ${meeting.meetingType} on ${meeting.date}.${duration ? ' Duration: ' + duration + '.' : ''}`;
    }

    const headline = meeting.title;

    // What actually happened
    let whatChanged: string;
    if (voteCount > 0 || billCount > 0 || actionItems.length > 0) {
      const parts: string[] = [];
      if (voteCount > 0) parts.push(`${voteCount} votes taken`);
      if (billCount > 0) parts.push(`${billCount} bills/items referenced`);
      if (transcript?.publicCommentDetected) parts.push('public comment heard');
      if (actionItems.length > 0) {
        parts.push(`actions include: ${actionItems.slice(0, 3).map(a => a.summary.slice(0, 50)).join('; ')}`);
      }
      whatChanged = parts.join('. ') + '.';
    } else if (summaryBullets.length > 0) {
      whatChanged = summaryBullets[0];
    } else if (keyTopics.length > 0) {
      whatChanged = `Discussed: ${keyTopics.join(', ')}.`;
    } else {
      whatChanged = `${meeting.governingBody} held ${meeting.meetingType} on ${meeting.date}.`;
    }

    // Why it matters — grounded in evidence
    let whyItMatters: string;
    if (contention.length > 0) {
      whyItMatters = `${contention.length} contested item(s) debated: ${contention.map(c => c.topic).join('; ')}.`;
    } else if (voteCount >= 3) {
      whyItMatters = `${voteCount} votes taken on legislation affecting Pittsburgh. ${billCount > 0 ? billCount + ' bills referenced.' : ''}`;
    } else if (themes.length > 0) {
      whyItMatters = `Community raised concerns: ${themes.slice(0, 3).join('; ')}. Public comment period included.`;
    } else if (keyTopics.length > 0) {
      whyItMatters = `${meeting.governingBody} addressed ${keyTopics.slice(0, 3).join(', ')} — decisions affect Pittsburgh residents.`;
    } else {
      whyItMatters = `Decisions by ${meeting.governingBody} affect city services and policy.`;
    }

    const actionNeeded = themes.length > 0
      ? `Review public comment themes and consider submitting feedback to ${meeting.governingBody}.`
      : contention.length > 0
      ? `Track upcoming votes on contested items at ${meeting.governingBody}.`
      : voteCount > 0
      ? `Review ${voteCount} votes taken. Watch recording for details.`
      : `Watch recording for full proceedings.`;

    const strongestSrc = sources[0];

    const item: BriefingItem = {
      id: `meeting-${meeting.id}`,
      headline,
      governmentLevel: govLevel,
      topicArea: topic,
      whyItMatters,
      whatChanged,
      urgency: urgencyLevel,
      actionNeeded,
      keyStakeholders: [meeting.governingBody, ...keyTopics.slice(0, 2)],
      evidenceBullets,
      sources,
      videoTimestamps: videoTimestamps.length > 0 ? videoTimestamps : undefined,
      confidenceLevel: (transcript && (transcript.votes.length > 0 || transcript.meetingSummary?.actionItems?.length > 0)) ? "high" : transcript ? "medium" : summaryBullets.length > 0 ? "medium" : "low",
      importanceScore: scores.importance,
      urgencyScore: scores.urgency,
      localRelevance: scores.relevance,
      influenceability: scores.influenceability,
      displayHeadline: headline,
      oneLineSummary: oneLiner,
      categoryTag: topic,
      categoryColor: color,
      keyStatOrQuote: voteCount > 0
        ? `${voteCount} votes, ${billCount} bills, ${speakerCount} speakers${duration ? ', ' + duration : ''}`
        : contention.length > 0
        ? `${contention.length} contested item(s) debated`
        : themes.length > 0
        ? `${themes.length} public comment theme(s)`
        : keyTopics.length > 0
        ? `Topics: ${keyTopics.slice(0,3).join(', ')}`
        : `${meeting.governingBody}`,
      strongestSourceLabel: strongestSrc.title,
      strongestSourceUrl: strongestSrc.url,
      timestampedClipRef: videoTimestamps[0]
        ? `${videoTimestamps[0].label} [${videoTimestamps[0].timestamp}]`
        : undefined,
      callToAction: themes.length > 0
        ? `Submit public comment to ${meeting.governingBody}`
        : `Attend next ${meeting.governingBody} meeting`,
      infographicCaption: `${meeting.governingBody} — ${meeting.date}`,
      date: meeting.date,
      relatedMeetingId: meeting.id,
      feedbackOpportunity: themes.length > 0,
    };

    items.push(item);

    // Feedback opportunity for meetings with public comment themes
    if (themes.length > 0) {
      const opp: FeedbackOpportunity = {
        id: `feedback-meeting-${meeting.id}`,
        briefingItemId: item.id,
        issue: `Public comment opportunity: ${meeting.title}`,
        receivingBody: meeting.governingBody,
        bodyPower: `${meeting.governingBody} has authority over decisions made in this meeting, including budget allocations, zoning changes, and policy directives affecting Pittsburgh residents.`,
        whoAffected: meeting.geographicTags || ["Pittsburgh residents"],
        likelyConsequences: `Decisions from this meeting will affect ${topic.toLowerCase()} policy in Pittsburgh. Public input can influence outcomes.`,
        deadline: meeting.date,
        submissionMethod: "in-person or written comment",
        submissionUrl: meeting.youtubeUrl || undefined,
        sources,
      };
      feedbackOpportunities.push(opp);
    }
  }

  // ── News → BriefingItems ──────────────────────────────────────────────
  for (const newsItem of news) {
    const scores = scoreFromNews(newsItem);
    const cat = newsItem.category || "General";
    const isGovernment = ["Government", "City", "County", "Policy"].some(
      (k) => cat.toLowerCase().includes(k.toLowerCase())
    );
    const isSafety = cat.toLowerCase().includes("safety");
    const urgencyLevel: BriefingItem["urgency"] = isSafety
      ? "high"
      : isGovernment && scores.importance >= 7
      ? "high"
      : scores.importance >= 6
      ? "medium"
      : "low";
    const color = categoryColor(urgencyLevel);

    const srcId = `src-news-${newsItem.id}`;
    const sources: SourceCitation[] = [
      {
        id: srcId,
        title: newsItem.headline,
        url: newsItem.url || `https://pittsburghpa.gov`,
        publishedDate: newsItem.date,
        retrievedDate: getToday(),
        sourceType: "secondary",
        confidenceLevel: "medium",
        quote: newsItem.summary?.slice(0, 200) || undefined,
      },
    ];

    const evidenceBullets: EvidenceBullet[] = [];
    if (newsItem.summary) {
      const sentences = newsItem.summary.replace(/\s+/g, " ").trim().split(/\.\s+/);
      for (const s of sentences.slice(0, 3)) {
        if (s.trim().length > 20) {
          evidenceBullets.push({ text: s.trim() + ".", sourceIds: [srcId] });
        }
      }
    }
    if (evidenceBullets.length === 0) {
      evidenceBullets.push({ text: newsItem.headline, sourceIds: [srcId] });
    }

    const topic = cat;
    const govLevel: BriefingItem["governmentLevel"] =
      cat.toLowerCase().includes("state") || cat.toLowerCase().includes("regional")
        ? "state"
        : "local";

    const whyItMatters = isSafety
      ? "Public safety issues require immediate community awareness and potential action."
      : isGovernment
      ? `Government decisions reported here directly affect Pittsburgh residents' services and policies.`
      : `This development affects the ${cat} sector in Pittsburgh.`;

    const actionNeeded = isGovernment
      ? "Contact your elected officials if this policy affects you directly."
      : isSafety
      ? "Stay informed and report relevant information to appropriate authorities."
      : "Stay informed about this development.";

    items.push({
      id: `news-${newsItem.id}`,
      headline: newsItem.headline,
      governmentLevel: govLevel,
      topicArea: topic,
      whyItMatters,
      whatChanged: newsItem.summary?.slice(0, 300) || newsItem.headline,
      urgency: urgencyLevel,
      actionNeeded,
      keyStakeholders: [newsItem.source, ...(newsItem.geographicTags || []).slice(0, 2)],
      evidenceBullets,
      sources,
      confidenceLevel: "medium",
      importanceScore: scores.importance,
      urgencyScore: scores.urgency,
      localRelevance: scores.relevance,
      influenceability: scores.influenceability,
      displayHeadline: newsItem.headline,
      oneLineSummary: newsItem.summary?.slice(0, 120) || newsItem.headline,
      categoryTag: topic,
      categoryColor: color,
      keyStatOrQuote: newsItem.summary?.slice(0, 100) || `Source: ${newsItem.source}`,
      strongestSourceLabel: `${newsItem.source} — ${newsItem.date}`,
      strongestSourceUrl: newsItem.url || "#",
      callToAction: isGovernment ? "Contact your representative" : "Read the full report",
      infographicCaption: `${newsItem.source} — ${newsItem.date}`,
      date: newsItem.date,
      relatedNewsId: newsItem.id,
      feedbackOpportunity: isGovernment,
    });

    // Feedback for government news
    if (isGovernment) {
      feedbackOpportunities.push({
        id: `feedback-news-${newsItem.id}`,
        briefingItemId: `news-${newsItem.id}`,
        issue: newsItem.headline,
        receivingBody: "Pittsburgh City Council / Allegheny County",
        bodyPower: "Legislative authority over city budget, zoning, public services, and policy.",
        whoAffected: newsItem.geographicTags || ["Pittsburgh residents"],
        likelyConsequences: newsItem.summary || "Policy changes may affect city services and resident quality of life.",
        deadline: newsItem.date,
        submissionMethod: "email or public testimony",
        submissionUrl: newsItem.url || undefined,
        sources,
      });
    }
  }

  // ── Developments → BriefingItems ─────────────────────────────────────
  for (const dev of developments) {
    const hasFeedbackDeadline =
      dev.commentDeadline &&
      dev.commentDeadline.trim() !== "" &&
      dev.commentDeadline > getYesterday();

    const srcId = `src-dev-${dev.id}`;
    const sources: SourceCitation[] = [
      {
        id: srcId,
        title: dev.title,
        url: dev.url || "https://pittsburghpa.gov",
        publishedDate: getToday(),
        retrievedDate: getToday(),
        sourceType: "government_document",
        confidenceLevel: "high",
        quote: dev.keyDetails?.slice(0, 200) || undefined,
      },
    ];

    const evidenceBullets: EvidenceBullet[] = [
      { text: dev.description, sourceIds: [srcId] },
    ];
    if (dev.keyDetails) {
      evidenceBullets.push({ text: dev.keyDetails, sourceIds: [srcId] });
    }

    const urgencyLevel: BriefingItem["urgency"] = hasFeedbackDeadline ? "high" : "medium";
    const color = categoryColor(urgencyLevel);

    items.push({
      id: `dev-${dev.id}`,
      headline: dev.title,
      governmentLevel: "local",
      topicArea: dev.projectType || "Development",
      whyItMatters: `This development project affects the physical character and land use of Pittsburgh neighborhoods.`,
      whatChanged: dev.description,
      urgency: urgencyLevel,
      actionNeeded: hasFeedbackDeadline
        ? `Submit public comment by ${dev.commentDeadline}`
        : "Monitor project status for public engagement opportunities.",
      deadline: dev.commentDeadline || undefined,
      keyStakeholders: [dev.source || "City of Pittsburgh", ...(dev.geographicTags || []).slice(0, 2)],
      evidenceBullets,
      sources,
      confidenceLevel: "high",
      importanceScore: hasFeedbackDeadline ? 7 : 5,
      urgencyScore: hasFeedbackDeadline ? 8 : 4,
      localRelevance: 8,
      influenceability: hasFeedbackDeadline ? 9 : 4,
      displayHeadline: dev.title,
      oneLineSummary: dev.description.slice(0, 120),
      categoryTag: dev.projectType || "Development",
      categoryColor: color,
      keyStatOrQuote: dev.keyDetails?.slice(0, 100) || dev.description.slice(0, 100),
      strongestSourceLabel: dev.source || "Pittsburgh Planning",
      strongestSourceUrl: dev.url || "https://pittsburghpa.gov",
      callToAction: hasFeedbackDeadline
        ? `Comment by ${dev.commentDeadline}`
        : "Stay informed",
      infographicCaption: `${dev.status || "Active"} — ${dev.address || "Pittsburgh"}`,
      date: getToday(),
      feedbackOpportunity: !!hasFeedbackDeadline,
      feedbackDeadline: dev.commentDeadline || undefined,
    });

    if (hasFeedbackDeadline) {
      feedbackOpportunities.push({
        id: `feedback-dev-${dev.id}`,
        briefingItemId: `dev-${dev.id}`,
        issue: dev.title,
        receivingBody: "Pittsburgh Planning Commission",
        bodyPower: "Reviews and approves development proposals, zoning variances, and land use changes in Pittsburgh.",
        whoAffected: dev.geographicTags || ["Affected neighborhood residents"],
        likelyConsequences: dev.description,
        deadline: dev.commentDeadline!,
        submissionMethod: "written comment or in-person testimony",
        submissionUrl: dev.url || undefined,
        sources,
      });
    }
  }

  // Sort: recency-first with strong preference for video/meeting-sourced items
  // Bug fix: a video source alone is not evidence — require at least 2 evidence
  // bullets before granting the video boost. Items with zero evidence bullets
  // are penalized instead of rewarded.
  const now = Date.now();
  function sortScore(item: BriefingItem): number {
    const quality = item.importanceScore * 0.2 + item.urgencyScore * 0.2 + item.localRelevance * 0.15 + item.influenceability * 0.15;
    const daysOld = Math.max(0, (now - new Date(item.date).getTime()) / (1000 * 60 * 60 * 24));
    const recency = daysOld <= 1 ? 10 : daysOld <= 3 ? 8 : daysOld <= 7 ? 5 : daysOld <= 14 ? 3 : daysOld <= 30 ? 1 : 0;
    const hasVideoSource = item.sources.some(s => s.sourceType === 'video');
    const hasSubstantiveEvidence = item.evidenceBullets.length >= 2;
    const videoBoost = hasVideoSource && hasSubstantiveEvidence ? 5 : 0;
    const hasTranscriptAnalysis = item.evidenceBullets.length >= 3 ? 3 : 0;
    const noEvidencePenalty = item.evidenceBullets.length === 0 ? -3 : 0;
    return quality + recency + videoBoost + hasTranscriptAnalysis + noEvidencePenalty;
  }
  items.sort((a, b) => sortScore(b) - sortScore(a));

  _itemsCache = items;
  _feedbackCache = feedbackOpportunities;
  _lastGenerated = Date.now();

  return { items, feedbackOpportunities };
}

export function getRecentlyChangedItems(items: BriefingItem[]): BriefingItem[] {
  return items.filter((item) => item.date >= getYesterday());
}

export function getFeedbackItems(items: BriefingItem[]): BriefingItem[] {
  return items.filter((item) => item.feedbackOpportunity === true);
}

export function getMonitoringItems(items: BriefingItem[]): BriefingItem[] {
  return items.filter((item) => item.importanceScore <= 4 || item.urgencyScore <= 3);
}

export function getAllSources(items: BriefingItem[]): SourceCitation[] {
  const seen = new Set<string>();
  const sources: SourceCitation[] = [];
  for (const item of items) {
    for (const src of item.sources) {
      if (!seen.has(src.id)) {
        seen.add(src.id);
        sources.push(src);
      }
    }
  }
  return sources;
}
