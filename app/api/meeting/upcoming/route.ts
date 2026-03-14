import { NextResponse } from "next/server"
import { getUpcomingTeamsMeetingStatus } from "@/lib/services/teams-proof-of-life"

export async function GET() {
  return NextResponse.json(getUpcomingTeamsMeetingStatus())
}
