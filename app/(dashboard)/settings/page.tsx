import { getOptionalSession, isGoogleAuthConfigured, signInIfConfigured } from "@/auth"
import { revalidatePath } from "next/cache"
import {
  getDefaultRelayCustomizationSettings,
  getRelayCustomizationSettings,
  saveRelayCustomizationSettings,
} from "@/lib/persistence/user-preferences"
import { getUpcomingGoogleMeet, getLiveCalendarEvents } from "@/lib/services/calendar"
import { getEmailStyleProfile } from "@/lib/services/email-style"
import {
  applyCalendarReadFailureToStatus,
  getBaseGoogleIntegrationStatus,
} from "@/lib/services/google-auth"
import type {
  ConcisenessPreference,
  FormalityPreference,
  MeetingUpdateStyle,
  RelayCustomizationSettings,
  TonePreference,
} from "@/types"

export const dynamic = "force-dynamic"

const toneOptions: Array<{ value: TonePreference; label: string }> = [
  { value: "professional", label: "Professional" },
  { value: "warm", label: "Warm" },
  { value: "direct", label: "Direct" },
  { value: "friendly", label: "Friendly" },
]

const formalityOptions: Array<{ value: FormalityPreference; label: string }> = [
  { value: "formal", label: "Formal" },
  { value: "balanced", label: "Balanced" },
  { value: "casual", label: "Casual" },
]

const concisenessOptions: Array<{ value: ConcisenessPreference; label: string }> = [
  { value: "brief", label: "Brief" },
  { value: "balanced", label: "Balanced" },
  { value: "detailed", label: "Detailed" },
]

const meetingStyleOptions: Array<{ value: MeetingUpdateStyle; label: string }> = [
  { value: "action_focused", label: "Action-focused" },
  { value: "crisp_status", label: "Crisp status" },
  { value: "warm_summary", label: "Warm summary" },
]

function readBooleanField(formData: FormData, name: string) {
  return formData.get(name) === "on"
}

function parseCustomizationSettings(formData: FormData): RelayCustomizationSettings {
  const defaults = getDefaultRelayCustomizationSettings()

  return {
    emailTone: (formData.get("emailTone") as TonePreference) ?? defaults.emailTone,
    emailFormality:
      (formData.get("emailFormality") as FormalityPreference) ?? defaults.emailFormality,
    emailConciseness:
      (formData.get("emailConciseness") as ConcisenessPreference) ?? defaults.emailConciseness,
    useSignature: readBooleanField(formData, "useSignature"),
    emailSignatureOverride: (formData.get("emailSignatureOverride") as string | null)?.trim() ?? "",
    includeGreeting: readBooleanField(formData, "includeGreeting"),
    includeSignOff: readBooleanField(formData, "includeSignOff"),
    enableBrowserNotifications: readBooleanField(formData, "enableBrowserNotifications"),
    enableNotificationSound: readBooleanField(formData, "enableNotificationSound"),
    meetingTone: (formData.get("meetingTone") as TonePreference) ?? defaults.meetingTone,
    meetingFormality:
      (formData.get("meetingFormality") as FormalityPreference) ?? defaults.meetingFormality,
    meetingConciseness:
      (formData.get("meetingConciseness") as ConcisenessPreference) ?? defaults.meetingConciseness,
    meetingUpdateStyle:
      (formData.get("meetingUpdateStyle") as MeetingUpdateStyle) ?? defaults.meetingUpdateStyle,
  }
}

