import "server-only"

import type { CalendarEvent, GmailThread, GmailThreadContext, SentEmailSample } from "@/types"
import { getStore, setStore } from "./store-backend"

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
    const data = await getStore("dev-test-state")
    if (!data || typeof data !== "object") return {}
    return data as RelayDevTestState
  } catch (error) {
    console.error("Failed to read dev test state:", error)
    return {}
  }
}

async function writeStore(state: RelayDevTestState) {
  await setStore("dev-test-state", state)
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
