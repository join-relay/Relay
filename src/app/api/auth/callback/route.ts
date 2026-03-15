import { NextRequest, NextResponse } from "next/server";
import { getTokensFromCode } from "@/lib/google-auth";
import { saveTokensForProvider } from "@/lib/store";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(new URL("/?error=no_code", request.url));
  }
  try {
    const tokens = await getTokensFromCode(code);
    saveTokensForProvider("google", {
      access_token: tokens.access_token!,
      refresh_token: tokens.refresh_token ?? undefined,
      expiry_date: tokens.expiry_date ?? undefined,
    });
    return NextResponse.redirect(new URL("/dashboard", request.url));
  } catch (e) {
    console.error(e);
    return NextResponse.redirect(new URL("/?error=auth_failed", request.url));
  }
}
