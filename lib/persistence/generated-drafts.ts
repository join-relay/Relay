import "server-only"

import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import type { DraftGenerationMetadata } from "@/types"

const STORE_DIR = path.join(process.cwd(), ".relay")
const STORE_FILE = path.join(STORE_DIR, "generated-drafts.json")

export interface GeneratedDraftRecord {
  actionId: string
  userEmail: string
  threadId: string
  cacheKey: string
  body: string
  generation: DraftGenerationMetadata
  updatedAt: string
}

type DraftStore = Record<string, Record<string, GeneratedDraftRecord>>

function normalizeEmail(email?: string | null) {
  return email?.trim().toLowerCase() ?? null
}

function normalizeRecord(
  userEmail: string,
  actionId: string,
  value: Partial<GeneratedDraftRecord>
): GeneratedDraftRecord | null {
  if (typeof value.body !== "string" || typeof value.cacheKey !== "string") return null
  if (!value.generation || typeof value.generation !== "object") return null

  return {
    actionId,
    userEmail,
    threadId: typeof value.threadId === "string" ? value.threadId : "",
    cacheKey: value.cacheKey,
    body: value.body,
    generation: value.generation as DraftGenerationMetadata,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : new Date(0).toISOString(),
  }
}

async function readStore(): Promise<DraftStore> {
  try {
    const raw = await readFile(STORE_FILE, "utf8")
    const parsed = JSON.parse(raw) as Record<string, Record<string, Partial<GeneratedDraftRecord>>>
    return Object.fromEntries(
      Object.entries(parsed).map(([email, records]) => {
        const normalizedEmail = normalizeEmail(email)
        if (!normalizedEmail || !records || typeof records !== "object") {
          return [email, {}]
        }

        return [
          normalizedEmail,
          Object.fromEntries(
            Object.entries(records)
              .map(([actionId, value]) => {
                const normalized = normalizeRecord(normalizedEmail, actionId, value)
                return normalized ? [actionId, normalized] : null
              })
              .filter((entry): entry is [string, GeneratedDraftRecord] => entry !== null)
          ),
        ]
      })
    )
  } catch (error) {
    const isMissing =
      error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT"
    if (isMissing) return {}
    console.error("Failed to read generated drafts store:", error)
    return {}
  }
}

async function writeStore(store: DraftStore) {
  await mkdir(STORE_DIR, { recursive: true })
  await writeFile(STORE_FILE, JSON.stringify(store, null, 2), "utf8")
}

export async function listGeneratedDraftsForUser(email?: string | null) {
  const normalizedEmail = normalizeEmail(email)
  if (!normalizedEmail) return {}

  const store = await readStore()
  return store[normalizedEmail] ?? {}
}

export async function saveGeneratedDraft(record: GeneratedDraftRecord) {
  const normalizedEmail = normalizeEmail(record.userEmail)
  if (!normalizedEmail) {
    throw new Error("An authenticated email is required to save generated drafts")
  }

  const store = await readStore()
  store[normalizedEmail] ??= {}
  store[normalizedEmail][record.actionId] = {
    ...record,
    userEmail: normalizedEmail,
    updatedAt: new Date().toISOString(),
  }
  await writeStore(store)
  return store[normalizedEmail][record.actionId]
}

export async function resetGeneratedDraftsStore() {
  try {
    await rm(STORE_FILE, { force: true })
  } catch (error) {
    console.error("Failed to reset generated drafts store:", error)
  }
}
