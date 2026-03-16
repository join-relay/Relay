import "server-only"

import { randomUUID } from "node:crypto"
import type { ProposedCalendarEvent } from "@/types"

const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions"
const MODEL = process.env.OPENAI_MEETING_SUMMARY_MODEL?.trim() || "gpt-4o-mini"

function getApiKey(): string | null {
  const key = process.env.OPENAI_API_KEY?.trim()
  return key && key.length > 0 ? key : null
}

/**
 * Extract a single proposed meeting from email content (e.g. "let's meet Tuesday at 3pm").
 * Returns one ProposedCalendarEvent or null. Uses OpenAI when API key is set.
 */
export async function extractProposedMeetingFromEmail(
  emailBody: string,
  subject?: string
): Promise<ProposedCalendarEvent | null> {
  const text = [subject, emailBody].filter(Boolean).join("\n\n").trim()
  if (!text || text.length < 20) return null

  const apiKey = getApiKey()
  if (!apiKey) return null

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
            content: `You extract a single proposed meeting or call from an email.
CRITICAL: Use the EXACT time mentioned in the email. If the email says "8 PM" or "at 8" use 20:00 (8 PM), not 2 PM or 14:00. If it says "2 PM" use 14:00.
Today's date (use for relative times like "tomorrow", "same time"): ${new Date().toISOString().slice(0, 10)}.
Interpret all times (e.g. 8 PM, 3pm) as the same calendar day unless the email says another day. Output start and end in ISO 8601 with Z (UTC). If the sender said "8 PM" assume they mean 20:00 local; you may output that time in UTC by assuming a reasonable offset (e.g. US Eastern = -5) so 8 PM Eastern = 01:00 next day Z.
Output a JSON object only, no markdown: { "title": string (short event title), "start": string (ISO UTC), "end": string (ISO UTC), "confidence": "high"|"medium"|"low", "rawPhrase": string (exact quote from email) }.
If there is no clear proposed meeting time, output null. Default duration 1 hour if not specified.`,
          },
          {
            role: "user",
            content: text.slice(0, 6000),
          },
        ],
        max_tokens: 300,
      }),
    })

    if (!res.ok) return null

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    const content = data.choices?.[0]?.message?.content?.trim()
    if (!content || content === "null") return null

    const cleaned = content.replace(/^```\w*\n?|\n?```$/g, "").trim()
    const parsed = JSON.parse(cleaned) as unknown
    if (!parsed || typeof parsed !== "object") return null

    const o = parsed as Record<string, unknown>
    const title = typeof o.title === "string" ? o.title.trim() : null
    const start = typeof o.start === "string" ? o.start : null
    const end = typeof o.end === "string" ? o.end : null
    if (!title || !start || !end) return null
    const startDate = new Date(start)
    const endDate = new Date(end)
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return null
    if (endDate.getTime() <= startDate.getTime()) return null

    return {
      id: randomUUID(),
      title,
      start: startDate.toISOString(),
      end: endDate.toISOString(),
      confidence:
        o.confidence === "high" || o.confidence === "medium" || o.confidence === "low"
          ? o.confidence
          : "medium",
      rawPhrase: typeof o.rawPhrase === "string" ? o.rawPhrase : undefined,
    }
  } catch {
    return null
  }
}
