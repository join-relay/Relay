import { getOptionalSession } from "@/auth"
import {
  getConflictingEvents,
  getLiveCalendarEvents,
  isGoogleMeetEvent,
  patchCalendarEvent,
} from "@/lib/services/calendar"
import { getLiveGmailThreads, sendEmail } from "@/lib/services/gmail"
import { getBaseGoogleIntegrationStatus } from "@/lib/services/google-auth"
import {
  getActionStatus,
  getStoredActionById,
  getStoredActions,
  mergeActionWithStore,
  rememberActionBases,
  seededActions,
  setActionApproved,
  setActionEditedContent,
  setActionRejected,
} from "@/lib/mocks/actions"
import { appendActionExecution } from "@/lib/persistence/action-executions"
import type {
  ActionExecutionRecord,
  ActionType,
  ActionsViewState,
  CalendarEvent,
  DraftEmailPayload,
  GmailThread,
  PendingAction,
  RescheduleMeetingPayload,
} from "@/types"

type ReviewedContent = DraftEmailPayload | RescheduleMeetingPayload
type PendingActionBase = Omit<
  PendingAction,
  "status" | "reviewedContent" | "executedAt" | "executionSummary"
>

const DEMO_SIGNATURE_NAME = "Yassin"
const LIVE_EMAIL_ACTION_PREFIX = "gmail:"
const LIVE_CALENDAR_ACTION_PREFIX = "calendar:"

function parseEmailAddress(from: string) {
  const bracketMatch = from.match(/<([^>]+)>/)
  if (bracketMatch?.[1]) return bracketMatch[1].trim().toLowerCase()

  const emailMatch = from.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)
  return emailMatch?.[0]?.toLowerCase()
}

function parseSenderName(from: string) {
  const cleaned = from.replace(/<[^>]+>/g, "").replaceAll('"', "").trim()
  if (cleaned) {
    return cleaned.split(/\s+/)[0]
  }

  const email = parseEmailAddress(from)
  if (!email) return "there"
  return email.split("@")[0]?.split(/[._-]/)[0] ?? "there"
}

function normalizeReplySubject(subject: string) {
  return /^re:/i.test(subject) ? subject : `Re: ${subject}`
}

function getThreadKeywordScore(thread: GmailThread) {
  const text = `${thread.subject} ${thread.snippet}`.toLowerCase()
  let score = 0
  if (/(urgent|asap|eod|today|deadline|approve|approval|confirm|follow up|follow-up)/.test(text)) {
    score += 4
  }
  if (/(question|\?)/.test(text)) score += 2
  if (/(resched|move|availability|calendar|meeting)/.test(text)) score += 1
  return score
}

function getEmailUrgency(score: number, thread: GmailThread): PendingAction["urgency"] {
  if (thread.isUnread && score >= 4) return "urgent"
  if (thread.isUnread || score >= 3) return "important"
  return "low"
}

function buildDraftBody(thread: GmailThread, displayName: string) {
  const senderName = parseSenderName(thread.from)
  const subject = thread.subject === "(No subject)" ? "your note" : thread.subject
  const mentionsUrgency = /(urgent|asap|eod|today|deadline|approve|approval)/i.test(
    `${thread.subject} ${thread.snippet}`
  )
  const responseLine = mentionsUrgency
    ? `Thanks for the note about ${subject}. I saw it and will follow up today.`
    : `Thanks for the email about ${subject}. I saw it and will follow up shortly.`

  return `Hi ${senderName},\n\n${responseLine}\n\nBest,\n${displayName}`
}

function buildEmailWhySurfaced(thread: GmailThread, score: number) {
  const reasons = []
  if (thread.isUnread) reasons.push("it is unread")
  if (score >= 4) reasons.push("the subject/snippet looks time-sensitive")
  if (/\?/.test(`${thread.subject} ${thread.snippet}`)) reasons.push("it appears to need a reply")

  if (reasons.length === 0) {
    reasons.push("it is a recent inbox thread that looks reply-worthy")
  }

  return `Live Gmail heuristic surfaced this thread because ${reasons.join(", ")}.`
}

