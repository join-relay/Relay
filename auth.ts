import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import { GOOGLE_BASE_SCOPES, upsertGoogleAccountTokens } from "@/lib/services/google-auth"

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
  if (!isGoogleAuthConfigured()) {
    return null
  }

  return signOut(options)
}
