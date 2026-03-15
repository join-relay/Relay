"use client"

import { useState, useEffect } from "react"
import { Mail, Calendar } from "lucide-react"
import type {
  PendingAction,
  DraftEmailPayload,
  RescheduleMeetingPayload,
} from "@/types"

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

interface DraftReviewProps {
  action: PendingAction
  onEdit?: (content: DraftEmailPayload | RescheduleMeetingPayload) => void
  onCancelEdit?: () => void
  isEditing?: boolean
  readOnly?: boolean
}

export function DraftReview({
  action,
  onEdit,
  onCancelEdit,
  isEditing = false,
  readOnly = false,
}: DraftReviewProps) {
  const content =
    action.reviewedContent ?? action.proposedAction

  if (action.type === "draft_email") {
    const payload = content as DraftEmailPayload
    return (
      <DraftEmailReview
        payload={payload}
        onEdit={onEdit as (c: DraftEmailPayload) => void}
        onCancelEdit={onCancelEdit}
        isEditing={isEditing}
        readOnly={readOnly}
      />
    )
  }

  if (action.type === "reschedule_meeting") {
    const payload = content as RescheduleMeetingPayload
    return (
      <RescheduleReview
        payload={payload}
        onEdit={onEdit as (c: RescheduleMeetingPayload) => void}
        isEditing={isEditing}
        readOnly={readOnly}
      />
    )
  }

  return null
}

function DraftEmailReview({
  payload,
  onEdit,
  onCancelEdit,
  isEditing,
  readOnly,
}: {
  payload: DraftEmailPayload
  onEdit?: (c: DraftEmailPayload) => void
  onCancelEdit?: () => void
  isEditing: boolean
  readOnly: boolean
}) {
  const [subject, setSubject] = useState(payload.subject)
  const [body, setBody] = useState(payload.body)
  const [localEditing, setLocalEditing] = useState(false)
  const showEditForm = isEditing || localEditing

  useEffect(() => {
    setSubject(payload.subject)
    setBody(payload.body)
  }, [payload.subject, payload.body])

  useEffect(() => {
    if (isEditing) setLocalEditing(true)
  }, [isEditing])

  const handleSave = () => {
    onEdit?.({
      ...payload,
      subject,
      body,
    })
    setLocalEditing(false)
    onCancelEdit?.()
  }

  const handleCancel = () => {
    setSubject(payload.subject)
    setBody(payload.body)
    setLocalEditing(false)
    onCancelEdit?.()
  }

  return (
    <div className="rounded-relay-inner border border-[var(--border)] bg-white/60 p-4">
      <div className="flex items-center gap-2 text-[#3F5363] mb-3">
        <Mail className="h-4 w-4" />
        <span className="text-xs font-medium uppercase tracking-wider">
          Proposed reply
        </span>
      </div>
      <div className="space-y-3">
        <div>
          <p className="text-xs text-[#3F5363] mb-0.5">To: {payload.to}</p>
          {showEditForm && !readOnly ? (
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full rounded-relay-control border border-[var(--border)] bg-white px-3 py-2 text-sm text-[#1B2E3B] focus:outline-none focus:ring-2 focus:ring-[#213443]/20"
              placeholder="Subject"
            />
        ) : (
          <p className="font-medium text-[#1B2E3B]">{subject}</p>
          )}
        </div>
        {showEditForm && !readOnly ? (
          <div>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={6}
              className="w-full rounded-relay-control border border-[var(--border)] bg-white px-3 py-2 text-sm text-[#1B2E3B] focus:outline-none focus:ring-2 focus:ring-[#213443]/20 resize-y"
              placeholder="Email body"
            />
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={handleSave}
                className="rounded-relay-control bg-[#213443] px-3 py-1.5 text-sm font-medium text-white transition-smooth hover:bg-[#1B2E3B]"
              >
                Save changes
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="rounded-relay-control border border-[var(--border)] px-3 py-1.5 text-sm text-[#3F5363] transition-smooth hover:bg-[#e8edf3]"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-[#314555] whitespace-pre-wrap">{body}</p>
        )}
      </div>
      {!showEditForm && !readOnly && onEdit && (
        <button
          type="button"
          onClick={() => setLocalEditing(true)}
          className="mt-3 text-xs text-[#3F5363] hover:text-[#1B2E3B] transition-smooth underline"
        >
          Edit draft
        </button>
      )}
    </div>
  )
}

function RescheduleReview({
  payload,
  readOnly,
}: {
  payload: RescheduleMeetingPayload
  onEdit?: (c: RescheduleMeetingPayload) => void
  isEditing: boolean
  readOnly: boolean
}) {
  return (
    <div className="rounded-relay-inner border border-[var(--border)] bg-white/60 p-4">
      <div className="flex items-center gap-2 text-[#3F5363] mb-3">
        <Calendar className="h-4 w-4" />
        <span className="text-xs font-medium uppercase tracking-wider">
          Proposed change
        </span>
      </div>
      <div className="space-y-2 text-sm">
        <p className="font-medium text-[#1B2E3B]">{payload.eventTitle}</p>
        <p className="text-[#3F5363]">
          From: {formatTime(payload.currentStart)} – {formatTime(payload.currentEnd)}
        </p>
        <p className="text-[#1B2E3B] font-medium">
          To: {formatTime(payload.proposedStart)} – {formatTime(payload.proposedEnd)}
        </p>
      </div>
    </div>
  )
}
