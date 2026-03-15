import { NextRequest, NextResponse } from "next/server"
import { generateDraftForActionAsUser } from "@/lib/services/actions"
import { getGoogleAccountRecord } from "@/lib/services/google-auth"
import type { DraftEmailPayload } from "@/types"

function notFoundResponse() {
  return NextResponse.json({ error: "Not found" }, { status: 404 })
}

function isDevOnly() {
  return process.env.NODE_ENV !== "production"
}

export async function GET(request: NextRequest) {
  if (!isDevOnly()) {
    return notFoundResponse()
  }

  const actionId = request.nextUrl.searchParams.get("actionId")?.trim()
  const email = request.nextUrl.searchParams.get("email")?.trim().toLowerCase()
  const force = request.nextUrl.searchParams.get("force") === "1"

  if (!actionId || !email) {
    return NextResponse.json(
      { error: "actionId and email are required" },
      { status: 400 }
    )
  }

  try {
    const account = await getGoogleAccountRecord(email)
    const action = await generateDraftForActionAsUser({
      id: actionId,
      userEmail: email,
      displayName: account?.name ?? undefined,
      force,
    })

    if (!action || action.type !== "draft_email") {
      return NextResponse.json({ error: "Draft action not found" }, { status: 404 })
    }

    const payload = action.proposedAction as DraftEmailPayload
    return NextResponse.json({
      actionId,
      email,
      force,
      title: action.title,
      sourceContext: action.sourceContext,
      draftBody: payload.body,
      generation: action.personalization?.generation ?? null,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Draft diagnostics failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
