import { NextResponse } from "next/server"
import { getOptionalSession } from "@/auth"
import { getUpcomingGoogleMeet, getLiveCalendarEvents } from "@/lib/services/calendar"
import { getBaseGoogleIntegrationStatus } from "@/lib/services/google-auth"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const session = await getOptionalSession()
    const status = await getBaseGoogleIntegrationStatus({
      email: session?.user?.email,
      name: session?.user?.name,
      hasSession: Boolean(session?.user?.email),
    })

    if (status.canReadCalendar && session?.user?.email) {
      try {
        const events = await getLiveCalendarEvents(session.user.email)
        status.nextMeetEvent = getUpcomingGoogleMeet(events)
      } catch (error) {
        status.note =
          error instanceof Error
            ? `Google auth is connected, but live Calendar read failed: ${error.message}`
            : "Google auth is connected, but live Calendar read failed."
      }
    }

    return NextResponse.json(status)
  } catch (error) {
    console.error("Google integration status error:", error)
    return NextResponse.json(
      { error: "Failed to load Google integration status" },
      { status: 500 }
    )
  }
}
