"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { ActionsPageHeader } from "@/components/actions/ActionsPageHeader"
import { ActionCard } from "@/components/actions/ActionCard"
import type {
  ActionsViewState,
  PendingAction,
  DraftEmailPayload,
  RescheduleMeetingPayload,
} from "@/types"

interface ActionsResponse {
  actions: PendingAction[]
  displayName: string | null
  viewState: ActionsViewState
}

async function fetchActions(): Promise<ActionsResponse> {
  const res = await fetch("/api/actions")
  if (!res.ok) throw new Error("Failed to load actions")
  return res.json() as Promise<ActionsResponse>
}

async function approveAction(id: string) {
  const res = await fetch(`/api/actions/${id}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error ?? "Failed to approve")
  }
  return res.json() as Promise<PendingAction>
}

async function rejectAction(id: string) {
  const res = await fetch(`/api/actions/${id}/reject`, {
    method: "POST",
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error ?? "Failed to reject")
  }
  return res.json() as Promise<PendingAction>
}

async function editAction(id: string, content: DraftEmailPayload | RescheduleMeetingPayload) {
  const res = await fetch(`/api/actions/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error ?? "Failed to update")
  }
  return res.json() as Promise<PendingAction>
}

export default function ActionsPage() {
  const queryClient = useQueryClient()
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["actions"],
    queryFn: fetchActions,
  })
  const actions = data?.actions ?? []
  const viewState = data?.viewState ?? {
    source: "mock" as const,
    statusNote: "Relay is showing explicit demo fallback actions.",
  }

  const approveMutation = useMutation({
    mutationFn: approveAction,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["actions"] }),
  })
  const rejectMutation = useMutation({
    mutationFn: rejectAction,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["actions"] }),
  })
  const editMutation = useMutation({
    mutationFn: ({ id, content }: { id: string; content: DraftEmailPayload | RescheduleMeetingPayload }) =>
      editAction(id, content),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["actions"] }),
  })

  const pendingActions = actions.filter((a) => a.status === "pending")
  const urgentCount = pendingActions.filter((a) => a.urgency === "urgent").length
  const conflictCount = pendingActions.filter((a) => a.type === "reschedule_meeting").length

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#213443] border-t-transparent" />
          <p className="text-sm text-[#3F5363]">Loading actions...</p>
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
            {error instanceof Error ? error.message : "Failed to load actions"}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="animate-relay-fade-in">
        <ActionsPageHeader
          pendingCount={pendingActions.length}
          urgentCount={urgentCount}
          conflictCount={conflictCount}
          sourceLabel={viewState.source === "google" ? "Live Actions" : "Demo Actions"}
          statusNote={viewState.statusNote}
        />
      </div>
      <div className="space-y-4 animate-relay-fade-in opacity-0 [animation-delay:75ms] [animation-fill-mode:forwards]">
        {actions.length === 0 ? (
          <div className="rounded-relay-card bg-white/80 backdrop-blur-sm border border-[var(--border)] p-8 text-center shadow-relay-soft">
            <p className="text-[#3F5363]">No actions to review</p>
          </div>
        ) : (
          actions.map((action) => (
            <ActionCard
              key={action.id}
              action={action}
              onApprove={(id) => approveMutation.mutate(id)}
              onReject={(id) => rejectMutation.mutate(id)}
              onEditContent={(id, content) => editMutation.mutate({ id, content })}
              isApproving={approveMutation.isPending && approveMutation.variables === action.id}
              isRejecting={rejectMutation.isPending && rejectMutation.variables === action.id}
              source={viewState.source}
            />
          ))
        )}
      </div>
    </div>
  )
}
