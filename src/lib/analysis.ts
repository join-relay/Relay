import type {
  CalendarEvent,
  EmailMessage,
  DocSummary,
  WorkLifeContext,
  DerivedStress,
} from "@/types/context";
import type { RawContextStore } from "./store";

const RECENT_EMAILS_FOR_CONTENT = 20;
const AFTER_HOURS_START = 18; // 6 PM
const AFTER_HOURS_END = 8;   // 6 AM
const MS_PER_MIN = 60 * 1000;
const MS_PER_DAY = 24 * 60 * MS_PER_MIN;

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function getDateKey(iso: string): string {
  return iso.slice(0, 10);
}

function parseDate(iso: string): Date {
  return new Date(iso);
}

function isToday(iso: string): boolean {
  const today = new Date().toISOString().slice(0, 10);
  return getDateKey(iso) === today;
}

function isThisWeek(iso: string): boolean {
  const d = parseDate(iso);
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * MS_PER_DAY);
  return d >= weekAgo && d <= now;
}

function isAfterHours(iso: string): boolean {
  const d = parseDate(iso);
  const h = d.getHours();
  return h >= AFTER_HOURS_START || h < AFTER_HOURS_END;
}

export function analyzeCalendar(events: CalendarEvent[]) {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(now.getTime() + 7 * MS_PER_DAY);

  const inRange = events.filter((e) => {
    const start = parseDate(e.start);
    return start >= todayStart && start <= weekEnd;
  });

  const todayEvents = inRange.filter((e) => isToday(e.start));
  const weekEvents = inRange;

  // Sort by start
  const sorted = [...inRange].sort(
    (a, b) => parseDate(a.start).getTime() - parseDate(b.start).getTime()
  );

  let longestFreeBlockMinutes = 0;
  let backToBackStretches = 0;

  for (let i = 0; i < sorted.length - 1; i++) {
    const end = parseDate(sorted[i].end).getTime();
    const nextStart = parseDate(sorted[i + 1].start).getTime();
    const gapMinutes = (nextStart - end) / MS_PER_MIN;
    if (gapMinutes > longestFreeBlockMinutes) longestFreeBlockMinutes = gapMinutes;

    if (gapMinutes <= 5) backToBackStretches++;
  }

  return {
    todayCount: todayEvents.length,
    weekCount: weekEvents.length,
    longestFreeBlockMinutes: Math.round(longestFreeBlockMinutes),
    backToBackStretches,
    events: inRange,
  };
}

export function analyzeEmail(messages: EmailMessage[]) {
  const unreadCount = messages.filter((m) => m.unread).length;
  const afterHoursCount = messages.filter((m) => isAfterHours(m.date)).length;

  const recent = messages
    .slice(0, 15)
    .map((m) => ({
      from: m.from,
      subject: m.subject,
      snippet: m.snippet || m.bodyText?.slice(0, 100),
    }));

  const contentInsights = messages.slice(0, RECENT_EMAILS_FOR_CONTENT).map((m) => {
    const text = (m.bodyText || m.snippet || "").toLowerCase();
    let urgency: string | undefined;
    if (/\b(urgent|asap|deadline|as soon as)\b/.test(text)) urgency = "high";
    else if (/\b(review|follow up|action)\b/.test(text)) urgency = "medium";
    return { topic: m.subject.slice(0, 50), urgency, keyAsk: undefined };
  });

  return {
    unreadCount,
    recentThreadSummary: recent,
    afterHoursCount,
    contentInsights,
    messages,
  };
}

export function deriveMeetFromCalendar(events: CalendarEvent[]) {
  const meetEvents = events.filter(
    (e) =>
      e.isMeet ||
      (e.description && e.description.includes("meet.google.com")) ||
      e.conferenceDataNotes
  );

  const now = new Date();
  const weekEnd = new Date(now.getTime() + 7 * MS_PER_DAY);
  const inRange = meetEvents.filter((e) => {
    const start = parseDate(e.start);
    return start >= now && start <= weekEnd;
  });

  const todayMeet = inRange.filter((e) => isToday(e.start));

  let totalHours = 0;
  for (const e of inRange) {
    const start = parseDate(e.start).getTime();
    const end = parseDate(e.end).getTime();
    totalHours += (end - start) / (60 * 60 * 1000);
  }

  const meetings = inRange.map((e) => ({
    eventId: e.id,
    summary: e.summary,
    start: e.start,
    end: e.end,
    agenda: stripHtml(e.description || "") || e.conferenceDataNotes || undefined,
    syncedAt: e.syncedAt,
  }));

  return {
    meetings,
    todayCount: todayMeet.length,
    weekCount: inRange.length,
    totalMeetingHoursThisWeek: Math.round(totalHours * 10) / 10,
  };
}

export function analyzeDocs(items: DocSummary[]) {
  const sevenDaysAgo = new Date(Date.now() - 7 * MS_PER_DAY).toISOString();
  const activeCount = items.filter((d) => d.lastModified >= sevenDaysAgo).length;

  const contentInsights = items.slice(0, 10).map((d) => ({
    theme: d.sectionTitles?.[0] || d.name,
    openComments: d.commentsCount,
  }));

  return {
    activeCount,
    contentInsights,
    items,
  };
}

