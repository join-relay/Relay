import { NextResponse } from "next/server"
import { getUpcomingMeetingStatus } from "@/lib/services/meeting-readiness"

export const dynamic = "force-dynamic"

export async function GET() {
  return NextResponse.json(await getUpcomingMeetingStatus())
}
