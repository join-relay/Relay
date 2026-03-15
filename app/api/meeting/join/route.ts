import { NextRequest, NextResponse } from "next/server"
import { prepareMeetingLinkCheck } from "@/lib/services/meeting-readiness"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const targetMeeting =
      typeof body.targetMeeting === "string" ? body.targetMeeting : ""
    const attempt = prepareMeetingLinkCheck(targetMeeting)

    return NextResponse.json(attempt, {
      status: attempt.state === "blocked" ? 400 : 200,
    })
  } catch (error) {
    console.error("Meeting readiness link check error:", error)
    return NextResponse.json(
      { error: "Failed to validate Google Meet readiness link" },
      { status: 500 }
    )
  }
}
