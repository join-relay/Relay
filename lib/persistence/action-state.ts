import "server-only"

import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import type { PendingAction } from "@/types"

const STORE_DIR = path.join(process.cwd(), ".relay")
const STORE_FILE = path.join(STORE_DIR, "action-state.json")

export interface PersistedActionState {
  status: "pending" | "approved" | "rejected"
  sourceFingerprint: string
  reviewedContent?: PendingAction["proposedAction"]
  executedAt?: string
  executionSummary?: string
  updatedAt: string
}

type ActionStateStore = Record<string, PersistedActionState>

declare global {
  // eslint-disable-next-line no-var
  var __relayPersistedActionStateStore: ActionStateStore | undefined
}

function readStoreFromDisk(): ActionStateStore {
  try {
    const raw = readFileSync(STORE_FILE, "utf8")
    const parsed = JSON.parse(raw) as Record<string, Partial<PersistedActionState>>

    return Object.fromEntries(
      Object.entries(parsed).flatMap(([actionId, value]) => {
        if (!value || typeof value !== "object") return []
        if (
          value.status !== "pending" &&
          value.status !== "approved" &&
          value.status !== "rejected"
        ) {
          return []
        }
        if (typeof value.sourceFingerprint !== "string") return []

        return [
          [
            actionId,
            {
              status: value.status,
              sourceFingerprint: value.sourceFingerprint,
              reviewedContent: value.reviewedContent,
              executedAt: value.executedAt,
              executionSummary: value.executionSummary,
              updatedAt:
                typeof value.updatedAt === "string" ? value.updatedAt : new Date(0).toISOString(),
            } satisfies PersistedActionState,
          ],
        ]
      })
    )
  } catch (error) {
    const isMissing =
      error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT"
    if (isMissing) return {}
    console.error("Failed to read action state store:", error)
    return {}
  }
}

function getStore() {
  globalThis.__relayPersistedActionStateStore ??= readStoreFromDisk()
  return globalThis.__relayPersistedActionStateStore
}

function persistStore(store: ActionStateStore) {
  mkdirSync(STORE_DIR, { recursive: true })
  writeFileSync(STORE_FILE, JSON.stringify(store, null, 2), "utf8")
}

export function getPersistedActionState(actionId: string) {
  return getStore()[actionId]
}

export function setPersistedActionState(actionId: string, value: Omit<PersistedActionState, "updatedAt">) {
  const store = getStore()
  store[actionId] = {
    ...value,
    updatedAt: new Date().toISOString(),
  }
  persistStore(store)
  return store[actionId]
}

export function clearPersistedActionState(actionId: string) {
  const store = getStore()
  if (!(actionId in store)) return
  delete store[actionId]
  persistStore(store)
}

export function resetPersistedActionState() {
  globalThis.__relayPersistedActionStateStore = {}
  persistStore(globalThis.__relayPersistedActionStateStore)
}
