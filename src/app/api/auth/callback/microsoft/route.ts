import { NextRequest, NextResponse } from "next/server";
import { getMicrosoftTokensFromCode } from "@/lib/microsoft-auth";
import { saveTokensForProvider } from "@/lib/store";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(new URL("/?error=no_code", request.url));
  }
  try {
    const data = await getMicrosoftTokensFromCode(code);
    const expiryDate = data.expires_in ? Date.now() + data.expires_in * 1000 : undefined;
    saveTokensForProvider("microsoft", {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expiry_date: expiryDate,
    });
    return NextResponse.redirect(new URL("/dashboard", request.url));
  } catch (e) {
    console.error(e);
    return NextResponse.redirect(new URL("/?error=auth_failed", request.url));
  }
}
