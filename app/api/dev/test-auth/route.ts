import { NextRequest, NextResponse } from "next/server"
import {
  DEV_AUTH_COOKIE,
  DEV_AUTH_COOKIE_VALUE,
  isDevAuthBypassEnabled,
} from "@/auth"
import { resetPersistedActionState } from "@/lib/persistence/action-state"
import {
  resetDevTestState,
  setDevLiveDataState,
} from "@/lib/persistence/dev-test-state"
import { resetGeneratedDraftsStore } from "@/lib/persistence/generated-drafts"
import { resetRememberedActionBases } from "@/lib/mocks/actions"

function notFoundResponse() {
  return NextResponse.json({ error: "Not found" }, { status: 404 })
}

export async function GET(request: NextRequest) {
  if (!isDevAuthBypassEnabled()) {
    return notFoundResponse()
  }

  const { searchParams } = request.nextUrl
  const action = searchParams.get("action")
  const redirectTo = searchParams.get("redirectTo") ?? "/briefing"

  if (action === "login") {
    const response = NextResponse.redirect(new URL(redirectTo, request.url))
    response.cookies.set(DEV_AUTH_COOKIE, DEV_AUTH_COOKIE_VALUE, {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
    })
    return response
  }

  if (action === "logout") {
    const response = NextResponse.redirect(new URL("/login", request.url))
    response.cookies.delete(DEV_AUTH_COOKIE)
    return response
  }

  return notFoundResponse()
}

export async function POST(request: NextRequest) {
  if (!isDevAuthBypassEnabled()) {
    return notFoundResponse()
  }

  const body = await request.json().catch(() => ({}))
  if (body.action === "reset") {
    resetPersistedActionState()
    await resetGeneratedDraftsStore()
    await resetDevTestState()
    resetRememberedActionBases()
    const response = NextResponse.json({ ok: true })
    response.cookies.delete(DEV_AUTH_COOKIE)
    return response
  }

  if (body.action === "setLiveData") {
    await setDevLiveDataState(body.liveData)
    return NextResponse.json({ ok: true })
  }

  return notFoundResponse()
}
