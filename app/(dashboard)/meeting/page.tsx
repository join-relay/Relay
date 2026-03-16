"use client"

import { useRef } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { JoinValidationPanel } from "@/components/meeting/JoinValidationPanel"
import { MeetingPageHeader } from "@/components/meeting/MeetingPageHeader"
import type {
  MeetingLinkCheckAttempt,
  MeetingReadinessStatus,
  MeetingUpcomingStatus,
  ProposedCalendarEvent,
} from "@/types"

const STATUS_FETCH_TIMEOUT_MS = 8000
/** When run is completed but transcript/recording not yet in, poll this often (ms) for up to COMPLETED_POLL_CAP_MS. */
const COMPLETED_WAITING_REFETCH_MS = 2000
const COMPLETED_POLL_CAP_MS = 90000

function formatEventTime(start: string, end: string): string {
  try {
    const s = new Date(start)
    const e = new Date(end)
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return `${start} – ${end}`
    return `${s.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })} – ${e.toLocaleTimeString(undefined, { timeStyle: "short" })}`
  } catch {
    return `${start} – ${end}`
  }
}

function SuggestedEventsCard({
  proposedEvents,
  runBotId,
  onUpdate,
}: {
  proposedEvents: ProposedCalendarEvent[]
  runBotId: string
  onUpdate: () => void
}) {
  const queryClient = useQueryClient()
  const addMutation = useMutation({
    mutationFn: async (event: ProposedCalendarEvent) => {
      const res = await fetch("/api/calendar/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: event.title,
          start: event.start,
          end: event.end,
          description: event.description,
          runBotId,
          proposedEventId: event.id,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { error?: string }).error ?? "Failed to add to calendar")
      }
      return res.json()
    },
    onSuccess: () => {
      onUpdate()
      queryClient.invalidateQueries({ queryKey: ["meeting-readiness"] })
    },
  })
  const dismissMutation = useMutation({
    mutationFn: async (proposedEventId: string) => {
      const res = await fetch("/api/calendar/events", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runBotId, proposedEventId }),
      })
      if (!res.ok) throw new Error("Failed to dismiss")
      return res.json()
    },
    onSuccess: () => {
      onUpdate()
      queryClient.invalidateQueries({ queryKey: ["meeting-readiness"] })
    },
  })

  return (
    <div className="rounded-relay-card border border-[var(--border)] bg-white/80 p-5 shadow-relay-soft">
      <h2 className="text-sm font-semibold tracking-tight text-[#1B2E3B]">
        Suggested events from this meeting
      </h2>
      <p className="mt-1 text-xs text-[#61707D]">
        Add to your Google Calendar or dismiss.
      </p>
      <div className="mt-3 space-y-3">
        {proposedEvents.map((event) => (
          <div
            key={event.id}
            className="rounded-relay-inner border border-[var(--border)] bg-white/60 p-3 text-sm"
          >
            <p className="font-medium text-[#1B2E3B]">{event.title}</p>
            <p className="mt-1 text-xs text-[#3F5363]">
              {formatEventTime(event.start, event.end)}
            </p>
            {event.rawPhrase && (
              <p className="mt-1 text-xs text-[#61707D] italic">&ldquo;{event.rawPhrase}&rdquo;</p>
            )}
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => addMutation.mutate(event)}
                disabled={addMutation.isPending}
                className="rounded-relay-control bg-[#213443] px-3 py-1.5 text-xs font-medium text-white shadow-relay-soft hover:bg-[#1B2E3B] disabled:opacity-60"
              >
                {addMutation.isPending ? "Adding…" : "Add to calendar"}
              </button>
              <button
                type="button"
                onClick={() => dismissMutation.mutate(event.id)}
                disabled={dismissMutation.isPending}
                className="rounded-relay-control border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-medium text-[#3F5363] hover:bg-[#e8edf3] disabled:opacity-60"
              >
                Dismiss
              </button>
            </div>
            {addMutation.isError && addMutation.variables?.id === event.id && (
              <p className="mt-2 text-xs text-[#7c3a2d]">
                {addMutation.error instanceof Error ? addMutation.error.message : "Failed to add"}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

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
    body: JSON.stringify({ meetingUrl }),
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
  const completedWaitingSince = useRef<number | null>(null)
  const {
    data: status,
    isLoading,
  } = useQuery({
    queryKey: ["meeting-readiness"],
    queryFn: fetchMeetingReadinessStatus,
    refetchInterval: (query) => {
      const data = query.state.data as MeetingReadinessStatus | undefined
      const run = data?.activeRecallRun
      const active = run?.status === "joining" || run?.status === "running"
      if (active) return 3000
      if (run?.status === "completed") {
        const hasArtifacts = Boolean(
          run.summary ||
            (run.transcriptEntries?.length ?? 0) > 0 ||
            run.artifactMetadata?.recordingUrl
        )
        if (!hasArtifacts) {
          const now = Date.now()
          if (completedWaitingSince.current === null) completedWaitingSince.current = now
          if (now - (completedWaitingSince.current ?? 0) < COMPLETED_POLL_CAP_MS) {
            return COMPLETED_WAITING_REFETCH_MS
          }
        } else {
          completedWaitingSince.current = null
        }
      } else {
        completedWaitingSince.current = null
      }
      return 5000
    },
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
    <div className="space-y-6" data-testid="meeting-resolution-state" data-resolution-state={status.resolutionState}>
      <span className="sr-only">{status.resolutionState}</span>
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
                Join with a bot
              </h2>
              <p className="mt-1 text-sm text-[#3F5363]">
                Paste a Google Meet URL to create a Recall bot; it will join and transcribe.
              </p>
              <div className="mt-4 rounded-relay-inner border border-[var(--border)] bg-white/60 p-4">
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
                <div className="mt-4 rounded-relay-inner border border-[var(--border)] bg-white/60 p-4 space-y-3">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-[#61707D]">
                    What’s happening with your bot
                  </p>
                  <p className="text-sm font-medium text-[#1B2E3B]">
                    {status.activeRecallRun.status === "joining" && "Joining the call…"}
                    {status.activeRecallRun.status === "running" && "In the call — recording and transcribing."}
                    {status.activeRecallRun.status === "completed" && "Meeting ended. Summary and recording appear below when ready."}
                    {status.activeRecallRun.status === "failed" && "Bot could not stay in the call."}
                    {!["joining", "running", "completed", "failed"].includes(status.activeRecallRun.status) &&
                      (status.activeRecallRun.providerStatus ?? status.activeRecallRun.status)}
                  </p>
                  <p className="text-xs text-[#61707D]">
                    {status.activeRecallRun.botId && `Bot ID: ${status.activeRecallRun.botId} · `}
                    Provider: {String(status.activeRecallRun.providerStatus ?? status.activeRecallRun.status)}
                  </p>
                  {status.activeRecallRun.artifactMetadata && status.activeRecallRun.artifactMetadata.transcriptEntries > 0 && (
                    <p className="text-sm text-[#3F5363]">
                      Live transcript: {status.activeRecallRun.artifactMetadata.transcriptEntries} utterance(s) so far.
                    </p>
                  )}
                  {status.activeRecallRun.status === "completed" && status.transcriptSurface.previewLines.length === 0 && !status.summarySurface.summary && (
                    <p className="text-xs text-[#61707D]">
                      To get transcript and summary here, in Recall add webhook <code className="rounded bg-[#e8edf3] px-1">/api/webhooks/recall</code> and subscribe to <strong>transcript</strong> and <strong>bot</strong>; set the same secret in Recall and as RECALL_WEBHOOK_SECRET.
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
          {status.activeRecallRun && (status.activeRecallRun.status === "joining" || status.activeRecallRun.status === "running") && (
            <p className="text-xs text-[#61707D]">
              Status and transcript below update every few seconds while the bot is in the call.
            </p>
          )}
          <div className="rounded-relay-card border border-[var(--border)] bg-white/80 p-5 shadow-relay-soft">
            <h2 className="text-sm font-semibold tracking-tight text-[#1B2E3B]">
              Upcoming Google Meet
            </h2>
            <p className="mt-2 text-sm text-[#3F5363]">
              {upcomingStatus?.upcomingMeeting
                ? `${upcomingStatus.upcomingMeeting.title} at ${new Date(
                    upcomingStatus.upcomingMeeting.start
                  ).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`
                : "No upcoming Meet from Calendar."}
            </p>
            {lastJoinAttempt && (
              <p className="mt-2 text-xs text-[#61707D]">
                Link check: {lastJoinAttempt.state.replaceAll("_", " ")} — {lastJoinAttempt.detail}
              </p>
            )}
          </div>

          {status.activeRecallRun?.artifactMetadata?.recordingUrl && (
            <div className="rounded-relay-card border border-[var(--border)] bg-white/80 p-5 shadow-relay-soft">
              <h2 className="text-sm font-semibold tracking-tight text-[#1B2E3B]">
                Recording
              </h2>
              <div className="mt-3 rounded-relay-inner overflow-hidden border border-[var(--border)] bg-black/5">
                <video
                  src={status.activeRecallRun.artifactMetadata.recordingUrl}
                  controls
                  className="w-full max-h-[360px]"
                  playsInline
                >
                  Your browser does not support the video tag.
                </video>
              </div>
            </div>
          )}

          <div className="rounded-relay-card border border-[var(--border)] bg-white/80 p-5 shadow-relay-soft">
            <h2 className="text-sm font-semibold tracking-tight text-[#1B2E3B]">
              Meeting summary
            </h2>
            <div className="mt-3 rounded-relay-inner border border-[var(--border)] bg-white/60 p-4 text-sm text-[#3F5363] whitespace-pre-wrap">
              {status.summarySurface.summary ?? "No summary yet. It appears after the bot leaves and transcript is received."}
            </div>
          </div>

          {status.activeRecallRun?.proposedCalendarEvents && status.activeRecallRun.proposedCalendarEvents.length > 0 && (
            <SuggestedEventsCard
              proposedEvents={status.activeRecallRun.proposedCalendarEvents}
              runBotId={status.activeRecallRun.botId ?? ""}
              onUpdate={() => queryClient.invalidateQueries({ queryKey: ["meeting-readiness"] })}
            />
          )}

          {status.actionItemsSurface.items.length > 0 && (
            <div className="rounded-relay-card border border-[var(--border)] bg-white/80 p-5 shadow-relay-soft">
              <h2 className="text-sm font-semibold tracking-tight text-[#1B2E3B]">
                Action items
              </h2>
              <div className="mt-3 space-y-2">
                {status.actionItemsSurface.items.map((item) => (
                  <div
                    key={item}
                    className="rounded-relay-inner border border-[var(--border)] bg-white/60 p-3 text-sm text-[#314555]"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-relay-card border border-[var(--border)] bg-white/80 p-5 shadow-relay-soft">
            <h2 className="text-sm font-semibold tracking-tight text-[#1B2E3B]">
              {status.activeRecallRun?.status === "joining" || status.activeRecallRun?.status === "running"
                ? "Live transcript"
                : "Transcript"}
            </h2>
            <div className="mt-3 rounded-relay-inner border border-[var(--border)] bg-white/60 p-4 text-sm text-[#3F5363] max-h-[320px] overflow-y-auto">
              {status.transcriptSurface.previewLines.length > 0 ? (
                <div className="space-y-2">
                  {status.transcriptSurface.previewLines.map((line, i) => (
                    <p key={`${i}-${line.slice(0, 40)}`}>{line}</p>
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
