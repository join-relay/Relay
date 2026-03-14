"use client"

import { useState } from "react"
import { ChevronDown, ChevronUp, Info } from "lucide-react"
import { cn } from "@/lib/utils"
import type { PriorityItem } from "@/types"

interface PriorityListProps {
  priorities: PriorityItem[]
}

const priorityStyles = {
  urgent: "border-[#3F5363]/25 bg-[#e8edf3]/80 text-[#1B2E3B]",
  important: "border-[#61707D]/30 bg-[#c9d4de]/50 text-[#1B2E3B]",
  can_wait: "border-[var(--border)] bg-white/50 text-[#3F5363]",
}

const priorityLabelStyles = {
  urgent: "text-[#314555]",
  important: "text-[#3F5363]",
  can_wait: "text-[#61707D]",
}

function PriorityItemRow({ item }: { item: PriorityItem }) {
  const [showWhy, setShowWhy] = useState(false)
  const style = priorityStyles[item.priority]
  const labelStyle = priorityLabelStyles[item.priority]

  return (
    <div
      className={cn(
        "rounded-relay-inner border p-3 transition-smooth hover:shadow-relay-soft",
        style
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="font-medium text-[#1B2E3B]">{item.title}</p>
        <p className="text-sm text-[#3F5363] mt-0.5">{item.description}</p>
        {item.whySurfaced && (
          <button
            type="button"
            onClick={() => setShowWhy(!showWhy)}
            className="mt-2.5 flex items-center gap-1.5 text-xs text-[#3F5363] hover:text-[#314555] transition-smooth"
          >
            <Info className="h-3 w-3" />
            {showWhy ? "Hide" : "Why this priority surfaced"}
            {showWhy ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
          </button>
        )}
        {showWhy && item.whySurfaced && (
          <p className="mt-2 rounded-relay-control bg-white/60 p-2 text-xs text-[#3F5363] border border-[var(--border)]">
            {item.whySurfaced}
          </p>
        )}
      </div>
    </div>
  )
}

export function PriorityList({ priorities }: PriorityListProps) {
  const urgent = priorities.filter((p) => p.priority === "urgent")
  const important = priorities.filter((p) => p.priority === "important")
  const canWait = priorities.filter((p) => p.priority === "can_wait")

  if (priorities.length === 0) {
    return (
      <div className="rounded-relay-card bg-white/80 backdrop-blur-sm border border-[var(--border)] p-5 shadow-relay-soft">
        <h2 className="text-sm font-semibold text-[#1B2E3B] tracking-tight">Priorities</h2>
        <p className="mt-4 text-sm text-[#3F5363]">
          Nothing needs your attention right now
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-relay-card bg-white/80 backdrop-blur-sm border border-[var(--border)] p-5 shadow-relay-soft">
      <h2 className="text-sm font-semibold text-[#1B2E3B] tracking-tight">Priorities</h2>
      <div className="mt-3 space-y-4">
        {urgent.length > 0 && (
          <div>
            <h3 className={cn(
              "mb-2 text-[10px] font-medium uppercase tracking-wider",
              priorityLabelStyles.urgent
            )}>
              Urgent
            </h3>
            <div className="space-y-2">
              {urgent.map((item) => (
                <PriorityItemRow key={item.id} item={item} />
              ))}
            </div>
          </div>
        )}
        {important.length > 0 && (
          <div>
            <h3 className={cn(
              "mb-2 text-[10px] font-medium uppercase tracking-wider",
              priorityLabelStyles.important
            )}>
              Important
            </h3>
            <div className="space-y-2">
              {important.map((item) => (
                <PriorityItemRow key={item.id} item={item} />
              ))}
            </div>
          </div>
        )}
        {canWait.length > 0 && (
          <div>
            <h3 className={cn(
              "mb-2 text-[10px] font-medium uppercase tracking-wider",
              priorityLabelStyles.can_wait
            )}>
              Can wait
            </h3>
            <div className="space-y-2">
              {canWait.map((item) => (
                <PriorityItemRow key={item.id} item={item} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
