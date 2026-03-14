"use client"

import { useState } from "react"
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
  isApproving?: boolean
  isRejecting?: boolean
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
  isApproving = false,
  isRejecting = false,
}: ActionCardProps) {
  const [expanded, setExpanded] = useState(true)
  const [isEditing, setIsEditing] = useState(false)

  const handleApprove = () => onApprove(action.id)
  const handleReject = () => onReject(action.id)
  const handleEditClick = () => setIsEditing(true)
  const handleEditContent = (content: DraftEmailPayload | RescheduleMeetingPayload) => {
    onEditContent(action.id, content)
    setIsEditing(false)
  }

  const isPending = action.status === "pending"
  const TypeIcon = action.type === "draft_email" ? Mail : Calendar

  return (
    <div
      className={cn(
        "rounded-relay-card border p-4 shadow-relay-soft transition-smooth",
        urgencyStyles[action.urgency]
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
                onCancelEdit={() => setIsEditing(false)}
                isEditing={isEditing}
                readOnly={false}
              />
              <ApprovalControls
                onApprove={handleApprove}
                onReject={handleReject}
                onEdit={action.type === "draft_email" ? handleEditClick : undefined}
                isApproving={isApproving}
                isRejecting={isRejecting}
              />
            </>
          )}
        </div>
      )}
    </div>
  )
}
