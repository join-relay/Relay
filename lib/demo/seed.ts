import type { GmailThread, CalendarEvent, PriorityItem } from "@/types"

export const DEMO_DISPLAY_NAME = "Yassin"

export const seededThreads: GmailThread[] = [
  {
    id: "t1",
    subject: "Re: Q4 budget approval needed by EOD",
    snippet: "Hi, we need your sign-off on the revised numbers before the 3pm cutoff...",
    from: "finance@company.com",
    date: "2024-03-14T08:15:00Z",
    isUnread: true,
  },
  {
    id: "t2",
    subject: "Standup notes from yesterday",
    snippet: "Here are the action items from yesterday's standup. Blockers listed below...",
    from: "team-lead@company.com",
    date: "2024-03-14T07:30:00Z",
    isUnread: false,
  },
  {
    id: "t3",
    subject: "Lunch with Sarah - reschedule?",
    snippet: "Hey, something came up. Can we push our 1pm to tomorrow?",
    from: "sarah@company.com",
    date: "2024-03-14T09:00:00Z",
    isUnread: true,
  },
]

export const seededEvents: CalendarEvent[] = [
  {
    id: "e1",
    title: "Daily Standup",
    start: "2024-03-14T09:00:00",
    end: "2024-03-14T09:15:00",
    location: "Microsoft Teams",
    provider: "demo",
    meetingProvider: "teams",
    joinUrl: "https://teams.microsoft.com/l/meetup-join/demo-standup",
    isTeamsMeeting: true,
  },
  {
    id: "e2",
    title: "Budget Review",
    start: "2024-03-14T10:30:00",
    end: "2024-03-14T11:00:00",
    isConflict: true,
    provider: "demo",
  },
  {
    id: "e2b",
    title: "1:1 with Sarah",
    start: "2024-03-14T10:30:00",
    end: "2024-03-14T11:00:00",
    isConflict: true,
    provider: "demo",
  },
  {
    id: "e3",
    title: "Project Sync",
    start: "2024-03-14T14:00:00",
    end: "2024-03-14T14:30:00",
    provider: "demo",
  },
]

export const seededPriorities: PriorityItem[] = [
  {
    id: "p1",
    type: "email",
    title: "Q4 budget approval needed",
    description: "Finance needs sign-off by 3pm",
    priority: "urgent",
    metadata: { threadId: "t1" },
    whySurfaced: "Deadline today; sender marked as high priority",
  },
  {
    id: "p2",
    type: "calendar",
    title: "Schedule conflict: 10:30",
    description: "Budget Review overlaps with 1:1 with Sarah",
    priority: "urgent",
    metadata: { eventIds: ["e2", "e2b"] },
    whySurfaced: "Two meetings at same time; one may need rescheduling",
  },
  {
    id: "p3",
    type: "meeting",
    title: "Standup in 45 min",
    description: "Daily Standup at 9:00 AM",
    priority: "important",
    metadata: { eventId: "e1" },
    whySurfaced: "Next meeting; prepare quick update",
  },
  {
    id: "p4",
    type: "email",
    title: "Lunch reschedule request",
    description: "Sarah asked to move 1pm to tomorrow",
    priority: "can_wait",
    metadata: { threadId: "t3" },
    whySurfaced: "No hard deadline; can respond after standup",
  },
]
