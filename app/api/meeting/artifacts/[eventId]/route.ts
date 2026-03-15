import { NextResponse } from "next/server"
import { getOptionalSession } from "@/auth"
import { getArtifactState } from "@/lib/services/meeting-orchestrator"

export const dynamic = "force-dynamic"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const session = await getOptionalSession()
    const { eventId } = await params
    if (!eventId) {
      return NextResponse.json({ error: "eventId is required" }, { status: 400 })
    }
    const state = await getArtifactState(eventId)
    return NextResponse.json({
      ...state,
      detail:
        state.availability === "available"
          ? "Meet artifacts/transcript are available for recap."
          : "Meet REST API for transcripts is not available in this integration. Recap uses manual or uploaded transcript when provided.",
    })
  } catch (error) {
    console.error("Meeting artifacts API error:", error)
    return NextResponse.json(
      { error: "Failed to check Meet artifacts" },
      { status: 500 }
    )
  }
}
