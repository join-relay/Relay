import { NextResponse } from "next/server"
import { getOptionalSession } from "@/auth"
import { listActions, substituteDisplayNameInActions } from "@/lib/services/actions"

export const dynamic = "force-dynamic"
const NO_STORE_HEADERS = { "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate" }

export async function GET() {
  try {
    const session = await getOptionalSession()
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
