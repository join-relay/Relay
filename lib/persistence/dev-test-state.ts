import "server-only"

import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import type { CalendarEvent, GmailThread, GmailThreadContext, SentEmailSample } from "@/types"

const STORE_DIR = path.join(process.cwd(), ".relay")
const STORE_FILE = path.join(STORE_DIR, "dev-test-state.json")

export interface RelayDevLiveDataState {
  enabled: boolean
  displayName?: string
  gmailThreads?: GmailThread[]
  gmailThreadContexts?: Record<string, GmailThreadContext>
  sentEmailSamples?: SentEmailSample[]
  calendarEvents?: CalendarEvent[]
}

interface RelayDevTestState {
  liveData?: RelayDevLiveDataState
}

declare global {
  // eslint-disable-next-line no-var
  var __relayDevTestState: RelayDevTestState | undefined
}

function getInMemoryState() {
  globalThis.__relayDevTestState ??= {}
  return globalThis.__relayDevTestState
}

async function readStore(): Promise<RelayDevTestState> {
  try {
    const raw = await readFile(STORE_FILE, "utf8")
    if (!raw.trim()) return {}
    return JSON.parse(raw) as RelayDevTestState
  } catch (error) {
    const isMissing =
      error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT"
    if (isMissing) return {}
    console.error("Failed to read dev test state:", error)
    return {}
  }
}

async function writeStore(state: RelayDevTestState) {
  await mkdir(STORE_DIR, { recursive: true })
  await writeFile(STORE_FILE, JSON.stringify(state, null, 2), "utf8")
}

export async function getDevLiveDataState() {
  const inMemory = getInMemoryState()
  if (inMemory.liveData) {
    return inMemory.liveData
  }

  const fileState = await readStore()
  globalThis.__relayDevTestState = fileState
  return fileState.liveData
}

export async function setDevLiveDataState(liveData?: RelayDevLiveDataState) {
  const nextState = liveData ? { liveData } : {}
  globalThis.__relayDevTestState = nextState
  await writeStore(nextState)
}

export async function resetDevTestState() {
  globalThis.__relayDevTestState = {}
  await writeStore({})
}
