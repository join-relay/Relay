import { NextResponse } from "next/server"
import { getTeamsProofOfLifeStatus } from "@/lib/services/teams-proof-of-life"

export async function GET() {
  try {
    return NextResponse.json(getTeamsProofOfLifeStatus())
  } catch (error) {
    console.error("Meeting status API error:", error)
    return NextResponse.json(
      { error: "Failed to load Teams proof-of-life status" },
      { status: 500 }
    )
  }
}
