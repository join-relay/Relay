import "server-only"

import { randomUUID } from "node:crypto"
import type { ProposedCalendarEvent, RecallTranscriptEntry } from "@/types"
import { getTimezoneOffsetHint } from "@/lib/utils/timezone"

const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions"
const MODEL = process.env.OPENAI_MEETING_SUMMARY_MODEL?.trim() || "gpt-4o-mini"

function getApiKey(): string | null {
  const key = process.env.OPENAI_API_KEY?.trim()
  return key && key.length > 0 ? key : null
}

function transcriptToText(entries: RecallTranscriptEntry[]): string {
  return entries
    .map((e) => (e.speaker ? `${e.speaker}: ${e.text}` : e.text))
    .filter(Boolean)
    .join("\n\n")
}

/**
 * Reference time for resolving relative phrases like "same time next week".
 * Uses meeting start = referenceStart, default duration 1 hour.
 */
export type MeetingReferenceTime = {
  referenceStart: string
  referenceEnd: string
}

const USER_TIMEZONE =
  (typeof process !== "undefined" && (process.env.USER_TIMEZONE?.trim() || process.env.CALENDAR_DEFAULT_TIMEZONE?.trim())) ||
  "America/Edmonton"

/**
 * Extract proposed follow-up meetings from transcript (and optional summary).
 * Uses OpenAI to find phrases like "let's meet same time next week" and resolve to ISO start/end.
 * Returns empty array when no API key or no proposals found.
 */
export async function extractProposedMeetings(
  transcriptEntries: RecallTranscriptEntry[],
  summary: string | null,
  referenceTime: MeetingReferenceTime
): Promise<ProposedCalendarEvent[]> {
  const text = transcriptToText(transcriptEntries)
  if (!text.trim()) return []

  const apiKey = getApiKey()
  if (!apiKey) return []

  const refStart = referenceTime.referenceStart
  const refEnd = referenceTime.referenceEnd

  try {
    const res = await fetch(OPENAI_CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: "system",
            content: `You extract follow-up or new meetings agreed in a meeting transcript.
Reference meeting: start ${refStart}, end ${refEnd} (ISO).
${getTimezoneOffsetHint(USER_TIMEZONE)} CRITICAL: "8 AM tomorrow" means 08:00 local time on the next calendar day in the user's timezone — convert that to UTC for start/end (e.g. if offset is GMT-6 then 8 AM local = 14:00 UTC). Never use 08:00 UTC for "8 AM" (that would display as 1–2 AM for the user).
For relative times like "same time next week" use the reference (same weekday and time next week).
Output a JSON array of objects only, no markdown. Each object: { "title": string, "start": string (ISO UTC), "end": string (ISO UTC), "confidence": "high"|"medium"|"low", "rawPhrase": string }.
If there are no clear follow-up meetings, output [].`,
          },
          {
            role: "user",
            content: `Transcript:\n${text.slice(0, 8000)}\n${summary ? `\nSummary:\n${summary.slice(0, 2000)}` : ""}`,
          },
        ],
        max_tokens: 600,
      }),
    })

    if (!res.ok) return []

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    const content = data.choices?.[0]?.message?.content?.trim()
    if (!content) return []

    const cleaned = content.replace(/^```\w*\n?|\n?```$/g, "").trim()
    const parsed = JSON.parse(cleaned) as unknown
    if (!Array.isArray(parsed)) return []

    const results: ProposedCalendarEvent[] = []
    for (const item of parsed) {
      if (!item || typeof item !== "object") continue
      const o = item as Record<string, unknown>
      const title = typeof o.title === "string" ? o.title.trim() : null
      const start = typeof o.start === "string" ? o.start : null
      const end = typeof o.end === "string" ? o.end : null
      if (!title || !start || !end) continue
      const startDate = new Date(start)
      const endDate = new Date(end)
      if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) continue
      if (endDate.getTime() <= startDate.getTime()) continue
      results.push({
        id: randomUUID(),
        title,
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        confidence:
          o.confidence === "high" || o.confidence === "medium" || o.confidence === "low"
            ? o.confidence
            : "medium",
        rawPhrase: typeof o.rawPhrase === "string" ? o.rawPhrase : undefined,
      })
    }
    return results
  } catch {
    return []
  }
}
