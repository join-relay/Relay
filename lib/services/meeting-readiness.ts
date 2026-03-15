import "server-only"

import { getOptionalSession } from "@/auth"
import { getRelayCustomizationSettings } from "@/lib/persistence/user-preferences"
import { BOT_LABEL } from "@/lib/constants"
import {
  getBaseGoogleIntegrationStatus,
} from "@/lib/services/google-auth"
import {
  getLiveCalendarEvents,
  getUpcomingGoogleMeet,
  isGoogleMeetEvent,
} from "@/lib/services/calendar"
import { getRecallProviderReadiness } from "@/lib/services/recall"
import { listMeetingRuns } from "@/lib/persistence/meeting-runs"
import type {
  IntegrationState,
  MeetingIntegrationCheckpoint,
  MeetingLinkCheckAttempt,
  MeetingReadinessStatus,
  MeetingUpcomingStatus,
} from "@/types"

let lastLinkCheck: MeetingLinkCheckAttempt | undefined
const MEETING_LIVE_TIMEOUT_MS = 4500

function deriveOverallState(checkpoints: MeetingIntegrationCheckpoint[]): IntegrationState {
  if (checkpoints.some((checkpoint) => checkpoint.state === "not_configured")) {
    return "not_configured"
  }
  if (checkpoints.some((checkpoint) => checkpoint.state === "blocked")) {
    return "blocked"
  }
  if (checkpoints.every((checkpoint) => checkpoint.state === "validated")) {
    return "validated"
  }
  return "fallback"
}

function withTimeout<T>(promise: Promise<T>, label: string, timeoutMs = MEETING_LIVE_TIMEOUT_MS) {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs)
    }),
  ])
}

export function buildMeetingReadinessErrorStatus(message: string): MeetingReadinessStatus {
  const providerReadiness = getRecallProviderReadiness()
  return {
    botIdentity: BOT_LABEL,
    resolutionState: "error",
    overallState: "fallback",
    assumptions: [
      "Relay is Google-first for Gmail, Calendar, and future Meet detection.",
      "This page should resolve explicitly even when live dependencies fail.",
    ],
    manualSteps: [
      "Reload the page to retry the readiness request.",
      "If the issue persists, reconnect Google in Settings and check server logs.",
    ],
    runtimeEvidenceNote: "Meeting readiness could not be resolved from the current runtime request.",
    checkpoints: [
      {
        key: "googleAuth",
        label: "Google auth connected",
        state: "fallback",
        source: "runtime",
        detail: message,
      },
      {
        key: "gmailBriefing",
        label: "Gmail read ready",
        state: "fallback",
        source: "runtime",
        detail: "Meeting readiness did not reach live Gmail/calendar evaluation.",
      },
      {
        key: "calendarRead",
        label: "Calendar read ready",
        state: "fallback",
        source: "runtime",
        detail: "Meeting readiness did not reach a usable calendar result.",
      },
      {
        key: "meetDiscovery",
        label: "Google Meet discovery",
        state: "fallback",
        source: "runtime",
        detail: "No live or fallback meeting result could be confirmed from this request.",
      },
      {
        key: "liveJoinPath",
        label: "Real join proof",
        state: "fallback",
        source: "derived",
        detail:
          "Relay still does not claim a live join or spoken delivery without real proof.",
      },
    ],
    nextMeeting: null,
    lastLinkCheck,
    providerReadiness,
    customizationSummary: "Future meeting writing settings are unavailable for this failed request.",
    summarySurface: {
      state: "empty",
      summary: null,
    },
    actionItemsSurface: {
      state: "empty",
      items: [],
    },
    transcriptSurface: {
      state: "empty",
      previewLines: [],
      note: "Meeting readiness failed before transcript or summary surfaces could load.",
    },
  }
}

