import { NextResponse } from "next/server"
import { rejectAction } from "@/lib/services/actions"

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const updated = await rejectAction(id)
    if (!updated) {
      return NextResponse.json({ error: "Action not found" }, { status: 404 })
    }

    return NextResponse.json(updated)
  } catch (error) {
    if (error instanceof Error && error.message === "Cannot reject approved action") {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    console.error("Actions reject error:", error)
    return NextResponse.json(
      { error: "Failed to reject action" },
      { status: 500 }
    )
  }
}
