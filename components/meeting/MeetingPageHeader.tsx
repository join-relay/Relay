"use client"

import { Radio, ShieldCheck } from "lucide-react"

interface MeetingPageHeaderProps {
  preparedCount: number
  validatedCount: number
  botLabel: string
}

export function MeetingPageHeader({
  preparedCount,
  validatedCount,
  botLabel,
}: MeetingPageHeaderProps) {
  return (
    <div className="relative overflow-hidden rounded-relay-card border border-[var(--border)] bg-white shadow-relay-elevated">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#e8edf3]/50 via-transparent to-transparent" />
      <div className="relative px-5 py-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-[#1B2E3B]">
              Google Meet readiness
            </h1>
            <p className="mt-0.5 text-sm text-[#3F5363]">
              Relay is now Google-first for upcoming Meet detection and honest fallback states.
            </p>
            <p className="mt-3 max-w-2xl text-sm text-[#314555]">
              Relay will only report validated milestones for {botLabel}.
              This page shows what is live from Google auth and Calendar today,
              and what still remains intentionally unimplemented.
            </p>
          </div>
          <div className="flex gap-6 shrink-0">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-relay-control bg-[#e8edf3] text-[#314555]">
                <Radio className="h-5 w-5" />
              </div>
              <div>
                <p className="text-lg font-semibold text-[#1B2E3B]">
                  {preparedCount}
                </p>
                <p className="text-xs text-[#3F5363]">Prepared</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-relay-control bg-[#e8edf3] text-[#314555]">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-lg font-semibold text-[#1B2E3B]">
                  {validatedCount}
                </p>
                <p className="text-xs text-[#3F5363]">Validated</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
