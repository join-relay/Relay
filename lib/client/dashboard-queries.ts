import type { Briefing, PendingAction, ActionsViewState } from "@/types"

export interface ActionsResponse {
  actions: PendingAction[]
  displayName: string | null
  viewState: ActionsViewState
}

export const BRIEFING_QUERY_KEY = ["briefing"] as const
export const ACTIONS_QUERY_KEY = ["actions"] as const
/** Poll every 15s so inbox/actions feel closer to real-time; refetch on focus/visibility. */
export const LIVE_REFRESH_INTERVAL_MS = 15000

async function readJson<T>(response: Response, fallbackMessage: string) {
  if (!response.ok) {
    throw new Error(fallbackMessage)
  }

  return response.json() as Promise<T>
}

export async function fetchBriefing() {
  const response = await fetch("/api/briefing", {
    cache: "no-store",
    headers: {
      "Cache-Control": "no-cache",
    },
  })

  return readJson<Briefing>(response, "Failed to load briefing")
}

export async function fetchActions() {
  const response = await fetch("/api/actions", {
    cache: "no-store",
    headers: {
      "Cache-Control": "no-cache",
    },
  })

  return readJson<ActionsResponse>(response, "Failed to load actions")
}