function SelectField<T extends string>({
  label,
  name,
  value,
  options,
}: {
  label: string
  name: string
  value: T
  options: Array<{ value: T; label: string }>
}) {
  return (
    <label className="space-y-1.5">
      <span className="text-xs font-medium uppercase tracking-wider text-[#61707D]">{label}</span>
      <select
        name={name}
        defaultValue={value}
        className="w-full rounded-relay-control border border-[var(--border)] bg-white px-3 py-2 text-sm text-[#1B2E3B] focus:outline-none focus:ring-2 focus:ring-[#213443]/15"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

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

  const customization = await getRelayCustomizationSettings(sessionEmail)
  const styleProfile = await getEmailStyleProfile({
    email: sessionEmail,
    displayName: session?.user?.name,
  })

  async function connectGoogle() {
    "use server"

    if (!isGoogleAuthConfigured()) {
      return
    }

    await signInIfConfigured("google", { redirectTo: "/settings" })
  }

  async function saveCustomization(formData: FormData) {
    "use server"

    if (!sessionEmail) return

    await saveRelayCustomizationSettings(sessionEmail, parseCustomizationSettings(formData))
    revalidatePath("/settings")
    revalidatePath("/actions")
    revalidatePath("/meeting")
  }

  return (
    <div className="space-y-6">
      <div className="rounded-relay-card border border-[var(--border)] bg-white p-5 shadow-relay-elevated">
        <h1 className="text-2xl font-semibold tracking-tight text-[#1B2E3B]">Settings</h1>
        <p className="mt-2 max-w-2xl text-sm text-[#3F5363]">
          Control how Relay sounds in email replies and future meeting updates while keeping
          Google auth and fallback status explicit.
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
            <p className="text-xs font-medium uppercase tracking-wider text-[#61707D]">Account</p>
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

        {(!sessionEmail || status.status === "not_configured" || status.status === "blocked") && (
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
          </div>
        )}
        {sessionEmail && status.status !== "not_configured" && status.status !== "blocked" && (
          <p className="mt-4 text-xs text-[#3F5363]">
            Signed in with Google. Sign out from the header to switch accounts.
          </p>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.95fr,1.05fr]">
        <div className="rounded-relay-card border border-[var(--border)] bg-white/80 p-5 shadow-relay-soft">
          <h2 className="text-sm font-semibold tracking-tight text-[#1B2E3B]">
            Inferred email style
          </h2>
          <p className="mt-2 text-sm text-[#3F5363]">
            Relay looks at recent Sent mail to infer a lightweight style profile, then stores
            only the structured result.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-relay-control bg-[#e8edf3] px-2 py-1 text-xs font-medium text-[#314555]">
              {styleProfile.source === "sent_mail" ? "Sent-mail profile" : "Default fallback"}
            </span>
            <span className="rounded-relay-control border border-[var(--border)] bg-white/70 px-2 py-1 text-xs text-[#314555]">
              {styleProfile.sampleCount} samples
            </span>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <div className="rounded-relay-inner border border-[var(--border)] bg-white/60 p-3">
              <p className="text-[11px] font-medium uppercase tracking-wider text-[#61707D]">
                Greeting style
              </p>
              <p className="mt-1 text-sm text-[#1B2E3B] capitalize">
                {styleProfile.greetingStyle.replaceAll("_", " ")}
              </p>
            </div>
            <div className="rounded-relay-inner border border-[var(--border)] bg-white/60 p-3">
              <p className="text-[11px] font-medium uppercase tracking-wider text-[#61707D]">
                Tone and formality
              </p>
              <p className="mt-1 text-sm text-[#1B2E3B] capitalize">
                {styleProfile.tone} / {styleProfile.formality}
              </p>
            </div>
            <div className="rounded-relay-inner border border-[var(--border)] bg-white/60 p-3">
              <p className="text-[11px] font-medium uppercase tracking-wider text-[#61707D]">
                Sentence length
              </p>
              <p className="mt-1 text-sm text-[#1B2E3B] capitalize">
                {styleProfile.sentenceLength}
              </p>
            </div>
            <div className="rounded-relay-inner border border-[var(--border)] bg-white/60 p-3">
              <p className="text-[11px] font-medium uppercase tracking-wider text-[#61707D]">
                Sign-off
              </p>
              <p className="mt-1 text-sm text-[#1B2E3B] capitalize">
                {styleProfile.signOffStyle.replaceAll("_", " ")}
              </p>
            </div>
          </div>
          <div className="mt-3 rounded-relay-inner border border-[var(--border)] bg-white/60 p-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-[#61707D]">
              Signature block
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-[#314555]">
              {styleProfile.signatureBlock ?? "No consistent signature block detected yet."}
            </p>
          </div>
        </div>

        <form
          action={saveCustomization}
          className="rounded-relay-card border border-[var(--border)] bg-white/80 p-5 shadow-relay-soft"
        >
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-[#1B2E3B]">
              Relay behavior
            </h2>
            <p className="mt-2 text-sm text-[#3F5363]">
              Saved settings shape reply drafts now and future meeting summaries or updates later.
            </p>
          </div>

          <div className="mt-5 space-y-5">
            <section className="space-y-3">
              <div>
                <h3 className="text-sm font-medium text-[#1B2E3B]">Email replies</h3>
                <p className="mt-1 text-sm text-[#3F5363]">
                  These preferences combine with your Sent-mail profile when Relay drafts replies.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <SelectField
                  label="Tone"
                  name="emailTone"
                  value={customization.emailTone}
                  options={toneOptions}
                />
                <SelectField
                  label="Formality"
                  name="emailFormality"
                  value={customization.emailFormality}
                  options={formalityOptions}
                />
                <SelectField
                  label="Conciseness"
                  name="emailConciseness"
                  value={customization.emailConciseness}
                  options={concisenessOptions}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="flex items-start gap-3 rounded-relay-inner border border-[var(--border)] bg-white/60 p-3 text-sm text-[#314555]">
                  <input
                    type="checkbox"
                    name="includeGreeting"
                    defaultChecked={customization.includeGreeting}
                    className="mt-0.5 h-4 w-4 rounded border-[var(--border)]"
                  />
                  Include a greeting
                </label>
                <label className="flex items-start gap-3 rounded-relay-inner border border-[var(--border)] bg-white/60 p-3 text-sm text-[#314555]">
                  <input
                    type="checkbox"
                    name="includeSignOff"
                    defaultChecked={customization.includeSignOff}
                    className="mt-0.5 h-4 w-4 rounded border-[var(--border)]"
                  />
                  Include a sign-off
                </label>
                <label className="flex items-start gap-3 rounded-relay-inner border border-[var(--border)] bg-white/60 p-3 text-sm text-[#314555]">
                  <input
                    type="checkbox"
                    name="useSignature"
                    defaultChecked={customization.useSignature}
                    className="mt-0.5 h-4 w-4 rounded border-[var(--border)]"
                  />
                  Include my signature
                </label>
              </div>
              <label className="block space-y-1.5">
                <span className="text-xs font-medium uppercase tracking-wider text-[#61707D]">
                  Signature block override
                </span>
                <textarea
                  name="emailSignatureOverride"
                  defaultValue={customization.emailSignatureOverride ?? ""}
                  rows={4}
                  data-testid="signature-override-input"
                  className="w-full rounded-relay-control border border-[var(--border)] bg-white px-3 py-2 text-sm text-[#1B2E3B] focus:outline-none focus:ring-2 focus:ring-[#213443]/15"
                  placeholder={styleProfile.signatureBlock ?? "Best,\nYassin"}
                />
                <p className="text-xs text-[#61707D]">
                  Saved signature override is used first. If left blank, Relay falls back to the
                  inferred signature block when available.
                </p>
              </label>
            </section>

            <section className="space-y-3">
              <div>
                <h3 className="text-sm font-medium text-[#1B2E3B]">Email notifications</h3>
                <p className="mt-1 text-sm text-[#3F5363]">
                  Control whether Relay plays a sound or uses browser alerts for genuinely new live
                  Gmail threads.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex items-start gap-3 rounded-relay-inner border border-[var(--border)] bg-white/60 p-3 text-sm text-[#314555]">
                  <input
                    type="checkbox"
                    name="enableBrowserNotifications"
                    defaultChecked={customization.enableBrowserNotifications}
                    className="mt-0.5 h-4 w-4 rounded border-[var(--border)]"
                  />
                  Enable browser notifications
                </label>
                <label className="flex items-start gap-3 rounded-relay-inner border border-[var(--border)] bg-white/60 p-3 text-sm text-[#314555]">
                  <input
                    type="checkbox"
                    name="enableNotificationSound"
                    defaultChecked={customization.enableNotificationSound}
                    className="mt-0.5 h-4 w-4 rounded border-[var(--border)]"
                  />
                  Play notification sound
                </label>
              </div>
            </section>

            <section className="space-y-3">
              <div>
                <h3 className="text-sm font-medium text-[#1B2E3B]">Meeting updates</h3>
                <p className="mt-1 text-sm text-[#3F5363]">
                  These settings will shape future summary, update, and action-item writing.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <SelectField
                  label="Update style"
                  name="meetingUpdateStyle"
                  value={customization.meetingUpdateStyle}
                  options={meetingStyleOptions}
                />
                <SelectField
                  label="Tone"
                  name="meetingTone"
                  value={customization.meetingTone}
                  options={toneOptions}
                />
                <SelectField
                  label="Formality"
                  name="meetingFormality"
                  value={customization.meetingFormality}
                  options={formalityOptions}
                />
                <SelectField
                  label="Conciseness"
                  name="meetingConciseness"
                  value={customization.meetingConciseness}
                  options={concisenessOptions}
                />
              </div>
            </section>
          </div>

          <div className="mt-5 flex items-center justify-between gap-3">
            <p className="text-xs text-[#61707D]">
              Changes take effect on newly generated drafts and future meeting text.
            </p>
            <button
              type="submit"
              data-testid="save-preferences"
              className="inline-flex items-center gap-2 rounded-relay-control bg-[#213443] px-4 py-2 text-sm font-medium text-white shadow-relay-soft transition-smooth hover:bg-[#1B2E3B]"
            >
              Save preferences
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
