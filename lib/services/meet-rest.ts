import "server-only"

import { getCalendarEventById } from "@/lib/services/calendar"
import { getGoogleAccessToken } from "@/lib/services/google-auth"
import type { MeetArtifactState } from "@/types"

const MEET_API_BASE = "https://meet.googleapis.com/v2"

/** Calendar's conferenceId is the meeting code (e.g. abc-defg-hij). Meet API uses a different conference record ID. */
type ConferenceRecord = {
  name?: string
  startTime?: string
  endTime?: string
  space?: string
}

type ConferenceRecordListResponse = {
  conferenceRecords?: ConferenceRecord[]
  nextPageToken?: string
}

type MeetTranscript = {
  name?: string
  state?: string
  startTime?: string
  endTime?: string
  docsDestination?: { document?: string; exportUri?: string }
}

type MeetTranscriptListResponse = {
  transcripts?: MeetTranscript[]
  nextPageToken?: string
}

type TranscriptEntry = {
  name?: string
  text?: string
  participant?: string
  languageCode?: string
  startTime?: string
  endTime?: string
}

type TranscriptEntriesListResponse = {
  transcriptEntries?: TranscriptEntry[]
  nextPageToken?: string
}

async function meetApiGet<T>(
  accessToken: string,
  path: string
): Promise<{ data?: T; error?: { code?: number; message?: string } }> {
  const res = await fetch(`${MEET_API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const data = (await res.json().catch(() => ({}))) as T & { error?: { code?: number; message?: string } }
  if (!res.ok) {
    return {
      error: {
        code: res.status,
        message: data?.error?.message ?? res.statusText ?? "Meet API request failed",
      },
    }
  }
  return { data }
}

/**
 * Resolve Calendar meeting code to a Meet API conference record ID.
 * Calendar's conferenceId is the meeting code; Meet API conferenceRecords/{id} expects the record ID.
 */
async function resolveConferenceRecordId(
  accessToken: string,
  meetingCode: string,
  eventStartIso?: string
): Promise<{ conferenceRecordId: string; error?: string }> {
  const filter = `space.meeting_code = "${meetingCode.replace(/"/g, "")}"`
  const path = `/conferenceRecords?filter=${encodeURIComponent(filter)}&pageSize=25`
  const listRes = await meetApiGet<ConferenceRecordListResponse>(accessToken, path)
  if (listRes.error) {
    return { conferenceRecordId: "", error: listRes.error.message }
  }
  const records = listRes.data?.conferenceRecords ?? []
  if (records.length === 0) {
    return {
      conferenceRecordId: "",
      error: "No conference record found for this meeting. The meeting may not have started yet or the meeting code may not match.",
    }
  }
  const eventStart = eventStartIso ? new Date(eventStartIso).getTime() : 0
  const sorted = [...records].sort((a, b) => {
    const aEnd = a.endTime ? new Date(a.endTime).getTime() : 0
    const bEnd = b.endTime ? new Date(b.endTime).getTime() : 0
    return bEnd - aEnd
  })
  const best = eventStart
    ? sorted.find((r) => {
        const start = r.startTime ? new Date(r.startTime).getTime() : 0
        const end = r.endTime ? new Date(r.endTime).getTime() : 0
        return eventStart >= start - 60000 && eventStart <= end + 60000
      }) ?? sorted[0]
    : sorted[0]
  const name = best?.name ?? ""
  const id = name.startsWith("conferenceRecords/") ? name.slice("conferenceRecords/".length) : name
  if (!id) {
    return { conferenceRecordId: "", error: "Conference record has no valid name." }
  }
  return { conferenceRecordId: id }
}

/**
 * Fetch transcript text for a conference record via Google Meet REST API.
 * Returns concatenated transcript entries when available.
 */
