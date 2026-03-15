"use client"

import { useQuery } from "@tanstack/react-query"
import { BriefingCard } from "@/components/briefing/BriefingCard"
import { InboxSummary } from "@/components/briefing/InboxSummary"
import { CalendarSummary } from "@/components/briefing/CalendarSummary"
import { PriorityList } from "@/components/briefing/PriorityList"
import {
  BRIEFING_QUERY_KEY,
  LIVE_REFRESH_INTERVAL_MS,
  fetchBriefing,
} from "@/lib/client/dashboard-queries"
import { useLiveRefetch } from "@/lib/client/use-live-refetch"
import type { Briefing } from "@/types"

export function BriefingPageContent({ initialData }: { initialData: Briefing }) {
  const { data, refetch } = useQuery({
    queryKey: BRIEFING_QUERY_KEY,
    queryFn: fetchBriefing,
    initialData,
    staleTime: 10000,
    refetchInterval: LIVE_REFRESH_INTERVAL_MS,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
  })
  useLiveRefetch(refetch)

  return (
    <div className="space-y-6">
      {data.statusNote && (
        <div className="animate-relay-fade-in rounded-relay-card border border-[var(--border)] bg-white/80 px-4 py-3 text-sm text-[#314555] shadow-relay-soft">
          {data.statusNote}
        </div>
      )}
      <div className="animate-relay-fade-in">
        <BriefingCard
          displayName={data.displayName}
          date={data.date}
          source={data.source}
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
