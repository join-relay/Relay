import { NextRequest, NextResponse } from "next/server"
import { updateActionContent } from "@/lib/services/actions"
import type { DraftEmailPayload, RescheduleMeetingPayload } from "@/types"

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await _req.json()
    const content = body.content as DraftEmailPayload | RescheduleMeetingPayload
    if (!content) {
      return NextResponse.json(
        { error: "Missing content in request body" },
        { status: 400 }
      )
    }

    const updated = await updateActionContent(id, content)
    if (!updated) {
      return NextResponse.json({ error: "Action not found" }, { status: 404 })
    }

    return NextResponse.json(updated)
  } catch (error) {
    if (error instanceof Error && error.message === "Cannot edit approved or rejected action") {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    console.error("Actions PATCH error:", error)
    return NextResponse.json(
      { error: "Failed to update action" },
      { status: 500 }
    )
  }
}
