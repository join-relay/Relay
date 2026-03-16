"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { AlertCircle, Calendar, Radio } from "lucide-react"
import { JoinValidationPanel } from "@/components/meeting/JoinValidationPanel"
import { MeetingPageHeader } from "@/components/meeting/MeetingPageHeader"
import type {
  MeetingLinkCheckAttempt,
  MeetingReadinessStatus,
  MeetingUpcomingStatus,
} from "@/types"

const STATUS_FETCH_TIMEOUT_MS = 8000

function buildClientErrorMeetingStatus(message: string): MeetingReadinessStatus {
  return {
    botIdentity: "Yassin's Relay",
    resolutionState: "error",
    overallState: "fallback",
    assumptions: [
      "Relay should resolve the Meeting page explicitly.",
      "This client-side fallback is used when the status request does not settle normally.",
    ],
    manualSteps: [
      "Reload the page to retry meeting readiness.",
      "Reconnect Google in Settings if live data should be available.",
    ],
    runtimeEvidenceNote: "The Meeting page rendered an explicit error state instead of staying in a spinner.",
    checkpoints: [],
    nextMeeting: null,
    customizationSummary: "Meeting customization could not be loaded for this request.",
    summarySurface: { state: "empty", summary: null },
    actionItemsSurface: { state: "empty", items: [] },
    transcriptSurface: {
      state: "empty",
      previewLines: [],
      note: "Meeting readiness failed before transcript data could load.",
    },
  }
}

async function fetchMeetingReadinessStatus() {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), STATUS_FETCH_TIMEOUT_MS)

  try {
    const response = await fetch("/api/meeting/status", {
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "Cache-Control": "no-cache",
      },
    })
    if (!response.ok) {
      return buildClientErrorMeetingStatus("Failed to load Google meeting readiness status")
    }

    return (await response.json()) as MeetingReadinessStatus
  } catch (error) {
    return buildClientErrorMeetingStatus(
      error instanceof Error && error.name === "AbortError"
        ? `Meeting readiness timed out after ${STATUS_FETCH_TIMEOUT_MS}ms.`
        : error instanceof Error
          ? error.message
          : "Failed to load Google meeting readiness status"
    )
  } finally {
    window.clearTimeout(timeout)
  }
}

async function fetchUpcomingStatus() {
  const response = await fetch("/api/meeting/upcoming")
  if (!response.ok) {
    throw new Error("Failed to load meeting discovery status")
  }

  return response.json() as Promise<MeetingUpcomingStatus>
}

async function checkMeetReadiness(targetMeeting: string) {
  const response = await fetch("/api/meeting/join", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ targetMeeting }),
  })
  const body = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(body.error ?? body.detail ?? "Failed to validate Google Meet link")
  }

  return body as MeetingLinkCheckAttempt
}

async function createRecallBot(meetingUrl: string) {
  const response = await fetch("/api/meeting/providers/recall/bot", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ meetingUrl, botName: "Relay" }),
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(
      (body as { error?: string }).error ?? `Create bot failed (${response.status})`
    )
  }
  if (!(body as { success?: boolean }).success) {
    throw new Error((body as { error?: string }).error ?? "Recall did not confirm bot creation")
  }
  return body
}

