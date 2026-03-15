import { NextResponse } from "next/server";
import { getWorkLifeContext, getProvider } from "@/lib/store";

export async function GET() {
  const context = getWorkLifeContext();
  const provider = getProvider();
  if (!context) {
    return NextResponse.json({ context: null, provider: provider ?? undefined, message: "No data yet. Sign in and run Sync." });
  }
  return NextResponse.json({ context, provider: provider ?? undefined });
}
