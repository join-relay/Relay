import { NextResponse } from "next/server"
import {
  buildMeetingReadinessErrorStatus,
  getMeetingReadinessStatus,
} from "@/lib/services/meeting-readiness"

export const dynamic = "force-dynamic"
const STATUS_ROUTE_TIMEOUT_MS = 7000

export async function GET() {
  try {
    const status = await Promise.race([
      getMeetingReadinessStatus(),
      new Promise<ReturnType<typeof buildMeetingReadinessErrorStatus>>((resolve) => {
        setTimeout(() => {
          resolve(
            buildMeetingReadinessErrorStatus(
              `Meeting readiness timed out after ${STATUS_ROUTE_TIMEOUT_MS}ms.`
            )
          )
        }, STATUS_ROUTE_TIMEOUT_MS)
      }),
    ])
    return NextResponse.json(status)
  } catch (error) {
    console.error("Meeting status API error:", error)
    const message =
      error instanceof Error ? error.message : "Failed to load Google meeting readiness status"
    return NextResponse.json(buildMeetingReadinessErrorStatus(message))
  }
}
