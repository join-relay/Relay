import Image from "next/image"
import { redirect } from "next/navigation"
import {
  getOptionalSession,
  isDevAuthBypassEnabled,
  isGoogleAuthConfigured,
  signInIfConfigured,
} from "@/auth"

export const dynamic = "force-dynamic"

const LOGO_HORIZONTAL_SRC = "/relay-logo-horizontal-cropped.png"

export default async function LoginPage() {
  const session = await getOptionalSession()

  if (session?.user?.email) {
    redirect("/briefing")
  }

  const authConfigured = isGoogleAuthConfigured()
  const devAuthBypassEnabled = isDevAuthBypassEnabled()

  async function login() {
    "use server"

    if (!isGoogleAuthConfigured()) {
      return
    }

    await signInIfConfigured("google", { redirectTo: "/briefing" })
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#DFE8F1] p-6">
      <div className="w-full max-w-[980px] overflow-hidden rounded-[28px] border border-[#61707D]/15 bg-white/85 shadow-[0_30px_80px_rgba(27,46,59,0.14)] backdrop-blur-sm">
        <div className="grid gap-0 lg:grid-cols-[1.1fr,0.9fr]">
          <section className="border-b border-[#61707D]/10 bg-[linear-gradient(180deg,rgba(223,232,241,0.72),rgba(255,255,255,0.9))] p-8 lg:border-b-0 lg:border-r">
            <div className="relative h-[72px] w-[220px]">
              <Image
                src={LOGO_HORIZONTAL_SRC}
                alt="Relay"
                fill
                className="object-contain object-left"
                priority
                sizes="220px"
              />
            </div>
            <div className="mt-8 max-w-xl space-y-4">
              <span className="inline-flex rounded-full border border-[#61707D]/15 bg-white/80 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-[#61707D]">
                Google-first workspace assistant
              </span>
              <h1 className="text-4xl font-semibold tracking-tight text-[#1B2E3B]">
                Start with Google sign-in, then go straight into Relay.
              </h1>
              <p className="text-base leading-7 text-[#3F5363]">
                Relay keeps the current polished workflow, but now starts from an authenticated
                Google session so inbox, calendar, personalization, and future meeting artifacts
                all stay tied to the signed-in user.
              </p>
            </div>
          </section>

          <section className="flex items-center p-8">
            <div className="w-full rounded-relay-card border border-[var(--border)] bg-white/90 p-6 shadow-relay-soft">
              <h2 className="text-lg font-semibold text-[#1B2E3B]">Sign in to continue</h2>
              <p className="mt-2 text-sm text-[#3F5363]">
                Use your Google account to unlock live Gmail and Calendar data, personalized reply
                style, and your saved Relay preferences.
              </p>

              {!authConfigured && (
                <div className="mt-4 rounded-relay-inner border border-[#7c3a2d]/20 bg-[#7c3a2d]/5 p-4 text-sm text-[#7c3a2d]">
                  Google auth is not configured on the server yet, so sign-in is unavailable.
                </div>
              )}

              <form action={login} className="mt-6">
                <button
                  type="submit"
                  disabled={!authConfigured}
                  className="inline-flex w-full items-center justify-center rounded-relay-control bg-[#213443] px-4 py-3 text-sm font-medium text-white shadow-relay-soft transition-smooth hover:bg-[#1B2E3B] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Continue with Google
                </button>
              </form>

              {devAuthBypassEnabled && (
                <a
                  href="/api/dev/test-auth?action=login&redirectTo=/briefing"
                  data-testid="dev-test-login"
                  className="mt-3 inline-flex w-full items-center justify-center rounded-relay-control border border-[var(--border)] bg-white px-4 py-3 text-sm font-medium text-[#1B2E3B] transition-smooth hover:bg-[#e8edf3]"
                >
                  Continue in dev test mode
                </a>
              )}

              <div className="mt-6 rounded-relay-inner border border-[var(--border)] bg-[#e8edf3]/55 p-4 text-sm text-[#314555]">
                Sessions persist through Auth.js, so once you are signed in you should return
                directly to the app until you explicitly log out.
              </div>

              <p className="mt-6 text-center text-xs text-[#3F5363]">
                <a href="/privacy" className="underline hover:text-[#1B2E3B]">Privacy Policy</a>
                {" · "}
                <a href="/terms" className="underline hover:text-[#1B2E3B]">Terms of Service</a>
              </p>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
