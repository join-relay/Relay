"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { AlertCircle, Calendar, FileText, Mic, Radio, ListTodo, ShieldCheck } from "lucide-react"
import { IntegrationCheckpointCard } from "@/components/meeting/IntegrationCheckpointCard"
import { JoinValidationPanel } from "@/components/meeting/JoinValidationPanel"
import { MeetingPageHeader } from "@/components/meeting/MeetingPageHeader"
import { markdownToPlainText, stripHtml } from "@/lib/utils"
import type {
  CalendarEventAttendee,
  MeetingLinkCheckAttempt,
  MeetingReadinessStatus,
  MeetingUpcomingStatus,
} from "@/types"

async function fetchMeetingReadinessStatus() {
  const response = await fetch("/api/meeting/status")
  if (!response.ok) {
    throw new Error("Failed to load Google meeting readiness status")
  }
  return response.json() as Promise<MeetingReadinessStatus>
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

function useMeetingBrief(eventId: string | null) {
  return useQuery({
    queryKey: ["meeting-brief", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/meeting/brief/${encodeURIComponent(eventId!)}`)
      if (!res.ok) throw new Error("Failed to load brief")
      return res.json()
    },
    enabled: Boolean(eventId),
  })
}

function useMeetingContext(eventId: string | null) {
  return useQuery({
    queryKey: ["meeting-context", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/meeting/context/${encodeURIComponent(eventId!)}`)
      if (!res.ok) throw new Error("Failed to load context")
      return res.json()
    },
    enabled: Boolean(eventId),
  })
}

function useMeetingArtifacts(eventId: string | null) {
  return useQuery({
    queryKey: ["meeting-artifacts", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/meeting/artifacts/${encodeURIComponent(eventId!)}`)
      if (!res.ok) throw new Error("Failed to load artifacts status")
      return res.json()
    },
    enabled: Boolean(eventId),
  })
}

function useMeetingSummary(eventId: string | null) {
  return useQuery({
    queryKey: ["meeting-summary", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/meeting/summary/${encodeURIComponent(eventId!)}`)
      if (!res.ok) throw new Error("Failed to load recap")
      return res.json()
    },
    enabled: Boolean(eventId),
  })
}

