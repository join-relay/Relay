import { NextResponse } from "next/server";
import { getAuthUrl } from "@/lib/google-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const url = getAuthUrl();
    return NextResponse.redirect(url);
  } catch (e) {
    return NextResponse.json(
      { error: "Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.local." },
      { status: 503 }
    );
  }
}
