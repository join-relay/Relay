import { NextResponse } from "next/server"
import { listActions } from "@/lib/services/actions"

export async function GET() {
  try {
    const actions = await listActions()
    return NextResponse.json(actions)
  } catch (error) {
    console.error("Actions API error:", error)
    return NextResponse.json(
      { error: "Failed to load actions" },
      { status: 500 }
    )
  }
}
