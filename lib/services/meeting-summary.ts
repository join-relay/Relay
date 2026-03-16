import "server-only"

import type { RecallTranscriptEntry } from "@/types"

const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions"
const FALLBACK_MAX_UTTERANCES = 12
const FALLBACK_MAX_CHARS = 800

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

function fallbackSummary(entries: RecallTranscriptEntry[]): string {
  if (entries.length === 0) {
    return "No transcript was captured for this meeting."
  }
  const lines = entries
    .map((e) => (e.speaker ? `${e.speaker}: ${e.text}` : e.text))
    .filter(Boolean)
  const clipped = lines.slice(0, FALLBACK_MAX_UTTERANCES)
  const text = clipped.join("\n\n")
  if (text.length <= FALLBACK_MAX_CHARS) {
    return `Meeting transcript captured. Key points from the conversation:\n\n${text}`
  }
  return `Meeting transcript captured. Key points from the conversation:\n\n${text.slice(0, FALLBACK_MAX_CHARS).trimEnd()}...`
}

/**
 * Generate a short post-meeting summary from transcript entries.
 * Uses OpenAI when OPENAI_API_KEY is set; otherwise returns a deterministic fallback.
 */
export async function generateMeetingSummary(
  entries: RecallTranscriptEntry[]
): Promise<string> {
  const fullText = transcriptToText(entries)
  if (!fullText.trim()) {
    return "No transcript was captured for this meeting."
  }

  const apiKey = getApiKey()
  if (!apiKey) {
    return fallbackSummary(entries)
  }

  try {
    const res = await fetch(OPENAI_CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MEETING_SUMMARY_MODEL?.trim() || "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are a meeting assistant. Summarize the following meeting transcript in 2–4 concise paragraphs. Focus on decisions, action items, and key points. Use clear, neutral language.",
          },
          {
            role: "user",
            content: fullText.slice(0, 12000),
          },
        ],
        max_tokens: 600,
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      console.warn("[meeting-summary] OpenAI error:", res.status, errText)
      return fallbackSummary(entries)
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    const content = data.choices?.[0]?.message?.content?.trim()
    if (content) return content
  } catch (err) {
    console.warn("[meeting-summary] OpenAI request failed:", err)
  }

  return fallbackSummary(entries)
}