export default function MeetingPage() {
  const queryClient = useQueryClient()
  const {
    data: status,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["meeting-readiness"],
    queryFn: fetchMeetingReadinessStatus,
    refetchInterval: 5000,
  })
  const { data: upcomingStatus } = useQuery({
    queryKey: ["meeting-upcoming-status"],
    queryFn: fetchUpcomingStatus,
  })

  const eventId = upcomingStatus?.upcomingMeeting?.id ?? null
  const { data: briefData, isLoading: briefLoading } = useMeetingBrief(eventId)
  const { data: contextData } = useMeetingContext(eventId)
  const { data: artifactsData } = useMeetingArtifacts(eventId)
  const { data: summaryData } = useMeetingSummary(eventId)

  const generateAudioMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/meeting/update-audio/${encodeURIComponent(eventId!)}`, {
        method: "POST",
      })
      if (!res.ok) throw new Error("Failed to generate spoken update")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meeting-brief", eventId] })
    },
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
          <p className="text-sm text-[#3F5363]">Loading Google meeting readiness...</p>
        </div>
      </div>
    )
  }

  if (isError || !status) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="max-w-md rounded-relay-card border border-[#3F5363]/25 bg-white/80 p-5 text-center shadow-relay-soft">
          <p className="font-medium text-[#1B2E3B]">Something went wrong</p>
          <p className="mt-1 text-sm text-[#3F5363]">
            {error instanceof Error ? error.message : "Failed to load the Google meeting readiness view"}
          </p>
        </div>
      </div>
    )
  }

  const preparedCount = status.checkpoints.filter(
    (c) => c.state !== "not_configured" && c.state !== "blocked"
  ).length
  const validatedCount = status.checkpoints.filter((c) => c.state === "validated").length
  const lastJoinAttempt = joinMutation.data ?? status.lastLinkCheck
  const brief = briefData?.brief ?? null
  const context = contextData?.context ?? null
  const artifactState = artifactsData?.availability ?? "not_checked"
  const recap = summaryData?.recap ?? null

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
          <div className="rounded-relay-card border border-[var(--border)] bg-white/80 p-5 shadow-relay-soft">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold tracking-tight text-[#1B2E3B]">
                  Google meeting readiness
                </h2>
                <p className="mt-2 text-sm text-[#3F5363]">
                  Relay is preparing the honest Google Meet path for {status.botIdentity}. Live Google
                  auth and Calendar discovery appear separately from explicit fallback states.
                </p>
              </div>
              <span className="rounded-relay-control border border-[var(--border)] bg-[#e8edf3] px-2 py-1 text-xs font-medium capitalize text-[#314555]">
                {status.overallState.replaceAll("_", " ")}
              </span>
            </div>
            <div className="mt-4 grid gap-3">
              {status.checkpoints.map((checkpoint) => (
                <IntegrationCheckpointCard key={checkpoint.key} checkpoint={checkpoint} />
              ))}
            </div>
          </div>

          {eventId && (
            <>
              <div className="rounded-relay-card border border-[var(--border)] bg-white/80 p-5 shadow-relay-soft">
                <h2 className="text-sm font-semibold tracking-tight text-[#1B2E3B]">
                  Pre-meeting brief &amp; update
                </h2>
                <p className="mt-1 text-xs text-[#61707D]">
                  Context prepared from Calendar, Drive, Gmail, and briefing. Relay does not join the
                  meeting live.
                </p>
                {briefLoading ? (
                  <p className="mt-3 text-sm text-[#3F5363]">Loading brief…</p>
                ) : brief ? (
                  <div className="mt-3 space-y-3 text-sm text-[#3F5363]">
                    <div className="rounded-relay-inner border border-[var(--border)] bg-white/60 p-3">
                      <div className="flex items-center gap-2 text-[#1B2E3B]">
                        <FileText className="h-4 w-4" />
                        Brief
                      </div>
                      <p className="mt-2 whitespace-pre-wrap">{markdownToPlainText(brief.briefText)}</p>
                    </div>
                    <div className="rounded-relay-inner border border-[var(--border)] bg-white/60 p-3">
                      <div className="flex items-center gap-2 text-[#1B2E3B]">What you&apos;ve been working on</div>
                      <p className="mt-2 whitespace-pre-wrap">{markdownToPlainText(brief.workingOnUpdate)}</p>
                    </div>
                    <div className="rounded-relay-inner border border-[var(--border)] bg-white/60 p-3">
                      <div className="flex items-center gap-2 text-[#1B2E3B]">Suggested update text</div>
                      <p className="mt-2 whitespace-pre-wrap">{markdownToPlainText(brief.suggestedUpdateText)}</p>
                    </div>
                    <span className="inline-block rounded-relay-control border border-[var(--border)] bg-[#e8edf3] px-2 py-1 text-[11px] text-[#314555]">
                      Source: {brief.source}
                    </span>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-[#3F5363]">
                    No brief yet. Generate one from the upcoming Meet event (brief is created when you
                    open this page with an upcoming event).
                  </p>
                )}
              </div>

              <div className="rounded-relay-card border border-[var(--border)] bg-white/80 p-5 shadow-relay-soft">
                <h2 className="text-sm font-semibold tracking-tight text-[#1B2E3B]">
                  Spoken update artifact
                </h2>
                <p className="mt-1 text-xs text-[#61707D]">
                  TTS-generated audio for the suggested update. Server-side only; Relay does not speak
                  in the meeting.
                </p>
                <div className="mt-3 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => generateAudioMutation.mutate()}
                    disabled={generateAudioMutation.isPending}
                    className="inline-flex items-center gap-2 rounded-relay-control bg-[#213443] px-3 py-2 text-sm font-medium text-white shadow-relay-soft transition-smooth hover:bg-[#1B2E3B] disabled:opacity-60"
                  >
                    <Mic className="h-4 w-4" />
                    {generateAudioMutation.isPending ? "Generating…" : "Generate spoken update"}
                  </button>
                  {generateAudioMutation.data?.artifact?.generated && (
                    <span className="text-xs text-[#1B2E3B]">Artifact generated</span>
                  )}
                  {generateAudioMutation.data?.artifact && !generateAudioMutation.data.artifact.generated && (
                    <span className="text-xs text-[#61707D]">
                      {generateAudioMutation.data.artifact.failureReason ?? "Unavailable"}
                    </span>
                  )}
                </div>
              </div>
            </>
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
                      ).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`
                    : "No live Google Meet detected yet."}
                </p>
              </div>
              {context && (
                <>
                  <div className="rounded-relay-inner border border-[var(--border)] bg-white/60 p-3">
                    <div className="flex items-center gap-2 text-[#1B2E3B]">Agenda / description</div>
                    <p className="mt-1 whitespace-pre-wrap">
                      {stripHtml(context.agendaText) || "No agenda in event."}
                    </p>
                  </div>
                  {context.attendees.length > 0 && (
                    <div className="rounded-relay-inner border border-[var(--border)] bg-white/60 p-3">
                      <div className="flex items-center gap-2 text-[#1B2E3B]">Attendees</div>
                      <p className="mt-1">
                        {context.attendees.map((a: CalendarEventAttendee) => a.displayName || a.email || "—").join(", ")}
                      </p>
                    </div>
                  )}
                </>
              )}
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
                  <p>{upcomingStatus?.detail ?? "Upcoming Google Meet discovery stays explicit about whether it is live or fallback."}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-relay-card border border-[var(--border)] bg-white/80 p-5 shadow-relay-soft">
            <h2 className="text-sm font-semibold tracking-tight text-[#1B2E3B]">
              Meet artifact / transcript status
            </h2>
            <p className="mt-1 text-xs text-[#61707D]">
              Post-meeting transcript from Meet REST when available. Relay does not join the meeting
              live.
            </p>
            <div className="mt-3 rounded-relay-inner border border-[var(--border)] bg-white/60 p-3 text-sm">
              <span className="font-medium text-[#1B2E3B]">Status: </span>
              <span className="capitalize text-[#3F5363]">{artifactState.replace(/_/g, " ")}</span>
              {artifactsData?.failureReason && (
                <p className="mt-1 text-[#61707D]">{artifactsData.failureReason}</p>
              )}
            </div>
          </div>

          {eventId && (
            <div className="rounded-relay-card border border-[var(--border)] bg-white/80 p-5 shadow-relay-soft">
              <h2 className="text-sm font-semibold tracking-tight text-[#1B2E3B]">
                Post-meeting recap
              </h2>
              <p className="mt-1 text-xs text-[#61707D]">
                Generated from transcript/artifacts when available. Artifact-based; not live attendance.
              </p>
              {summaryData?.recap ? (
                <div className="mt-3 space-y-3 text-sm text-[#3F5363]">
                  <p className="whitespace-pre-wrap">{markdownToPlainText(recap.recapSummary)}</p>
                  {recap.decisions.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 font-medium text-[#1B2E3B]">
                        <ListTodo className="h-4 w-4" /> Decisions
                      </div>
                      <ul className="mt-1 list-inside list-disc">
                        {recap.decisions.map((d: string, i: number) => (
                          <li key={i}>{markdownToPlainText(d)}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {recap.blockers.length > 0 && (
                    <div>
                      <div className="font-medium text-[#1B2E3B]">Blockers</div>
                      <ul className="mt-1 list-inside list-disc">
                        {recap.blockers.map((b: string, i: number) => (
                          <li key={i}>{markdownToPlainText(b)}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {recap.nextSteps.length > 0 && (
                    <div>
                      <div className="font-medium text-[#1B2E3B]">Next steps</div>
                      <ul className="mt-1 list-inside list-disc">
                        {recap.nextSteps.map((s: string, i: number) => (
                          <li key={i}>{markdownToPlainText(s)}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {recap.suggestedFollowUp.length > 0 && (
                    <div>
                      <div className="font-medium text-[#1B2E3B]">Suggested follow-up</div>
                      <ul className="mt-1 list-inside list-disc">
                        {recap.suggestedFollowUp.map((f: string, i: number) => (
                          <li key={i}>{markdownToPlainText(f)}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <span className="inline-block rounded-relay-control border border-[var(--border)] bg-[#e8edf3] px-2 py-1 text-[11px] text-[#314555]">
                    Source: {recap.source}
                  </span>
                </div>
              ) : (
                <p className="mt-3 text-sm text-[#3F5363]">
                  No recap yet. Meet transcript API is not available in this integration; you can
                  provide transcript via the summary API to generate a recap.
                </p>
              )}
            </div>
          )}

          <div className="rounded-relay-card border border-[var(--border)] bg-white/80 p-5 shadow-relay-soft">
            <h2 className="text-sm font-semibold tracking-tight text-[#1B2E3B]">
              Runtime evidence
            </h2>
            <p className="mt-2 text-sm text-[#3F5363]">{status.runtimeEvidenceNote}</p>
            <div className="mt-3 rounded-relay-inner border border-[#3F5363]/25 bg-[#e8edf3]/70 p-3 text-sm text-[#314555]">
              <div className="flex items-start gap-2">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                <p>Live attendance unavailable / not implemented. All briefs and recaps are artifact-based or fallback.</p>
              </div>
            </div>
            {lastJoinAttempt && (
              <div className="mt-3 rounded-relay-inner border border-[var(--border)] bg-white/60 p-3 text-sm text-[#3F5363]">
                <p className="font-medium text-[#1B2E3B]">
                  Link check: {lastJoinAttempt.state.replaceAll("_", " ")}
                </p>
                <p className="mt-1">{lastJoinAttempt.detail}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
