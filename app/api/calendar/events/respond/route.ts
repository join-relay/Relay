import { NextRequest, NextResponse } from "next/server"
import { getOptionalSession } from "@/auth"
import { respondToCalendarEvent } from "@/lib/services/calendar"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const session = await getOptionalSession()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 })
  }

  let body: { eventId?: string; response?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { eventId, response } = body
  if (typeof eventId !== "string" || !eventId.trim()) {
    return NextResponse.json({ error: "eventId is required" }, { status: 400 })
  }
  if (response !== "accepted" && response !== "declined") {
    return NextResponse.json(
      { error: "response must be 'accepted' or 'declined'" },
      { status: 400 }
    )
  }

  try {
    const result = await respondToCalendarEvent(
      session.user.email,
      eventId.trim(),
      response
    )
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to respond to event"
    const isScope = /scope|calendar|reconnect|re-author/i.test(message)
    return NextResponse.json(
      { error: message },
      { status: isScope ? 403 : 500 }
    )
  }
}