function deriveLiveDraftEmailActions(
  threads: GmailThread[],
  displayName: string
): PendingActionBase[] {
  const candidates: Array<{
    action: PendingActionBase
    isStrongCandidate: boolean
  }> = []

  for (const thread of threads) {
      const to = parseEmailAddress(thread.from)
      const score = getThreadKeywordScore(thread) + (thread.isUnread ? 6 : 0)
      if (!to || /(no-?reply|noreply|notifications?@|mailer-daemon)/i.test(to)) {
        continue
      }

      candidates.push({
        action: {
          id: `${LIVE_EMAIL_ACTION_PREFIX}${thread.id}`,
          type: "draft_email" as const,
          title: `Draft reply to ${thread.subject}`,
          sourceContext: `${thread.subject} - from ${thread.from}`,
          proposedAction: {
            to,
            subject: normalizeReplySubject(thread.subject),
            body: buildDraftBody(thread, displayName),
            threadId: thread.id,
          },
          urgency: getEmailUrgency(score, thread),
          whySurfaced: buildEmailWhySurfaced(thread, score),
          createdAt: thread.date,
        } satisfies PendingActionBase,
        isStrongCandidate: thread.isUnread || score >= 3,
      })
  }

  candidates.sort((left, right) => {
    const urgencyRank = { urgent: 3, important: 2, low: 1 }
    const urgencyDelta = urgencyRank[right.action.urgency] - urgencyRank[left.action.urgency]
    if (urgencyDelta !== 0) return urgencyDelta
    return new Date(right.action.createdAt).getTime() - new Date(left.action.createdAt).getTime()
  })

  const strongCandidates = candidates
    .filter((candidate) => candidate.isStrongCandidate)
    .map((candidate) => candidate.action)

  if (strongCandidates.length > 0) {
    return strongCandidates.slice(0, 2)
  }

  return candidates.slice(0, 1).map((candidate) => ({
    ...candidate.action,
    urgency: candidate.action.urgency === "low" ? "important" : candidate.action.urgency,
    whySurfaced:
      "Live Gmail fallback surfaced the most recent real inbox thread that still looks safe to draft against.",
  }))
}

function overlaps(left: { start: string; end: string }, right: { start: string; end: string }) {
  return new Date(left.start).getTime() < new Date(right.end).getTime() &&
    new Date(right.start).getTime() < new Date(left.end).getTime()
}

function findNextAvailableSlot(target: CalendarEvent, events: CalendarEvent[], earliestStart: number) {
  const durationMs =
    new Date(target.end).getTime() - new Date(target.start).getTime()
  if (durationMs <= 0) return null

  const sorted = [...events]
    .filter((event) => !event.isAllDay)
    .sort((left, right) => new Date(left.start).getTime() - new Date(right.start).getTime())

  let candidateStart = earliestStart
  let candidateEnd = candidateStart + durationMs

  for (const event of sorted) {
    if (event.id === target.id) continue

    const eventStart = new Date(event.start).getTime()
    const eventEnd = new Date(event.end).getTime()
    if (eventEnd <= candidateStart) continue

    if (eventStart < candidateEnd && candidateStart < eventEnd) {
      candidateStart = eventEnd
      candidateEnd = candidateStart + durationMs
    }
  }

  const dayBoundary = new Date(target.start)
  dayBoundary.setHours(23, 59, 59, 999)
  if (candidateEnd > dayBoundary.getTime()) {
    return null
  }

  return {
    proposedStart: new Date(candidateStart).toISOString(),
    proposedEnd: new Date(candidateEnd).toISOString(),
  }
}

function chooseEventToMove(left: CalendarEvent, right: CalendarEvent) {
  if (isGoogleMeetEvent(left) && !isGoogleMeetEvent(right)) {
    return { eventToMove: right, blockingEvent: left }
  }
  if (isGoogleMeetEvent(right) && !isGoogleMeetEvent(left)) {
    return { eventToMove: left, blockingEvent: right }
  }

  const leftStart = new Date(left.start).getTime()
  const rightStart = new Date(right.start).getTime()
  return leftStart <= rightStart
    ? { eventToMove: right, blockingEvent: left }
    : { eventToMove: left, blockingEvent: right }
}

