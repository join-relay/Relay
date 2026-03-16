import "server-only"

import { google } from "googleapis"
import type { CalendarEvent, CalendarEventResponseStatus } from "@/types"
import { getDevLiveDataState } from "@/lib/persistence/dev-test-state"
import {
  clearGoogleAccountConnection,
  getGoogleAccessToken,
  getGoogleOAuthClient,
} from "@/lib/services/google-auth"

function isDevAuthBypassEnabled() {
  return process.env.NODE_ENV !== "production" && process.env.RELAY_DEV_AUTH_BYPASS === "1"
}

function getDateWindow() {
  const start = new Date()
  start.setHours(0, 0, 0, 0)

  const end = new Date(start)
  end.setDate(end.getDate() + 1)

  return {
    timeMin: start.toISOString(),
    timeMax: end.toISOString(),
  }
}

function getEventDate(value?: { dateTime?: string | null; date?: string | null } | null) {
  return value?.dateTime ?? value?.date ?? new Date().toISOString()
}

function getGoogleMeetLink(event: {
  hangoutLink?: string | null
  conferenceData?: {
    entryPoints?: Array<{ entryPointType?: string | null; uri?: string | null }> | null
  } | null
}) {
  const conferenceEntry =
    event.conferenceData?.entryPoints?.find(
      (entryPoint) => entryPoint.entryPointType === "video" && entryPoint.uri
    )?.uri ?? null

  return event.hangoutLink ?? conferenceEntry ?? undefined
}

function getAttendeeResponseStatus(
  event: { attendees?: Array<{ email?: string | null; responseStatus?: string | null }> | null },
  userEmail: string | null | undefined
): CalendarEventResponseStatus | undefined {
  if (!userEmail?.trim() || !event.attendees?.length) return undefined
  const normalized = userEmail.trim().toLowerCase()
  const attendee = event.attendees.find(
    (a) => a.email?.trim().toLowerCase() === normalized
  )
  const status = attendee?.responseStatus?.trim().toLowerCase()
  if (status === "needsaction" || status === "accepted" || status === "declined" || status === "tentative") {
    return status === "needsaction" ? "needsAction" : (status as CalendarEventResponseStatus)
  }
  return undefined
}

export function isGoogleMeetEvent(event: CalendarEvent) {
  return event.meetingProvider === "google_meet" || Boolean(event.joinUrl?.includes("meet.google.com"))
}

export function getConflictingEvents(events: CalendarEvent[]) {
  const sorted = [...events]
    .filter((event) => !event.isAllDay)
    .sort((left, right) => new Date(left.start).getTime() - new Date(right.start).getTime())

  const conflictingIds = new Set<string>()
  for (let index = 0; index < sorted.length; index += 1) {
    const current = sorted[index]
    const next = sorted[index + 1]
    if (!current || !next) continue

    if (new Date(current.end).getTime() > new Date(next.start).getTime()) {
      conflictingIds.add(current.id)
      conflictingIds.add(next.id)
    }
  }

  return events.map((event) => ({
    ...event,
    isConflict: conflictingIds.has(event.id) || event.isConflict,
  }))
}

export function getUpcomingGoogleMeet(events: CalendarEvent[]) {
  const now = Date.now()

  return (
    events
      .filter((event) => isGoogleMeetEvent(event))
      .sort((left, right) => new Date(left.start).getTime() - new Date(right.start).getTime())
      .find((event) => new Date(event.end).getTime() >= now) ?? null
  )
}

type CalendarListEntry = {
  id?: string | null
  summary?: string | null
  primary?: boolean | null
  selected?: boolean | null
}

function isIncludedCalendar(calendar: CalendarListEntry) {
  return Boolean(calendar.id) && calendar.selected !== false
}

function sortEvents(left: CalendarEvent, right: CalendarEvent) {
  return new Date(left.start).getTime() - new Date(right.start).getTime()
}

function isInsufficientScopesError(err: unknown): boolean {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase()
    if (msg.includes("insufficient authentication scopes")) return true
    if (msg.includes("insufficient authentication")) return true
  }
  const status = (err as { code?: number; status?: number })?.code ?? (err as { code?: number; status?: number })?.status
  if (status === 403) {
    const msg = String((err as Error)?.message ?? "").toLowerCase()
    if (msg.includes("scope") || msg.includes("insufficient")) return true
  }
  return false
}

