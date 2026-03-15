import {
  getOptionalSession,
  isGoogleAuthConfigured,
  signInIfConfigured,
  signOutIfConfigured,
} from "@/auth"
import { getUpcomingGoogleMeet, getLiveCalendarEvents } from "@/lib/services/calendar"
import {
  applyCalendarReadFailureToStatus,
  clearGoogleAccountConnection,
  getBaseGoogleIntegrationStatus,
} from "@/lib/services/google-auth"

export const dynamic = "force-dynamic"

export default async function SettingsPage() {
  const session = await getOptionalSession()
  const sessionEmail = session?.user?.email ?? null
  const authConfigured = isGoogleAuthConfigured()
  const status = await getBaseGoogleIntegrationStatus({
    email: sessionEmail,
    name: session?.user?.name,
    hasSession: Boolean(sessionEmail),
  })

  if (status.canReadCalendar && sessionEmail) {
    try {
      const events = await getLiveCalendarEvents(sessionEmail)
      status.nextMeetEvent = getUpcomingGoogleMeet(events)
    } catch (error) {
      applyCalendarReadFailureToStatus(status, error)
    }
  }

  async function connectGoogle() {
    "use server"

    if (!isGoogleAuthConfigured()) {
      return
    }

    await signInIfConfigured("google", { redirectTo: "/settings" })
  }

  async function disconnectGoogle() {
    "use server"

    await clearGoogleAccountConnection(sessionEmail)
    if (!isGoogleAuthConfigured()) {
      return
    }

    await signOutIfConfigured({ redirectTo: "/settings" })
  }

  return (
    <div className="space-y-6">
      <div className="rounded-relay-card border border-[var(--border)] bg-white p-5 shadow-relay-elevated">
        <h1 className="text-2xl font-semibold tracking-tight text-[#1B2E3B]">
          Settings
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-[#3F5363]">
          Connect Google so Relay can read Gmail and Calendar live. When that
          connection is missing or incomplete, the app stays on explicit mock
          fallback.
        </p>
      </div>

      <div className="rounded-relay-card border border-[var(--border)] bg-white/80 p-5 shadow-relay-soft">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-[#1B2E3B]">
              Google connection
            </h2>
            <p className="mt-2 text-sm text-[#3F5363]">{status.note}</p>
          </div>
          <span className="rounded-relay-control border border-[var(--border)] bg-[#e8edf3] px-2 py-1 text-xs font-medium capitalize text-[#314555]">
            {status.status.replaceAll("_", " ")}
          </span>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-relay-inner border border-[var(--border)] bg-white/60 p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-[#61707D]">
              Account
            </p>
            <p className="mt-2 text-sm font-medium text-[#1B2E3B]">
              {status.displayName ?? "Not connected"}
            </p>
            <p className="mt-1 text-sm text-[#3F5363]">
              {status.email ?? "No Google session"}
            </p>
          </div>

          <div className="rounded-relay-inner border border-[var(--border)] bg-white/60 p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-[#61707D]">
              Live read status
            </p>
            <p className="mt-2 text-sm text-[#3F5363]">
              Gmail: {status.canReadGmail ? "ready" : "fallback"}
            </p>
            <p className="mt-1 text-sm text-[#3F5363]">
              Calendar: {status.canReadCalendar ? "ready" : "fallback"}
            </p>
            <p className="mt-1 text-sm text-[#3F5363]">
              Refresh token: {status.hasRefreshToken ? "stored" : "missing"}
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-relay-inner border border-[var(--border)] bg-white/60 p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-[#61707D]">
            Granted scopes
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {status.scopes.length > 0 ? (
              status.scopes.map((scope) => (
                <span
                  key={scope}
                  className="rounded-relay-control border border-[var(--border)] bg-white px-2 py-1 text-xs text-[#314555]"
                >
                  {scope}
                </span>
              ))
            ) : (
              <p className="text-sm text-[#3F5363]">No Google scopes granted yet.</p>
            )}
          </div>
        </div>

        {status.missingEnv.length > 0 && (
          <div className="mt-4 rounded-relay-inner border border-[#7c3a2d]/20 bg-[#7c3a2d]/5 p-4 text-sm text-[#7c3a2d]">
            Missing server env: {status.missingEnv.join(", ")}
          </div>
        )}

        <div className="mt-4 rounded-relay-inner border border-[var(--border)] bg-white/60 p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-[#61707D]">
            Next Google Meet
          </p>
          <p className="mt-2 text-sm text-[#3F5363]">
            {status.nextMeetEvent
              ? `${status.nextMeetEvent.title} at ${new Date(
                  status.nextMeetEvent.start
                ).toLocaleTimeString("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
                })}`
              : "No live Google Meet detected yet."}
          </p>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <form action={connectGoogle}>
            <button
              type="submit"
              disabled={!authConfigured}
              className="inline-flex items-center gap-2 rounded-relay-control bg-[#213443] px-4 py-2 text-sm font-medium text-white shadow-relay-soft transition-smooth hover:bg-[#1B2E3B] disabled:cursor-not-allowed disabled:opacity-60"
            >
              Connect Google
            </button>
          </form>

          <form action={disconnectGoogle}>
            <button
              type="submit"
              disabled={!authConfigured}
              className="inline-flex items-center gap-2 rounded-relay-control border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium text-[#1B2E3B] transition-smooth hover:bg-[#e8edf3] disabled:cursor-not-allowed disabled:opacity-60"
            >
              Disconnect
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
