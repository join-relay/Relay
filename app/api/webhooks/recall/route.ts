import { NextRequest, NextResponse } from "next/server"
import { verifyRecallWebhook } from "@/lib/recall/verify-webhook"
import {
  fetchRecallBotRecordingUrl,
  fetchRecallBotTranscript,
} from "@/lib/services/recall"
import { generateMeetingSummary } from "@/lib/services/meeting-summary"
import { extractProposedMeetings } from "@/lib/services/meeting-to-calendar"
import {
  appendTranscriptToRun,
  getMeetingRunByBotId,
  updateMeetingRunByBotId,
} from "@/lib/persistence/meeting-runs"
import type { RecallTranscriptEntry } from "@/types"

async function applyTranscriptAndSummaryToRun(botId: string) {
  const entries = await fetchRecallBotTranscript(botId)
  if (!entries || entries.length === 0) return
  const run = await getMeetingRunByBotId(botId)
  const refStart = run?.createdAt ?? new Date().toISOString()
  const refEnd = new Date(new Date(refStart).getTime() + 60 * 60 * 1000).toISOString()
  const summary = await generateMeetingSummary(entries)
  const proposedCalendarEvents = await extractProposedMeetings(entries, summary, {
    referenceStart: refStart,
    referenceEnd: refEnd,
  })
  await updateMeetingRunByBotId(botId, {
    transcriptEntries: entries,
    summary: summary ?? null,
    proposedCalendarEvents: proposedCalendarEvents.length > 0 ? proposedCalendarEvents : undefined,
  })
}

export const dynamic = "force-dynamic"
export const maxDuration = 15

/** Map Recall bot status event to our run status. */
function mapProviderStatusToRunStatus(
  event: string
): "joining" | "running" | "completed" | "failed" | undefined {
  switch (event) {
    case "bot.joining_call":
    case "bot.in_waiting_room":
    case "bot.in_call_not_recording":
      return "joining"
    case "bot.recording_permission_allowed":
    case "bot.in_call_recording":
      return "running"
    case "bot.call_ended":
    case "bot.done":
      return "completed"
    case "bot.fatal":
      return "failed"
    default:
      return undefined
  }
}

/** Parse transcript.data payload. Tries data.data (nested) then data (flat) for words and participant. */
function parseTranscriptDataPayload(data: Record<string, unknown>): RecallTranscriptEntry | null {
  const inner =
    (data.data as Record<string, unknown> | undefined) && typeof data.data === "object"
      ? (data.data as Record<string, unknown>)
      : data
  const words = inner.words as Array<Record<string, unknown>> | undefined
  const participant = inner.participant as { name?: string | null } | undefined
  if (!Array.isArray(words) || words.length === 0) return null
  const text = words
    .map((w) => (typeof w?.text === "string" ? w.text : typeof w?.word === "string" ? w.word : ""))
    .filter(Boolean)
    .join(" ")
    .trim()
  if (!text) return null
  return {
    speaker: typeof participant?.name === "string" ? participant.name : undefined,
    text,
  }
}

export async function POST(request: NextRequest) {
  const secret = process.env.RECALL_WEBHOOK_SECRET?.trim()
  if (!secret) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 })
  }

  let rawBody: string
  try {
    rawBody = await request.text()
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 })
  }

  const headers: Record<string, string> = {}
  request.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value
  })

  try {
    verifyRecallWebhook({ secret, headers, payload: rawBody })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Verification failed" },
      { status: 401 }
    )
  }

  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const event = payload.event as string | undefined
  const data = payload.data as Record<string, unknown> | undefined
  const bot = data?.bot as { id?: string } | undefined
  const botId = typeof bot?.id === "string" ? bot.id : undefined

  if (!botId) {
    return NextResponse.json({ received: true }, { status: 200 })
  }

  if (event?.startsWith("bot.")) {
    const runStatus = mapProviderStatusToRunStatus(event)
    const dataInner = data?.data as { sub_code?: string } | undefined
    const providerError = typeof dataInner?.sub_code === "string" ? dataInner.sub_code : undefined
    await updateMeetingRunByBotId(botId, {
      providerStatus: event,
      status: runStatus,
      providerError: event === "bot.fatal" ? providerError : undefined,
    })

    if (runStatus === "completed" && (event === "bot.call_ended" || event === "bot.done")) {
      const recordingUrl = await fetchRecallBotRecordingUrl(botId)
      const run = await getMeetingRunByBotId(botId)
      const entries = (run?.transcriptEntries ?? []) as RecallTranscriptEntry[]
      const summary = entries.length > 0 ? await generateMeetingSummary(entries) : null
      const refStart = run?.createdAt ?? new Date().toISOString()
      const refEnd = new Date(new Date(refStart).getTime() + 60 * 60 * 1000).toISOString()
      const proposedCalendarEvents =
        entries.length > 0
          ? await extractProposedMeetings(entries, summary, {
              referenceStart: refStart,
              referenceEnd: refEnd,
            })
          : []
      await updateMeetingRunByBotId(botId, {
        artifactMetadata: {
          recordingUrl: recordingUrl ?? undefined,
          recordingSource: recordingUrl ? "recall_recording" : undefined,
        },
        summary: summary ?? null,
        proposedCalendarEvents: proposedCalendarEvents.length > 0 ? proposedCalendarEvents : undefined,
      })
    }

    return NextResponse.json({ received: true }, { status: 200 })
  }

  if (event === "transcript.data" && data) {
    const entry = parseTranscriptDataPayload(data as Record<string, unknown>)
    if (entry) {
      await appendTranscriptToRun(botId, entry)
    }
    return NextResponse.json({ received: true }, { status: 200 })
  }

  if (event === "transcript.done") {
    try {
      await applyTranscriptAndSummaryToRun(botId)
    } catch (err) {
      console.warn("[recall] transcript.done processing error:", err)
    }
    return NextResponse.json({ received: true }, { status: 200 })
  }

  if (event === "recording.done" || event === "video.mixed.done") {
    try {
      const recordingUrl = await fetchRecallBotRecordingUrl(botId)
      if (recordingUrl) {
        await updateMeetingRunByBotId(botId, {
          artifactMetadata: {
            recordingUrl,
            recordingSource: "recall_recording",
          },
        })
      }
    } catch (err) {
      console.warn("[recall] recording.done/video.mixed.done processing error:", err)
    }
    return NextResponse.json({ received: true }, { status: 200 })
  }

  return NextResponse.json({ received: true }, { status: 200 })
}
