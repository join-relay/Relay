import { NextRequest, NextResponse } from "next/server"
import { generateDraftForAction } from "@/lib/services/actions"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const updated = await generateDraftForAction(id, {
      force: body.force === true,
    })

    if (!updated) {
      return NextResponse.json({ error: "Action not found" }, { status: 404 })
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error("Draft generation error:", error)
    const message = error instanceof Error ? error.message : "Failed to generate draft"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
