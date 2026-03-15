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
