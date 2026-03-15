"use client"

import { useEffect, useRef, useState } from "react"
import { ChevronDown, ChevronUp, Mail, Calendar, Info } from "lucide-react"
import { cn } from "@/lib/utils"
import { DraftReview } from "./DraftReview"
import { ApprovalControls } from "./ApprovalControls"
import type { PendingAction, DraftEmailPayload, RescheduleMeetingPayload } from "@/types"

interface ActionCardProps {
  action: PendingAction
  onApprove: (id: string) => void
  onReject: (id: string) => void
  onEditContent: (id: string, content: DraftEmailPayload | RescheduleMeetingPayload) => void
  onGenerateDraft?: (id: string) => void
  onRegenerateDraft?: (id: string) => void
  isApproving?: boolean
  isRejecting?: boolean
  isGeneratingDraft?: boolean
  isFocused?: boolean
  autoEnterEdit?: boolean
}

const urgencyStyles = {
  urgent: "border-[#3F5363]/25 bg-[#e8edf3]/80",
  important: "border-[#61707D]/30 bg-[#c9d4de]/50",
  low: "border-[var(--border)] bg-white/50",
}

const statusStyles = {
  pending: "bg-[#e8edf3] text-[#314555]",
  approved: "bg-[#1B2E3B]/10 text-[#1B2E3B]",
  rejected: "bg-[#7c3a2d]/10 text-[#7c3a2d]",
}

