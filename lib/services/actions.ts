import {
  getActionStatus,
  getAllActions,
  getSeededActionById,
  mergeActionWithStore,
  setActionApproved,
  setActionEditedContent,
  setActionRejected,
} from "@/lib/mocks/actions"
import type { DraftEmailPayload, PendingAction, RescheduleMeetingPayload } from "@/types"

type ReviewedContent = DraftEmailPayload | RescheduleMeetingPayload

export async function listActions(): Promise<PendingAction[]> {
  return getAllActions()
}

export async function updateActionContent(
  id: string,
  content: ReviewedContent
): Promise<PendingAction | null> {
  const base = getSeededActionById(id)
  if (!base) return null

  const entry = getActionStatus(id)
  if (entry?.status === "approved" || entry?.status === "rejected") {
    throw new Error("Cannot edit approved or rejected action")
  }

  setActionEditedContent(id, content)
  return mergeActionWithStore(base)
}

export async function approveAction(
  id: string,
  content?: ReviewedContent
): Promise<PendingAction | null> {
  const base = getSeededActionById(id)
  if (!base) return null

  const entry = getActionStatus(id)
  if (entry?.status === "approved") {
    throw new Error("Action already approved")
  }
  if (entry?.status === "rejected") {
    throw new Error("Cannot approve rejected action")
  }

  const contentToExecute = content ?? entry?.reviewedContent ?? base.proposedAction
  const { executedAt, executionSummary } = setActionApproved(id, contentToExecute)
  const updated = mergeActionWithStore(base)

  return {
    ...updated,
    executedAt,
    executionSummary,
  }
}

export async function rejectAction(id: string): Promise<PendingAction | null> {
  const base = getSeededActionById(id)
  if (!base) return null

  const entry = getActionStatus(id)
  if (entry?.status === "approved") {
    throw new Error("Cannot reject approved action")
  }

  setActionRejected(id)
  return mergeActionWithStore(base)
}
