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

/**
 * Relay — Digital Double
 * Shared types for the you-model and agent engine.
 */

// =============================================================================
// Layer 1: Static identity (from onboarding)
// =============================================================================

export interface StaticIdentity {
  /** How the user writes and speaks; tone, formality, vocabulary. */
  communicationStyle: string;
  /** What they own vs delegate; when they make calls vs escalate. */
  decisionOwnership: string;
  /** Non-negotiables: legal, budget caps, sensitive topics, etc. */
  hardLimits: string[];
  /** How much uncertainty they tolerate before escalating. */
  riskTolerance: string;
}

// =============================================================================
// Layer 2: Dynamic context (from integrations)
// =============================================================================

export interface DynamicContext {
  /** Current projects and focus areas. */
  currentProjects: string[];
  /** Recent decisions or commitments relevant to this moment. */
  recentDecisions: string[];
  /** Calendar pressure: deadlines, back-to-backs, who's in the room. */
  calendarPressure: string;
}

// =============================================================================
// Layer 3: Meeting-specific instructions (from prep; overrides everything)
// =============================================================================

export interface MeetingSpecificInstructions {
  /** Goals for this meeting. */
  goals: string[];
  /** Topics or asks to push back on. */
  pushBackOn: string[];
  /** Thresholds (e.g. budget, scope) that trigger escalation or silence. */
  thresholds: string[];
  /** Optional free-form notes. */
  notes?: string;
}

// =============================================================================
// You-model: full profile used to assemble the system prompt
// =============================================================================

export interface YouModel {
  /** User's display name for the double. */
  userName: string;
  /** Layer 1 — built in onboarding. */
  staticIdentity: StaticIdentity;
  /** Layer 2 — pulled from integrations; may be partial. */
  dynamicContext: Partial<DynamicContext>;
  /** Layer 3 — set in prep; overrides Layer 1 & 2 for this meeting. */
  meetingSpecific?: MeetingSpecificInstructions;
}

// =============================================================================
// Meeting context: input to each decision cycle
// =============================================================================

export interface MeetingContext {
  /** Meeting identifier. */
  meetingId: string;
  /** Transcript chunk to evaluate (e.g. last N seconds). */
  transcriptChunk: string;
  /** Optional: recent messages Relay has already sent in this meeting. */
  recentRelayMessages?: string[];
}

// =============================================================================
// Call 1 — Judgment result
// =============================================================================

export interface JudgmentResult {
  /** Should Relay speak at all for this chunk? */
  shouldSpeak: boolean;
  /** Reason for the decision. */
  reason: string;
}

// =============================================================================
// Call 3 — Confidence score
// =============================================================================

export interface ConfidenceScore {
  /** Score from 0 to 1. */
  score: number;
  /** Reasoning for the score. */
  reasoning: string;
}

// =============================================================================
// Agent decision: output of the full three-call cycle
// =============================================================================

export interface AgentDecision {
  /** Whether Relay decided to speak. */
  spoke: boolean;
  /** If spoke: the proposed or final response in the user's voice. */
  response?: string;
  /** If spoke: confidence score and reasoning. */
  confidence?: ConfidenceScore;
  /** Reason from the judgment call (why we did or didn't speak). */
  judgmentReason: string;
}
