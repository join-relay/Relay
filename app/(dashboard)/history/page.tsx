import { Ban, Calendar, CheckCircle2, Mail, Radio, XCircle } from "lucide-react"
import { listActionExecutions } from "@/lib/persistence/action-executions"
import { listMeetingHistoryEntries } from "@/lib/persistence/meeting-history"
import { listMeetingRuns } from "@/lib/persistence/meeting-runs"
import type { ActionExecutionRecord, MeetingHistoryEntry, MeetingRunRecord } from "@/types"

export const dynamic = "force-dynamic"

function formatRecordedAt(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  })
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  })
}

function formatSourceLabel(record: ActionExecutionRecord) {
  if (record.source === "mock") return "Demo fallback"
  return record.provider === "gmail" ? "Live Gmail" : "Live Calendar"
}

function formatSourceType(record: ActionExecutionRecord) {
  switch (record.sourceType) {
    case "gmail_thread":
      return "Gmail thread"
    case "calendar_event":
      return "Calendar event"
    default:
      return "Demo fallback"
  }
}

function renderExecutionDetails(record: ActionExecutionRecord) {
  if (record.type === "draft_email" && "subject" in record.proposedPayload) {
    return (
      <>
        <DetailRow label="Recipient" value={record.proposedPayload.to ?? "Unknown"} />
        <DetailRow label="Subject" value={record.proposedPayload.subject} />
        {record.source === "live" ? (
          <>
            <DetailRow
              label="Thread ID"
              value={record.sourceIdentifiers?.gmailThreadId ?? record.proposedPayload.threadId ?? "Not captured"}
              monospace
            />
            <DetailRow
              label="Message ID"
              value={record.sourceIdentifiers?.gmailMessageId ?? "Not captured"}
              monospace
            />
          </>
        ) : (
          <DetailRow
            label="Demo source"
            value={record.sourceIdentifiers?.demoActionId ?? record.actionId}
            monospace
          />
        )}
      </>
    )
  }

  if (record.type === "reschedule_meeting" && "eventId" in record.proposedPayload) {
    return (
      <>
        <DetailRow label="Event" value={record.proposedPayload.eventTitle} />
        <DetailRow
          label="From"
          value={`${formatDateTime(record.proposedPayload.currentStart)} to ${formatDateTime(record.proposedPayload.currentEnd)}`}
        />
        <DetailRow
          label="To"
          value={`${formatDateTime(record.proposedPayload.proposedStart)} to ${formatDateTime(record.proposedPayload.proposedEnd)}`}
        />
        {record.source === "live" ? (
          <>
            <DetailRow
              label="Calendar ID"
              value={record.sourceIdentifiers?.calendarId ?? "Not captured"}
              monospace
            />
            <DetailRow
              label="Event ID"
              value={record.sourceIdentifiers?.calendarEventId ?? record.proposedPayload.eventId}
              monospace
            />
          </>
        ) : (
          <DetailRow
            label="Demo source"
            value={record.sourceIdentifiers?.demoActionId ?? record.actionId}
            monospace
          />
        )}
      </>
    )
  }

  return null
}

