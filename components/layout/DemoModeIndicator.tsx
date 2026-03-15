"use client"

import { useQuery } from "@tanstack/react-query"
import { cn } from "@/lib/utils"

interface DemoModeIndicatorProps {
  className?: string
}

async function fetchIntegrationStatus() {
  const response = await fetch("/api/integrations/google/status")
  if (!response.ok) {
    throw new Error("Failed to load Google integration status")
  }

  return response.json() as Promise<{
    canUseLiveBriefing?: boolean
    note?: string
  }>
}

export function DemoModeIndicator({ className }: DemoModeIndicatorProps) {
  const { data } = useQuery({
    queryKey: ["google-integration-indicator"],
    queryFn: fetchIntegrationStatus,
    staleTime: 30000,
  })

  const isLive = Boolean(data?.canUseLiveBriefing)
  const label = isLive ? "Google Live" : "Demo Fallback"
  const title = data?.note ?? "Relay reports whether live Google reads are active or falling back."

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-full border border-[#61707D]/20 bg-white/90 backdrop-blur-sm px-3 py-1.5 text-xs font-medium text-[#314555] shadow-relay-soft transition-smooth",
        className
      )}
      title={title}
    >
      <span className="relative flex h-1.5 w-1.5">
        <span
          className={cn(
            "absolute inline-flex h-full w-full animate-pulse rounded-full",
            isLive ? "bg-[#1B2E3B]/25" : "bg-[#3F5363]/50"
          )}
        />
        <span
          className={cn(
            "relative inline-flex h-1.5 w-1.5 rounded-full",
            isLive ? "bg-[#1B2E3B]" : "bg-[#3F5363]"
          )}
        />
      </span>
      {label}
    </div>
  )
}
