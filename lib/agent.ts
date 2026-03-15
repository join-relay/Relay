/**
 * Relay — Agent decision engine
 * Three-call cycle per decision: Judgment → Generation → Confidence.
 * Not a GPT wrapper; each call is a separate Claude API invocation with the you-model.
 */

import type {
  YouModel,
  MeetingContext,
  AgentDecision,
  JudgmentResult,
  ConfidenceScore,
} from "../types";
import { buildYouModelPrompt } from "./you-model";

// -----------------------------------------------------------------------------
// Claude API — placeholder; replace with real client (e.g. lib/claude.ts)
// -----------------------------------------------------------------------------

export type ClaudeMessage = { role: "user" | "assistant" | "system"; content: string };

export interface ClaudeClient {
  complete(messages: ClaudeMessage[], systemPrompt?: string): Promise<string>;
}

/**
 * Default: no-op client. Wire this to your real Claude API (e.g. Anthropic SDK).
 */
const defaultClaude: ClaudeClient = {
  async complete() {
    throw new Error("Claude client not configured. Inject a real client.");
  },
};

// -----------------------------------------------------------------------------
// Prompt builders — structure only; prompt content to be designed with you
// -----------------------------------------------------------------------------

function buildJudgmentUserPrompt(meetingContext: MeetingContext): string {
  // TODO: Design prompt content with user. This is the structure.
  return [
    "Evaluate the following transcript chunk against the you-model above.",
    "Decide: should Relay speak at all in response to this chunk?",
    "",
    "TRANSCRIPT CHUNK:",
    "---",
    meetingContext.transcriptChunk,
    "---",
    "",
    "Respond with a JSON object only: { \"shouldSpeak\": boolean, \"reason\": string }",
  ].join("\n");
}

function buildGenerationUserPrompt(meetingContext: MeetingContext, judgmentReason: string): string {
  // TODO: Design prompt content with user. This is the structure.
  return [
    "Relay has decided to speak. Judgment reason: " + judgmentReason,
    "",
    "TRANSCRIPT CHUNK:",
    "---",
    meetingContext.transcriptChunk,
    "---",
    meetingContext.recentRelayMessages?.length
      ? "\nRECENT MESSAGES RELAY SENT (for consistency):\n" +
        meetingContext.recentRelayMessages.map((m) => `- ${m}`).join("\n")
      : "",
    "",
    "Generate a single response in the user's voice that Relay would post to the meeting chat. Be concise. Output only the response text, no JSON.",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildConfidenceUserPrompt(
  meetingContext: MeetingContext,
  proposedResponse: string,
  judgmentReason: string
): string {
  // TODO: Design prompt content with user. This is the structure.
  return [
    "Evaluate the following proposed response against the you-model above.",
    "Score how confident Relay should be that this response is appropriate (0.0 to 1.0).",
    "",
    "JUDGMENT REASON (why we're speaking): " + judgmentReason,
    "",
    "TRANSCRIPT CHUNK:",
    "---",
    meetingContext.transcriptChunk,
    "---",
    "",
    "PROPOSED RESPONSE:",
    "---",
    proposedResponse,
    "---",
    "",
    "Respond with a JSON object only: { \"score\": number, \"reasoning\": string }",
  ].join("\n");
}

// -----------------------------------------------------------------------------
// Parsers — extract structured output from Claude responses
// -----------------------------------------------------------------------------

function parseJudgmentResponse(raw: string): JudgmentResult {
  const json = extractJson(raw);
  const shouldSpeak = Boolean(json?.shouldSpeak);
  const reason = typeof json?.reason === "string" ? json.reason : "No reason provided.";
  return { shouldSpeak, reason };
}

function parseConfidenceResponse(raw: string): ConfidenceScore {
  const json = extractJson(raw);
  let score = typeof json?.score === "number" ? json.score : 0.5;
  score = Math.max(0, Math.min(1, score));
  const reasoning =
    typeof json?.reasoning === "string" ? json.reasoning : "No reasoning provided.";
  return { score, reasoning };
}

function extractJson(raw: string): Record<string, unknown> | null {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as Record<string, unknown>;
  } catch {
    return null;
  }
}

// -----------------------------------------------------------------------------
// Three-call decision loop
// -----------------------------------------------------------------------------

export interface AgentOptions {
  /** You-model profile (used to build system prompt for all three calls). */
  profile: YouModel;
  /** Claude client. If not provided, a no-op that throws is used. */
  claude?: ClaudeClient;
  /** Minimum confidence to allow the response to go out (default 0.5). Below this we do not speak. */
  minConfidenceToSpeak?: number;
}

/**
 * Runs one full decision cycle: Judgment → (optional) Generation → (optional) Confidence.
 * Returns an AgentDecision with spoke, response, confidence, and judgmentReason.
 */
export async function runDecisionCycle(
  meetingContext: MeetingContext,
  options: AgentOptions
): Promise<AgentDecision> {
  const claude = options.claude ?? defaultClaude;
  const minConfidence = options.minConfidenceToSpeak ?? 0.5;
  const systemPrompt = buildYouModelPrompt(options.profile);

  // --- Call 1: Judgment ---
  const judgmentPrompt = buildJudgmentUserPrompt(meetingContext);
  const judgmentRaw = await claude.complete(
    [{ role: "user", content: judgmentPrompt }],
    systemPrompt
  );
  const judgment = parseJudgmentResponse(judgmentRaw);

  if (!judgment.shouldSpeak) {
    return {
      spoke: false,
      judgmentReason: judgment.reason,
    };
  }

  // --- Call 2: Generation ---
  const generationPrompt = buildGenerationUserPrompt(meetingContext, judgment.reason);
  const proposedResponse = await claude.complete(
    [{ role: "user", content: generationPrompt }],
    systemPrompt
  );
  const responseText = proposedResponse.trim();

  // --- Call 3: Confidence ---
  const confidencePrompt = buildConfidenceUserPrompt(
    meetingContext,
    responseText,
    judgment.reason
  );
  const confidenceRaw = await claude.complete(
    [{ role: "user", content: confidencePrompt }],
    systemPrompt
  );
  const confidence = parseConfidenceResponse(confidenceRaw);

  // If confidence is below threshold, we do not speak; we still return the proposed response and score for debrief.
  const spoke = confidence.score >= minConfidence;

  return {
    spoke,
    response: responseText,
    confidence,
    judgmentReason: judgment.reason,
  };
}
