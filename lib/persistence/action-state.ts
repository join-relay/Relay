import "server-only"

import { getStore, setStore } from "@/lib/persistence/store-backend"
import type { PendingAction } from "@/types"

const STORE_KEY = "action-state"

export interface PersistedActionState {
  status: "pending" | "approved" | "rejected"
  sourceFingerprint: string
  reviewedContent?: PendingAction["proposedAction"]
  executedAt?: string
  executionSummary?: string
  updatedAt: string
}

type ActionStateStore = Record<string, PersistedActionState>

async function loadStore(): Promise<ActionStateStore> {
  const raw = await getStore(STORE_KEY)
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return {}
  const parsed = raw as Record<string, unknown>
  const out: ActionStateStore = {}
  for (const [actionId, value] of Object.entries(parsed)) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue
    const v = value as Record<string, unknown>
    if (
      v.status !== "pending" &&
      v.status !== "approved" &&
      v.status !== "rejected"
    )
      continue
    if (typeof v.sourceFingerprint !== "string") continue
    out[actionId] = {
      status: v.status,
      sourceFingerprint: v.sourceFingerprint,
      reviewedContent: v.reviewedContent as PersistedActionState["reviewedContent"],
      executedAt: typeof v.executedAt === "string" ? v.executedAt : undefined,
      executionSummary:
        typeof v.executionSummary === "string" ? v.executionSummary : undefined,
      updatedAt:
        typeof v.updatedAt === "string" ? v.updatedAt : new Date(0).toISOString(),
    }
  }
  return out
}

async function saveStore(store: ActionStateStore): Promise<void> {
  await setStore(STORE_KEY, store)
}

export async function getPersistedActionState(
  actionId: string
): Promise<PersistedActionState | undefined> {
  const store = await loadStore()
  return store[actionId]
}

export async function setPersistedActionState(
  actionId: string,
  value: Omit<PersistedActionState, "updatedAt">
): Promise<PersistedActionState> {
  const store = await loadStore()
  const entry: PersistedActionState = {
    ...value,
    updatedAt: new Date().toISOString(),
  }
  store[actionId] = entry
  await saveStore(store)
  return entry
}

export async function clearPersistedActionState(actionId: string): Promise<void> {
  const store = await loadStore()
  if (!(actionId in store)) return
  delete store[actionId]
  await saveStore(store)
}

export async function resetPersistedActionState(): Promise<void> {
  await saveStore({})
}
