import "server-only"

import { getOptionalSession } from "@/auth"
import { getBriefing } from "@/lib/services/briefing"
import {
  getCalendarEventById,
  getLiveCalendarEvents,
  getUpcomingGoogleMeet,
  isGoogleMeetEvent,
} from "@/lib/services/calendar"
import { getLiveGmailThreads } from "@/lib/services/gmail"
import { getBaseGoogleIntegrationStatus } from "@/lib/services/google-auth"
import { getSelectedDriveFiles } from "@/lib/persistence/selected-drive-files"
import { listActionExecutions } from "@/lib/persistence/action-executions"
import type { MeetingContext } from "@/types"

/**
 * Find the user's next Google Meet–capable calendar event.
 * Returns null if no session, no calendar access, or no upcoming Meet event.
 */
export async function findNextMeetEvent(): Promise<{ id: string; title: string; start: string; end: string } | null> {
  const session = await getOptionalSession()
  const status = await getBaseGoogleIntegrationStatus({
    email: session?.user?.email,
    name: session?.user?.name,
    hasSession: Boolean(session?.user?.email),
  })
  if (!status.canReadCalendar || !session?.user?.email) return null

  try {
    const events = await getLiveCalendarEvents(session.user.email)
    const next = getUpcomingGoogleMeet(events)
    if (!next) return null
    return {
      id: next.id,
      title: next.title,
      start: next.start,
      end: next.end,
    }
  } catch {
    return null
  }
}

/**
 * Assemble a full meeting context packet for an event: calendar metadata,
 * agenda/description, attendees, linked Drive files, Gmail summary, recent
 * approved actions, and current briefing summary.
 */
export async function getMeetingContext(eventId: string): Promise<MeetingContext | null> {
  const session = await getOptionalSession()
  const email = session?.user?.email ?? null
  const status = await getBaseGoogleIntegrationStatus({
    email: session?.user?.email,
    name: session?.user?.name,
    hasSession: Boolean(session?.user?.email),
  })

  const event = await getCalendarEventById(email, eventId)
  if (!event) return null

  if (!isGoogleMeetEvent(event)) {
    return null
  }

  const agendaText = event.description?.trim() ?? ""
  const attendees = event.attendees ?? []

  let linkedDriveFiles: { id: string; name: string; mimeType?: string; webViewLink?: string }[] = []
  let gmailSummary = { threads: [] as MeetingContext["gmailSummary"]["threads"], total: 0 }
  let recentApprovedActions: MeetingContext["recentApprovedActions"] = []
  let briefingSummary: MeetingContext["briefingSummary"]

  if (email) {
    const [files, executions, threads] = await Promise.all([
      getSelectedDriveFiles(email),
      listActionExecutions().then((list) => list.filter((e) => e.status === "success").slice(0, 10)),
      status.canReadGmail ? getLiveGmailThreads(email, 5).catch(() => []) : Promise.resolve([]),
    ])
    linkedDriveFiles = files.map((f) => ({
      id: f.id,
      name: f.name,
      mimeType: f.mimeType,
      webViewLink: f.webViewLink,
    }))
    gmailSummary = { threads, total: threads.length }
    recentApprovedActions = executions
  }

  try {
    const briefing = await getBriefing()
    briefingSummary = {
      date: briefing.date,
      prioritiesCount: briefing.priorities.length,
      upcomingMeetingTitle: briefing.calendarSummary.upcomingMeeting?.title,
    }
  } catch {
    briefingSummary = undefined
  }

  return {
    eventId,
    event,
    agendaText,
    attendees,
    linkedDriveFiles,
    gmailSummary,
    recentApprovedActions,
    briefingSummary,
    assembledAt: new Date().toISOString(),
  }
}