export async function getMeetingReadinessStatus(): Promise<MeetingReadinessStatus> {
  const session = await getOptionalSession()
  const providerReadiness = getRecallProviderReadiness()
  const customization = await getRelayCustomizationSettings(session?.user?.email)
  const baseStatus = await getBaseGoogleIntegrationStatus({
    email: session?.user?.email,
    name: session?.user?.name,
    hasSession: Boolean(session?.user?.email),
  })

  let nextMeeting = null
  let calendarDetail =
    "Calendar read access is not ready yet, so Google Meet discovery is still using explicit fallback states."
  let meetDetail =
    "Relay has not joined any meeting. This pass only verifies Google readiness and future Meet discovery."

  if (baseStatus.canReadCalendar && session?.user?.email) {
    try {
      const events = await withTimeout(
        getLiveCalendarEvents(session.user.email),
        "Meeting calendar discovery"
      )
      nextMeeting = getUpcomingGoogleMeet(events)
      calendarDetail = `Relay can read today's Google Calendar events${events.length > 0 ? ` (${events.length} found)` : ""}.`
      meetDetail = nextMeeting
        ? `Relay detected an upcoming Google Meet from Calendar: ${nextMeeting.title}.`
        : "Calendar read is live, but no upcoming Google Meet was found in the current window."
    } catch (error) {
      calendarDetail =
        error instanceof Error
          ? `Calendar read is configured, but the live request failed: ${error.message}`
          : "Calendar read is configured, but the live request failed."
      meetDetail =
        "Upcoming Google Meet discovery is falling back because live Calendar data could not be loaded."
    }
  }

  const checkpoints: MeetingIntegrationCheckpoint[] = [
    {
      key: "googleAuth",
      label: "Google auth connected",
      state: baseStatus.status,
      source: baseStatus.status === "validated" ? "google" : "derived",
      detail: baseStatus.note,
      blocker: baseStatus.missingEnv.length > 0 ? `Missing: ${baseStatus.missingEnv.join(", ")}` : undefined,
    },
    {
      key: "gmailBriefing",
      label: "Gmail read ready",
      state: baseStatus.canReadGmail ? "validated" : baseStatus.status,
      source: baseStatus.canReadGmail ? "google" : baseStatus.hasSession ? "derived" : "demo",
      detail: baseStatus.canReadGmail
        ? "Relay can read Gmail threads for Briefing when a connected Google session is present."
        : "Gmail read falls back to mock briefing data until Google auth and Gmail readonly scope are available.",
    },
    {
      key: "calendarRead",
      label: "Calendar read ready",
      state: baseStatus.canReadCalendar && calendarDetail.startsWith("Relay can read")
        ? "validated"
        : baseStatus.canReadCalendar
          ? "fallback"
          : baseStatus.status,
      source: baseStatus.canReadCalendar ? "google" : baseStatus.hasSession ? "derived" : "demo",
      detail: calendarDetail,
    },
    {
      key: "meetDiscovery",
      label: "Google Meet discovery",
      state: nextMeeting ? "validated" : baseStatus.canReadCalendar ? "fallback" : baseStatus.status,
      source: nextMeeting ? "google" : baseStatus.canReadCalendar ? "google" : "demo",
      detail: meetDetail,
    },
    {
      key: "liveJoinPath",
      label: "Real join proof",
      state: "fallback",
      source: "derived",
      detail:
        "Real meeting join, speaking, and artifact retrieval are intentionally not implemented in this pass. Relay will not claim it joined or spoke without real proof.",
    },
  ]

  const botIdentity =
    session?.user?.name ? `${session.user.name}'s Relay` : BOT_LABEL
  const resolutionState = nextMeeting
    ? "live"
    : baseStatus.canReadCalendar && session?.user?.email
      ? "empty"
      : "fallback"
  const hasUpcomingMeeting = Boolean(nextMeeting)

  let activeRecallRun: MeetingReadinessStatus["activeRecallRun"] = null
  let transcriptSurface: MeetingReadinessStatus["transcriptSurface"] = {
    state: hasUpcomingMeeting ? "pending" : "empty",
    previewLines: [],
    note: hasUpcomingMeeting
      ? "No Google Meet summary or transcript artifacts are attached yet. Relay will only show them after a real artifact path exists."
      : "No upcoming or recorded Google Meet artifact is available yet, so transcript preview stays empty.",
  }
  try {
    const runs = await listMeetingRuns()
    const latestRun = runs[0] ?? null
    if (latestRun) {
      activeRecallRun = latestRun
      const lines = (latestRun.transcriptEntries ?? [])
        .map((e) => (e.speaker ? `${e.speaker}: ${e.text}` : e.text))
        .filter(Boolean)
      if (lines.length > 0) {
        transcriptSurface = {
          state: "available",
          previewLines: lines,
          note: `Transcript from Recall bot (${lines.length} utterance(s)).`,
        }
      } else {
        transcriptSurface = {
          state: latestRun.status === "running" || latestRun.status === "joining" ? "pending" : "empty",
          previewLines: [],
          note: latestRun.providerStatus
            ? `Bot status: ${latestRun.providerStatus}. No transcript received yet.`
            : "No transcript data received yet for this run.",
        }
      }
    }
  } catch {
    // keep default transcriptSurface and activeRecallRun null
  }

  return {
    botIdentity,
    resolutionState,
    overallState: deriveOverallState(checkpoints),
    assumptions: [
      "Relay is Google-first for Gmail, Calendar, and future Meet detection.",
      "Mock fallback stays visible whenever auth is missing or live Google reads fail.",
      "This page never implies a live join or spoken update without real evidence.",
    ],
    manualSteps: [
      "Configure Google OAuth server env vars and ENCRYPTION_KEY.",
      "Connect a Google account in Settings.",
      "Grant Gmail and Calendar readonly scopes for Briefing and Meet discovery.",
      "Create or use a real Calendar event with a Google Meet link if you want live Meet readiness to show up here.",
    ],
    runtimeEvidenceNote:
      "This phase only proves Google connection and Calendar-based Meet discovery readiness. Relay does not yet join meetings or retrieve Meet artifacts.",
    checkpoints,
    nextMeeting,
    lastLinkCheck,
    providerReadiness,
    activeRecallRun,
    customizationSummary: `Future meeting writing is set to ${customization.meetingUpdateStyle.replaceAll(
      "_",
      " "
    )}, ${customization.meetingTone}, ${customization.meetingFormality}, and ${customization.meetingConciseness}.`,
    summarySurface: {
      state: hasUpcomingMeeting ? "pending" : "empty",
      summary: null,
    },
    actionItemsSurface: {
      state: hasUpcomingMeeting ? "pending" : "empty",
      items: [],
    },
    transcriptSurface,
  }
}

