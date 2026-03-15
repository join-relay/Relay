import { NextResponse } from "next/server"
import { getMeetingReadinessStatus } from "@/lib/services/meeting-readiness"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    return NextResponse.json(await getMeetingReadinessStatus())
  } catch (error) {
    console.error("Meeting status API error:", error)
    return NextResponse.json(
      { error: "Failed to load Google meeting readiness status" },
      { status: 500 }
    )
  }
}
