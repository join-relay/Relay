// Normalized schema for work-life context (Phase 1b)

export interface CalendarEvent {
  id: string;
  summary: string;
  start: string; // ISO
  end: string;
  description?: string;
  location?: string;
  conferenceDataNotes?: string;
  attendees?: string[];
  isMeet?: boolean;
  sourceId: string;
  syncedAt: string;
}

export interface EmailMessage {
  id: string;
  threadId: string;
  from: string;
  to?: string;
  subject: string;
  date: string;
  labelIds: string[];
  snippet?: string;
  bodyText?: string;
  unread: boolean;
  sourceId: string;
  syncedAt: string;
}

export interface MeetSummary {
  eventId: string;
  summary: string;
  start: string;
  end: string;
  agenda?: string;
  syncedAt: string;
}

export interface DocSummary {
  id: string;
  name: string;
  lastModified: string;
  owners?: string[];
  extractedText?: string;
  sectionTitles?: string[];
  commentsCount: number;
  lastRevised?: string;
  sourceId: string;
  syncedAt: string;
}

export interface WellbeingCheckIn {
  id: string;
  timestamp: string;
  energyScore?: number; // 1-5
  overwhelmScore?: number; // 1-5
  note?: string;
  contextSnapshot?: {
    meetingCount?: number;
    unreadCount?: number;
    activeDocsCount?: number;
  };
}

/** Stress/load inferred from G Suite (and Outlook) data when user hasn’t done a check-in. */
export interface DerivedStress {
  /** 1–5, same scale as overwhelmScore (1 = low load, 5 = very high). */
  score: number;
  level: "low" | "medium" | "high";
  /** Short reasons from data, e.g. "5 meetings today", "12 unread emails". */
  reasons: string[];
}

export interface WorkLifeContext {
  lastSyncedAt: string | null;
  /** Inferred from calendar/email/meet/docs when no wellbeing check-in; used for LOAD/STATUS. */
  derivedStress?: DerivedStress | null;
  calendar: {
    events: CalendarEvent[];
    todayCount: number;
    weekCount: number;
    longestFreeBlockMinutes: number;
    backToBackStretches: number;
  };
  email: {
    messages: EmailMessage[];
    unreadCount: number;
    recentThreadSummary: { from: string; subject: string; snippet?: string }[];
    afterHoursCount: number;
    contentInsights?: { topic?: string; urgency?: string; keyAsk?: string }[];
  };
  meet: {
    meetings: MeetSummary[];
    todayCount: number;
    weekCount: number;
    totalMeetingHoursThisWeek: number;
  };
  docs: {
    items: DocSummary[];
    activeCount: number;
    contentInsights?: { theme?: string; openComments?: number }[];
  };
  wellbeing: {
    latest: WellbeingCheckIn | null;
    trend: WellbeingCheckIn[];
  };
}
