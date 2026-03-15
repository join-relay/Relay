import "server-only"

import type { MeetArtifactState } from "@/types"

/**
 * Fetch Google Meet conference/artifact/transcript data via any available REST path.
 * In this pass we do NOT have a public Google Meet REST API for consumer transcripts;
 * the API is limited or enterprise-only. We return explicit unavailable state.
 */
export async function fetchMeetArtifacts(
  _eventId: string,
  _userEmail: string | null | undefined
): Promise<MeetArtifactState> {
  const now = new Date().toISOString()
  return {
    eventId: _eventId,
    availability: "api_not_supported",
    failureReason:
      "Google Meet REST API for transcripts/artifacts is not available in this integration. Post-meeting recap uses uploaded or manually provided transcript when available.",
    checkedAt: now,
  }
}

/**
 * Check whether Meet artifacts/transcript are available for an event.
 * Returns explicit unavailable when not available.
 */
export async function getMeetArtifactAvailability(
  eventId: string,
  _userEmail: string | null | undefined
): Promise<MeetArtifactState> {
  return fetchMeetArtifacts(eventId, _userEmail)
}
