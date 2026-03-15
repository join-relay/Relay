import { NextResponse } from "next/server"
import { listMeetingRuns } from "@/lib/persistence/meeting-runs"

export const dynamic = "force-dynamic"

export async function GET() {
  const runs = await listMeetingRuns()
  return NextResponse.json({ runs })
}
