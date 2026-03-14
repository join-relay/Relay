import { NextRequest, NextResponse } from "next/server"
import { prepareJoinValidation } from "@/lib/services/teams-proof-of-life"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const targetMeeting =
      typeof body.targetMeeting === "string" ? body.targetMeeting : ""
    const attempt = prepareJoinValidation(targetMeeting)

    return NextResponse.json(attempt, {
      status: attempt.state === "blocked" ? 400 : 200,
    })
  } catch (error) {
    console.error("Meeting join scaffold error:", error)
    return NextResponse.json(
      { error: "Failed to prepare join validation" },
      { status: 500 }
    )
  }
}
