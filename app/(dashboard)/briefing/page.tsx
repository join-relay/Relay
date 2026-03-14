"use client"

import { useQuery } from "@tanstack/react-query"
import { BriefingCard } from "@/components/briefing/BriefingCard"
import { InboxSummary } from "@/components/briefing/InboxSummary"
import { CalendarSummary } from "@/components/briefing/CalendarSummary"
import { PriorityList } from "@/components/briefing/PriorityList"

async function fetchBriefing() {
  const res = await fetch("/api/briefing")
  if (!res.ok) throw new Error("Failed to load briefing")
  return res.json()
}

export default function BriefingPage() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["briefing"],
    queryFn: fetchBriefing,
  })

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#213443] border-t-transparent" />
          <p className="text-sm text-[#3F5363]">Loading your briefing...</p>
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="rounded-relay-card border border-[#3F5363]/25 bg-white/80 p-5 text-center max-w-md shadow-relay-soft">
          <p className="font-medium text-[#1B2E3B]">Something went wrong</p>
          <p className="mt-1 text-sm text-[#3F5363]">
            {error instanceof Error ? error.message : "Failed to load briefing"}
          </p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <p className="text-[#3F5363]">No briefing data</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="animate-relay-fade-in">
      <BriefingCard
        displayName={data.displayName}
        date={data.date}
        stats={{
          urgentEmails: data.inboxSummary?.urgent ?? 0,
          totalEmails: data.inboxSummary?.total ?? 0,
          conflicts: data.calendarSummary?.conflicts?.length ?? 0,
        }}
      />
      </div>
      <div className="grid gap-6 lg:grid-cols-2 animate-relay-fade-in opacity-0 [animation-delay:75ms] [animation-fill-mode:forwards]">
        <InboxSummary threads={data.inboxSummary?.threads ?? []} />
        <CalendarSummary
          events={data.calendarSummary?.events ?? []}
          conflicts={data.calendarSummary?.conflicts ?? []}
          upcomingMeeting={data.calendarSummary?.upcomingMeeting}
        />
      </div>
      <div className="animate-relay-fade-in opacity-0 [animation-delay:150ms] [animation-fill-mode:forwards]">
        <PriorityList priorities={data.priorities ?? []} />
      </div>
    </div>
  )
}
