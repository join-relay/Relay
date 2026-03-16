export interface GmailThread {
  id: string
  messageId?: string
  subject: string
  snippet: string
  from: string
  date: string
  isUnread?: boolean
  labels?: string[]
}

export interface GmailThreadMessage {
  id: string
  from: string
  to?: string
  date: string
  snippet: string
  bodyPreview?: string
  bodyText?: string
  rfcMessageId?: string
  referenceMessageIds?: string[]
}

export interface GmailThreadContext {
  threadId: string
  subject: string
  preview: string
  participants: string[]
  replyToMessageId?: string
  referenceMessageIds: string[]
  messages: GmailThreadMessage[]
}

export interface SentEmailSample {
  subject: string
  snippet: string
  bodyText: string
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
    /** Suggested meetings extracted from emails (e.g. "let's meet at 8 PM"). */
    suggestedFromEmail?: Array<ProposedCalendarEvent & { actionId: string }>
  }
  priorities: PriorityItem[]
}

export type ActionType = "draft_email" | "reschedule_meeting"
export type ActionStatus = "pending" | "approved" | "rejected"
export type ActionExecutionStatus = "success" | "failed" | "rejected"
export type ActionOrigin = "live" | "mock"
export type ActionProvider = "gmail" | "google_calendar" | "mock"
export type ActionSourceType = "gmail_thread" | "calendar_event" | "demo_fallback"
export type GreetingStyle = "formal" | "warm" | "casual" | "minimal" | "none"
export type TonePreference = "warm" | "professional" | "direct" | "friendly"
export type FormalityPreference = "formal" | "balanced" | "casual"
export type ConcisenessPreference = "brief" | "balanced" | "detailed"
export type SentenceLengthPreference = "short" | "medium" | "long"
export type SignOffStyle = "best" | "best_regards" | "thanks" | "regards" | "name_only" | "none"
export type MeetingUpdateStyle = "crisp_status" | "warm_summary" | "action_focused"
export type DirectnessPreference = "low" | "balanced" | "high"
export type DraftGenerationSource = "openai" | "deterministic_fallback"
export type DraftFinalSource =
  | "openai_fresh_generation"
  | "cached_generated_draft"
  | "deterministic_fallback"
export type PunctuationStyle = "light" | "standard" | "expressive"
export type CapitalizationStyle = "sentence_case" | "mostly_lowercase" | "mixed"
export type SignatureUsage = "consistent" | "occasional" | "none"

export interface DraftEmailPayload {
  to?: string
  subject: string
  body: string
  threadId?: string
  replyToMessageId?: string
  referenceMessageIds?: string[]
}

export interface RescheduleMeetingPayload {
  eventId: string
  eventTitle: string
  currentStart: string
  currentEnd: string
  proposedStart: string
  proposedEnd: string
}

export interface EmailStyleProfile {
  profileVersion: number
  source: "sent_mail" | "fallback"
  analyzedAt: string
  sampleCount: number
  sampledEmailSubjects: string[]
  greetingStyle: GreetingStyle
  tone: TonePreference
  formality: FormalityPreference
  sentenceLength: SentenceLengthPreference
  averageSentenceLengthWords: number
  directness: DirectnessPreference
  punctuationStyle: PunctuationStyle
  capitalizationStyle: CapitalizationStyle
  usesEmDash: boolean
  usesBullets: boolean
  signOffStyle: SignOffStyle
  signatureUsage: SignatureUsage
  signatureBlock?: string
  commonPhrases: string[]
  structuralHabits: string[]
  formattingHabits: string[]
  styleAnchors: {
    greetingExamples: string[]
    openingLineExamples: string[]
    closingLineExamples: string[]
    signOffExamples: string[]
    signatureExamples: string[]
    formattingPatterns: string[]
  }
}

