"use client"

import Link from "next/link"
import { useState } from "react"
import { Mail, ChevronDown, ChevronUp } from "lucide-react"
import { cn } from "@/lib/utils"
import type { GmailThread } from "@/types"

interface InboxSummaryProps {
  threads: GmailThread[]
}

function ThreadRow({ thread }: { thread: GmailThread }) {
  const [expanded, setExpanded] = useState(false)
  const actionHref = `/actions?focus=${encodeURIComponent(`gmail:${thread.id}`)}&compose=1`
  return (
    <div
      className={cn(
        "rounded-relay-inner border border-[var(--border)] p-3 transition-smooth-slow hover:shadow-relay-soft",
        thread.isUnread && "bg-[#e8edf3]/50 border-[#61707D]/25"
      )}
    >
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-start gap-3 text-left"
      >
        <div className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-relay-control transition-smooth",
          thread.isUnread ? "bg-[#213443] text-white" : "bg-[#e8edf3] text-[#3F5363]"
        )}>
          <Mail className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-[#1B2E3B] truncate">{thread.subject}</p>
          <p className="text-xs text-[#3F5363] mt-0.5">{thread.from}</p>
          <p
            className={cn(
              "mt-1.5 text-sm text-[#3F5363] transition-all duration-200 ease-out",
              expanded ? "line-clamp-none" : "line-clamp-1"
            )}
          >
            {thread.snippet}
          </p>
        </div>
        <span className="shrink-0 pt-1">
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-[#61707D]" />
          ) : (
            <ChevronDown className="h-4 w-4 text-[#61707D]" />
          )}
        </span>
      </button>
      <div className="mt-2 pl-11">
        <Link
          href={actionHref}
          className="inline-flex items-center rounded-relay-control border border-[var(--border)] bg-white/80 px-3 py-1.5 text-xs font-medium text-[#1B2E3B] transition-smooth hover:bg-[#e8edf3]"
        >
          Reply in Actions
        </Link>
      </div>
    </div>
  )
}

export function InboxSummary({ threads }: InboxSummaryProps) {
  if (threads.length === 0) {
    return (
      <div className="rounded-relay-card bg-white/80 backdrop-blur-sm border border-[var(--border)] p-5 shadow-relay-soft">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-[#1B2E3B] tracking-tight">
          <Mail className="h-4 w-4 text-[#3F5363]" />
          Inbox
        </h2>
        <p className="mt-4 text-sm text-[#3F5363]">No threads to show</p>
      </div>
    )
  }

  return (
    <div className="rounded-relay-card bg-white/80 backdrop-blur-sm border border-[var(--border)] p-5 shadow-relay-soft">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-[#1B2E3B] tracking-tight">
        <Mail className="h-4 w-4 text-[#3F5363]" />
        Inbox
      </h2>
      <div className="mt-3 space-y-2">
        {threads.map((thread) => (
          <ThreadRow key={thread.id} thread={thread} />
        ))}
      </div>
    </div>
  )
}
