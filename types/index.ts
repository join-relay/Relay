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
  calendarName?: string
  isAllDay?: boolean
  isConflict?: boolean
  provider?: "demo" | "google"
  meetingProvider?: "google_meet" | "zoom" | "other"
  joinUrl?: string
  externalEventId?: string
  isMeeting?: boolean
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
  source?: "google" | "mock"
  statusNote?: string
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

export interface ActionsViewState {
  source: "mock" | "google"
  statusNote: string
}

/** Persisted record of an action execution (audit/trust layer). */
export interface ActionExecutionRecord {
  id: string
  actionId: string
  type: ActionType
  title: string
  proposedPayload: DraftEmailPayload | RescheduleMeetingPayload
  executedAt: string
  status: "success" | "failed"
  errorMessage?: string
  userEmail?: string | null
  source: "live" | "mock"
}

export type IntegrationState =
  | "not_configured"
  | "blocked"
  | "fallback"
  | "validated"

export interface MeetingIntegrationCheckpoint {
  key:
    | "googleAuth"
    | "gmailBriefing"
    | "calendarRead"
    | "meetDiscovery"
    | "liveJoinPath"
  label: string
  state: IntegrationState
  source: "derived" | "google" | "demo" | "runtime"
  detail: string
  blocker?: string
}

export interface MeetingLinkCheckAttempt {
  id: string
  createdAt: string
  targetMeeting: string
  state: "blocked" | "fallback" | "validated"
  detail: string
}

export interface MeetingUpcomingStatus {
  state: "blocked" | "fallback" | "validated"
  detail: string
  upcomingMeeting?: CalendarEvent | null
}

export interface MeetingReadinessStatus {
  botIdentity: string
  overallState: IntegrationState
  assumptions: string[]
  manualSteps: string[]
  runtimeEvidenceNote: string
  checkpoints: MeetingIntegrationCheckpoint[]
  nextMeeting?: CalendarEvent | null
  lastLinkCheck?: MeetingLinkCheckAttempt
}

export interface GoogleIntegrationStatus {
  status: IntegrationState
  displayName?: string
  email?: string
  scopes: string[]
  missingEnv: string[]
  hasSession: boolean
  hasRefreshToken: boolean
  encryptionReady: boolean
  canReadGmail: boolean
  canReadCalendar: boolean
  canUseLiveBriefing: boolean
  nextMeetEvent?: CalendarEvent | null
  note: string
}
