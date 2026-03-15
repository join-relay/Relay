import "server-only"

import { getOptionalSession } from "@/auth"
import { getMeetingContext } from "@/lib/services/meeting-context"
import {
  generatePreMeetingBrief,
  generateWorkingOnUpdate,
  generateSuggestedUpdateText,
  generatePostMeetingRecap,
} from "@/lib/services/openai-reasoning"
import { generateSpokenUpdateAudio } from "@/lib/services/openai-speech"
import { getMeetArtifactAvailability, fetchMeetArtifacts } from "@/lib/services/meet-rest"
import {
  getMeetingBrief,
  saveMeetingBrief,
  getMeetingRecap,
  saveMeetingRecap,
  getSpokenUpdateArtifact,
  saveSpokenUpdateArtifact,
} from "@/lib/persistence/meeting-artifacts"
import type {
  MeetingBrief,
  MeetingRecap,
  SpokenUpdateArtifactMetadata,
  MeetArtifactState,
} from "@/types"

export interface OrchestratedBriefResult {
  brief: MeetingBrief | null
  contextPrepared: boolean
  error?: string
}

/**
 * Load context for eventId, generate pre-meeting brief + working-on + suggested update,
 * persist and return. Uses existing brief if present (optional refresh later).
 */
export async function getOrCreateBrief(
  eventId: string,
  options?: { forceRegenerate?: boolean }
): Promise<OrchestratedBriefResult> {
  const session = await getOptionalSession()
  const userEmail = session?.user?.email ?? null

  const context = await getMeetingContext(eventId)
  if (!context) {
    return { brief: null, contextPrepared: false, error: "Meeting context unavailable or event not found." }
  }

  const existing = !options?.forceRegenerate ? await getMeetingBrief(userEmail, eventId) : null
  if (existing) {
    return { brief: existing, contextPrepared: true }
  }

  const [briefResult, workingResult, suggestedResult] = await Promise.all([
    generatePreMeetingBrief(context),
    generateWorkingOnUpdate(context),
    generateSuggestedUpdateText(context),
  ])

  const source = briefResult.source === "artifact" ? "artifact" : "fallback"
  const brief: MeetingBrief = {
    eventId,
    userEmail,
    briefText: briefResult.briefText,
    workingOnUpdate: workingResult.workingOnUpdate,
    suggestedUpdateText: suggestedResult.suggestedUpdateText,
    source,
    generatedAt: new Date().toISOString(),
  }
  await saveMeetingBrief(brief)
  return { brief, contextPrepared: true }
}

export interface OrchestratedSpokenUpdateResult {
  artifact: SpokenUpdateArtifactMetadata | null
  error?: string
}

/**
 * Generate spoken-update audio artifact for an event (from its brief's suggested update text).
 */
export async function getOrCreateSpokenUpdateArtifact(eventId: string): Promise<OrchestratedSpokenUpdateResult> {
  const session = await getOptionalSession()
  const userEmail = session?.user?.email ?? null

  const existing = await getSpokenUpdateArtifact(userEmail, eventId)
  if (existing?.generated) {
    return { artifact: existing }
  }

  const brief = await getMeetingBrief(userEmail, eventId)
  const textToSpeak = brief?.suggestedUpdateText ?? "No update text available. Generate a meeting brief first."
  const result = await generateSpokenUpdateAudio(textToSpeak)

  const meta: SpokenUpdateArtifactMetadata = {
    eventId,
    userEmail,
    generated: result.generated,
    artifactUrl: result.artifactUrl,
    failureReason: result.failureReason,
    generatedAt: new Date().toISOString(),
  }
  await saveSpokenUpdateArtifact(meta)
  return { artifact: meta, error: result.failureReason }
}

/**
 * Get Meet artifact/transcript availability for an event (honest unavailable when API not supported).
 */
export async function getArtifactState(eventId: string): Promise<MeetArtifactState> {
  const session = await getOptionalSession()
  return getMeetArtifactAvailability(eventId, session?.user?.email)
}

/**
 * Fetch post-meeting artifacts and generate recap. When transcript is unavailable,
 * recap can still be generated from manually provided text or from artifact state.
 */
export async function getOrCreateRecap(
  eventId: string,
  options?: { transcriptOverride?: string }
): Promise<MeetingRecap | null> {
  const session = await getOptionalSession()
  const userEmail = session?.user?.email ?? null

  const existing = await getMeetingRecap(userEmail, eventId)
  if (existing) {
    return existing
  }

  let transcriptText = options?.transcriptOverride
  if (!transcriptText) {
    const artifactState = await fetchMeetArtifacts(eventId, userEmail)
    transcriptText = artifactState.transcriptText ?? ""
  }

  const recap = await generatePostMeetingRecap(eventId, transcriptText || "[No transcript available.]", userEmail)
  await saveMeetingRecap(recap)
  return recap
}
