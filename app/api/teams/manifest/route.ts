import { NextResponse } from "next/server"
import { buildTeamsManifest } from "@/lib/services/teams-proof-of-life"

export async function GET() {
  return NextResponse.json({
    filename: "relay-teams-manifest.json",
    note:
      "Use this helper as a starting point for tenant install validation during Phase A.5. It does not claim that install validation is complete.",
    inMemoryOnly: true,
    manifest: buildTeamsManifest(),
  })
}
