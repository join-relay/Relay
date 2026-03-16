import "server-only"

import type { MeetingRunRecord, ProposedCalendarEvent, RecallTranscriptEntry } from "@/types"
import { getStore, setStore } from "./store-backend"

function normalizeRun(raw: unknown): MeetingRunRecord | null {
  if (!raw || typeof raw !== "object") return null
  const r = raw as Record<string, unknown>
  if (
    typeof r.id !== "string" ||
    r.provider !== "recall_ai" ||
    typeof r.meetingUrl !== "string" ||
    typeof r.createdAt !== "string" ||
    typeof r.updatedAt !== "string"
  ) {
    return null
  }
  const validStatuses = ["scaffolded", "created", "joining", "running", "completed", "failed"] as const
  const status = validStatuses.includes(r.status as (typeof validStatuses)[number])
    ? (r.status as MeetingRunRecord["status"])
    : "scaffolded"

  const transcriptEntries: RecallTranscriptEntry[] = Array.isArray(r.transcriptEntries)
    ? (r.transcriptEntries as unknown[]).filter((e): e is RecallTranscriptEntry => {
        if (!e || typeof e !== "object") return false
        const x = e as Record<string, unknown>
        return typeof (x.text as string) === "string"
      }).map((e) => ({
        speaker: typeof (e as RecallTranscriptEntry).speaker === "string" ? (e as RecallTranscriptEntry).speaker : undefined,
        text: (e as RecallTranscriptEntry).text,
        startedAt: typeof (e as RecallTranscriptEntry).startedAt === "string" ? (e as RecallTranscriptEntry).startedAt : undefined,
        endedAt: typeof (e as RecallTranscriptEntry).endedAt === "string" ? (e as RecallTranscriptEntry).endedAt : undefined,
      }))
    : []

  const artifactMetadata = r.artifactMetadata && typeof r.artifactMetadata === "object"
    ? (r.artifactMetadata as MeetingRunRecord["artifactMetadata"])
    : undefined

  const proposedCalendarEvents: ProposedCalendarEvent[] = Array.isArray(r.proposedCalendarEvents)
    ? (r.proposedCalendarEvents as unknown[]).filter((e): e is ProposedCalendarEvent => {
        if (!e || typeof e !== "object") return false
        const x = e as Record<string, unknown>
        return (
          typeof x.id === "string" &&
          typeof x.title === "string" &&
          typeof x.start === "string" &&
          typeof x.end === "string"
        )
      }).map((e) => ({
        id: (e as ProposedCalendarEvent).id,
        title: (e as ProposedCalendarEvent).title,
        start: (e as ProposedCalendarEvent).start,
        end: (e as ProposedCalendarEvent).end,
        description: typeof (e as ProposedCalendarEvent).description === "string" ? (e as ProposedCalendarEvent).description : undefined,
        confidence: (e as ProposedCalendarEvent).confidence,
        rawPhrase: typeof (e as ProposedCalendarEvent).rawPhrase === "string" ? (e as ProposedCalendarEvent).rawPhrase : undefined,
      }))
    : []

  return {
    id: r.id,
    provider: "recall_ai",
    meetingUrl: r.meetingUrl,
    botId: typeof r.botId === "string" ? r.botId : undefined,
    status,
    providerStatus: typeof r.providerStatus === "string" ? r.providerStatus : undefined,
    providerError: typeof r.providerError === "string" ? r.providerError : undefined,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    artifactMetadata,
    transcriptEntries,
    summary: typeof r.summary === "string" ? r.summary : r.summary === null ? null : undefined,
    proposedCalendarEvents: proposedCalendarEvents.length > 0 ? proposedCalendarEvents : undefined,
  }
}

async function readAll(): Promise<MeetingRunRecord[]> {
  try {
    const data = await getStore("meeting-runs")
    return Array.isArray(data)
      ? data.map(normalizeRun).filter((r): r is MeetingRunRecord => r !== null)
      : []
  } catch (error) {
    console.error("Failed to read meeting runs store:", error)
    return []
  }
}

async function writeAll(runs: MeetingRunRecord[]) {
  await setStore("meeting-runs", runs)
}

export async function listMeetingRuns(): Promise<MeetingRunRecord[]> {
  const runs = await readAll()
  return runs.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
}

export async function getMeetingRunById(id: string): Promise<MeetingRunRecord | null> {
  const runs = await readAll()
  return runs.find((r) => r.id === id) ?? null
}

export async function getMeetingRunByBotId(botId: string): Promise<MeetingRunRecord | null> {
  const runs = await readAll()
  return runs.find((r) => r.botId === botId) ?? null
}

export async function upsertMeetingRun(
  run: MeetingRunRecord
): Promise<MeetingRunRecord> {
  const runs = await readAll()
  const index = runs.findIndex((r) => r.id === run.id || (run.botId && r.botId === run.botId))
  const updated = { ...run, updatedAt: new Date().toISOString() }
  if (index >= 0) {
    runs[index] = { ...runs[index], ...updated }
  } else {
    runs.push(updated)
  }
  await writeAll(runs)
  return updated
}

export async function updateMeetingRunByBotId(
  botId: string,
  patch: Partial<
    Pick<
      MeetingRunRecord,
      "status" | "providerStatus" | "providerError" | "updatedAt" | "summary" | "proposedCalendarEvents"
    > & {
      artifactMetadata?: Partial<MeetingRunRecord["artifactMetadata"]>
    }
  >
): Promise<MeetingRunRecord | null> {
  const runs = await readAll()
  const index = runs.findIndex((r) => r.botId === botId)
  if (index < 0) return null
  const existing = runs[index]
  const { artifactMetadata: metaPatch, ...rest } = patch
  const baseMeta = existing.artifactMetadata ?? {
    transcriptSource: "none" as const,
    recordingSource: "none" as const,
    transcriptEntries: (existing.transcriptEntries ?? []).length,
  }
  const artifactMetadata = metaPatch
    ? ({ ...baseMeta, ...metaPatch } as MeetingRunRecord["artifactMetadata"])
    : undefined
  const updated: MeetingRunRecord = {
    ...existing,
    ...rest,
    ...(artifactMetadata ? { artifactMetadata } : {}),
    updatedAt: patch.updatedAt ?? new Date().toISOString(),
  }
  runs[index] = updated
  await writeAll(runs)
  return updated
}

export async function appendTranscriptToRun(
  botId: string,
  entry: RecallTranscriptEntry
): Promise<MeetingRunRecord | null> {
  const runs = await readAll()
  const index = runs.findIndex((r) => r.botId === botId)
  if (index < 0) return null
  const run = runs[index]
  const transcriptEntries = [...(run.transcriptEntries ?? []), entry]
  const artifactMetadata = {
    ...(run.artifactMetadata ?? {
      transcriptSource: "recall_transcript" as const,
      recordingSource: "none" as const,
      transcriptEntries: 0,
    }),
    transcriptSource: "recall_transcript" as const,
    transcriptEntries: transcriptEntries.length,
  }
  const updated: MeetingRunRecord = {
    ...run,
    transcriptEntries,
    artifactMetadata,
    updatedAt: new Date().toISOString(),
  }
  runs[index] = updated
  await writeAll(runs)
  return updated
}
