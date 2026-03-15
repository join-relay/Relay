import { NextResponse } from "next/server"
import { getBriefing } from "@/lib/services/briefing"

export const dynamic = "force-dynamic"
const NO_STORE_HEADERS = { "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate" }

export async function GET() {
  try {
    const briefing = await getBriefing()
    return NextResponse.json(briefing, { headers: NO_STORE_HEADERS })
  } catch (error) {
    console.error("Briefing API error:", error)
    return NextResponse.json(
      { error: "Failed to load briefing" },
      { status: 500, headers: NO_STORE_HEADERS }
    )
  }
}
