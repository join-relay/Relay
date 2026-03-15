import { NextResponse } from "next/server"
import { getBriefing } from "@/lib/services/briefing"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const briefing = await getBriefing()
    return NextResponse.json(briefing)
  } catch (error) {
    console.error("Briefing API error:", error)
    return NextResponse.json(
      { error: "Failed to load briefing" },
      { status: 500 }
    )
  }
}
