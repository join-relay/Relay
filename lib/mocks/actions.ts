import { clearPersistedActionState, getPersistedActionState, setPersistedActionState } from "@/lib/persistence/action-state"
import type { ActionProvenance, PendingAction } from "@/types"

export type StoredPendingAction = Omit<
  PendingAction,
  "status" | "reviewedContent" | "executedAt" | "executionSummary"
>

function createDemoProvenance(actionId: string): ActionProvenance {
  return {
    provider: "mock",
    sourceType: "demo_fallback",
    origin: "mock",
    sourceIdentifiers: {
      demoActionId: actionId,
    },
  }
}

export const seededActions: StoredPendingAction[] = [
  {
    id: "a1",
    type: "draft_email",
    title: "Draft reply to budget approval email",
    sourceContext: "Re: Q4 budget approval needed by EOD — from finance@company.com",
    provenance: createDemoProvenance("a1"),
    proposedAction: {
      to: "finance@company.com",
      subject: "Re: Q4 budget approval needed by EOD",
      body: "Hi,\n\nI've reviewed the revised numbers and approve the Q4 budget as outlined. Please proceed with the submission before the 3pm cutoff.\n\nBest,\nYassin",
      threadId: "t1",
    },
    urgency: "urgent",
    whySurfaced: "Deadline today; Finance needs sign-off by 3pm cutoff",
    originalContext: {
      kind: "gmail_thread",
      preview:
        "Hi Yassin, can you confirm the revised Q4 budget by end of day so finance can submit it before the cutoff?",
      thread: {
        threadId: "t1",
        subject: "Re: Q4 budget approval needed by EOD",
        preview:
          "Hi Yassin, can you confirm the revised Q4 budget by end of day so finance can submit it before the cutoff?",
        participants: ["finance@company.com", "yassin@company.com"],
        referenceMessageIds: ["<demo-finance-thread-1@relay.mock>"],
        messages: [
          {
            id: "m1",
            from: "finance@company.com",
            to: "yassin@company.com",
            date: new Date().toISOString(),
            snippet: "Can you confirm the revised Q4 budget by end of day?",
            bodyPreview:
              "Hi Yassin,\n\nCan you confirm the revised Q4 budget by end of day so finance can submit it before the 3pm cutoff?\n\nThanks,\nFinance",
            rfcMessageId: "<demo-finance-thread-1@relay.mock>",
            referenceMessageIds: [],
          },
        ],
      },
    },
    personalization: {
      styleSource: "settings_only",
      settingsApplied: true,
      summary: "Saved settings + default style: professional/balanced, brief, best sign-off",
      generation: {
        source: "deterministic_fallback",
        finalDraftSource: "deterministic_fallback",
        generatedAt: new Date().toISOString(),
        openAIConfigured: false,
        attemptedOpenAI: false,
        usedOriginalThreadContext: true,
        usedSentMailStyle: false,
        usedSavedSettings: true,
        styleSampleCount: 0,
        fallbackReason: "OpenAI is not configured for demo fallback data",
        note: "Deterministic fallback drafted this reply because OpenAI is not configured for demo fallback data.",
      },
    },
    createdAt: new Date().toISOString(),
  },
  {
    id: "a2",
    type: "reschedule_meeting",
    title: "Reschedule conflicting 1:1 with Sarah",
    sourceContext: "1:1 with Sarah conflicts with Budget Review at 10:30",
    provenance: createDemoProvenance("a2"),
    proposedAction: {
      eventId: "e2b",
      eventTitle: "1:1 with Sarah",
      currentStart: "2024-03-14T10:30:00",
      currentEnd: "2024-03-14T11:00:00",
      proposedStart: "2024-03-14T11:30:00",
      proposedEnd: "2024-03-14T12:00:00",
    },
    originalContext: {
      kind: "calendar_event",
      preview: "1:1 with Sarah currently runs 10:30 AM to 11:00 AM and overlaps with Budget Review.",
      title: "1:1 with Sarah",
      currentStart: "2024-03-14T10:30:00",
      currentEnd: "2024-03-14T11:00:00",
      location: "Conference Room B",
    },
    urgency: "urgent",
    whySurfaced: "Two meetings overlap at 10:30; Budget Review is higher priority",
    createdAt: new Date().toISOString(),
  },
  {
    id: "a3",
    type: "draft_email",
    title: "Reply to Sarah's lunch reschedule request",
    sourceContext: "Lunch with Sarah - reschedule? — from sarah@company.com",
    provenance: createDemoProvenance("a3"),
    proposedAction: {
      to: "sarah@company.com",
      subject: "Re: Lunch with Sarah - reschedule?",
      body: "Hey Sarah,\n\nNo problem—tomorrow at 1pm works for me. See you then!\n\nYassin",
      threadId: "t3",
    },
    urgency: "low",
    whySurfaced: "Sarah requested to move lunch; can respond after urgent items",
    originalContext: {
      kind: "gmail_thread",
      preview: "Hey Yassin, does tomorrow at 1pm work instead for lunch?",
      thread: {
        threadId: "t3",
        subject: "Lunch with Sarah - reschedule?",
        preview: "Hey Yassin, does tomorrow at 1pm work instead for lunch?",
        participants: ["sarah@company.com", "yassin@company.com"],
        referenceMessageIds: ["<demo-sarah-thread-1@relay.mock>"],
        messages: [
          {
            id: "m3",
            from: "sarah@company.com",
            to: "yassin@company.com",
            date: new Date().toISOString(),
            snippet: "Does tomorrow at 1pm work instead?",
            bodyPreview:
              "Hey Yassin,\n\nDoes tomorrow at 1pm work instead for lunch? Something came up on my side.\n\nThanks,\nSarah",
            rfcMessageId: "<demo-sarah-thread-1@relay.mock>",
            referenceMessageIds: [],
          },
        ],
      },
    },
    personalization: {
      styleSource: "settings_only",
      settingsApplied: true,
      summary: "Saved settings + default style: professional/balanced, brief, best sign-off",
      generation: {
        source: "deterministic_fallback",
        finalDraftSource: "deterministic_fallback",
        generatedAt: new Date().toISOString(),
        openAIConfigured: false,
        attemptedOpenAI: false,
        usedOriginalThreadContext: true,
        usedSentMailStyle: false,
        usedSavedSettings: true,
        styleSampleCount: 0,
        fallbackReason: "OpenAI is not configured for demo fallback data",
        note: "Deterministic fallback drafted this reply because OpenAI is not configured for demo fallback data.",
      },
    },
    createdAt: new Date().toISOString(),
  },
]