export function ActionCard({
  action,
  onApprove,
  onReject,
  onEditContent,
  onGenerateDraft,
  onRegenerateDraft,
  isApproving = false,
  isRejecting = false,
  isGeneratingDraft = false,
  isFocused = false,
  autoEnterEdit = false,
}: ActionCardProps) {
  const cardRef = useRef<HTMLDivElement | null>(null)
  const [expanded, setExpanded] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [showFullOriginal, setShowFullOriginal] = useState(false)

  const handleApprove = () => onApprove(action.id)
  const handleReject = () => onReject(action.id)
  const handleEditClick = () => setIsEditing(true)
  const handleEditContent = (content: DraftEmailPayload | RescheduleMeetingPayload) => {
    onEditContent(action.id, content)
    setIsEditing(false)
  }

  const isPending = action.status === "pending"
  const emailDraftContent =
    action.type === "draft_email"
      ? ((action.reviewedContent ?? action.proposedAction) as DraftEmailPayload)
      : null
  const canApproveEmailDraft =
    action.type !== "draft_email" || Boolean(emailDraftContent?.body?.trim())
  const TypeIcon = action.type === "draft_email" ? Mail : Calendar
  const provenanceLabel =
    action.provenance.origin === "live"
      ? action.provenance.provider === "gmail"
        ? "Live Gmail"
        : "Live Calendar"
      : "Demo fallback"

  useEffect(() => {
    if (!isFocused) return
    setExpanded(true)
    cardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [isFocused])

  useEffect(() => {
    if (!isFocused || !autoEnterEdit || action.type !== "draft_email" || action.status !== "pending") return
    setIsEditing(true)
  }, [action.status, action.type, autoEnterEdit, isFocused])

  return (
    <div
      id={`action-${action.id}`}
      data-testid={`action-card-${action.id}`}
      ref={cardRef}
      className={cn(
        "rounded-relay-card border p-4 shadow-relay-soft transition-smooth",
        urgencyStyles[action.urgency],
        isFocused && "ring-2 ring-[#213443]/15"
      )}
    >
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-start gap-3 text-left"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-relay-control bg-white/80 text-[#314555]">
          <TypeIcon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-[#1B2E3B]">{action.title}</p>
            <span
              className={cn(
                "rounded-relay-control px-2 py-0.5 text-xs font-medium capitalize",
                statusStyles[action.status]
              )}
            >
              {action.status}
            </span>
            <span className="text-[10px] font-medium uppercase tracking-wider text-[#3F5363]">
              {action.urgency}
            </span>
          </div>
          <p className="mt-0.5 text-sm text-[#3F5363]">{action.sourceContext}</p>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-[#61707D]" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-[#61707D]" />
        )}
      </button>

      {expanded && (
        <div className="mt-4 space-y-4 pl-12">
          <div className="rounded-relay-control bg-white/60 p-2 text-xs text-[#3F5363] border border-[var(--border)]">
            <button
              type="button"
              className="flex items-center gap-1.5 hover:text-[#1B2E3B] transition-smooth"
            >
              <Info className="h-3 w-3" />
              Why this surfaced: {action.whySurfaced}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span
              className={cn(
                "rounded-relay-control px-2 py-1 font-medium",
                action.provenance.origin === "live"
                  ? "bg-[#213443]/10 text-[#213443]"
                  : "bg-[#e8edf3] text-[#314555]"
              )}
            >
              {provenanceLabel}
            </span>
            {action.personalization && (
              <span className="rounded-relay-control border border-[#213443]/15 bg-white/80 px-2 py-1 text-[#314555]">
                {action.personalization.styleSource === "sent_mail"
                  ? "Personalized reply"
                  : "Saved preferences"}
              </span>
            )}
            {action.personalization?.generation?.source === "deterministic_fallback" && (
              <span className="rounded-relay-control border border-[var(--border)] bg-white/80 px-2 py-1 text-[#314555]">
                Fallback draft
              </span>
            )}
          </div>

          {action.originalContext && (
            <div className="rounded-relay-inner border border-[var(--border)] bg-white/70 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-[#61707D]">
                    Original {action.originalContext.kind === "gmail_thread" ? "thread" : "event"}
                  </p>
                  <p className="mt-1 text-sm text-[#314555]">{action.originalContext.preview}</p>
                </div>
                {action.originalContext.kind === "gmail_thread" && (
                  <button
                    type="button"
                    onClick={() => setShowFullOriginal((current) => !current)}
                    className="shrink-0 rounded-relay-control border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-medium text-[#1B2E3B] transition-smooth hover:bg-[#e8edf3]"
                  >
                    {showFullOriginal ? "Hide full thread" : "Show full thread"}
                  </button>
                )}
              </div>

              {action.originalContext.kind === "gmail_thread" ? (
                <div className="mt-3 space-y-2">
                  {showFullOriginal ? (
                    action.originalContext.thread.messages.map((message) => (
                      <div
                        key={message.id}
                        className="rounded-relay-control border border-[var(--border)] bg-white/80 p-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-medium text-[#1B2E3B]">{message.from}</p>
                          <p className="text-xs text-[#61707D]">
                            {new Date(message.date).toLocaleString()}
                          </p>
                        </div>
                        {message.to && (
                          <p className="mt-1 text-xs text-[#61707D]">To: {message.to}</p>
                        )}
                        <p className="mt-2 whitespace-pre-wrap text-sm text-[#314555]">
                          {message.bodyPreview || message.snippet}
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-relay-control border border-[var(--border)] bg-white/80 p-3">
                      <p className="text-sm text-[#314555]">
                        {action.originalContext.thread.messages.at(-1)?.bodyPreview ??
                          action.originalContext.thread.preview}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <div className="rounded-relay-control border border-[var(--border)] bg-white/80 p-3">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-[#61707D]">
                      Current timing
                    </p>
                    <p className="mt-1 text-sm text-[#1B2E3B]">
                      {new Date(action.originalContext.currentStart).toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                      })}{" "}
                      to{" "}
                      {new Date(action.originalContext.currentEnd).toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <div className="rounded-relay-control border border-[var(--border)] bg-white/80 p-3">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-[#61707D]">
                      Location
                    </p>
                    <p className="mt-1 text-sm text-[#1B2E3B]">
                      {action.originalContext.location ?? "No location attached"}
                    </p>
                  </div>
                </div>
              )}

              {action.personalization && (
                <div className="mt-3 space-y-1 text-xs text-[#61707D]">
                  <p>{action.personalization.summary}</p>
                </div>
              )}
            </div>
          )}

          {action.status === "approved" && action.executionSummary && (
            <div className="rounded-relay-inner border border-[#1B2E3B]/20 bg-white/80 p-3">
              <p className="text-sm font-medium text-[#1B2E3B] flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#1B2E3B]" />
                Executed
              </p>
              <p className="mt-0.5 text-sm text-[#3F5363]">{action.executionSummary}</p>
              {action.executedAt && (
                <p className="mt-1 text-xs text-[#61707D]">
                  {new Date(action.executedAt).toLocaleString()}
                </p>
              )}
            </div>
          )}

          {action.status === "rejected" && (
            <p className="text-sm text-[#61707D]">This action was declined.</p>
          )}

          {isPending && (
            <>
              <DraftReview
                action={action}
                onEdit={handleEditContent}
                onGenerateDraft={
                  action.type === "draft_email" && onGenerateDraft
                    ? () => onGenerateDraft(action.id)
                    : undefined
                }
                onRegenerateDraft={
                  action.type === "draft_email" && onRegenerateDraft
                    ? () => onRegenerateDraft(action.id)
                    : undefined
                }
                onCancelEdit={() => setIsEditing(false)}
                isEditing={isEditing}
                isGenerating={isGeneratingDraft}
                readOnly={false}
              />
              <ApprovalControls
                onApprove={handleApprove}
                onReject={handleReject}
                onEdit={action.type === "draft_email" ? handleEditClick : undefined}
                isApproving={isApproving}
                isRejecting={isRejecting}
                approveDisabled={!canApproveEmailDraft || isGeneratingDraft}
                provenance={action.provenance}
              />
            </>
          )}
        </div>
      )}
    </div>
  )
}
