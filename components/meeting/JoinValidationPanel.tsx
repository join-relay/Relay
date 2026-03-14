"use client"

import { useState } from "react"
import type { TeamsJoinAttempt } from "@/types"

interface JoinValidationPanelProps {
  lastJoinAttempt?: TeamsJoinAttempt
  isSubmitting?: boolean
  errorMessage?: string
  onSubmit: (targetMeeting: string) => void
}

export function JoinValidationPanel({
  lastJoinAttempt,
  isSubmitting = false,
  errorMessage,
  onSubmit,
}: JoinValidationPanelProps) {
  const [targetMeeting, setTargetMeeting] = useState("")

  return (
    <div className="rounded-relay-card border border-[var(--border)] bg-white/80 p-5 shadow-relay-soft">
      <h2 className="text-sm font-semibold tracking-tight text-[#1B2E3B]">
        Join validation
      </h2>
      <p className="mt-2 text-sm text-[#3F5363]">
        Use one real Microsoft Teams meeting URL to prepare the proof-of-life
        join path. This does not claim a successful join until external
        validation is observed.
      </p>

      <form
        className="mt-4 space-y-3"
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit(targetMeeting)
        }}
      >
        <input
          type="url"
          value={targetMeeting}
          onChange={(event) => setTargetMeeting(event.target.value)}
          placeholder="https://teams.microsoft.com/l/meetup-join/..."
          className="w-full rounded-relay-control border border-[var(--border)] bg-white px-3 py-2 text-sm text-[#1B2E3B] focus:outline-none focus:ring-2 focus:ring-[#213443]/20"
        />
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center gap-2 rounded-relay-control bg-[#213443] px-4 py-2 text-sm font-medium text-white shadow-relay-soft transition-smooth hover:bg-[#1B2E3B] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Preparing..." : "Prepare join validation"}
        </button>
      </form>

      {errorMessage && (
        <p className="mt-3 text-sm text-[#7c3a2d]">{errorMessage}</p>
      )}

      {lastJoinAttempt && (
        <div className="mt-4 rounded-relay-inner border border-[var(--border)] bg-white/60 p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-[#61707D]">
            Latest join attempt
          </p>
          <p className="mt-2 text-sm font-medium text-[#1B2E3B]">
            {lastJoinAttempt.targetMeeting || "No meeting URL recorded"}
          </p>
          <p className="mt-1 text-sm text-[#3F5363]">
            {lastJoinAttempt.detail}
          </p>
          <p className="mt-2 text-xs text-[#61707D]">
            State: {lastJoinAttempt.state.replaceAll("_", " ")}
          </p>
        </div>
      )}
    </div>
  )
}
