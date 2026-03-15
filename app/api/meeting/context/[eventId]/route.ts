import { NextRequest, NextResponse } from "next/server"
import { getOptionalSession } from "@/auth"
import { getMeetingContext } from "@/lib/services/meeting-context"

export const dynamic = "force-dynamic"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const session = await getOptionalSession()
    const { eventId } = await params
    if (!eventId) {
      return NextResponse.json({ error: "eventId is required" }, { status: 400 })
    }
    const context = await getMeetingContext(eventId)
    if (!context) {
      return NextResponse.json(
        {
          context: null,
          state: "unavailable",
          detail: "Meeting context could not be assembled. Event may not exist or may not be a Google Meet.",
        },
        { status: 200 }
      )
    }
    return NextResponse.json({
      context,
      state: "prepared",
      detail: "Meeting context assembled from Calendar, Drive, Gmail, and briefing.",
    })
  } catch (error) {
    console.error("Meeting context API error:", error)
    return NextResponse.json(
      { error: "Failed to load meeting context" },
      { status: 500 }
    )
  }
}
