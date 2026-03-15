import { getOptionalSession } from "@/auth"
import { getMockBriefing } from "@/lib/mocks/briefing"
import {
  getConflictingEvents,
  getUpcomingGoogleMeet,
  getLiveCalendarEvents,
} from "@/lib/services/calendar"
import { getLiveGmailThreads } from "@/lib/services/gmail"
import { getBaseGoogleIntegrationStatus } from "@/lib/services/google-auth"
import type { Briefing } from "@/types"

function buildPriorities(briefing: Pick<Briefing, "inboxSummary" | "calendarSummary">) {
  const priorities = []

  const urgentThread = briefing.inboxSummary.threads.find((thread) => thread.isUnread)
  if (urgentThread) {
    priorities.push({
      id: `email-${urgentThread.id}`,
      type: "email" as const,
      title: urgentThread.subject,
      description: `Unread email from ${urgentThread.from}`,
      priority: "urgent" as const,
      metadata: { threadId: urgentThread.id },
      whySurfaced: "Unread Gmail thread surfaced from the live inbox read.",
    })
  }

  if (briefing.calendarSummary.conflicts.length > 0) {
    priorities.push({
      id: "calendar-conflict",
      type: "calendar" as const,
      title: "Schedule conflict detected",
      description: briefing.calendarSummary.conflicts.map((event) => event.title).join(" overlaps with "),
      priority: "urgent" as const,
      metadata: { eventIds: briefing.calendarSummary.conflicts.map((event) => event.id) },
      whySurfaced: "Two or more events overlap in the current Google Calendar window.",
    })
  }

  if (briefing.calendarSummary.upcomingMeeting) {
    priorities.push({
      id: `meeting-${briefing.calendarSummary.upcomingMeeting.id}`,
      type: "meeting" as const,
      title: `${briefing.calendarSummary.upcomingMeeting.title} is coming up`,
      description: `Next Google Meet at ${new Date(
        briefing.calendarSummary.upcomingMeeting.start
      ).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      })}`,
      priority: "important" as const,
      metadata: { eventId: briefing.calendarSummary.upcomingMeeting.id },
      whySurfaced: "Relay found the next Google Meet in today's calendar events.",
    })
  }

  return priorities
}

export async function getBriefing(): Promise<Briefing> {
  const session = await getOptionalSession()
  const googleStatus = await getBaseGoogleIntegrationStatus({
    email: session?.user?.email,
    name: session?.user?.name,
    hasSession: Boolean(session?.user?.email),
  })

  if (!googleStatus.canUseLiveBriefing || !session?.user?.email) {
    return {
      ...getMockBriefing(),
      source: "mock",
      statusNote: googleStatus.note,
    }
  }

  try {
    const [threads, rawEvents] = await Promise.all([
      getLiveGmailThreads(session.user.email),
      getLiveCalendarEvents(session.user.email),
    ])
    const events = getConflictingEvents(rawEvents)
    const conflicts = events.filter((event) => event.isConflict)
    const upcomingMeeting = getUpcomingGoogleMeet(events)

    const briefing: Briefing = {
      displayName: session.user.name ?? googleStatus.displayName ?? "there",
      date: new Date().toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      }),
      source: "google",
      statusNote: "Live Gmail and Calendar data are active for this briefing.",
      inboxSummary: {
        total: threads.length,
        urgent: threads.filter((thread) => thread.isUnread).length,
        important: Math.min(threads.length, 3),
        threads,
      },
      calendarSummary: {
        events,
        conflicts,
        upcomingMeeting: upcomingMeeting ?? undefined,
      },
      priorities: [],
    }

    briefing.priorities = buildPriorities(briefing)
    return briefing
  } catch (error) {
    return {
      ...getMockBriefing(),
      source: "mock",
      statusNote:
        error instanceof Error
          ? `Live Google data failed, so Relay fell back to mock briefing data: ${error.message}`
          : "Live Google data failed, so Relay fell back to mock briefing data.",
    }
  }
}
