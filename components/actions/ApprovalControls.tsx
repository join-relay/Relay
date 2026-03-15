"use client"

import { Check, X, Pencil } from "lucide-react"
import type { ActionProvenance } from "@/types"

interface ApprovalControlsProps {
  onApprove: () => void
  onReject: () => void
  onEdit?: () => void
  isApproving?: boolean
  isRejecting?: boolean
  approveDisabled?: boolean
  provenance: ActionProvenance
}

function getApprovalNote(provenance: ActionProvenance) {
  if (provenance.origin === "live" && provenance.provider === "gmail") {
    return "Approving will execute against the linked Gmail thread."
  }

  if (provenance.origin === "live" && provenance.provider === "google_calendar") {
    return "Approving will patch the linked Google Calendar event."
  }

  return "Approving records a demo fallback execution only. It will not touch Gmail or Calendar."
}

export function ApprovalControls({
  onApprove,
  onReject,
  onEdit,
  isApproving = false,
  isRejecting = false,
  approveDisabled = false,
  provenance,
}: ApprovalControlsProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <p className="w-full text-xs text-[#3F5363]">
        {getApprovalNote(provenance)}
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onApprove}
          disabled={isApproving || isRejecting || approveDisabled}
          className="inline-flex items-center gap-2 rounded-relay-control bg-[#213443] px-4 py-2 text-sm font-medium text-white shadow-relay-soft transition-smooth hover:bg-[#1B2E3B] disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isApproving ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Executing…
            </>
          ) : (
            <>
              <Check className="h-4 w-4" />
              Approve & execute
            </>
          )}
        </button>
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            disabled={isApproving || isRejecting}
            className="inline-flex items-center gap-2 rounded-relay-control border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium text-[#1B2E3B] transition-smooth hover:bg-[#e8edf3] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Pencil className="h-4 w-4" />
            Edit before approve
          </button>
        )}
        <button
          type="button"
          onClick={onReject}
          disabled={isApproving || isRejecting}
          className="inline-flex items-center gap-2 rounded-relay-control border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium text-[#7c3a2d] transition-smooth hover:bg-[#7c3a2d]/10 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isRejecting ? (
            "Rejecting…"
          ) : (
            <>
              <X className="h-4 w-4" />
              Reject
            </>
          )}
        </button>
      </div>
    </div>
  )
}
