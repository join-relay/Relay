import { NextRequest, NextResponse } from "next/server"
import {
  buildRecallBotCreatePayload,
  buildRecallMeetingRun,
  createRecallBot,
  getRecallProviderReadiness,
} from "@/lib/services/recall"
import type { RecallBotCreateRequest } from "@/types"

function isGoogleMeetUrl(meetingUrl: string) {
  return meetingUrl.includes("meet.google.com/") || meetingUrl.includes("https://g.co/meet/")
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Partial<RecallBotCreateRequest>
  const providerReadiness = getRecallProviderReadiness()
  const meetingUrl = body.meetingUrl?.trim() ?? ""
  const botName = body.botName?.trim() || "Relay"

  if (!meetingUrl) {
    return NextResponse.json(
      {
        error: "A Google Meet URL is required to prepare Recall.ai bot scaffolding.",
      },
      { status: 400 }
    )
  }

  if (!isGoogleMeetUrl(meetingUrl)) {
    return NextResponse.json(
      {
        error: "This scaffold only supports Google Meet URLs in the current pass.",
      },
      { status: 400 }
    )
  }

  const scaffoldInput: RecallBotCreateRequest = {
    meetingUrl,
    botName,
    deduplicationKey: body.deduplicationKey?.trim(),
    metadata: body.metadata,
  }

  let liveBot: Awaited<ReturnType<typeof createRecallBot>> = null
  if (providerReadiness.configState === "configured") {
    liveBot = await createRecallBot(scaffoldInput)
  }

  return NextResponse.json({
    providerReadiness,
    liveRequestSent: providerReadiness.configState === "configured",
    liveBot: liveBot ?? undefined,
    note:
      providerReadiness.configState === "configured"
        ? "Recall.ai is configured. Bot create request was sent; the bot will join and transcribe when the API succeeds."
        : "This endpoint validates inputs and returns the Recall.ai create-bot payload shape. Configure RECALL_API_KEY (and RECALL_WEBHOOK_SECRET for webhooks) to create a live bot that transcribes.",
    payloadPreview: buildRecallBotCreatePayload(scaffoldInput),
    meetingRunPreview: buildRecallMeetingRun(scaffoldInput),
  })
}
