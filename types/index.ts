export interface GmailThread {
  id: string
  subject: string
  snippet: string
  from: string
  date: string
  isUnread?: boolean
  labels?: string[]
}

export interface CalendarEvent {
  id: string
  title: string
  start: string
  end: string
  location?: string
  isAllDay?: boolean
  isConflict?: boolean
  provider?: "demo" | "google"
  meetingProvider?: "teams" | "zoom" | "google_meet"
  joinUrl?: string
  externalEventId?: string
  isTeamsMeeting?: boolean
}

export interface PriorityItem {
  id: string
  type: "email" | "calendar" | "meeting" | "follow_up"
  title: string
  description: string
  priority: "urgent" | "important" | "can_wait"
  metadata?: Record<string, unknown>
  whySurfaced?: string
}

export interface Briefing {
  displayName: string
  date: string
  inboxSummary: {
    total: number
    urgent: number
    important: number
    threads: GmailThread[]
  }
  calendarSummary: {
    events: CalendarEvent[]
    conflicts: CalendarEvent[]
    upcomingMeeting?: CalendarEvent
  }
  priorities: PriorityItem[]
}

export type ActionType = "draft_email" | "reschedule_meeting"
export type ActionStatus = "pending" | "approved" | "rejected"

export interface DraftEmailPayload {
  to?: string
  subject: string
  body: string
  threadId?: string
}

export interface RescheduleMeetingPayload {
  eventId: string
  eventTitle: string
  currentStart: string
  currentEnd: string
  proposedStart: string
  proposedEnd: string
}

export interface PendingAction {
  id: string
  type: ActionType
  title: string
  sourceContext: string
  proposedAction: DraftEmailPayload | RescheduleMeetingPayload
  status: ActionStatus
  urgency: "urgent" | "important" | "low"
  whySurfaced: string
  reviewedContent?: DraftEmailPayload | RescheduleMeetingPayload
  executedAt?: string
  executionSummary?: string
  createdAt: string
}

export type ProofOfLifeState =
  | "not_configured"
  | "blocked"
  | "pending_external_validation"
  | "validated"

export interface TeamsProofCheckpoint {
  key:
    | "configured"
    | "webhookReachable"
    | "tenantInstallValidated"
    | "realJoinPathValidated"
  label: string
  state: ProofOfLifeState
  source: "derived" | "runtime" | "manual"
  detail: string
  blocker?: string
}

export interface TeamsWebhookEvent {
  id: string
  receivedAt: string
  eventType: string
  source: "manual_probe" | "external_callback"
  note: string
}

export interface TeamsJoinAttempt {
  id: string
  createdAt: string
  targetMeeting: string
  state: "blocked" | "awaiting_external_validation" | "validated"
  detail: string
}

export interface TeamsUpcomingMeetingStatus {
  state: "blocked"
  detail: string
}

export interface TeamsProofOfLifeStatus {
  botIdentity: string
  overallState: ProofOfLifeState
  webhookUrl?: string
  assumptions: string[]
  manualSteps: string[]
  runtimeEvidenceNote: string
  checkpoints: TeamsProofCheckpoint[]
  lastWebhookEvent?: TeamsWebhookEvent
  lastJoinAttempt?: TeamsJoinAttempt
}
