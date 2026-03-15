import { NextRequest, NextResponse } from "next/server"
import { getOptionalSession } from "@/auth"
import { getOrCreateRecap } from "@/lib/services/meeting-orchestrator"

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
    const transcriptOverride = req.nextUrl.searchParams.get("transcript")
    const recap = await getOrCreateRecap(eventId, {
      transcriptOverride: transcriptOverride ?? undefined,
    })
    if (!recap) {
      return NextResponse.json(
        {
          recap: null,
          state: "unavailable",
          detail: "Post-meeting recap could not be generated.",
        },
        { status: 200 }
      )
    }
    return NextResponse.json({
      recap,
      state: "generated",
      detail:
        recap.source === "artifact"
          ? "Recap generated from meeting transcript/artifacts."
          : "Recap generated from fallback or placeholder. Relay did not join the meeting live.",
    })
  } catch (error) {
    console.error("Meeting summary API error:", error)
    return NextResponse.json(
      { error: "Failed to generate meeting recap" },
      { status: 500 }
    )
  }
}
