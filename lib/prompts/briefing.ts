import type { CalendarEvent, GmailThread, PriorityItem } from "@/types"

type CandidatePriority = Pick<PriorityItem, "id" | "type" | "title" | "description" | "priority" | "whySurfaced">

function summarizeThread(thread: GmailThread) {
  return [
    `id: ${thread.id}`,
    `type: email`,
    `title: ${thread.subject}`,
    `description: ${thread.from} — ${thread.snippet || "(empty snippet)"}`,
    `received_at: ${thread.date}`,
    `unread: ${thread.isUnread ? "yes" : "no"}`,
  ].join("\n")
}

function summarizeMeeting(event: CalendarEvent) {
  return [
    `id: ${event.id}`,
    `type: meeting`,
    `title: ${event.title}`,
    `description: Starts at ${event.start}${event.joinUrl ? " with a Google Meet link present" : ""}`,
  ].join("\n")
}

export function buildBriefingPrioritiesPrompt(params: {
  displayName: string
  candidates: CandidatePriority[]
  threads: GmailThread[]
  upcomingMeeting?: CalendarEvent
}) {
  const candidateText = params.candidates
    .map((candidate) =>
      [
        `id: ${candidate.id}`,
        `type: ${candidate.type}`,
        `title: ${candidate.title}`,
        `description: ${candidate.description}`,
        `priority_hint: ${candidate.priority}`,
        `why_hint: ${candidate.whySurfaced ?? ""}`,
      ].join("\n")
    )
    .join("\n\n---\n\n")

  const threadText = params.threads.slice(0, 5).map(summarizeThread).join("\n\n---\n\n")
  const meetingText = params.upcomingMeeting ? summarizeMeeting(params.upcomingMeeting) : "none"

  return `
You are prioritizing a morning briefing for Relay.

Return the most useful priorities for a busy professional right now using the provided Gmail and Calendar context.

Constraints:
- Keep the result faithful to the supplied data only.
- Prefer urgent, blocking, time-sensitive, and reply-worthy work.
- Do not flood the list; pick the strongest few items.
- Never imply Relay joined or spoke in a meeting.

Return JSON only in this exact shape:
{
  "priorities": [
    {
      "id": "string",
      "priority": "urgent" | "important" | "can_wait",
      "whySurfaced": "string"
    }
  ]
}

Rules:
- Return at most 4 priorities.
- Use only IDs from the candidate list.
- Keep the whySurfaced field under 160 characters.

Display name: ${params.displayName}

Priority candidates:
${candidateText || "none"}

Recent inbox context:
${threadText || "none"}

Upcoming meeting context:
${meetingText}
  `.trim()
}
