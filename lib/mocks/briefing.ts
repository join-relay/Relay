import {
  DEMO_DISPLAY_NAME,
  seededThreads,
  seededEvents,
  seededPriorities,
} from "@/lib/demo/seed"
import type { Briefing } from "@/types"

export function getMockBriefing(): Briefing {
  const conflicts = seededEvents.filter((e) => e.isConflict)
  const upcomingMeeting = seededEvents.find(
    (e) =>
      e.title.toLowerCase().includes("standup") ||
      e.title.toLowerCase().includes("daily")
  )

  return {
    displayName: DEMO_DISPLAY_NAME,
    date: new Date().toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    }),
    inboxSummary: {
      total: seededThreads.length,
      urgent: seededThreads.filter((t) => t.isUnread).length,
      important: 2,
      threads: seededThreads,
    },
    calendarSummary: {
      events: seededEvents,
      conflicts,
      upcomingMeeting,
    },
    priorities: seededPriorities,
  }
}
