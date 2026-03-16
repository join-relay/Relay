import { NextRequest, NextResponse } from "next/server"
import { getOptionalSession } from "@/auth"
import { generateDraftForAction } from "@/lib/services/actions"
import { checkRateLimit, rateLimitHeaders, RATE_LIMITS } from "@/lib/rate-limit"

function rateLimitKey(email: string | null, request: NextRequest): string {
  if (email) return `draft:${email}`
  const forwarded = request.headers.get("x-forwarded-for")
  const ip = forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "anon"
  return `draft:ip:${ip}`
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getOptionalSession()
    const key = rateLimitKey(session?.user?.email ?? null, req)
    if (!checkRateLimit(key, RATE_LIMITS.draftGeneration)) {
      return NextResponse.json(
        { error: "Too many draft requests. Please wait a minute." },
        { status: 429, headers: rateLimitHeaders(RATE_LIMITS.draftGeneration) }
      )
    }
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const updated = await generateDraftForAction(id, {
      force: body.force === true,
    })

    if (!updated) {
      return NextResponse.json({ error: "Action not found" }, { status: 404 })
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error("Draft generation error:", error)
    const message = error instanceof Error ? error.message : "Failed to generate draft"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
