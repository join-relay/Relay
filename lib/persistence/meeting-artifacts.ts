import "server-only"

import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import type {
  MeetingBrief,
  MeetingRecap,
  SpokenUpdateArtifactMetadata,
} from "@/types"

const STORE_DIR = path.join(process.cwd(), ".relay")
const BRIEFS_FILE = path.join(STORE_DIR, "meeting-briefs.json")
const RECAPS_FILE = path.join(STORE_DIR, "meeting-recaps.json")
const SPOKEN_FILE = path.join(STORE_DIR, "meeting-spoken-updates.json")

function storageKey(userEmail: string | null | undefined, eventId: string): string {
  const email = userEmail ?? "anonymous"
  return `${email}:${eventId}`
}

async function readJson<T>(filePath: string, defaultVal: T): Promise<T> {
  try {
    const raw = await readFile(filePath, "utf8")
    const data = JSON.parse(raw)
    return (typeof data === "object" && data !== null ? data : defaultVal) as T
  } catch (error) {
    const isMissing =
      error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT"
    if (isMissing) return defaultVal
    console.error("Failed to read meeting store:", error)
    return defaultVal
  }
}

async function writeJson(filePath: string, data: Record<string, unknown>) {
  await mkdir(STORE_DIR, { recursive: true })
  await writeFile(filePath, JSON.stringify(data, null, 2), "utf8")
}

export async function saveMeetingBrief(brief: MeetingBrief): Promise<void> {
  const key = storageKey(brief.userEmail, brief.eventId)
  const store = await readJson<Record<string, MeetingBrief>>(BRIEFS_FILE, {})
  store[key] = brief
  await writeJson(BRIEFS_FILE, store)
}

export async function getMeetingBrief(
  userEmail: string | null | undefined,
  eventId: string
): Promise<MeetingBrief | null> {
  const key = storageKey(userEmail, eventId)
  const store = await readJson<Record<string, MeetingBrief>>(BRIEFS_FILE, {})
  return store[key] ?? null
}

export async function saveMeetingRecap(recap: MeetingRecap): Promise<void> {
  const key = storageKey(recap.userEmail, recap.eventId)
  const store = await readJson<Record<string, MeetingRecap>>(RECAPS_FILE, {})
  store[key] = recap
  await writeJson(RECAPS_FILE, store)
}

export async function getMeetingRecap(
  userEmail: string | null | undefined,
  eventId: string
): Promise<MeetingRecap | null> {
  const key = storageKey(userEmail, eventId)
  const store = await readJson<Record<string, MeetingRecap>>(RECAPS_FILE, {})
  return store[key] ?? null
}

export async function saveSpokenUpdateArtifact(meta: SpokenUpdateArtifactMetadata): Promise<void> {
  const key = storageKey(meta.userEmail, meta.eventId)
  const store = await readJson<Record<string, SpokenUpdateArtifactMetadata>>(SPOKEN_FILE, {})
  store[key] = meta
  await writeJson(SPOKEN_FILE, store)
}

export async function getSpokenUpdateArtifact(
  userEmail: string | null | undefined,
  eventId: string
): Promise<SpokenUpdateArtifactMetadata | null> {
  const key = storageKey(userEmail, eventId)
  const store = await readJson<Record<string, SpokenUpdateArtifactMetadata>>(SPOKEN_FILE, {})
  return store[key] ?? null
}