function deriveLiveRescheduleActions(events: CalendarEvent[]): PendingActionBase[] {
  const sorted = [...events]
    .filter((event) => !event.isAllDay && new Date(event.end).getTime() >= Date.now())
    .sort((left, right) => new Date(left.start).getTime() - new Date(right.start).getTime())

  for (let index = 0; index < sorted.length - 1; index += 1) {
    const current = sorted[index]
    const next = sorted[index + 1]
    if (!current || !next || !overlaps(current, next)) continue

    const { eventToMove, blockingEvent } = chooseEventToMove(current, next)
    const slot = findNextAvailableSlot(
      eventToMove,
      sorted,
      Math.max(new Date(eventToMove.start).getTime(), new Date(blockingEvent.end).getTime())
    )

    if (!slot) continue

    return [
      {
        id: `${LIVE_CALENDAR_ACTION_PREFIX}${eventToMove.id}`,
        type: "reschedule_meeting",
        title: `Reschedule ${eventToMove.title}`,
        sourceContext: `${eventToMove.title} overlaps with ${blockingEvent.title}`,
        proposedAction: {
          eventId: eventToMove.id,
          eventTitle: eventToMove.title,
          currentStart: eventToMove.start,
          currentEnd: eventToMove.end,
          proposedStart: slot.proposedStart,
          proposedEnd: slot.proposedEnd,
        },
        urgency: "urgent",
        whySurfaced: `Live Calendar conflict detection found a real overlap with ${blockingEvent.title}.`,
        createdAt: eventToMove.start,
      } satisfies PendingActionBase,
    ]
  }

  return []
}

function isLiveAction(action: PendingActionBase) {
  return (
    action.id.startsWith(LIVE_EMAIL_ACTION_PREFIX) ||
    action.id.startsWith(LIVE_CALENDAR_ACTION_PREFIX)
  )
}

function hydrateActions(actions: PendingActionBase[], source: ActionsViewState["source"]) {
  rememberActionBases(actions)
  const merged = actions.map(mergeActionWithStore)

  if (source !== "google") {
    return merged
  }

  const seen = new Set(actions.map((action) => action.id))
  const carried = getStoredActions()
    .filter((action) => isLiveAction(action) && !seen.has(action.id) && getActionStatus(action.id))
    .map(mergeActionWithStore)

  return [...merged, ...carried].sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
  )
}

function buildMockActionResult(statusNote: string) {
  return {
    actions: hydrateActions(seededActions, "mock"),
    viewState: {
      source: "mock" as const,
      statusNote,
    },
  }
}

async function deriveActionsData() {
  const session = await getOptionalSession()
  const googleStatus = await getBaseGoogleIntegrationStatus({
    email: session?.user?.email,
    name: session?.user?.name,
    hasSession: Boolean(session?.user?.email),
  })

  if (!googleStatus.canUseLiveBriefing || !session?.user?.email) {
    return buildMockActionResult(googleStatus.note)
  }

  try {
    const displayName = session.user.name ?? googleStatus.displayName ?? DEMO_SIGNATURE_NAME
    const [threads, rawEvents] = await Promise.all([
      getLiveGmailThreads(session.user.email, 10),
      getLiveCalendarEvents(session.user.email),
    ])
    const events = getConflictingEvents(rawEvents)
    const liveActions = [
      ...deriveLiveDraftEmailActions(threads, displayName),
      ...deriveLiveRescheduleActions(events),
    ]

    if (liveActions.length === 0) {
      return buildMockActionResult(
        "Relay could not derive a live Gmail reply or Calendar reschedule from the current Google data, so it is showing explicit demo fallback actions."
      )
    }

    return {
      actions: hydrateActions(liveActions, "google"),
      viewState: {
        source: "google" as const,
        statusNote: "Live Gmail and Calendar data are active for these actions.",
      },
    }
  } catch (error) {
    return buildMockActionResult(
      error instanceof Error
        ? `Live Google action sourcing failed, so Relay fell back to explicit demo actions: ${error.message}`
        : "Live Google action sourcing failed, so Relay fell back to explicit demo actions."
    )
  }
}

async function getActionBaseById(id: string): Promise<PendingActionBase | null> {
  const stored = getStoredActionById(id)
  if (stored) return stored

  await deriveActionsData()
  return getStoredActionById(id) ?? null
}