async function fetchTranscriptText(
  accessToken: string,
  conferenceRecordId: string
): Promise<{ text: string; error?: string }> {
  const listRes = await meetApiGet<MeetTranscriptListResponse>(
    accessToken,
    `/conferenceRecords/${encodeURIComponent(conferenceRecordId)}/transcripts`
  )
  if (listRes.error) {
    return { text: "", error: listRes.error.message }
  }
  const transcripts = listRes.data?.transcripts ?? []
  const readyTranscript = transcripts.find((t) => t.state === "FILE_GENERATED")
  if (!readyTranscript?.name) {
    const hasEnded = transcripts.some((t) => t.state === "ENDED")
    return {
      text: "",
      error: hasEnded
        ? "Transcript not yet generated. It may appear shortly after the meeting ends."
        : "No transcript available for this meeting.",
    }
  }
  const nameParts = readyTranscript.name.split("/")
  const transcriptId = nameParts[nameParts.length - 1]
  if (!transcriptId) {
    return { text: "", error: "Invalid transcript name." }
  }

  const entries: string[] = []
  let pageToken: string | undefined
  do {
    const entriesPath =
      `/conferenceRecords/${encodeURIComponent(conferenceRecordId)}/transcripts/${encodeURIComponent(transcriptId)}/entries` +
      (pageToken ? `?pageToken=${encodeURIComponent(pageToken)}` : "?pageSize=100")
    const entriesRes = await meetApiGet<TranscriptEntriesListResponse>(accessToken, entriesPath)
    if (entriesRes.error) {
      return { text: entries.join(" ").trim(), error: entriesRes.error.message }
    }
    const list = entriesRes.data?.transcriptEntries ?? []
    for (const entry of list) {
      if (entry.text?.trim()) entries.push(entry.text.trim())
    }
    pageToken = entriesRes.data?.nextPageToken
  } while (pageToken)

  return { text: entries.join("\n").trim() }
}

/**
 * Fetch Google Meet conference/artifact/transcript data via the Meet REST API.
 * Uses the Calendar event's conferenceId (from conferenceDataVersion=1) to list
 * transcripts and transcript entries. Requires meetings.space.readonly scope.
 */
export async function fetchMeetArtifacts(
  eventId: string,
  userEmail: string | null | undefined
): Promise<MeetArtifactState> {
  const now = new Date().toISOString()

  const accessToken = await getGoogleAccessToken(userEmail)
  if (!accessToken) {
    return {
      eventId,
      availability: "unavailable",
      failureReason: "Not signed in. Connect Google and grant Meet read scope to access post-meeting transcripts.",
      checkedAt: now,
    }
  }

  const event = await getCalendarEventById(userEmail, eventId)
  const meetingCode = event?.conferenceId
  if (!meetingCode) {
    return {
      eventId,
      availability: "unavailable",
      failureReason:
        "No conference ID for this event. Re-save the calendar event with Google Meet or ensure the event has Meet enabled.",
      checkedAt: now,
    }
  }

  const { conferenceRecordId, error: resolveError } = await resolveConferenceRecordId(
    accessToken,
    meetingCode,
    event?.start
  )
  if (resolveError || !conferenceRecordId) {
    return {
      eventId,
      availability: "unavailable",
      failureReason:
        resolveError ??
        "Could not find a conference record for this meeting. The meeting may not have started or may have ended.",
      checkedAt: now,
    }
  }

  const { text, error } = await fetchTranscriptText(accessToken, conferenceRecordId)
  if (error && !text) {
    return {
      eventId,
      availability: "unavailable",
      failureReason: error,
      checkedAt: now,
    }
  }

  return {
    eventId,
    availability: text ? "available" : "unavailable",
    transcriptText: text || undefined,
    failureReason: text ? undefined : (error ?? "No transcript text returned."),
    checkedAt: now,
  }
}

/**
 * Check whether Meet artifacts/transcript are available for an event.
 */
export async function getMeetArtifactAvailability(
  eventId: string,
  userEmail: string | null | undefined
): Promise<MeetArtifactState> {
  return fetchMeetArtifacts(eventId, userEmail)
}
