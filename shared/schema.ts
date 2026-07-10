import { pgTable, text, serial, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Contention item shape (stored as JSONB array)
export const contentionItemSchema = z.object({
  topic: z.string(),
  description: z.string(),
  vote_split: z.string().optional(),
  sides: z.string().optional(),
});

export type ContentionItem = z.infer<typeof contentionItemSchema>;

export interface AddressLocation {
  address: string;
  lat: number;
  lon: number;
  neighborhood: string | null;
  municipality: string | null;
}

export const meetings = pgTable("meetings", {
  id: serial("id").primaryKey(),
  externalId: text("external_id").notNull(),
  governingBody: text("governing_body").notNull(),
  meetingType: text("meeting_type").notNull(),
  date: text("date").notNull(),
  youtubeUrl: text("youtube_url"),
  title: text("title").notNull(),
  keyTopics: text("key_topics").array(),
  billsMentioned: text("bills_mentioned").array(),
  summaryBullets: text("summary_bullets").array(),
  geographicTags: text("geographic_tags").array(),
  contention: jsonb("contention").$type<ContentionItem[]>(),
  publicCommentThemes: text("public_comment_themes").array(),
  addressLocations: jsonb("address_locations").$type<AddressLocation[]>(),
});

export const newsItems = pgTable("news_items", {
  id: serial("id").primaryKey(),
  externalId: text("external_id").notNull(),
  headline: text("headline").notNull(),
  source: text("source").notNull(),
  date: text("date").notNull(),
  url: text("url"),
  summary: text("summary"),
  geographicTags: text("geographic_tags").array(),
  category: text("category"),
});

export const developments = pgTable("developments", {
  id: serial("id").primaryKey(),
  externalId: text("external_id").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  status: text("status"),
  projectType: text("project_type"),
  address: text("address"),
  url: text("url"),
  keyDetails: text("key_details"),
  commentDeadline: text("comment_deadline"),
  geographicTags: text("geographic_tags").array(),
  source: text("source"),
});

export const insertMeetingSchema = createInsertSchema(meetings).omit({ id: true });
export const insertNewsItemSchema = createInsertSchema(newsItems).omit({ id: true });
export const insertDevelopmentSchema = createInsertSchema(developments).omit({ id: true });

export type Meeting = typeof meetings.$inferSelect;
export type InsertMeeting = z.infer<typeof insertMeetingSchema>;
export type NewsItem = typeof newsItems.$inferSelect;
export type InsertNewsItem = z.infer<typeof insertNewsItemSchema>;
export type Development = typeof developments.$inferSelect;
export type InsertDevelopment = z.infer<typeof insertDevelopmentSchema>;

// Transcript analysis (stored alongside meeting, populated by yt-dlp pipeline)
export interface TranscriptVoteEvent {
  type: string; // "voice_vote", "roll_call", "motion"
  context: string; // surrounding text
  position: number;
}

export interface TimedSegment {
  startMs: number;
  endMs: number;
  text: string;
}

export interface MeetingActionItem {
  type: 'proclamation' | 'announcement' | 'vote' | 'presentation' | 'budget' | 'appointment' | 'public_comment' | 'discussion';
  icon: string;
  summary: string;
  detail?: string;
}

export interface MeetingSummary {
  oneLiner: string;
  actionItems: MeetingActionItem[];
  duration: string;
  publicInput: string | null;
  meetingCharacter: 'legislative' | 'ceremonial' | 'committee' | 'public_hearing' | 'special' | 'work_session';
  // backward compat — old fields optional
  opening?: string;
  keyDiscussions?: Array<{ topic: string; context: string }>;
  decisions?: Array<{ description: string; voteType: string }>;
}

export interface TranscriptAnalysis {
  videoId: string;
  transcriptLength: number;
  votes: TranscriptVoteEvent[];
  billNumbers: string[];
  publicCommentDetected: boolean;
  publicCommentCount: number;
  topicKeywords: Record<string, number>;
  speakerCount: number;
  timedSegments: TimedSegment[];
  meetingSummary: MeetingSummary;
  extractedAt: string;
}

// Feedback mechanism (template-based, zero AI)
export interface FeedbackQuestion {
  id: string;
  label: string;
  type: "text" | "textarea" | "select";
  options?: string[];
  placeholder?: string;
  required: boolean;
}

export interface FeedbackTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  questions: FeedbackQuestion[];
  letterTemplate: string; // template string with {{placeholders}}
}