/** Replaces demo name in email bodies with the given display name (for personalized display when user is connected). */
export function substituteDisplayNameInActions(
  actions: PendingAction[],
  displayName: string
): PendingAction[] {
  if (!displayName || displayName === DEMO_SIGNATURE_NAME) return actions
  return actions.map((action) => {
    const out = { ...action }
    if (action.proposedAction && "body" in action.proposedAction) {
      out.proposedAction = {
        ...action.proposedAction,
        body: (action.proposedAction as DraftEmailPayload).body.replaceAll(
          DEMO_SIGNATURE_NAME,
          displayName
        ),
      }
    }
    if (out.reviewedContent && "body" in out.reviewedContent) {
      out.reviewedContent = {
        ...out.reviewedContent,
        body: (out.reviewedContent as DraftEmailPayload).body.replaceAll(
          DEMO_SIGNATURE_NAME,
          displayName
        ),
      }
    }
    return out
  })
}

export async function listActions(): Promise<{
  actions: PendingAction[]
  viewState: ActionsViewState
}> {
  return await deriveActionsData()
}

export async function updateActionContent(
  id: string,
  content: ReviewedContent
): Promise<PendingAction | null> {
  const base = await getActionBaseById(id)
  if (!base) return null

  const entry = getActionStatus(id)
  if (entry?.status === "approved" || entry?.status === "rejected") {
    throw new Error("Cannot edit approved or rejected action")
  }

  setActionEditedContent(id, content)
  return mergeActionWithStore(base)
}

function isDraftEmailPayload(
  p: DraftEmailPayload | RescheduleMeetingPayload
): p is DraftEmailPayload {
  return "subject" in p && "body" in p
}

function isReschedulePayload(
  p: DraftEmailPayload | RescheduleMeetingPayload
): p is RescheduleMeetingPayload {
  return "eventId" in p && "proposedStart" in p && "proposedEnd" in p
}

export async function approveAction(
  id: string,
  content?: ReviewedContent
): Promise<PendingAction | null> {
  const base = await getActionBaseById(id)
  if (!base) return null

  const entry = getActionStatus(id)
  if (entry?.status === "approved") {
    throw new Error("Action already approved")
  }
  if (entry?.status === "rejected") {
    throw new Error("Cannot approve rejected action")
  }

  const contentToExecute = content ?? entry?.reviewedContent ?? base.proposedAction
  const session = await getOptionalSession()
  const userEmail = session?.user?.email ?? null
  const shouldExecuteLive = Boolean(userEmail && isLiveAction(base))

  const record: Omit<ActionExecutionRecord, "id" | "executedAt" | "status" | "errorMessage"> = {
    actionId: id,
    type: base.type as ActionType,
    title: base.title,
    proposedPayload: contentToExecute,
    userEmail,
    source: shouldExecuteLive ? "live" : "mock",
  }

  if (shouldExecuteLive && base.type === "draft_email" && isDraftEmailPayload(contentToExecute)) {
    try {
      await sendEmail(userEmail, {
        to: contentToExecute.to,
        subject: contentToExecute.subject,
        body: contentToExecute.body,
        threadId: contentToExecute.threadId,
      })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Gmail send failed"
      await appendActionExecution({
        ...record,
        id: crypto.randomUUID(),
        executedAt: new Date().toISOString(),
        status: "failed",
        errorMessage,
      })
      throw new Error(`Send failed: ${errorMessage}`)
    }
  } else if (
    shouldExecuteLive &&
    base.type === "reschedule_meeting" &&
    isReschedulePayload(contentToExecute)
  ) {
    try {
      await patchCalendarEvent(
        userEmail,
        contentToExecute.eventId,
        contentToExecute.proposedStart,
        contentToExecute.proposedEnd
      )
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Calendar patch failed"
      await appendActionExecution({
        ...record,
        id: crypto.randomUUID(),
        executedAt: new Date().toISOString(),
        status: "failed",
        errorMessage,
      })
      throw new Error(`Reschedule failed: ${errorMessage}`)
    }
  }

  const { executedAt, executionSummary } = setActionApproved(id, contentToExecute)
  await appendActionExecution({
    ...record,
    id: crypto.randomUUID(),
    executedAt,
    status: "success",
  })
  const updated = mergeActionWithStore(base)
  return {
    ...updated,
    executedAt,
    executionSummary,
  }
}

export async function rejectAction(id: string): Promise<PendingAction | null> {
  const base = await getActionBaseById(id)
  if (!base) return null

  const entry = getActionStatus(id)
  if (entry?.status === "approved") {
    throw new Error("Cannot reject approved action")
  }

  setActionRejected(id)
  return mergeActionWithStore(base)
}
