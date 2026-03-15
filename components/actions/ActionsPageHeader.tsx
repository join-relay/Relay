"use client"

import { Zap, AlertCircle } from "lucide-react"

interface ActionsPageHeaderProps {
  pendingCount: number
  urgentCount: number
  conflictCount?: number
  sourceLabel?: string
  statusNote?: string
}

export function ActionsPageHeader({
  pendingCount,
  urgentCount,
  conflictCount = 0,
  sourceLabel = "Demo Actions",
  statusNote = "Actions stay review-only and mock-backed in this pass. Real Gmail send and Calendar changes come later.",
}: ActionsPageHeaderProps) {
  const hasUrgency = urgentCount > 0 || conflictCount > 0
  const summaryLine =
    pendingCount === 0
      ? "No actions pending review."
      : pendingCount === 1
        ? "1 action ready for your review."
        : `${pendingCount} actions ready for your review.`

  return (
    <div className="relative overflow-hidden rounded-relay-card bg-white shadow-relay-elevated border border-[var(--border)]">
      <div className="absolute inset-0 bg-gradient-to-br from-[#e8edf3]/50 via-transparent to-transparent pointer-events-none" />
      <div className="relative px-5 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-[#1B2E3B]">
              Pending actions
            </h1>
            <p className="mt-0.5 text-sm text-[#3F5363]">{summaryLine}</p>
            <div className="mt-2">
              <span className="rounded-relay-control border border-[var(--border)] bg-white px-2 py-1 text-[11px] font-medium text-[#314555]">
                {sourceLabel}
              </span>
            </div>
            {hasUrgency && (
              <p className="mt-1.5 text-sm text-[#314555]">
                {urgentCount > 0 && `${urgentCount} urgent`}
                {urgentCount > 0 && conflictCount > 0 && " · "}
                {conflictCount > 0 && `${conflictCount} conflict${conflictCount !== 1 ? "s" : ""}`}
              </p>
            )}
            <p className="mt-3 text-xs text-[#61707D] max-w-lg">
              {statusNote}
            </p>
          </div>
          <div className="flex gap-6 shrink-0">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-relay-control bg-[#e8edf3] text-[#314555]">
                <Zap className="h-5 w-5" />
              </div>
              <div>
                <p className="text-lg font-semibold text-[#1B2E3B]">
                  {pendingCount}
                </p>
                <p className="text-xs text-[#3F5363]">Pending</p>
              </div>
            </div>
            {hasUrgency && (
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-relay-control bg-[#e8edf3] text-[#314555]">
                  <AlertCircle className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-lg font-semibold text-[#1B2E3B]">
                    {urgentCount + conflictCount}
                  </p>
                  <p className="text-xs text-[#3F5363]">Need attention</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
