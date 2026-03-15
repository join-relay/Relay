import { NextRequest, NextResponse } from "next/server"
import { verifyRecallWebhook } from "@/lib/recall/verify-webhook"
import {
  appendTranscriptToRun,
  updateMeetingRunByBotId,
} from "@/lib/persistence/meeting-runs"
import type { RecallTranscriptEntry } from "@/types"

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

/** Parse transcript.data payload into RecallTranscriptEntry. Relative timestamps are not converted to absolute (no epoch from Recall). */
function parseTranscriptDataPayload(data: Record<string, unknown>): RecallTranscriptEntry | null {
  const inner = data.data as Record<string, unknown> | undefined
  if (!inner || typeof inner !== "object") return null
  const words = inner.words as Array<{ text?: string }> | undefined
  const participant = inner.participant as { name?: string | null } | undefined
  if (!Array.isArray(words) || words.length === 0) return null
  const text = words.map((w) => (typeof w?.text === "string" ? w.text : "")).filter(Boolean).join(" ").trim()
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
    return NextResponse.json({ received: true }, { status: 200 })
  }

  if (event === "transcript.data" && data) {
    const entry = parseTranscriptDataPayload(data as Record<string, unknown>)
    if (entry) {
      await appendTranscriptToRun(botId, entry)
    }
    return NextResponse.json({ received: true }, { status: 200 })
  }

  return NextResponse.json({ received: true }, { status: 200 })
}
