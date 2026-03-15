import NextAuth from "next-auth"
import { cookies } from "next/headers"
import Google from "next-auth/providers/google"
import { GOOGLE_BASE_SCOPES, upsertGoogleAccountTokens } from "@/lib/services/google-auth"

export const DEV_AUTH_COOKIE = "relay-dev-auth"
export const DEV_AUTH_COOKIE_VALUE = "enabled"
const DEV_AUTH_USER_EMAIL = "relay-dev@local.test"
const DEV_AUTH_USER_NAME = "Relay Dev User"

function isProduction() {
  return process.env.NODE_ENV === "production"
}

export function isDevAuthBypassEnabled() {
  return !isProduction() && process.env.RELAY_DEV_AUTH_BYPASS === "1"
}

function createDevSession() {
  return {
    user: {
      name: DEV_AUTH_USER_NAME,
      email: DEV_AUTH_USER_EMAIL,
      image: null,
    },
    expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
  }
}

export async function enableDevAuthSession() {
  if (!isDevAuthBypassEnabled()) {
    throw new Error("Dev auth bypass is not enabled")
  }

  const cookieStore = await cookies()
  cookieStore.set(DEV_AUTH_COOKIE, DEV_AUTH_COOKIE_VALUE, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
  })
}

export async function clearDevAuthSession() {
  const cookieStore = await cookies()
  cookieStore.delete(DEV_AUTH_COOKIE)
}

export function isGoogleAuthConfigured() {
  return Boolean(
    process.env.NEXTAUTH_SECRET &&
      process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET
  )
}

export const authConfig = {
  trustHost: true,
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
  },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      authorization: {
        params: {
          access_type: "offline",
          prompt: "consent",
          response_type: "code",
          scope: GOOGLE_BASE_SCOPES.join(" "),
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account, profile, user }) {
      if (account?.provider === "google") {
        await upsertGoogleAccountTokens({
          subject: profile?.sub ?? token.sub ?? null,
          email: user.email ?? token.email ?? null,
          name: user.name ?? token.name ?? null,
          image: user.image ?? token.picture ?? null,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          expiresAt: account.expires_at,
          scope: account.scope,
        })
      }

      return token
    },
  },
} satisfies Parameters<typeof NextAuth>[0]

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig)

export async function getOptionalSession() {
  if (isDevAuthBypassEnabled()) {
    const cookieStore = await cookies()
    if (cookieStore.get(DEV_AUTH_COOKIE)?.value === DEV_AUTH_COOKIE_VALUE) {
      return createDevSession()
    }
  }

  if (!isGoogleAuthConfigured()) {
    return null
  }

  try {
    return await auth()
  } catch (error) {
    console.error("Optional auth session lookup failed:", error)
    return null
  }
}

export async function signInIfConfigured(provider: string, options?: Parameters<typeof signIn>[1]) {
  if (!isGoogleAuthConfigured()) {
    return null
  }

  return signIn(provider, options)
}

export async function signOutIfConfigured(options?: Parameters<typeof signOut>[0]) {
  await clearDevAuthSession()

  if (!isGoogleAuthConfigured()) {
    return null
  }

  return signOut(options)
}
