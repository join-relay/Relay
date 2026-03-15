import type { WorkLifeContext } from "@/types/context";

const now = new Date();
const today = now.toISOString().slice(0, 10);
const iso = (h: number, m: number) => `${today}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00.000Z`;

/** Mock work-life context for the "See demo" preview (no real Gmail/Outlook data). */
export function getDemoContext(): WorkLifeContext {
  return {
    lastSyncedAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    derivedStress: {
      score: 3,
      level: "medium",
      reasons: [
        "4 meetings today",
        "2 back-to-back stretches",
        "8h of meetings this week",
        "12 unread emails",
        "3 docs in progress",
      ],
    },
    calendar: {
      events: [
        {
          id: "demo-1",
          summary: "Standup",
          start: iso(9, 0),
          end: iso(9, 15),
          isMeet: true,
          sourceId: "demo",
          syncedAt: now.toISOString(),
        },
        {
          id: "demo-2",
          summary: "Project review",
          start: iso(10, 0),
          end: iso(11, 0),
          description: "meet.google.com/abc-defg-hij",
          location: "Conference Room B",
          isMeet: true,
          sourceId: "demo",
          syncedAt: now.toISOString(),
        },
        {
          id: "demo-3",
          summary: "1:1 with manager",
          start: iso(14, 0),
          end: iso(14, 30),
          isMeet: true,
          sourceId: "demo",
          syncedAt: now.toISOString(),
        },
      ],
      todayCount: 3,
      weekCount: 8,
      longestFreeBlockMinutes: 120,
      backToBackStretches: 2,
    },
    email: {
      messages: [],
      unreadCount: 12,
      recentThreadSummary: [
        { from: "team@company.com", subject: "Q3 planning – action needed", snippet: "Please review the attached deck by EOD…" },
        { from: "boss@company.com", subject: "Re: Project timeline", snippet: "Can we move the deadline to Friday?" },
        { from: "hr@company.com", subject: "Benefits open enrollment", snippet: "Reminder: enrollment closes next week." },
      ],
      afterHoursCount: 2,
      contentInsights: [
        { topic: "Q3 planning – action needed", urgency: "high" },
        { topic: "Re: Project timeline", urgency: "medium" },
      ],
    },
    meet: {
      meetings: [
        { eventId: "demo-1", summary: "Standup", start: iso(9, 0), end: iso(9, 15), syncedAt: now.toISOString() },
        { eventId: "demo-2", summary: "Project review", start: iso(10, 0), end: iso(11, 0), syncedAt: now.toISOString() },
        { eventId: "demo-3", summary: "1:1 with manager", start: iso(14, 0), end: iso(14, 30), syncedAt: now.toISOString() },
      ],
      todayCount: 3,
      weekCount: 8,
      totalMeetingHoursThisWeek: 8,
    },
    docs: {
      items: [],
      activeCount: 3,
      contentInsights: [
        { theme: "Q3 Roadmap", openComments: 2 },
        { theme: "Meeting notes", openComments: 0 },
      ],
    },
    wellbeing: {
      latest: null,
      trend: [],
    },
  };
}
