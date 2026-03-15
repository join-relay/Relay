import { NextRequest, NextResponse } from "next/server"
import { getOptionalSession } from "@/auth"
import { getOrCreateBrief } from "@/lib/services/meeting-orchestrator"

export const dynamic = "force-dynamic"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const session = await getOptionalSession()
    const { eventId } = await params
    if (!eventId) {
      return NextResponse.json({ error: "eventId is required" }, { status: 400 })
    }
    const forceRegenerate = req.nextUrl.searchParams.get("refresh") === "true"
    const result = await getOrCreateBrief(eventId, { forceRegenerate })
    if (!result.brief) {
      return NextResponse.json(
        {
          brief: null,
          state: "unavailable",
          detail: result.error ?? "Pre-meeting brief could not be generated.",
        },
        { status: 200 }
      )
    }
    return NextResponse.json({
      brief: result.brief,
      state: "generated",
      contextPrepared: result.contextPrepared,
      detail: "Pre-meeting brief, working-on update, and suggested update text generated. Live attendance is not implemented.",
    })
  } catch (error) {
    console.error("Meeting brief API error:", error)
    return NextResponse.json(
      { error: "Failed to generate meeting brief" },
      { status: 500 }
    )
  }
}
