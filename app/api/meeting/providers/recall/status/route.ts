import { NextResponse } from "next/server"
import { getRecallProviderReadiness } from "@/lib/services/recall"

export const dynamic = "force-dynamic"

export async function GET() {
  return NextResponse.json(getRecallProviderReadiness())
}
