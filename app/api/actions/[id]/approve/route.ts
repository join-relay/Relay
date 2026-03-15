import { NextRequest, NextResponse } from "next/server"
import { approveAction } from "@/lib/services/actions"
import type { DraftEmailPayload, RescheduleMeetingPayload } from "@/types"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const content = body.content as DraftEmailPayload | RescheduleMeetingPayload | undefined
    const updated = await approveAction(id, content)
    if (!updated) {
      return NextResponse.json({ error: "Action not found" }, { status: 404 })
    }

    return NextResponse.json(updated)
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === "Action already approved" ||
        error.message === "Cannot approve rejected action" ||
        error.message === "Generate a reply before approving this email action")
    ) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    console.error("Actions approve error:", error)
    const message =
      error instanceof Error ? error.message : "Failed to approve action"
    return NextResponse.json(
      { error: message },
      { status: 500 }
    )
  }
}
