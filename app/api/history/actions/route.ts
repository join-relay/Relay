import { NextResponse } from "next/server"
import { getOptionalSession } from "@/auth"
import { listActionExecutions } from "@/lib/persistence/action-executions"
import type { ActionExecutionRecord } from "@/types"

export const dynamic = "force-dynamic"

export async function GET() {
  const session = await getOptionalSession()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 })
  }

  try {
    const executions = await listActionExecutions()
    return NextResponse.json({ executions } as { executions: ActionExecutionRecord[] })
  } catch (err) {
    console.error("History actions list error:", err)
    return NextResponse.json(
      { error: "Failed to load action history" },
      { status: 500 }
    )
  }
}
