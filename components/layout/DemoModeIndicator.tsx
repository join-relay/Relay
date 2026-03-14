"use client"

import { cn } from "@/lib/utils"
import { DEMO_MODE_LABEL } from "@/lib/constants"

interface DemoModeIndicatorProps {
  className?: string
}

export function DemoModeIndicator({ className }: DemoModeIndicatorProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-full border border-[#61707D]/20 bg-white/90 backdrop-blur-sm px-3 py-1.5 text-xs font-medium text-[#314555] shadow-relay-soft transition-smooth",
        className
      )}
      title="Mock data and voice are active"
    >
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-pulse rounded-full bg-[#3F5363]/50" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#3F5363]" />
      </span>
      {DEMO_MODE_LABEL}
    </div>
  )
}
