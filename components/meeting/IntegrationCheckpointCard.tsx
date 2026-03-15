"use client"

import { AlertCircle, CheckCircle2, Clock3, ShieldOff } from "lucide-react"
import { cn } from "@/lib/utils"
import type { IntegrationState, MeetingIntegrationCheckpoint } from "@/types"

const badgeStyles: Record<IntegrationState, string> = {
  not_configured: "border-[#7c3a2d]/20 bg-[#7c3a2d]/5 text-[#7c3a2d]",
  blocked: "border-[#7c3a2d]/20 bg-[#7c3a2d]/5 text-[#7c3a2d]",
  fallback:
    "border-[#3F5363]/20 bg-[#e8edf3]/65 text-[#314555]",
  validated: "border-[#1B2E3B]/20 bg-[#1B2E3B]/5 text-[#1B2E3B]",
}

function StatusIcon({ state }: { state: IntegrationState }) {
  if (state === "validated") {
    return <CheckCircle2 className="h-4 w-4" />
  }
  if (state === "fallback") {
    return <Clock3 className="h-4 w-4" />
  }
  if (state === "not_configured") {
    return <ShieldOff className="h-4 w-4" />
  }
  return <AlertCircle className="h-4 w-4" />
}

interface IntegrationCheckpointCardProps {
  checkpoint: MeetingIntegrationCheckpoint
}

export function IntegrationCheckpointCard({
  checkpoint,
}: IntegrationCheckpointCardProps) {
  return (
    <div className="rounded-relay-card border border-[var(--border)] bg-white/80 p-4 shadow-relay-soft">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[#1B2E3B]">
            {checkpoint.label}
          </p>
          <p className="mt-1 text-sm text-[#3F5363]">{checkpoint.detail}</p>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-relay-control border px-2 py-1 text-[11px] font-medium capitalize",
            badgeStyles[checkpoint.state]
          )}
        >
          <StatusIcon state={checkpoint.state} />
          {checkpoint.state.replaceAll("_", " ")}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[#61707D]">
        <span className="rounded-relay-control bg-[#e8edf3] px-2 py-1">
          Source: {checkpoint.source}
        </span>
        {checkpoint.blocker && (
          <span className="rounded-relay-control border border-[#7c3a2d]/15 bg-[#7c3a2d]/5 px-2 py-1 text-[#7c3a2d]">
            {checkpoint.blocker}
          </span>
        )}
      </div>
    </div>
  )
}
