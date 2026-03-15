# Fix "redirect_uri_mismatch" on Vercel (Google sign-in)

If you see **Error 400: redirect_uri_mismatch** when signing in with Google on your Vercel app, the redirect URI your app uses is not yet allowed in your Google OAuth client.

## Fix (one-time)

1. Open [Google Cloud Console](https://console.cloud.google.com/) and select the project that owns your OAuth client.
2. Go to **APIs & Services** → **Credentials**.
3. Open your **OAuth 2.0 Client ID** (Web application) used by Relay.
4. Under **Authorized redirect URIs**, click **Add URI** and add exactly:
   ```text
   https://relay-phi-green.vercel.app/api/auth/callback/google
   ```
5. Save. Changes can take a few minutes to apply.

## Ensure env matches

In Vercel, set **NEXTAUTH_URL** to your app’s public URL (no trailing slash), e.g.:

```text
NEXTAUTH_URL=https://relay-phi-green.vercel.app
```

NextAuth builds the redirect URI as `{NEXTAUTH_URL}/api/auth/callback/google`, so that value must match what you added in the Google Console.

## Local dev

For local sign-in, also add:

```text
http://localhost:3000/api/auth/callback/google
```

as an authorized redirect URI in the same OAuth client.
