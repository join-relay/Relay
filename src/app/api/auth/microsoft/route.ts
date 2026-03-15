import { NextResponse } from "next/server";
import { getMicrosoftAuthUrl } from "@/lib/microsoft-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const url = getMicrosoftAuthUrl();
    return NextResponse.redirect(url);
  } catch (e) {
    return NextResponse.json(
      { error: "Microsoft OAuth not configured. Set MICROSOFT_CLIENT_ID (and MICROSOFT_CLIENT_SECRET) in .env.local." },
      { status: 503 }
    );
  }
}
