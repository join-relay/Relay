export interface GmailThread {
  id: string
  subject: string
  snippet: string
  from: string
  date: string
  isUnread?: boolean
  labels?: string[]
}

export interface CalendarEventAttendee {
  email?: string
  displayName?: string
  responseStatus?: "needsAction" | "declined" | "tentative" | "accepted"
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
  /** Full event description/body (from Calendar API when fetching single event). */
  description?: string
  /** Attendees (from Calendar API when fetching single event). */
  attendees?: CalendarEventAttendee[]
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

// ——— Google Meet AI attendee (artifact-based) ———

/** Source of meeting/recap data: artifact (post-Meet), live (not implemented), or fallback. */
export type MeetingDataSource = "artifact" | "live" | "fallback" | "unavailable"

/** Whether Meet REST artifacts/transcript are available. */
export type MeetArtifactAvailability =
  | "available"
  | "unavailable"
  | "not_checked"
  | "permission_denied"
  | "api_not_supported"

export interface MeetingContext {
  eventId: string
  event: CalendarEvent
  /** Agenda/description text. */
  agendaText: string
  attendees: CalendarEventAttendee[]
  /** Drive files already linked in Relay (selected for user). */
  linkedDriveFiles: { id: string; name: string; mimeType?: string; webViewLink?: string }[]
  /** Recent Gmail context (threads) already available in the app. */
  gmailSummary: { threads: GmailThread[]; total: number }
  /** Recent approved Relay actions (execution records). */
  recentApprovedActions: ActionExecutionRecord[]
  /** Current briefing summary if available (e.g. priorities, today's date). */
  briefingSummary?: { date: string; prioritiesCount: number; upcomingMeetingTitle?: string }
  /** When context was assembled. */
  assembledAt: string
}

export interface MeetingBrief {
  eventId: string
  userEmail?: string | null
  /** Pre-meeting brief text. */
  briefText: string
  /** "What you've been working on" update text. */
  workingOnUpdate: string
  /** Suggested spoken/typed update text for the meeting. */
  suggestedUpdateText: string
  source: MeetingDataSource
  generatedAt: string
}

export interface SpokenUpdateArtifactMetadata {
  eventId: string
  userEmail?: string | null
  /** Whether TTS artifact was generated (URL or stored ref). */
  generated: boolean
  /** Optional storage path or URL for the audio artifact. */
  artifactUrl?: string
  failureReason?: string
  generatedAt: string
}

export interface MeetArtifactState {
  eventId: string
  availability: MeetArtifactAvailability
  /** Transcript text when availability is "available". */
  transcriptText?: string
  /** Raw artifact payload when available (e.g. for recap). */
  rawPayload?: unknown
  failureReason?: string
  checkedAt: string
}

export interface MeetingRecap {
  eventId: string
  userEmail?: string | null
  /** Summary of decisions, blockers, next steps, follow-ups. */
  decisions: string[]
  blockers: string[]
  nextSteps: string[]
  suggestedFollowUp: string[]
  recapSummary: string
  source: MeetingDataSource
  generatedAt: string
}