export async function getUpcomingMeetingStatus(): Promise<MeetingUpcomingStatus> {
  const session = await getOptionalSession()
  const baseStatus = await getBaseGoogleIntegrationStatus({
    email: session?.user?.email,
    name: session?.user?.name,
    hasSession: Boolean(session?.user?.email),
  })

  if (!baseStatus.canReadCalendar || !session?.user?.email) {
    return {
      state: "fallback",
      detail: "Upcoming Google Meet discovery is using fallback because Calendar auth is not connected yet.",
      upcomingMeeting: null,
    }
  }

  try {
    const events = await withTimeout(
      getLiveCalendarEvents(session.user.email),
      "Upcoming meeting discovery"
    )
    const upcomingMeeting = getUpcomingGoogleMeet(events)

    if (!upcomingMeeting) {
      return {
        state: "fallback",
        detail: "Calendar read is live, but no upcoming Google Meet was found right now.",
        upcomingMeeting: null,
      }
    }

    return {
      state: "validated",
      detail: `Upcoming Google Meet detected from Calendar: ${upcomingMeeting.title}.`,
      upcomingMeeting,
    }
  } catch (error) {
    return {
      state: "fallback",
      detail:
        error instanceof Error
          ? `Live Calendar read failed, so upcoming Meet discovery fell back: ${error.message}`
          : "Live Calendar read failed, so upcoming Meet discovery fell back.",
      upcomingMeeting: null,
    }
  }
}

export function prepareMeetingLinkCheck(targetMeeting: string): MeetingLinkCheckAttempt {
  const trimmedMeeting = targetMeeting.trim()

  if (!trimmedMeeting) {
    lastLinkCheck = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      targetMeeting: "",
      state: "blocked",
      detail: "A Google Meet link is required for readiness validation.",
    }
    return lastLinkCheck
  }

  const isMeetLink =
    trimmedMeeting.includes("meet.google.com/") || trimmedMeeting.includes("https://g.co/meet/")

  if (!isMeetLink) {
    lastLinkCheck = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      targetMeeting: trimmedMeeting,
      state: "blocked",
      detail: "Only Google Meet links are in scope for this pass.",
    }
    return lastLinkCheck
  }

  lastLinkCheck = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    targetMeeting: trimmedMeeting,
    state: "fallback",
    detail:
      "The Meet link format looks valid, but Relay does not join meetings yet in this pass. This only confirms Google Meet readiness, not live attendance.",
  }

  return lastLinkCheck
}

export function getDemoUpcomingGoogleMeet() {
  return null
}

export function eventLooksLikeMeetLink(targetMeeting?: string | null) {
  return Boolean(targetMeeting && isGoogleMeetEvent({
    id: "check",
    title: "Meet link",
    start: new Date().toISOString(),
    end: new Date().toISOString(),
    joinUrl: targetMeeting,
    meetingProvider: targetMeeting.includes("meet.google.com") ? "google_meet" : "other",
  }))
}
