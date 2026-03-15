import type { PendingAction } from "@/types"

export type StoredPendingAction = Omit<
  PendingAction,
  "status" | "reviewedContent" | "executedAt" | "executionSummary"
>

export const seededActions: StoredPendingAction[] = [
  {
    id: "a1",
    type: "draft_email",
    title: "Draft reply to budget approval email",
    sourceContext: "Re: Q4 budget approval needed by EOD — from finance@company.com",
    proposedAction: {
      to: "finance@company.com",
      subject: "Re: Q4 budget approval needed by EOD",
      body: "Hi,\n\nI've reviewed the revised numbers and approve the Q4 budget as outlined. Please proceed with the submission before the 3pm cutoff.\n\nBest,\nYassin",
      threadId: "t1",
    },
    urgency: "urgent",
    whySurfaced: "Deadline today; Finance needs sign-off by 3pm cutoff",
    createdAt: new Date().toISOString(),
  },
  {
    id: "a2",
    type: "reschedule_meeting",
    title: "Reschedule conflicting 1:1 with Sarah",
    sourceContext: "1:1 with Sarah conflicts with Budget Review at 10:30",
    proposedAction: {
      eventId: "e2b",
      eventTitle: "1:1 with Sarah",
      currentStart: "2024-03-14T10:30:00",
      currentEnd: "2024-03-14T11:00:00",
      proposedStart: "2024-03-14T11:30:00",
      proposedEnd: "2024-03-14T12:00:00",
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
    proposedAction: {
      to: "sarah@company.com",
      subject: "Re: Lunch with Sarah - reschedule?",
      body: "Hey Sarah,\n\nNo problem—tomorrow at 1pm works for me. See you then!\n\nYassin",
      threadId: "t3",
    },
    urgency: "low",
    whySurfaced: "Sarah requested to move lunch; can respond after urgent items",
    createdAt: new Date().toISOString(),
  },
]

/** In-memory action state persists across API calls during the dev server lifetime. */
export interface ActionStoreEntry {
  status: "pending" | "approved" | "rejected"
  reviewedContent?: PendingAction["proposedAction"]
  executedAt?: string
  executionSummary?: string
}

const actionStore = new Map<string, ActionStoreEntry>()

declare global {
  // eslint-disable-next-line no-var
  var __relayActionBaseStore: Map<string, StoredPendingAction> | undefined
}

function getActionBaseStore() {
  globalThis.__relayActionBaseStore ??= new Map()
  return globalThis.__relayActionBaseStore
}

function getEntry(id: string): ActionStoreEntry | undefined {
  return actionStore.get(id)
}

function setEntry(id: string, entry: ActionStoreEntry): void {
  actionStore.set(id, entry)
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
  return getEntry(id)
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

export function setActionApproved(
  id: string,
  reviewedContent: PendingAction["proposedAction"]
): { executedAt: string; executionSummary: string } {
  const executedAt = new Date().toISOString()
  const summary =
    reviewedContent && "subject" in reviewedContent
      ? `Reply sent to ${(reviewedContent as { to?: string }).to ?? "recipient"}`
      : reviewedContent && "eventTitle" in reviewedContent
        ? `${(reviewedContent as { eventTitle: string; proposedStart: string }).eventTitle} rescheduled to ${formatExecutionTime((reviewedContent as { proposedStart: string }).proposedStart)}`
        : "Action executed"
  setEntry(id, {
    status: "approved",
    reviewedContent,
    executedAt,
    executionSummary: summary,
  })
  return { executedAt, executionSummary: summary }
}

export function setActionRejected(id: string): void {
  setEntry(id, { status: "rejected" })
}

export function setActionEditedContent(
  id: string,
  reviewedContent: PendingAction["proposedAction"]
): void {
  setEntry(id, {
    status: "pending",
    reviewedContent,
  })
}

export function mergeActionWithStore(base: StoredPendingAction): PendingAction {
  const entry = getEntry(base.id)
  const status = entry?.status ?? "pending"
  return {
    ...base,
    status,
    reviewedContent: entry?.reviewedContent,
    executedAt: entry?.executedAt,
    executionSummary: entry?.executionSummary,
  }
}

export function getAllActions(): PendingAction[] {
  return seededActions.map(mergeActionWithStore)
}
