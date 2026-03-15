"use client"

import { Calendar, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import type { CalendarEvent } from "@/types"

interface CalendarSummaryProps {
  events: CalendarEvent[]
  conflicts: CalendarEvent[]
  upcomingMeeting?: CalendarEvent | null
}

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    })
  } catch {
    return iso
  }
}

export function CalendarSummary({
  events,
  conflicts,
  upcomingMeeting,
}: CalendarSummaryProps) {
  if (events.length === 0) {
    return (
      <div className="rounded-relay-card bg-white/80 backdrop-blur-sm border border-[var(--border)] p-5 shadow-relay-soft">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-[#1B2E3B] tracking-tight">
          <Calendar className="h-4 w-4 text-[#3F5363]" />
          Today&apos;s Calendar
        </h2>
        <p className="mt-4 text-sm text-[#3F5363]">No events today</p>
      </div>
    )
  }

  return (
    <div className="rounded-relay-card bg-white/80 backdrop-blur-sm border border-[var(--border)] p-5 shadow-relay-soft">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-[#1B2E3B] tracking-tight">
        <Calendar className="h-4 w-4 text-[#3F5363]" />
        Today&apos;s Calendar
      </h2>
      {conflicts.length > 0 && (
        <div className="mt-3 flex items-start gap-2.5 rounded-relay-inner border border-[#3F5363]/25 bg-[#e8edf3]/70 p-3">
          <AlertCircle className="h-4 w-4 shrink-0 text-[#314555] mt-0.5" />
          <p className="text-sm text-[#314555]">
            Schedule conflict: {conflicts.map((e) => e.title).join(" & ")} at{" "}
            {conflicts[0] && formatTime(conflicts[0].start)}
          </p>
        </div>
      )}
      {upcomingMeeting && (
        <p className="mt-3 text-xs text-[#3F5363]">
          Next: {upcomingMeeting.title} at {formatTime(upcomingMeeting.start)}
        </p>
      )}
      <div className="mt-3 space-y-2">
        {events.map((event) => (
          <div
            key={event.id}
            className={cn(
              "rounded-relay-inner border p-3 transition-smooth hover:shadow-relay-soft",
              event.isConflict
                ? "border-[#3F5363]/25 bg-[#e8edf3]/50"
                : "border-[var(--border)] bg-white/50 hover:bg-white/80"
            )}
          >
            <p className="font-medium text-[#1B2E3B]">{event.title}</p>
            <p className="text-xs text-[#3F5363] mt-0.5">
              {formatTime(event.start)} – {formatTime(event.end)}
              {event.location && ` · ${event.location}`}
              {event.calendarName && ` · ${event.calendarName}`}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