export interface GeneratedFeedback {
  subject: string;
  body: string;
  templateId: string;
  generatedAt: string;
}

// Source citation — attached to any factual claim
export interface SourceCitation {
  id: string;
  title: string;
  url: string;
  publishedDate: string;
  retrievedDate: string;
  quote?: string;             // exact quoted text
  speaker?: string;           // speaker name if identifiable
  videoTimestamp?: string;     // e.g. "14:22–14:49"
  videoTimestampSeconds?: [number, number]; // [start, end] in seconds
  agendaItem?: string;        // agenda/item number
  sourceType: 'primary' | 'secondary' | 'video' | 'meeting_record' | 'government_document';
  confidenceLevel: 'high' | 'medium' | 'low' | 'inference';
}

// Evidence bullet — one factual point with inline source refs
export interface EvidenceBullet {
  text: string;
  sourceIds: string[];     // references SourceCitation.id
  videoRef?: string;       // e.g. "[video 1, 14:22–14:49]"
}

// Research-bullet briefing item — the core unit
export interface BriefingItem {
  id: string;
  headline: string;
  governmentLevel: 'local' | 'county' | 'state' | 'regional' | 'federal';
  topicArea: string;
  whyItMatters: string;
  whatChanged: string;
  urgency: 'critical' | 'high' | 'medium' | 'low';
  actionNeeded: string;
  deadline?: string;
  keyStakeholders: string[];
  evidenceBullets: EvidenceBullet[];
  sources: SourceCitation[];
  videoTimestamps?: Array<{ label: string; timestamp: string; url?: string }>;
  confidenceLevel: 'high' | 'medium' | 'low';

  // Scoring for ranking
  importanceScore: number;     // 1-10
  urgencyScore: number;        // 1-10
  localRelevance: number;      // 1-10
  influenceability: number;    // 1-10 (how much a resident can affect this)

  // Infographic data block
  displayHeadline: string;
  oneLineSummary: string;
  categoryTag: string;
  categoryColor: string;
  keyStatOrQuote: string;
  strongestSourceLabel: string;
  strongestSourceUrl: string;
  timestampedClipRef?: string;
  callToAction: string;
  infographicCaption: string;

  // Metadata
  date: string;
  relatedMeetingId?: number;
  relatedNewsId?: number;
  feedbackOpportunity?: boolean;
  feedbackDeadline?: string;
}

// Feedback opportunity workflow
export interface FeedbackOpportunity {
  id: string;
  briefingItemId: string;
  issue: string;
  receivingBody: string;
  bodyPower: string;          // what the body actually controls
  whoAffected: string[];
  likelyConsequences: string;
  deadline: string;
  submissionMethod: string;   // email, portal, in-person, etc.
  submissionUrl?: string;
  sources: SourceCitation[];
}

// Strategy prompt answers (stored in React state, not persisted)
export interface StrategyAnswers {
  whatMatters: string;
  desiredOutcome: string;
  mostAffected: string;
  strongestFact: string;
  strongestValue: string;
  tone: 'collaborative' | 'firm' | 'urgent';
  speakingAs: 'individual' | 'resident' | 'organizer' | 'direct_experience';
}

// Upcoming meetings (stored in memory, not DB)
export interface UpcomingMeeting {
  governing_body: string;
  meeting_type: string;
  date: string;
  time: string;
  timezone: string;
  location: string;
  location_name: string;
  agenda_url: string;
  known_topics: string[];
  public_comment: boolean;
  live_stream_url: string;
  source_url: string;
}
