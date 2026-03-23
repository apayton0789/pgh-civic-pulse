import type { Meeting, InsertMeeting, NewsItem, InsertNewsItem, Development, InsertDevelopment, TranscriptAnalysis } from "@shared/schema";

export interface IStorage {
  getMeetings(): Promise<Meeting[]>;
  getMeetingById(id: number): Promise<Meeting | undefined>;
  createMeeting(meeting: InsertMeeting): Promise<Meeting>;
  updateMeetingTranscript(meetingId: number, transcript: TranscriptAnalysis): Promise<void>;
  getTranscript(meetingId: number): Promise<TranscriptAnalysis | undefined>;
  getNewsItems(): Promise<NewsItem[]>;
  getNewsItemById(id: number): Promise<NewsItem | undefined>;
  createNewsItem(item: InsertNewsItem): Promise<NewsItem>;
  getDevelopments(): Promise<Development[]>;
  getDevelopmentById(id: number): Promise<Development | undefined>;
  createDevelopment(dev: InsertDevelopment): Promise<Development>;
  getItemsByGeography(tag: string): Promise<{ meetings: Meeting[]; news: NewsItem[]; developments: Development[] }>;
}

export class MemStorage implements IStorage {
  private meetings: Meeting[] = [];
  private newsItems: NewsItem[] = [];
  private developments: Development[] = [];
  private transcripts: Map<number, TranscriptAnalysis> = new Map();
  private meetingId = 1;
  private newsId = 1;
  private developmentId = 1;

  async getMeetings(): Promise<Meeting[]> {
    return [...this.meetings].sort((a, b) => b.date.localeCompare(a.date));
  }

  async getMeetingById(id: number): Promise<Meeting | undefined> {
    return this.meetings.find((m) => m.id === id);
  }

  async createMeeting(meeting: InsertMeeting): Promise<Meeting> {
    const existing = this.meetings.find((m) => m.externalId === meeting.externalId);
    if (existing) return existing;
    const newMeeting: Meeting = { ...meeting, id: this.meetingId++ } as Meeting;
    this.meetings.push(newMeeting);
    return newMeeting;
  }

  async updateMeetingTranscript(meetingId: number, transcript: TranscriptAnalysis): Promise<void> {
    this.transcripts.set(meetingId, transcript);
    // Also enrich the meeting record with transcript-derived data
    const meeting = this.meetings.find((m) => m.id === meetingId);
    if (meeting) {
      // Merge transcript bill numbers into meeting bills
      if (transcript.billNumbers.length > 0) {
        const existing = meeting.billsMentioned || [];
        meeting.billsMentioned = [...new Set([...existing, ...transcript.billNumbers])];
      }
      // Add topic keywords as key topics if meeting has none
      if ((!meeting.keyTopics || meeting.keyTopics.length === 0) && Object.keys(transcript.topicKeywords).length > 0) {
        meeting.keyTopics = Object.entries(transcript.topicKeywords)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 8)
          .map(([k]) => k.charAt(0).toUpperCase() + k.slice(1));
      }
    }
  }

  async getTranscript(meetingId: number): Promise<TranscriptAnalysis | undefined> {
    return this.transcripts.get(meetingId);
  }

  async getNewsItems(): Promise<NewsItem[]> {
    return [...this.newsItems].sort((a, b) => b.date.localeCompare(a.date));
  }

  async getNewsItemById(id: number): Promise<NewsItem | undefined> {
    return this.newsItems.find((n) => n.id === id);
  }

  async createNewsItem(item: InsertNewsItem): Promise<NewsItem> {
    const existing = this.newsItems.find((n) => n.externalId === item.externalId);
    if (existing) return existing;
    const newItem: NewsItem = { ...item, id: this.newsId++ } as NewsItem;
    this.newsItems.push(newItem);
    return newItem;
  }

  async getDevelopments(): Promise<Development[]> {
    return [...this.developments];
  }

  async getDevelopmentById(id: number): Promise<Development | undefined> {
    return this.developments.find((d) => d.id === id);
  }

  async createDevelopment(dev: InsertDevelopment): Promise<Development> {
    const existing = this.developments.find((d) => d.externalId === dev.externalId);
    if (existing) return existing;
    const newDev: Development = { ...dev, id: this.developmentId++ } as Development;
    this.developments.push(newDev);
    return newDev;
  }

  async getItemsByGeography(tag: string): Promise<{ meetings: Meeting[]; news: NewsItem[]; developments: Development[] }> {
    const tagLower = tag.toLowerCase();
    const meetings = this.meetings.filter((m) =>
      m.geographicTags?.some((t) => t.toLowerCase().includes(tagLower))
    );
    const news = this.newsItems.filter((n) =>
      n.geographicTags?.some((t) => t.toLowerCase().includes(tagLower))
    );
    const developments = this.developments.filter((d) =>
      d.geographicTags?.some((t) => t.toLowerCase().includes(tagLower))
    );
    return { meetings, news, developments };
  }
}

export const storage = new MemStorage();