export interface DraftGenerationMetadata {
  source: DraftGenerationSource
  finalDraftSource: DraftFinalSource
  cacheStatus?: "generated" | "cached" | "regenerated"
  generatedAt: string
  model?: string
  openAIConfigured: boolean
  attemptedOpenAI: boolean
  usedOriginalThreadContext: boolean
  usedSentMailStyle: boolean
  usedSavedSettings: boolean
  styleSampleCount: number
  fallbackReason?: string
  note: string
  debug?: {
    actionId: string
    threadId: string
    latestMessageId?: string
    activeThreadText: string
    cacheKey: string
    cacheVersion: number
    cachedDraftSource?: DraftGenerationSource
    usedCachedDraft: boolean
    openAISucceeded: boolean
    openAIError?: string
    openAIDraftPreview?: string
    groundingAccepted?: boolean
    fallbackTriggered: boolean
    fallbackReason?: string
    finalDraftSource: DraftFinalSource
  }
}

export interface RelayCustomizationSettings {
  emailTone: TonePreference
  emailFormality: FormalityPreference
  emailConciseness: ConcisenessPreference
  useSignature: boolean
  emailSignatureOverride?: string
  includeGreeting: boolean
  includeSignOff: boolean
  enableBrowserNotifications: boolean
  enableNotificationSound: boolean
  meetingTone: TonePreference
  meetingFormality: FormalityPreference
  meetingConciseness: ConcisenessPreference
  meetingUpdateStyle: MeetingUpdateStyle
}

export interface ActionPersonalization {
  styleSource: EmailStyleProfile["source"] | "settings_only"
  settingsApplied: boolean
  summary: string
  styleDebug?: {
    sampleCount: number
    usesEmDash: boolean
    usesBullets: boolean
    signatureUsage: SignatureUsage
    greetingStyle: GreetingStyle
    signOffStyle: SignOffStyle
  }
  generation?: DraftGenerationMetadata
}

export interface EmailActionOriginalContext {
  kind: "gmail_thread"
  preview: string
  thread: GmailThreadContext
}

export interface CalendarActionOriginalContext {
  kind: "calendar_event"
  preview: string
  title: string
  currentStart: string
  currentEnd: string
  location?: string
  joinUrl?: string
}

export type ActionOriginalContext =
  | EmailActionOriginalContext
  | CalendarActionOriginalContext

export interface ActionSourceIdentifiers {
  gmailThreadId?: string
  gmailMessageId?: string
  gmailRfcMessageId?: string
  gmailReferenceMessageIds?: string[]
  calendarEventId?: string
  calendarId?: string
  demoActionId?: string
}

export interface ActionProvenance {
  provider: ActionProvider
  sourceType: ActionSourceType
  origin: ActionOrigin
  sourceIdentifiers?: ActionSourceIdentifiers
}

export interface PendingAction {
  id: string
  type: ActionType
  title: string
  sourceContext: string
  provenance: ActionProvenance
  proposedAction: DraftEmailPayload | RescheduleMeetingPayload
  status: ActionStatus
  urgency: "urgent" | "important" | "low"
  whySurfaced: string
  originalContext?: ActionOriginalContext
  personalization?: ActionPersonalization
  reviewedContent?: DraftEmailPayload | RescheduleMeetingPayload
  executedAt?: string
  executionSummary?: string
  createdAt: string
  /** Suggested meeting extracted from email (e.g. "let's meet Tuesday 3pm"). */
  proposedCalendarEvent?: ProposedCalendarEvent | null
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
  sourceContext: string
  proposedPayload: DraftEmailPayload | RescheduleMeetingPayload
  executionSummary?: string
  executedAt: string
  status: ActionExecutionStatus
  errorMessage?: string
  userEmail?: string | null
  source: ActionOrigin
  provider: ActionProvider
  sourceType: ActionSourceType
  sourceIdentifiers?: ActionSourceIdentifiers
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
  resolutionState: "live" | "fallback" | "empty" | "error"
  overallState: IntegrationState
  assumptions: string[]
  manualSteps: string[]
  runtimeEvidenceNote: string
  checkpoints: MeetingIntegrationCheckpoint[]
  nextMeeting?: CalendarEvent | null
  lastLinkCheck?: MeetingLinkCheckAttempt
  customizationSummary?: string
  providerReadiness?: RecallProviderReadiness
  /** Most recent Recall meeting run, when present (provider-confirmed bot/transcript). */
  activeRecallRun?: MeetingRunRecord | null
  summarySurface: {
    state: "empty" | "pending" | "available"
    summary: string | null
  }
  actionItemsSurface: {
    state: "empty" | "pending" | "available"
    items: string[]
  }
  transcriptSurface: {
    state: "empty" | "pending" | "available"
    previewLines: string[]
    note: string
  }
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
  /** True when calendar.events scope is granted (create/patch events from meetings). */
  canWriteCalendar?: boolean
  canUseLiveBriefing: boolean
  nextMeetEvent?: CalendarEvent | null
  note: string
}

