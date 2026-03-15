const MICROSOFT_AUTHORITY = "https://login.microsoftonline.com/common/oauth2/v2.0";
const SCOPES = ["Mail.Read", "Calendars.Read", "User.Read", "offline_access"];

function getRedirectUri(): string {
  return process.env.MICROSOFT_REDIRECT_URI || "http://localhost:3000/api/auth/callback/microsoft";
}

export function getMicrosoftAuthUrl(): string {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  if (!clientId) throw new Error("Missing MICROSOFT_CLIENT_ID");
  const redirectUri = encodeURIComponent(getRedirectUri());
  const scope = encodeURIComponent(SCOPES.join(" "));
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: getRedirectUri(),
    scope: SCOPES.join(" "),
    response_mode: "query",
    prompt: "consent",
  });
  return `${MICROSOFT_AUTHORITY}/authorize?${params.toString()}`;
}

export async function getMicrosoftTokensFromCode(code: string): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
}> {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Missing MICROSOFT_CLIENT_ID or MICROSOFT_CLIENT_SECRET");
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: getRedirectUri(),
    grant_type: "authorization_code",
  });
  const res = await fetch(`${MICROSOFT_AUTHORITY}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `Token exchange failed: ${res.status}`);
  }
  const data = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };
  return data;
}

export async function refreshMicrosoftAccessToken(refreshToken: string): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
}> {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Missing MICROSOFT_CLIENT_ID or MICROSOFT_CLIENT_SECRET");
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  const res = await fetch(`${MICROSOFT_AUTHORITY}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`Refresh failed: ${res.status}`);
  return (await res.json()) as { access_token: string; refresh_token?: string; expires_in?: number };
}

export async function getValidMicrosoftAccessToken(): Promise<string | null> {
  const { getProvider, loadTokensForProvider, saveTokensForProvider } = await import("./store");
  if (getProvider() !== "microsoft") return null;
  const tokens = loadTokensForProvider("microsoft");
  if (!tokens?.access_token) return null;
  const expiry = tokens.expiry_date;
  const expired = expiry ? expiry < Date.now() + 60_000 : false;
  if (expired && tokens.refresh_token) {
    const data = await refreshMicrosoftAccessToken(tokens.refresh_token);
    const newExpiry = data.expires_in ? Date.now() + data.expires_in * 1000 : undefined;
    saveTokensForProvider("microsoft", {
      access_token: data.access_token,
      refresh_token: data.refresh_token ?? tokens.refresh_token,
      expiry_date: newExpiry,
    });
    return data.access_token;
  }
  return tokens.access_token;
}
