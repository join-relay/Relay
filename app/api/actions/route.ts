import { NextRequest, NextResponse } from "next/server"
import { getOptionalSession } from "@/auth"
import { listActions, substituteDisplayNameInActions } from "@/lib/services/actions"
import { checkRateLimit, rateLimitHeaders, RATE_LIMITS } from "@/lib/rate-limit"

export const dynamic = "force-dynamic"
const NO_STORE_HEADERS = { "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate" }

function rateLimitKey(email: string | null, request: NextRequest): string {
  if (email) return `actions:${email}`
  const forwarded = request.headers.get("x-forwarded-for")
  const ip = forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "anon"
  return `actions:ip:${ip}`
}

export async function GET(request: NextRequest) {
  try {
    const session = await getOptionalSession()
    const key = rateLimitKey(session?.user?.email ?? null, request)
    if (!checkRateLimit(key, RATE_LIMITS.actionsList)) {
      return NextResponse.json(
        { error: "Too many requests. Please wait a minute." },
        { status: 429, headers: { ...NO_STORE_HEADERS, ...rateLimitHeaders(RATE_LIMITS.actionsList) } }
      )
    }
    const displayName = session?.user?.name ?? undefined
    const result = await listActions()
    let actions = result.actions
    if (displayName) {
      actions = substituteDisplayNameInActions(actions, displayName)
    }
    return NextResponse.json(
      {
        actions,
        displayName: displayName ?? null,
        viewState: result.viewState,
      },
      { headers: NO_STORE_HEADERS }
    )
  } catch (error) {
    console.error("Actions API error:", error)
    return NextResponse.json(
      { error: "Failed to load actions" },
      { status: 500, headers: NO_STORE_HEADERS }
    )
  }
}
