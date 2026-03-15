import "server-only"

import type { MeetingHistoryEntry } from "@/types"
import { getStore, setStore } from "./store-backend"

function normalizeMeetingHistoryEntry(value: unknown): MeetingHistoryEntry | null {
  if (!value || typeof value !== "object") return null
  const entry = value as Partial<MeetingHistoryEntry>

  if (
    typeof entry.id !== "string" ||
    typeof entry.title !== "string" ||
    typeof entry.occurredAt !== "string" ||
    entry.provider !== "google_meet" ||
    (entry.source !== "rest_artifact" &&
      entry.source !== "manual_fallback" &&
      entry.source !== "placeholder")
  ) {
    return null
  }

  return {
    id: entry.id,
    title: entry.title,
    occurredAt: entry.occurredAt,
    provider: entry.provider,
    source: entry.source,
    summary: typeof entry.summary === "string" ? entry.summary : null,
    actionItems: Array.isArray(entry.actionItems)
      ? entry.actionItems.filter((item): item is string => typeof item === "string")
      : [],
    transcriptPreview: Array.isArray(entry.transcriptPreview)
      ? entry.transcriptPreview.filter((item): item is string => typeof item === "string")
      : [],
    transcriptState:
      entry.transcriptState === "available" ||
      entry.transcriptState === "pending" ||
      entry.transcriptState === "unavailable"
        ? entry.transcriptState
        : "unavailable",
    metadata: {
      participantsLabel:
        typeof entry.metadata?.participantsLabel === "string"
          ? entry.metadata.participantsLabel
          : "Participants not captured yet",
      artifactLabel:
        typeof entry.metadata?.artifactLabel === "string"
          ? entry.metadata.artifactLabel
          : "No meeting artifacts captured yet",
      durationLabel:
        typeof entry.metadata?.durationLabel === "string" ? entry.metadata.durationLabel : undefined,
    },
  }
}

async function readAll(): Promise<MeetingHistoryEntry[]> {
  try {
    const parsed = await getStore("meeting-history")
    return Array.isArray(parsed)
      ? parsed
          .map(normalizeMeetingHistoryEntry)
          .filter((entry): entry is MeetingHistoryEntry => entry !== null)
      : []
  } catch (error) {
    console.error("Failed to read meeting history store:", error)
    return []
  }
}

async function writeAll(entries: MeetingHistoryEntry[]) {
  await setStore("meeting-history", entries)
}

export async function listMeetingHistoryEntries() {
  const entries = await readAll()
  return entries.sort((left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime())
}

export async function appendMeetingHistoryEntry(entry: MeetingHistoryEntry) {
  const entries = await readAll()
  entries.push(entry)
  await writeAll(entries)
}
