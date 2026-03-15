import { NextRequest, NextResponse } from "next/server"
import { getTeamsWebhookUrl, recordWebhookEvent } from "@/lib/services/teams-proof-of-life"

export async function GET(request: NextRequest) {
  const validationToken = request.nextUrl.searchParams.get("validationToken")
  if (validationToken) {
    return new NextResponse(validationToken, {
      status: 200,
      headers: { "content-type": "text/plain" },
    })
  }

  return NextResponse.json({
    ready: true,
    note: "This is the public webhook scaffold for Teams proof-of-life validation.",
    webhookUrl: getTeamsWebhookUrl(),
    inMemoryOnly: true,
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const eventType =
      typeof body.type === "string"
        ? body.type
        : typeof body.eventType === "string"
          ? body.eventType
          : "unknown"
    const source =
      request.headers.get("x-relay-webhook-probe") === "manual"
        ? "manual_probe"
        : "external_callback"
    const note =
      source === "manual_probe"
        ? "Manual webhook probe recorded for proof-of-life scaffolding."
        : "Received callback on the public Teams webhook path."
    const event = recordWebhookEvent(eventType, source, note)

    return NextResponse.json({
      ok: true,
      inMemoryOnly: true,
      event,
    })
  } catch (error) {
    console.error("Teams webhook error:", error)
    return NextResponse.json(
      { error: "Failed to process Teams webhook callback" },
      { status: 500 }
    )
  }
}