export async function getLiveCalendarEvents(email?: string | null, limit = 25): Promise<CalendarEvent[]> {
  const devLiveData = isDevAuthBypassEnabled() ? await getDevLiveDataState() : null
  if (devLiveData?.enabled) {
    return (devLiveData.calendarEvents ?? []).slice(0, limit)
  }

  const accessToken = await getGoogleAccessToken(email)
  if (!accessToken) {
    throw new Error("No Google access token is available for Calendar")
  }

  try {
    const calendar = google.calendar({
      version: "v3",
      auth: getGoogleOAuthClient(accessToken),
    })
    const { timeMin, timeMax } = getDateWindow()
    const calendarListResponse = await calendar.calendarList.list({
      maxResults: 20,
    })
    const calendars = (calendarListResponse.data.items ?? []).filter(isIncludedCalendar)
    const targetCalendars = calendars.length > 0
      ? calendars
      : [{ id: "primary", summary: "Primary calendar", primary: true, selected: true }]

    const eventGroups = await Promise.all(
      targetCalendars.map(async (calendarEntry) => {
        const response = await calendar.events.list({
          calendarId: calendarEntry.id ?? "primary",
          timeMin,
          timeMax,
          singleEvents: true,
          orderBy: "startTime",
          maxResults: limit,
        })

        return (response.data.items ?? []).map((event) => {
          const joinUrl = getGoogleMeetLink(event)
          const responseStatus = getAttendeeResponseStatus(event, email)

          return {
            id: `${calendarEntry.id ?? "primary"}:${event.id ?? crypto.randomUUID()}`,
            title: event.summary ?? "(Untitled event)",
            start: getEventDate(event.start),
            end: getEventDate(event.end),
            location: event.location ?? (joinUrl ? "Google Meet" : undefined),
            calendarName: calendarEntry.summary ?? (calendarEntry.primary ? "Primary calendar" : undefined),
            isAllDay: Boolean(event.start?.date && !event.start?.dateTime),
            provider: "google",
            meetingProvider: joinUrl?.includes("meet.google.com") ? "google_meet" : undefined,
            joinUrl,
            externalEventId: event.iCalUID ?? event.id ?? undefined,
            isMeeting: Boolean(joinUrl),
            responseStatus,
          } satisfies CalendarEvent
        })
      })
    )

    return eventGroups.flat().sort(sortEvents).slice(0, limit)
  } catch (err) {
    if (isInsufficientScopesError(err) && email) {
      await clearGoogleAccountConnection(email)
      throw new Error(
        "Calendar access requires re-authorization. Please disconnect and reconnect Google in Settings to grant the updated Calendar readonly scope."
      )
    }
    throw err
  }
}

/** Parse our composite event id into calendarId and eventId for the API. */
function parseEventId(compositeId: string): { calendarId: string; eventId: string } {
  const colon = compositeId.indexOf(":")
  if (colon >= 0) {
    return {
      calendarId: compositeId.slice(0, colon) || "primary",
      eventId: compositeId.slice(colon + 1) || compositeId,
    }
  }
  return { calendarId: "primary", eventId: compositeId }
}

/** Accept or decline a calendar event invite. Requires calendar.events scope. */
export async function respondToCalendarEvent(
  email: string | null | undefined,
  compositeEventId: string,
  response: "accepted" | "declined"
): Promise<{ id: string }> {
  const accessToken = await getGoogleAccessToken(email)
  if (!accessToken) {
    throw new Error("No Google access token is available for Calendar")
  }
  if (!email?.trim()) {
    throw new Error("User email is required to respond to an event")
  }

  const { calendarId, eventId: apiEventId } = parseEventId(compositeEventId)
  const calendar = google.calendar({
    version: "v3",
    auth: getGoogleOAuthClient(accessToken),
  })

  await calendar.events.patch({
    calendarId,
    eventId: apiEventId,
    requestBody: {
      attendees: [{ email: email.trim(), responseStatus: response }],
    },
    sendUpdates: "all",
  })

  return { id: compositeEventId }
}

/** Reschedule a calendar event. Requires calendar.events scope. */
export async function patchCalendarEvent(
  email: string | null | undefined,
  eventId: string,
  proposedStart: string,
  proposedEnd: string
): Promise<{ id: string }> {
  const accessToken = await getGoogleAccessToken(email)
  if (!accessToken) {
    throw new Error("No Google access token is available for Calendar patch")
  }

  const { calendarId, eventId: apiEventId } = parseEventId(eventId)
  const calendar = google.calendar({
    version: "v3",
    auth: getGoogleOAuthClient(accessToken),
  })

  const res = await calendar.events.patch({
    calendarId,
    eventId: apiEventId,
    requestBody: {
      start: { dateTime: proposedStart, timeZone: "UTC" },
      end: { dateTime: proposedEnd, timeZone: "UTC" },
    },
  })

  return { id: res.data.id ?? apiEventId }
}

export type CreateCalendarEventPayload = {
  title: string
  start: string
  end: string
  description?: string
  location?: string
  calendarId?: string
}

/**
 * Create a calendar event. Requires calendar.events (write) scope.
 */
export async function createCalendarEvent(
  email: string | null | undefined,
  payload: CreateCalendarEventPayload
): Promise<{ id: string; calendarId: string }> {
  const accessToken = await getGoogleAccessToken(email)
  if (!accessToken) {
    throw new Error("No Google access token is available for Calendar create")
  }

  const calendarId = payload.calendarId ?? "primary"
  const calendar = google.calendar({
    version: "v3",
    auth: getGoogleOAuthClient(accessToken),
  })

  const res = await calendar.events.insert({
    calendarId,
    requestBody: {
      summary: payload.title,
      description: payload.description ?? undefined,
      location: payload.location ?? undefined,
      start: { dateTime: payload.start, timeZone: "UTC" },
      end: { dateTime: payload.end, timeZone: "UTC" },
    },
  })

  const id = res.data.id ?? ""
  return { id, calendarId }
}
