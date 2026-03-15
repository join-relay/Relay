import { NextRequest, NextResponse } from "next/server"
import {
  buildRecallBotCreatePayload,
  buildRecallMeetingRun,
  createRecallBot,
  getRecallProviderReadiness,
} from "@/lib/services/recall"
import { upsertMeetingRun } from "@/lib/persistence/meeting-runs"
import type { RecallBotCreateRequest } from "@/types"

function isGoogleMeetUrl(meetingUrl: string) {
  return (
    meetingUrl.includes("meet.google.com/") ||
    meetingUrl.includes("https://g.co/meet/")
  )
}

/**
 * Create a real Recall bot for a Google Meet and persist the run.
 * Returns provider-confirmed run only when Recall API confirms creation.
 */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Partial<RecallBotCreateRequest>
  const providerReadiness = getRecallProviderReadiness()
  const meetingUrl = body.meetingUrl?.trim() ?? ""
  const botName = body.botName?.trim() || "Relay"

  if (!meetingUrl) {
    return NextResponse.json(
      { error: "A Google Meet URL is required.", success: false },
      { status: 400 }
    )
  }

  if (!isGoogleMeetUrl(meetingUrl)) {
    return NextResponse.json(
      { error: "Only Google Meet URLs are supported.", success: false },
      { status: 400 }
    )
  }

  if (providerReadiness.configState !== "configured") {
    return NextResponse.json(
      {
        error: "Recall is not configured. Set RECALL_API_KEY (and RECALL_WEBHOOK_SECRET for transcript webhooks).",
        success: false,
        providerReadiness,
      },
      { status: 503 }
    )
  }

  const input: RecallBotCreateRequest = {
    meetingUrl,
    botName,
    deduplicationKey: body.deduplicationKey?.trim(),
    metadata: body.metadata,
  }

  const liveBot = await createRecallBot(input)

  if (!liveBot || !liveBot.id) {
    return NextResponse.json(
      {
        success: false,
        error: "Recall API did not confirm bot creation. Check server logs and Recall dashboard.",
        providerReadiness,
      },
      { status: 502 }
    )
  }

  const runRecord = buildRecallMeetingRun(input, {
    id: crypto.randomUUID(),
    botId: liveBot.id,
    status: "created",
  })
  runRecord.providerStatus = liveBot.status ?? "created"
  await upsertMeetingRun(runRecord)

  return NextResponse.json({
    success: true,
    run: runRecord,
    liveBot: {
      id: liveBot.id,
      status: liveBot.status,
      meetingUrl: liveBot.meetingUrl,
      joinUrl: liveBot.joinUrl,
    },
    providerReadiness,
  })
}
