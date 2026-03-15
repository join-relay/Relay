"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { AlertCircle, Calendar, Radio } from "lucide-react"
import { IntegrationCheckpointCard } from "@/components/meeting/IntegrationCheckpointCard"
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

      <div
        data-testid="meeting-resolution-state"
        className="rounded-relay-card border border-[var(--border)] bg-white/80 p-4 shadow-relay-soft"
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-[#61707D]">
              Meeting resolution
            </p>
            <p className="mt-1 text-sm text-[#3F5363]">
              {status.resolutionState === "live"
                ? "Live Google readiness resolved successfully."
                : status.resolutionState === "empty"
                  ? "Live Google readiness resolved, but no current Google Meet was found."
                  : status.resolutionState === "fallback"
                    ? "Meeting readiness resolved to an explicit fallback state."
                    : "Meeting readiness resolved to an explicit error state."}
            </p>
          </div>
          <span className="rounded-relay-control border border-[var(--border)] bg-[#e8edf3] px-2 py-1 text-xs font-medium uppercase text-[#314555]">
            {status.resolutionState}
          </span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.35fr,0.95fr] animate-relay-fade-in opacity-0 [animation-delay:75ms] [animation-fill-mode:forwards]">
        <div className="space-y-4">
          <div className="rounded-relay-card border border-[var(--border)] bg-white/80 p-5 shadow-relay-soft">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold tracking-tight text-[#1B2E3B]">
                  Google meeting readiness
                </h2>
                <p className="mt-2 text-sm text-[#3F5363]">
                  Relay is preparing the honest Google Meet path for {status.botIdentity}.
                  Live Google auth and Calendar discovery appear separately from
                  explicit fallback states.
                </p>
              </div>
              <span className="rounded-relay-control border border-[var(--border)] bg-[#e8edf3] px-2 py-1 text-xs font-medium capitalize text-[#314555]">
                {status.overallState.replaceAll("_", " ")}
              </span>
            </div>

            <div className="mt-4 grid gap-3">
              {status.checkpoints.map((checkpoint) => (
                <IntegrationCheckpointCard
                  key={checkpoint.key}
                  checkpoint={checkpoint}
                />
              ))}
            </div>
          </div>

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
              Current assumptions
            </h2>
            <div className="mt-3 space-y-2">
              {status.assumptions.map((assumption) => (
                <div
                  key={assumption}
                  className="rounded-relay-inner border border-[var(--border)] bg-white/60 p-3 text-sm text-[#3F5363]"
                >
                  {assumption}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-relay-card border border-[var(--border)] bg-white/80 p-5 shadow-relay-soft">
            <h2 className="text-sm font-semibold tracking-tight text-[#1B2E3B]">
              What still requires action
            </h2>
            <div className="mt-3 space-y-2">
              {status.manualSteps.map((step) => (
                <div
                  key={step}
                  className="rounded-relay-inner border border-[var(--border)] bg-white/60 p-3 text-sm text-[#3F5363]"
                >
                  {step}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-relay-card border border-[var(--border)] bg-white/80 p-5 shadow-relay-soft">
            <h2 className="text-sm font-semibold tracking-tight text-[#1B2E3B]">
              Future meeting writing
            </h2>
            <p className="mt-2 text-sm text-[#3F5363]">
              {status.customizationSummary ??
                "Meeting personalization is ready for future summaries and updates."}
            </p>
          </div>

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
