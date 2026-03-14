"use client"

import Link from "next/link"
import { ArrowRight, Mail, Calendar } from "lucide-react"

interface BriefingCardProps {
  displayName: string
  date: string
  stats: {
    urgentEmails: number
    totalEmails: number
    conflicts: number
  }
}

export function BriefingCard({ displayName, date, stats }: BriefingCardProps) {
  const hasUrgency = stats.urgentEmails > 0 || stats.conflicts > 0
  const summarySentence = hasUrgency
    ? `${stats.urgentEmails} urgent item${stats.urgentEmails !== 1 ? "s" : ""} and ${stats.conflicts} conflict${stats.conflicts !== 1 ? "s" : ""} need your attention.`
    : "Your day looks clear. Review actions when you&apos;re ready."

  return (
    <div className="relative overflow-hidden rounded-relay-card bg-white shadow-relay-elevated border border-[var(--border)]">
      <div className="absolute inset-0 bg-gradient-to-br from-[#e8edf3]/50 via-transparent to-transparent pointer-events-none" />
      <div className="relative px-5 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-[#1B2E3B]">
              Good morning, {displayName}
            </h1>
            <p className="mt-0.5 text-sm text-[#3F5363]">{date}</p>
            <p className="mt-3 text-sm text-[#314555] max-w-lg">
              {summarySentence}
            </p>
          </div>
          <div className="flex gap-6 shrink-0">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-relay-control bg-[#e8edf3] text-[#314555]">
                <Mail className="h-5 w-5" />
              </div>
              <div>
                <p className="text-lg font-semibold text-[#1B2E3B]">
                  {stats.urgentEmails}
                  <span className="text-sm font-normal text-[#3F5363]">/{stats.totalEmails}</span>
                </p>
                <p className="text-xs text-[#3F5363]">Urgent emails</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-relay-control bg-[#e8edf3] text-[#314555]">
                <Calendar className="h-5 w-5" />
              </div>
              <div>
                <p className="text-lg font-semibold text-[#1B2E3B]">
                  {stats.conflicts}
                </p>
                <p className="text-xs text-[#3F5363]">Conflicts</p>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/actions"
            className="inline-flex items-center gap-2 rounded-relay-control bg-[#213443] px-4 py-2 text-sm font-medium text-white shadow-relay-soft transition-smooth hover:bg-[#1B2E3B]"
          >
            Review Actions
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/meeting"
            className="inline-flex items-center gap-2 rounded-relay-control border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium text-[#1B2E3B] transition-smooth hover:bg-[#e8edf3]"
          >
            Prep Standup
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  )
}