function MeetingRunCard({ run }: { run: MeetingRunRecord }) {
  const transcriptCount = run.artifactMetadata?.transcriptEntries ?? run.transcriptEntries?.length ?? 0
  return (
    <li className="rounded-relay-card border border-[var(--border)] bg-white/80 p-4 shadow-relay-soft">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-relay-control bg-[#e8edf3] text-[#314555]">
            <Radio className="h-4 w-4" />
          </div>
          <div>
            <p className="font-medium text-[#1B2E3B]">Recall bot run</p>
            <p className="text-sm text-[#3F5363]">{run.meetingUrl}</p>
            <p className="mt-1 text-xs text-[#61707D]">
              {formatRecordedAt(run.createdAt)} · updated {formatRecordedAt(run.updatedAt)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-relay-control bg-[#e8edf3] px-2 py-1 text-[11px] font-medium text-[#314555]">
            {run.status}
          </span>
          {run.providerStatus && (
            <span className="rounded-relay-control border border-[var(--border)] bg-white/70 px-2 py-1 text-[11px] font-medium text-[#3F5363]">
              {run.providerStatus.replaceAll(".", " ")}
            </span>
          )}
        </div>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <div className="rounded-relay-inner border border-[var(--border)] bg-white/60 p-3">
          <p className="text-[11px] font-medium uppercase tracking-wider text-[#61707D]">Bot ID</p>
          <p className="mt-1 truncate font-mono text-xs text-[#314555]">{run.botId ?? "—"}</p>
        </div>
        <div className="rounded-relay-inner border border-[var(--border)] bg-white/60 p-3">
          <p className="text-[11px] font-medium uppercase tracking-wider text-[#61707D]">Transcript</p>
          <p className="mt-1 text-sm text-[#314555]">
            {transcriptCount > 0 ? `${transcriptCount} utterance(s)` : "No transcript yet"}
          </p>
        </div>
        <div className="rounded-relay-inner border border-[var(--border)] bg-white/60 p-3">
          <p className="text-[11px] font-medium uppercase tracking-wider text-[#61707D]">Run ID</p>
          <p className="mt-1 truncate font-mono text-xs text-[#314555]">{run.id}</p>
        </div>
      </div>
      {run.providerError && (
        <p className="mt-2 rounded-relay-inner border border-[#7c3a2d]/20 bg-[#7c3a2d]/5 px-3 py-2 text-sm text-[#7c3a2d]">
          {run.providerError}
        </p>
      )}
    </li>
  )
}

function MeetingHistoryCard({ entry }: { entry: MeetingHistoryEntry }) {
  return (
    <li className="rounded-relay-card border border-[var(--border)] bg-white/80 p-4 shadow-relay-soft">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-relay-control bg-[#e8edf3] text-[#314555]">
            <Calendar className="h-4 w-4" />
          </div>
          <div>
            <p className="font-medium text-[#1B2E3B]">{entry.title}</p>
            <p className="text-sm text-[#3F5363]">{formatRecordedAt(entry.occurredAt)}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-relay-control bg-[#e8edf3] px-2 py-1 text-[11px] font-medium text-[#314555]">
            {entry.provider.replaceAll("_", " ")}
          </span>
          <span className="rounded-relay-control border border-[var(--border)] bg-white/70 px-2 py-1 text-[11px] font-medium text-[#3F5363]">
            {entry.source.replaceAll("_", " ")}
          </span>
        </div>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <div className="rounded-relay-inner border border-[var(--border)] bg-white/60 p-3">
          <p className="text-[11px] font-medium uppercase tracking-wider text-[#61707D]">Summary</p>
          <p className="mt-1 text-sm text-[#314555]">
            {entry.summary ?? "No summary stored yet."}
          </p>
        </div>
        <div className="rounded-relay-inner border border-[var(--border)] bg-white/60 p-3">
          <p className="text-[11px] font-medium uppercase tracking-wider text-[#61707D]">
            Action items
          </p>
          {entry.actionItems.length > 0 ? (
            <div className="mt-1 space-y-1 text-sm text-[#314555]">
              {entry.actionItems.map((item) => (
                <p key={item}>{item}</p>
              ))}
            </div>
          ) : (
            <p className="mt-1 text-sm text-[#314555]">No action items stored yet.</p>
          )}
        </div>
        <div className="rounded-relay-inner border border-[var(--border)] bg-white/60 p-3">
          <p className="text-[11px] font-medium uppercase tracking-wider text-[#61707D]">
            Transcript
          </p>
          {entry.transcriptPreview.length > 0 ? (
            <div className="mt-1 space-y-1 text-sm text-[#314555]">
              {entry.transcriptPreview.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          ) : (
            <p className="mt-1 text-sm text-[#314555]">
              Transcript {entry.transcriptState === "pending" ? "pending" : "unavailable"}.
            </p>
          )}
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <DetailRow label="Participants" value={entry.metadata.participantsLabel} />
        <DetailRow label="Artifacts" value={entry.metadata.artifactLabel} />
        <DetailRow label="Duration" value={entry.metadata.durationLabel ?? "Not captured"} />
      </div>
    </li>
  )
}

function DetailRow({
  label,
  value,
  monospace = false,
}: {
  label: string
  value: string
  monospace?: boolean
}) {
  return (
    <div className="rounded-relay-control border border-[var(--border)] bg-white/70 px-3 py-2">
      <p className="text-[11px] font-medium uppercase tracking-wider text-[#61707D]">{label}</p>
      <p className={`mt-1 text-sm text-[#1B2E3B] ${monospace ? "font-mono text-xs break-all" : ""}`}>
        {value}
      </p>
    </div>
  )
}

export default async function HistoryPage() {
  const [executions, meetingEntries, meetingRuns] = await Promise.all([
    listActionExecutions(),
    listMeetingHistoryEntries(),
    listMeetingRuns(),
  ])

  return (
    <div className="space-y-6">
      <div className="animate-relay-fade-in">
        <h1 className="text-2xl font-semibold tracking-tight text-[#1B2E3B]">
          History
        </h1>
        <p className="mt-0.5 text-sm text-[#3F5363]">
          Actions and meeting records with explicit provenance, artifact honesty, and room for future transcript or summary data.
        </p>
      </div>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-[#1B2E3B]">Action history</h2>
          <p className="mt-1 text-sm text-[#3F5363]">
            Approved, failed, and rejected action outcomes with explicit provenance.
          </p>
        </div>
        {executions.length === 0 ? (
        <div className="animate-relay-fade-in rounded-relay-card border border-[var(--border)] bg-white/80 p-8 text-center shadow-relay-soft">
          <p className="text-[#3F5363]">No action history yet.</p>
          <p className="mt-1 text-sm text-[#314555]">
            Approve or reject an action on the Actions page to see it here.
          </p>
        </div>
      ) : (
        <ul className="space-y-3 animate-relay-fade-in opacity-0 [animation-delay:75ms] [animation-fill-mode:forwards]">
          {executions.map((ex) => (
            <li
              key={ex.id}
              className="rounded-relay-card border border-[var(--border)] bg-white/80 p-4 shadow-relay-soft"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-relay-control bg-[#e8edf3] text-[#314555]">
                    {ex.type === "draft_email" ? (
                      <Mail className="h-4 w-4" />
                    ) : (
                      <Calendar className="h-4 w-4" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-[#1B2E3B]">{ex.title}</p>
                    <p className="text-sm text-[#3F5363]">{formatRecordedAt(ex.executedAt)}</p>
                    <p className="mt-1 text-sm text-[#314555]">{ex.sourceContext}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {ex.status === "success" ? (
                    <span className="flex items-center gap-1 rounded-relay-control bg-green-50 px-2 py-1 text-sm text-[#1B2E3B]">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      Success
                    </span>
                  ) : ex.status === "rejected" ? (
                    <span className="flex items-center gap-1 rounded-relay-control bg-amber-50 px-2 py-1 text-sm text-amber-700">
                      <Ban className="h-4 w-4" />
                      Rejected
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 rounded-relay-control bg-red-50 px-2 py-1 text-sm text-red-600">
                      <XCircle className="h-4 w-4" />
                      Failed
                    </span>
                  )}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <span
                  className={`rounded-relay-control px-2 py-1 text-[11px] font-medium ${
                    ex.source === "live"
                      ? "bg-[#213443]/10 text-[#213443]"
                      : "bg-[#e8edf3] text-[#314555]"
                  }`}
                >
                  {formatSourceLabel(ex)}
                </span>
                <span className="rounded-relay-control border border-[var(--border)] bg-white/70 px-2 py-1 text-[11px] font-medium text-[#3F5363]">
                  {formatSourceType(ex)}
                </span>
              </div>
              {ex.executionSummary && (
                <p
                  className={`mt-3 rounded-relay-inner border px-3 py-2 text-sm ${
                    ex.status === "rejected"
                      ? "border-amber-200 bg-amber-50/60 text-amber-800"
                      : "border-[var(--border)] bg-white/70 text-[#314555]"
                  }`}
                >
                  {ex.executionSummary}
                </p>
              )}
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <DetailRow label="Provider" value={ex.provider} />
                <DetailRow
                  label="Origin"
                  value={ex.source === "live" ? "Live data" : "Demo fallback"}
                />
                {renderExecutionDetails(ex)}
              </div>
              {ex.status === "failed" && ex.errorMessage && (
                <p className="mt-2 text-sm text-red-600 rounded-relay-inner border border-red-200 bg-red-50/50 px-3 py-2">
                  {ex.errorMessage}
                </p>
              )}
            </li>
          ))}
        </ul>
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-[#1B2E3B]">Meeting history</h2>
          <p className="mt-1 text-sm text-[#3F5363]">
            Recall meeting runs and manual/placeholder meeting records with transcript availability.
          </p>
        </div>
        {meetingRuns.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#61707D]">
              Recall meeting runs
            </h3>
            <ul className="space-y-3">
              {meetingRuns.map((run) => (
                <MeetingRunCard key={run.id} run={run} />
              ))}
            </ul>
          </div>
        )}
        {meetingEntries.length === 0 && meetingRuns.length === 0 ? (
          <div className="rounded-relay-card border border-[var(--border)] bg-white/80 p-8 text-center shadow-relay-soft">
            <p className="text-[#3F5363]">No meeting history yet.</p>
            <p className="mt-1 text-sm text-[#314555]">
              Create a Recall bot on the Meeting page to see runs here. Manual meeting entries will appear when available.
            </p>
          </div>
        ) : meetingEntries.length > 0 ? (
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#61707D]">
              Meeting entries
            </h3>
            <ul className="space-y-3">
              {meetingEntries.map((entry) => (
                <MeetingHistoryCard key={entry.id} entry={entry} />
              ))}
            </ul>
          </div>
        ) : null}
      </section>
    </div>
  )
}
