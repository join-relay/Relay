import { NextRequest, NextResponse } from "next/server"
import { getOptionalSession } from "@/auth"
import { createCalendarEvent } from "@/lib/services/calendar"
import { getMeetingRunByBotId, updateMeetingRunByBotId } from "@/lib/persistence/meeting-runs"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const session = await getOptionalSession()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 })
  }

  let body: {
    title: string
    start: string
    end: string
    description?: string
    location?: string
    calendarId?: string
    runBotId?: string
    proposedEventId?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { title, start, end, description, location, calendarId, runBotId, proposedEventId } = body
  if (typeof title !== "string" || !title.trim() || typeof start !== "string" || typeof end !== "string") {
    return NextResponse.json(
      { error: "title, start, and end are required" },
      { status: 400 }
    )
  }

  try {
    const result = await createCalendarEvent(session.user.email, {
      title: title.trim(),
      start,
      end,
      description: typeof description === "string" ? description : undefined,
      location: typeof location === "string" ? location : undefined,
      calendarId: typeof calendarId === "string" ? calendarId : undefined,
    })

    if (runBotId && proposedEventId) {
      const run = await getMeetingRunByBotId(runBotId)
      const list = run?.proposedCalendarEvents ?? []
      const filtered = list.filter((e) => e.id !== proposedEventId)
      if (filtered.length !== list.length) {
        await updateMeetingRunByBotId(runBotId, {
          proposedCalendarEvents: filtered.length > 0 ? filtered : undefined,
        })
      }
    }

    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create calendar event"
    const isScope = /scope|calendar|reconnect|re-author/i.test(message)
    return NextResponse.json(
      { error: message },
      { status: isScope ? 403 : 500 }
    )
  }
}

/** Dismiss a proposed event (remove from run without adding to calendar). */
export async function PATCH(request: NextRequest) {
  const session = await getOptionalSession()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 })
  }

  let body: { runBotId?: string; proposedEventId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { runBotId, proposedEventId } = body
  if (typeof runBotId !== "string" || !runBotId || typeof proposedEventId !== "string" || !proposedEventId) {
    return NextResponse.json(
      { error: "runBotId and proposedEventId are required" },
      { status: 400 }
    )
  }

  const run = await getMeetingRunByBotId(runBotId)
  const list = run?.proposedCalendarEvents ?? []
  const filtered = list.filter((e) => e.id !== proposedEventId)
  if (filtered.length === list.length) {
    return NextResponse.json({ dismissed: false })
  }
  await updateMeetingRunByBotId(runBotId, {
    proposedCalendarEvents: filtered.length > 0 ? filtered : undefined,
  })
  return NextResponse.json({ dismissed: true })
}