export interface ActionStoreEntry {
  status: "pending" | "approved" | "rejected"
  sourceFingerprint: string
  reviewedContent?: PendingAction["proposedAction"]
  executedAt?: string
  executionSummary?: string
}

declare global {
  // eslint-disable-next-line no-var
  var __relayActionBaseStore: Map<string, StoredPendingAction> | undefined
}

function getActionBaseStore() {
  globalThis.__relayActionBaseStore ??= new Map()
  return globalThis.__relayActionBaseStore
}

function formatExecutionTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    })
  } catch {
    return iso
  }
}

export function getActionStatus(id: string): ActionStoreEntry | undefined {
  return getPersistedActionState(id)
}

export function rememberActionBases(actions: StoredPendingAction[]) {
  const store = getActionBaseStore()
  for (const action of actions) {
    store.set(action.id, action)
  }
}

export function getStoredActionById(id: string): StoredPendingAction | undefined {
  return getActionBaseStore().get(id) ?? seededActions.find((action) => action.id === id)
}

export function getStoredActions(): StoredPendingAction[] {
  return Array.from(getActionBaseStore().values())
}

function getActionSourceFingerprint(action: StoredPendingAction): string {
  if (action.type === "draft_email") {
    const payload = action.proposedAction as PendingAction["proposedAction"] & { threadId?: string }
    const threadContext =
      action.originalContext?.kind === "gmail_thread" ? action.originalContext.thread : undefined

    return JSON.stringify({
      type: action.type,
      actionId: action.id,
      threadId: payload.threadId ?? action.provenance.sourceIdentifiers?.gmailThreadId ?? "",
      messageId:
        action.provenance.sourceIdentifiers?.gmailMessageId ??
        threadContext?.messages.at(-1)?.id ??
        "",
      preview: action.originalContext?.preview ?? "",
    })
  }

  const payload = action.proposedAction
  return JSON.stringify({
    type: action.type,
    actionId: action.id,
    eventId:
      action.provenance.sourceIdentifiers?.calendarEventId ??
      ("eventId" in payload ? payload.eventId : ""),
    currentStart: action.originalContext?.kind === "calendar_event" ? action.originalContext.currentStart : "",
    currentEnd: action.originalContext?.kind === "calendar_event" ? action.originalContext.currentEnd : "",
    proposedStart: "proposedStart" in payload ? payload.proposedStart : "",
    proposedEnd: "proposedEnd" in payload ? payload.proposedEnd : "",
  })
}

export function setActionApproved(
  id: string,
  base: StoredPendingAction,
  reviewedContent: PendingAction["proposedAction"],
  executionSummary?: string
): { executedAt: string; executionSummary: string } {
  const executedAt = new Date().toISOString()
  const summary =
    executionSummary ??
    (reviewedContent && "subject" in reviewedContent
      ? `Reply sent to ${(reviewedContent as { to?: string }).to ?? "recipient"}`
      : reviewedContent && "eventTitle" in reviewedContent
        ? `${(reviewedContent as { eventTitle: string; proposedStart: string }).eventTitle} rescheduled to ${formatExecutionTime((reviewedContent as { proposedStart: string }).proposedStart)}`
        : "Action executed")
  setPersistedActionState(id, {
    status: "approved",
    sourceFingerprint: getActionSourceFingerprint(base),
    reviewedContent,
    executedAt,
    executionSummary: summary,
  })
  return { executedAt, executionSummary: summary }
}

export function setActionRejected(id: string, base: StoredPendingAction): void {
  setPersistedActionState(id, {
    status: "rejected",
    sourceFingerprint: getActionSourceFingerprint(base),
  })
}

export function setActionEditedContent(
  id: string,
  base: StoredPendingAction,
  reviewedContent: PendingAction["proposedAction"]
): void {
  setPersistedActionState(id, {
    status: "pending",
    sourceFingerprint: getActionSourceFingerprint(base),
    reviewedContent,
  })
}

export function mergeActionWithStore(base: StoredPendingAction): PendingAction {
  const entry = getPersistedActionState(base.id)
  const sourceFingerprint = getActionSourceFingerprint(base)
  if (entry && entry.sourceFingerprint !== sourceFingerprint) {
    clearPersistedActionState(base.id)
  }
  const current = entry?.sourceFingerprint === sourceFingerprint ? entry : undefined
  const status = current?.status ?? "pending"
  return {
    ...base,
    status,
    reviewedContent: current?.reviewedContent,
    executedAt: current?.executedAt,
    executionSummary: current?.executionSummary,
  }
}

export function getAllActions(): PendingAction[] {
  return seededActions.map(mergeActionWithStore)
}

export function resetRememberedActionBases() {
  globalThis.__relayActionBaseStore = new Map()
}