export type RecallConfigState = "configured" | "not_configured"
export type RecallScaffoldingState = "ready" | "not_ready"
export type RecallLiveBotState = "untested" | "validated"
export type RecallArtifactSource =
  | "recall_transcript"
  | "recall_recording"
  | "manual"
  | "none"

export interface RecallProviderReadiness {
  provider: "recall_ai"
  configState: RecallConfigState
  botCreationScaffoldingState: RecallScaffoldingState
  liveBotState: RecallLiveBotState
  missingEnv: string[]
  apiBaseUrl: string
  webhookConfigured: boolean
  note: string
}

export interface RecallBotCreateRequest {
  meetingUrl: string
  botName: string
  deduplicationKey?: string
  metadata?: Record<string, string>
}

export interface RecallBotCreateResponse {
  id: string
  status: string
  meetingUrl?: string
  joinUrl?: string
  raw?: Record<string, unknown>
}

export interface RecallTranscriptEntry {
  speaker?: string
  text: string
  startedAt?: string
  endedAt?: string
}

export interface RecallArtifactMetadata {
  transcriptSource: RecallArtifactSource
  recordingSource: RecallArtifactSource
  transcriptEntries: number
  recordingUrl?: string
  transcriptUrl?: string
}

export interface MeetingRunRecord {
  id: string
  provider: "recall_ai"
  meetingUrl: string
  botId?: string
  status: "scaffolded" | "created" | "joining" | "running" | "completed" | "failed"
  /** Provider-reported status (e.g. joining_call, in_call_recording, done, fatal). */
  providerStatus?: string
  /** Error or sub_code from provider when status is failed/fatal. */
  providerError?: string
  createdAt: string
  updatedAt: string
  artifactMetadata?: RecallArtifactMetadata
  /** Stored transcript utterances from webhook events. */
  transcriptEntries?: RecallTranscriptEntry[]
  /** Post-meeting summary generated when the bot completes (from transcript). */
  summary?: string | null
  /** Follow-up meetings extracted from transcript (e.g. "same time next week"). */
  proposedCalendarEvents?: ProposedCalendarEvent[]
}

export interface ProposedCalendarEvent {
  id: string
  title: string
  start: string
  end: string
  description?: string
  confidence?: "high" | "medium" | "low"
  rawPhrase?: string
}

/**
 * Relay — Digital Double
 * Shared types for the you-model and agent engine.
 */
export interface StaticIdentity {
  communicationStyle: string
  decisionOwnership: string
  hardLimits: string[]
  riskTolerance: string
}

export interface DynamicContext {
  currentProjects: string[]
  recentDecisions: string[]
  calendarPressure: string
}

export interface MeetingSpecificInstructions {
  goals: string[]
  pushBackOn: string[]
  thresholds: string[]
  notes?: string
}

export interface YouModel {
  userName: string
  staticIdentity: StaticIdentity
  dynamicContext: Partial<DynamicContext>
  meetingSpecific?: MeetingSpecificInstructions
}

export interface MeetingContext {
  meetingId: string
  transcriptChunk: string
  recentRelayMessages?: string[]
}

export interface JudgmentResult {
  shouldSpeak: boolean
  reason: string
}

export interface ConfidenceScore {
  score: number
  reasoning: string
}

export interface AgentDecision {
  spoke: boolean
  response?: string
  confidence?: ConfidenceScore
  judgmentReason: string
}

export interface MeetingHistoryEntry {
  id: string
  title: string
  occurredAt: string
  provider: "google_meet"
  source: "rest_artifact" | "manual_fallback" | "placeholder"
  summary: string | null
  actionItems: string[]
  transcriptPreview: string[]
  transcriptState: "unavailable" | "pending" | "available"
  metadata: {
    participantsLabel: string
    artifactLabel: string
    durationLabel?: string
  }
}
