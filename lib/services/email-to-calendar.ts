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
            content: `You extract a single proposed meeting or call from an email (e.g. "let's meet Tuesday at 3pm", "can we do a call next week?", "how about 2pm tomorrow?").
Today's date context: use current date when resolving relative times like "tomorrow", "next Tuesday".
Output a JSON object only, no markdown: { "title": string (short event title), "start": string (ISO UTC), "end": string (ISO UTC), "confidence": "high"|"medium"|"low", "rawPhrase": string (exact quote from email) }.
If there is no clear proposed meeting time, output null. Use UTC for start/end. Default duration 1 hour if not specified.`,
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
