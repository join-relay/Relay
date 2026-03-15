import "server-only"

import OpenAI from "openai"
import type { MeetingContext, MeetingRecap } from "@/types"

const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const client = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null

function buildContextBlob(ctx: MeetingContext): string {
  const parts: string[] = [
    `Event: ${ctx.event.title}`,
    `Start: ${ctx.event.start}, End: ${ctx.event.end}`,
    ctx.agendaText ? `Agenda/Description:\n${ctx.agendaText}` : "",
    ctx.attendees.length > 0
      ? `Attendees: ${ctx.attendees.map((a) => a.displayName || a.email || "?").join(", ")}`
      : "",
    ctx.linkedDriveFiles.length > 0
      ? `Linked files: ${ctx.linkedDriveFiles.map((f) => f.name).join(", ")}`
      : "",
    ctx.gmailSummary.threads.length > 0
      ? `Recent email threads: ${ctx.gmailSummary.threads.map((t) => t.subject).join("; ")}`
      : "",
    ctx.recentApprovedActions.length > 0
      ? `Recent approved actions: ${ctx.recentApprovedActions.map((a) => a.title).join("; ")}`
      : "",
    ctx.briefingSummary
      ? `Briefing: ${ctx.briefingSummary.date}, ${ctx.briefingSummary.prioritiesCount} priorities`
      : "",
  ]
  return parts.filter(Boolean).join("\n")
}

async function chat(
  system: string,
  user: string
): Promise<{ text: string; source: "artifact" | "fallback" }> {
  if (!client) {
    return {
      text: "[OpenAI not configured. Set OPENAI_API_KEY to generate live content.]",
      source: "fallback",
    }
  }
  try {
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      max_tokens: 1024,
    })
    const text =
      completion.choices?.[0]?.message?.content?.trim() ??
      "[No response from model.]"
    return { text, source: "artifact" }
  } catch (err) {
    console.error("OpenAI reasoning error:", err)
    return {
      text: `[Generation failed: ${err instanceof Error ? err.message : "unknown error"}]`,
      source: "fallback",
    }
  }
}

/** Generate a short pre-meeting brief from meeting context. */
export async function generatePreMeetingBrief(ctx: MeetingContext): Promise<{
  briefText: string
  source: "artifact" | "fallback"
}> {
  const blob = buildContextBlob(ctx)
  const { text, source } = await chat(
    "You are an AI assistant preparing a user for an upcoming meeting. Output a concise pre-meeting brief (3–5 bullet points): key topics, attendees, and any prep from linked context. No preamble, just the brief.",
    `Meeting context:\n${blob}`
  )
  return { briefText: text, source }
}

/** Generate a "what you've been working on" update for the user to share in the meeting. */
export async function generateWorkingOnUpdate(ctx: MeetingContext): Promise<{
  workingOnUpdate: string
  source: "artifact" | "fallback"
}> {
  const blob = buildContextBlob(ctx)
  const { text, source } = await chat(
    "You are an AI assistant. Based on the user's recent emails, approved actions, and briefing, write a short 'what I've been working on' update (2–4 sentences) the user can say at the start of a meeting. Be specific and professional.",
    `Context:\n${blob}`
  )
  return { workingOnUpdate: text, source }
}

/** Generate suggested update text the user can say or type in the meeting. */
export async function generateSuggestedUpdateText(ctx: MeetingContext): Promise<{
  suggestedUpdateText: string
  source: "artifact" | "fallback"
}> {
  const blob = buildContextBlob(ctx)
  const { text, source } = await chat(
    "You are an AI assistant. Suggest a short spoken or typed update (2–3 sentences) the user can give in the meeting based on their recent work and the meeting context. No preamble.",
    `Context:\n${blob}`
  )
  return { suggestedUpdateText: text, source }
}

/** Generate post-meeting recap (decisions, blockers, next steps, follow-ups) from transcript/artifact text. */
export async function generatePostMeetingRecap(
  eventId: string,
  transcriptOrArtifactText: string,
  userEmail?: string | null
): Promise<MeetingRecap> {
  const base: Omit<MeetingRecap, "decisions" | "blockers" | "nextSteps" | "suggestedFollowUp" | "recapSummary"> = {
    eventId,
    userEmail,
    source: "fallback",
    generatedAt: new Date().toISOString(),
  }

  if (!client) {
    return {
      ...base,
      decisions: [],
      blockers: [],
      nextSteps: [],
      suggestedFollowUp: ["Set OPENAI_API_KEY to generate recap from transcript."],
      recapSummary: "Recap generation is not configured.",
    }
  }

  try {
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are an AI assistant. Given meeting transcript or notes, extract and return a JSON object with exactly these keys: "decisions" (array of strings), "blockers" (array of strings), "nextSteps" (array of strings), "suggestedFollowUp" (array of strings), "recapSummary" (single string, 2-3 sentences). Output only valid JSON, no markdown.`,
        },
        {
          role: "user",
          content: `Meeting transcript/notes:\n${transcriptOrArtifactText.slice(0, 12000)}`,
        },
      ],
      max_tokens: 1024,
    })
    const raw =
      completion.choices?.[0]?.message?.content?.trim() ?? "{}"
    const parsed = JSON.parse(raw.replace(/^```json?\s*|\s*```$/g, "")) as {
      decisions?: string[]
      blockers?: string[]
      nextSteps?: string[]
      suggestedFollowUp?: string[]
      recapSummary?: string
    }
    return {
      ...base,
      decisions: Array.isArray(parsed.decisions) ? parsed.decisions : [],
      blockers: Array.isArray(parsed.blockers) ? parsed.blockers : [],
      nextSteps: Array.isArray(parsed.nextSteps) ? parsed.nextSteps : [],
      suggestedFollowUp: Array.isArray(parsed.suggestedFollowUp) ? parsed.suggestedFollowUp : [],
      recapSummary: typeof parsed.recapSummary === "string" ? parsed.recapSummary : "No summary generated.",
      source: "artifact",
    }
  } catch (err) {
    console.error("OpenAI recap error:", err)
    return {
      ...base,
      decisions: [],
      blockers: [],
      nextSteps: [],
      suggestedFollowUp: [],
      recapSummary: `Recap generation failed: ${err instanceof Error ? err.message : "unknown error"}`,
    }
  }
}
