import { NextResponse } from "next/server"
import { getOptionalSession } from "@/auth"
import { getOrCreateSpokenUpdateArtifact } from "@/lib/services/meeting-orchestrator"

export const dynamic = "force-dynamic"

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const session = await getOptionalSession()
    const { eventId } = await params
    if (!eventId) {
      return NextResponse.json({ error: "eventId is required" }, { status: 400 })
    }
    const result = await getOrCreateSpokenUpdateArtifact(eventId)
    return NextResponse.json({
      artifact: result.artifact,
      state: result.artifact?.generated ? "generated" : "unavailable",
      detail: result.artifact?.generated
        ? "Spoken update artifact generated. Relay does not join or speak in the meeting live."
        : result.error ?? "Spoken update audio could not be generated.",
    })
  } catch (error) {
    console.error("Meeting update-audio API error:", error)
    return NextResponse.json(
      { error: "Failed to generate spoken update artifact" },
      { status: 500 }
    )
  }
}