export default function MeetingPage() {
  const queryClient = useQueryClient()
  const {
    data: status,
    isLoading,
  } = useQuery({
    queryKey: ["meeting-readiness"],
    queryFn: fetchMeetingReadinessStatus,
    refetchInterval: 5000,
    retry: 0,
  })
  const { data: upcomingStatus } = useQuery({
    queryKey: ["meeting-upcoming-status"],
    queryFn: fetchUpcomingStatus,
  })

  const joinMutation = useMutation({
    mutationFn: checkMeetReadiness,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meeting-readiness"] })
    },
  })

  const createBotMutation = useMutation({
    mutationFn: createRecallBot,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meeting-readiness"] })
    },
  })

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#213443] border-t-transparent" />
          <p className="text-sm text-[#3F5363]">
            Loading Google meeting readiness...
          </p>
        </div>
      </div>
    )
  }

  if (!status) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="max-w-md rounded-relay-card border border-[#3F5363]/25 bg-white/80 p-5 text-center shadow-relay-soft">
          <p className="font-medium text-[#1B2E3B]">Something went wrong</p>
          <p className="mt-1 text-sm text-[#3F5363]">Failed to load the Google meeting readiness view</p>
        </div>
      </div>
    )
  }

  const preparedCount = status.checkpoints.filter(
    (checkpoint) =>
      checkpoint.state !== "not_configured" && checkpoint.state !== "blocked"
  ).length
  const validatedCount = status.checkpoints.filter(
    (checkpoint) => checkpoint.state === "validated"
  ).length
  const lastJoinAttempt = joinMutation.data ?? status.lastLinkCheck

  return (
    <div className="space-y-6">
      <div className="animate-relay-fade-in">
        <MeetingPageHeader
          preparedCount={preparedCount}
          validatedCount={validatedCount}
          botLabel={status.botIdentity}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.35fr,0.95fr] animate-relay-fade-in opacity-0 [animation-delay:75ms] [animation-fill-mode:forwards]">
        <div className="space-y-4">
          {status.providerReadiness && status.providerReadiness.configState === "configured" && (
            <div className="rounded-relay-card border border-[var(--border)] bg-white/80 p-5 shadow-relay-soft">
              <h2 className="text-sm font-semibold tracking-tight text-[#1B2E3B]">
                Join a meeting with a bot
              </h2>
              <p className="mt-1 text-sm text-[#3F5363]">
                Paste a Google Meet URL and create a Recall bot. It will join and transcribe; status updates when the provider confirms.
              </p>
              <div className="mt-4 rounded-relay-inner border border-[var(--border)] bg-white/60 p-4">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-[#61707D]">
                    Create bot
                  </p>
                  <p className="mt-1 text-sm text-[#3F5363]">
                    Enter a Google Meet link below and click Create bot.
                  </p>
                  <form
                    className="mt-3 flex gap-2"
                    onSubmit={(e) => {
                      e.preventDefault()
                      const form = e.currentTarget
                      const input = form.querySelector<HTMLInputElement>('input[name="recall-meet-url"]')
                      const url = input?.value?.trim()
                      if (url) createBotMutation.mutate(url)
                    }}
                  >
                    <input
                      name="recall-meet-url"
                      type="url"
                      placeholder="https://meet.google.com/..."
                      className="min-w-0 flex-1 rounded-relay-control border border-[var(--border)] bg-white px-3 py-2 text-sm text-[#1B2E3B] focus:outline-none focus:ring-2 focus:ring-[#213443]/20"
                    />
                    <button
                      type="submit"
                      disabled={createBotMutation.isPending}
                      className="shrink-0 rounded-relay-control bg-[#213443] px-4 py-2 text-sm font-medium text-white shadow-relay-soft transition-smooth hover:bg-[#1B2E3B] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {createBotMutation.isPending ? "Creating…" : "Create bot"}
                    </button>
                  </form>
                  {createBotMutation.isError && (
                    <p className="mt-2 text-sm text-[#7c3a2d]">
                      {createBotMutation.error instanceof Error
                        ? createBotMutation.error.message
                        : "Create bot failed"}
                    </p>
                  )}
                  {createBotMutation.isSuccess && (
                    <p className="mt-2 text-sm text-[#1B2E3B]">
                      Bot created. Status will update as the provider reports join and transcript events.
                    </p>
                  )}
                </div>

              {status.activeRecallRun && (
                <div className="mt-4 rounded-relay-inner border border-[var(--border)] bg-white/60 p-4">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-[#61707D]">
                    Current run
                  </p>
                  <p className="mt-1 text-sm text-[#1B2E3B]">
                    {status.activeRecallRun.botId && `Bot ID: ${status.activeRecallRun.botId} · `}
                    Status: {status.activeRecallRun.providerStatus ?? status.activeRecallRun.status}
                  </p>
                  {status.activeRecallRun.artifactMetadata && status.activeRecallRun.artifactMetadata.transcriptEntries > 0 && (
                    <p className="mt-1 text-sm text-[#3F5363]">
                      Transcript: {status.activeRecallRun.artifactMetadata.transcriptEntries} utterance(s)
                    </p>
                  )}
                </div>
              )}

              {status.providerReadiness.missingEnv.length > 0 && (
                <div className="mt-3 rounded-relay-inner border border-[#7c3a2d]/20 bg-[#7c3a2d]/5 p-3 text-sm text-[#7c3a2d]">
                  Missing: {status.providerReadiness.missingEnv.join(", ")}
                </div>
              )}
            </div>
          )}

          {status.providerReadiness && status.providerReadiness.configState !== "configured" && (
            <div className="rounded-relay-card border border-[var(--border)] bg-white/80 p-5 shadow-relay-soft">
              <p className="text-sm text-[#3F5363]">
                Recall is not configured. Set RECALL_API_KEY (and RECALL_WEBHOOK_SECRET) in server env to create bots.
              </p>
            </div>
          )}

          <JoinValidationPanel
            lastJoinAttempt={lastJoinAttempt}
            isSubmitting={joinMutation.isPending}
            errorMessage={
              joinMutation.isError && joinMutation.error instanceof Error
                ? joinMutation.error.message
                : undefined
            }
            onSubmit={(targetMeeting) => joinMutation.mutate(targetMeeting)}
          />
        </div>

        <div className="space-y-4">
          <div className="rounded-relay-card border border-[var(--border)] bg-white/80 p-5 shadow-relay-soft">
            <h2 className="text-sm font-semibold tracking-tight text-[#1B2E3B]">
              Upcoming Google Meet
            </h2>
            <div className="mt-3 space-y-3 text-sm text-[#3F5363]">
              <div className="rounded-relay-inner border border-[var(--border)] bg-white/60 p-3">
                <div className="flex items-center gap-2 text-[#1B2E3B]">
                  <Calendar className="h-4 w-4" />
                  Calendar discovery
                </div>
                <p className="mt-1">
                  {upcomingStatus?.upcomingMeeting
                    ? `${upcomingStatus.upcomingMeeting.title} at ${new Date(
                        upcomingStatus.upcomingMeeting.start
                      ).toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                      })}`
                    : "No live Google Meet detected yet."}
                </p>
              </div>

              <div className="rounded-relay-inner border border-[var(--border)] bg-white/60 p-3">
                <div className="flex items-center gap-2 text-[#1B2E3B]">
                  <Radio className="h-4 w-4" />
                  Readiness note
                </div>
                <p className="mt-1">
                  {status.nextMeeting?.joinUrl
                    ? "A Google Meet join URL is present on the upcoming event."
                    : "No confirmed Meet join URL is present from the current readiness data."}
                </p>
              </div>

              <div className="rounded-relay-inner border border-[#3F5363]/25 bg-[#e8edf3]/70 p-3">
                <div className="flex items-start gap-2 text-sm text-[#314555]">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>
                    {upcomingStatus?.detail ??
                      "Upcoming Google Meet discovery stays explicit about whether it is live or fallback."}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-relay-card border border-[var(--border)] bg-white/80 p-5 shadow-relay-soft">
            <h2 className="text-sm font-semibold tracking-tight text-[#1B2E3B]">
              Runtime evidence
            </h2>
            <p className="mt-2 text-sm text-[#3F5363]">
              {status.runtimeEvidenceNote}
            </p>
            {lastJoinAttempt && (
              <div className="mt-3 space-y-3 text-sm text-[#3F5363]">
                {lastJoinAttempt && (
                  <div className="rounded-relay-inner border border-[var(--border)] bg-white/60 p-3">
                    <p className="font-medium text-[#1B2E3B]">
                      Link check: {lastJoinAttempt.state.replaceAll("_", " ")}
                    </p>
                    <p className="mt-1">{lastJoinAttempt.detail}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="rounded-relay-card border border-[var(--border)] bg-white/80 p-5 shadow-relay-soft">
            <h2 className="text-sm font-semibold tracking-tight text-[#1B2E3B]">
              Meeting summary
            </h2>
            <div className="mt-3 rounded-relay-inner border border-[var(--border)] bg-white/60 p-4 text-sm text-[#3F5363]">
              {status.summarySurface.summary ??
                "No meeting summary is available yet. This panel is ready for future Google Meet summary artifacts or manual fallback summaries."}
            </div>
          </div>

          <div className="rounded-relay-card border border-[var(--border)] bg-white/80 p-5 shadow-relay-soft">
            <h2 className="text-sm font-semibold tracking-tight text-[#1B2E3B]">
              Action items
            </h2>
            <div className="mt-3 space-y-2">
              {status.actionItemsSurface.items.length > 0 ? (
                status.actionItemsSurface.items.map((item) => (
                  <div
                    key={item}
                    className="rounded-relay-inner border border-[var(--border)] bg-white/60 p-3 text-sm text-[#314555]"
                  >
                    {item}
                  </div>
                ))
              ) : (
                <div className="rounded-relay-inner border border-[var(--border)] bg-white/60 p-4 text-sm text-[#3F5363]">
                  No meeting action items are captured yet. Relay will only show them when a real
                  summary path or artifact exists.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-relay-card border border-[var(--border)] bg-white/80 p-5 shadow-relay-soft">
            <h2 className="text-sm font-semibold tracking-tight text-[#1B2E3B]">
              Transcript preview
            </h2>
            <div className="mt-3 rounded-relay-inner border border-[var(--border)] bg-white/60 p-4 text-sm text-[#3F5363]">
              {status.transcriptSurface.previewLines.length > 0 ? (
                <div className="space-y-2">
                  {status.transcriptSurface.previewLines.map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                </div>
              ) : (
                <p>{status.transcriptSurface.note}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
