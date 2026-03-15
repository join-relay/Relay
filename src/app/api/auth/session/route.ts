import { NextResponse } from "next/server";
import { getProvider, loadTokens } from "@/lib/store";

export async function GET() {
  const tokens = loadTokens();
  const provider = getProvider();
  return NextResponse.json({
    authenticated: !!(tokens?.access_token),
    provider: provider ?? undefined,
  });
}
