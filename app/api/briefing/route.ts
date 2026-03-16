import { NextRequest, NextResponse } from "next/server"
import { getOptionalSession } from "@/auth"
import { getBriefing } from "@/lib/services/briefing"
import { checkRateLimit, rateLimitHeaders, RATE_LIMITS } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"
const NO_STORE_HEADERS = { "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate" }

function rateLimitKey(email: string | null, request: NextRequest): string {
  if (email) return `briefing:${email}`
  const forwarded = request.headers.get("x-forwarded-for")
  const ip = forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "anon"
  return `briefing:ip:${ip}`
}

export async function GET(request: NextRequest) {
  try {
    const session = await getOptionalSession()
    const key = rateLimitKey(session?.user?.email ?? null, request)
    if (!checkRateLimit(key, RATE_LIMITS.briefing)) {
      return NextResponse.json(
        { error: "Too many requests. Please wait a minute." },
        { status: 429, headers: { ...NO_STORE_HEADERS, ...rateLimitHeaders(RATE_LIMITS.briefing) } }
      )
    }
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
