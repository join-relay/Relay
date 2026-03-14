import { seededThreads } from "@/lib/demo/seed"
import type { GmailThread } from "@/types"

export function getMockThreads(limit = 20): GmailThread[] {
  return seededThreads.slice(0, limit)
}

export function getMockThreadById(id: string): GmailThread | null {
  return seededThreads.find((t) => t.id === id) ?? null
}