/** Derive a stress/load indicator (1–5) from G Suite/Outlook data for when user hasn’t check in. */
export function deriveStressFromContext(
  cal: ReturnType<typeof analyzeCalendar>,
  meet: ReturnType<typeof deriveMeetFromCalendar>,
  email: ReturnType<typeof analyzeEmail>,
  docs: ReturnType<typeof analyzeDocs>
): DerivedStress {
  const reasons: string[] = [];
  let points = 0;

  // Calendar: meetings today
  if (cal.todayCount >= 6) {
    points += 2;
    reasons.push(`${cal.todayCount} meetings today`);
  } else if (cal.todayCount >= 3) {
    points += 1;
    reasons.push(`${cal.todayCount} meetings today`);
  } else if (cal.todayCount > 0) {
    reasons.push(`${cal.todayCount} meeting${cal.todayCount !== 1 ? "s" : ""} today`);
  }

  // Back-to-back stretches (no break between meetings)
  if (cal.backToBackStretches >= 3) {
    points += 2;
    reasons.push(`${cal.backToBackStretches} back-to-back meeting stretches`);
  } else if (cal.backToBackStretches > 0) {
    points += 1;
    reasons.push(`${cal.backToBackStretches} back-to-back stretch${cal.backToBackStretches !== 1 ? "es" : ""}`);
  }

  // Little or no focus time (longest free block)
  if (cal.longestFreeBlockMinutes > 0 && cal.longestFreeBlockMinutes < 30) {
    points += 1;
    reasons.push("very little focus time between meetings");
  }

  // Meeting hours this week
  if (meet.totalMeetingHoursThisWeek >= 20) {
    points += 2;
    reasons.push(`${meet.totalMeetingHoursThisWeek}h of meetings this week`);
  } else if (meet.totalMeetingHoursThisWeek >= 10) {
    points += 1;
    reasons.push(`${meet.totalMeetingHoursThisWeek}h of meetings this week`);
  }

  // Unread email
  if (email.unreadCount >= 30) {
    points += 2;
    reasons.push(`${email.unreadCount} unread emails`);
  } else if (email.unreadCount >= 15) {
    points += 1;
    reasons.push(`${email.unreadCount} unread emails`);
  } else if (email.unreadCount > 0) {
    reasons.push(`${email.unreadCount} unread email${email.unreadCount !== 1 ? "s" : ""}`);
  }

  // After-hours email activity (work creeping in)
  if (email.afterHoursCount >= 5) {
    points += 1;
    reasons.push(`${email.afterHoursCount} emails outside work hours`);
  } else if (email.afterHoursCount > 0) {
    reasons.push(`${email.afterHoursCount} after-hours email${email.afterHoursCount !== 1 ? "s" : ""}`);
  }

  // Urgent-looking email content
  const highUrgency = email.contentInsights?.filter((c) => c.urgency === "high").length ?? 0;
  if (highUrgency >= 2) {
    points += 1;
    reasons.push("several urgent-looking emails");
  } else if (highUrgency === 1) {
    reasons.push("urgent-looking email in inbox");
  }

  // Active docs and comments (cognitive load)
  const docsWithComments = docs.contentInsights?.filter((d) => (d.openComments ?? 0) > 0).length ?? 0;
  if (docs.activeCount >= 8 && docsWithComments >= 3) {
    points += 1;
    reasons.push(`${docs.activeCount} active docs with open comments`);
  } else if (docs.activeCount >= 5) {
    reasons.push(`${docs.activeCount} docs in progress`);
  }

  // Map points to 1–5 score and level (cap so score stays in range)
  const rawScore = Math.min(5, Math.max(1, 1 + Math.floor(points / 1.5)));
  const score = Math.min(5, Math.max(1, rawScore));
  const level: DerivedStress["level"] =
    score >= 4 ? "high" : score >= 3 ? "medium" : "low";

  return {
    score,
    level,
    reasons: reasons.length > 0 ? reasons : ["No strong load signals from your data yet."],
  };
}

export function buildWorkLifeContext(
  store: RawContextStore,
  wellbeingLatest: import("@/types/context").WellbeingCheckIn | null,
  wellbeingTrend: import("@/types/context").WellbeingCheckIn[]
): WorkLifeContext {
  const cal = analyzeCalendar(store.calendarEvents);
  const meet = deriveMeetFromCalendar(store.calendarEvents);
  const email = analyzeEmail(store.emailMessages);
  const docs = analyzeDocs(store.docSummaries);
  const derivedStress = deriveStressFromContext(cal, meet, email, docs);

  return {
    lastSyncedAt: store.lastSyncedAt,
    derivedStress,
    calendar: {
      events: cal.events,
      todayCount: cal.todayCount,
      weekCount: cal.weekCount,
      longestFreeBlockMinutes: cal.longestFreeBlockMinutes,
      backToBackStretches: cal.backToBackStretches,
    },
    email: {
      messages: email.messages,
      unreadCount: email.unreadCount,
      recentThreadSummary: email.recentThreadSummary,
      afterHoursCount: email.afterHoursCount,
      contentInsights: email.contentInsights,
    },
    meet: {
      meetings: meet.meetings,
      todayCount: meet.todayCount,
      weekCount: meet.weekCount,
      totalMeetingHoursThisWeek: meet.totalMeetingHoursThisWeek,
    },
    docs: {
      items: docs.items,
      activeCount: docs.activeCount,
      contentInsights: docs.contentInsights,
    },
    wellbeing: {
      latest: wellbeingLatest,
      trend: wellbeingTrend,
    },
  };
}
