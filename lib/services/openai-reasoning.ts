import "server-only"

import { buildDraftEmailPrompt, buildActionRankingPrompt } from "@/lib/prompts/actions"
import { buildBriefingPrioritiesPrompt } from "@/lib/prompts/briefing"
import { getDevLiveDataState } from "@/lib/persistence/dev-test-state"
import type {
  CalendarEvent,
  EmailStyleProfile,
  GmailThread,
  GmailThreadContext,
  PendingAction,
  PriorityItem,
  RelayCustomizationSettings,
} from "@/types"

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses"
const DEFAULT_REASONING_MODEL = "gpt-4o-mini"
const DEFAULT_HEAVY_REASONING_MODEL = "gpt-4o-mini"

type RankedAction = {
  threadId: string
  score: number
  urgency: PendingAction["urgency"]
  whySurfaced: string
}

type ReasoningModelKind = "default" | "heavy"

function getReasoningModel(kind: ReasoningModelKind = "default") {
  if (kind === "heavy") {
    return (
      process.env.OPENAI_HEAVY_REASONING_MODEL?.trim() ||
      process.env.OPENAI_REASONING_MODEL?.trim() ||
      DEFAULT_HEAVY_REASONING_MODEL
    )
  }

  return process.env.OPENAI_REASONING_MODEL?.trim() || DEFAULT_REASONING_MODEL
}

export function getConfiguredReasoningModel(kind: ReasoningModelKind = "default") {
  return getReasoningModel(kind)
}

function getApiKey() {
  const key = process.env.OPENAI_API_KEY?.trim()
  return key && key.length > 0 ? key : null
}

async function shouldBypassOpenAIForDevTests() {
  if (process.env.NODE_ENV === "production" || process.env.RELAY_DEV_AUTH_BYPASS !== "1") {
    return false
  }

  return Boolean((await getDevLiveDataState())?.enabled)
}

function normalizeJsonText(raw: string) {
  const trimmed = raw.trim()
  if (!trimmed) return trimmed

  if (trimmed.startsWith("```")) {
    return trimmed
      .replace(/^```(?:json)?/i, "")
      .replace(/```$/i, "")
      .trim()
  }

  return trimmed
}

function parseJsonResponse<T>(raw: string): T {
  const normalized = normalizeJsonText(raw)
  try {
    return JSON.parse(normalized) as T
  } catch {
    const objectMatch = normalized.match(/\{[\s\S]*\}/)
    if (!objectMatch) {
      throw new Error("OpenAI returned invalid JSON output")
    }
    return JSON.parse(objectMatch[0]) as T
  }
}

function clipErrorText(raw: string, maxLength = 240) {
  const normalized = raw.replace(/\s+/g, " ").trim()
  if (normalized.length <= maxLength) return normalized
  return `${normalized.slice(0, maxLength).trimEnd()}...`
}

function extractOutputText(body: unknown): string {
  if (!body || typeof body !== "object") return ""
  const obj = body as Record<string, unknown>

  // Top-level output_text (some docs)
  if (typeof obj.output_text === "string" && obj.output_text.trim()) {
    return obj.output_text
  }

  // Responses API: output = array of messages with content[].text
  const output = obj.output
  if (Array.isArray(output)) {
    const parts: string[] = []
    for (const item of output) {
      const msg = item as Record<string, unknown>
      const content = msg.content
      if (!Array.isArray(content)) continue
      for (const block of content) {
        const c = block as Record<string, unknown>
        if (typeof c.text === "string" && c.text.trim()) {
          parts.push(c.text.trim())
        }
      }
    }
    if (parts.length > 0) return parts.join("\n")
  }

  // Alternate: output_items (some API versions)
  const outputItems = obj.output_items ?? obj.output_items_done
  if (Array.isArray(outputItems)) {
    const parts: string[] = []
    for (const item of outputItems) {
      const it = item as Record<string, unknown>
      const content = it.content ?? it.text
      if (typeof content === "string" && content.trim()) {
        parts.push(content.trim())
      }
      if (Array.isArray(it.content)) {
        for (const block of it.content as Array<Record<string, unknown>>) {
          if (typeof block?.text === "string" && String(block.text).trim()) {
            parts.push(String(block.text).trim())
          }
        }
      }
    }
    if (parts.length > 0) return parts.join("\n")
  }

  // Responses API: output[].message.content[].text (nested message wrapper)
  if (Array.isArray(output)) {
    for (const item of output) {
      const msg = (item as Record<string, unknown>).message ?? item
      const content = (msg as Record<string, unknown>).content
      if (!Array.isArray(content)) continue
      const parts: string[] = []
      for (const block of content) {
        const c = block as Record<string, unknown>
        if (typeof c.text === "string" && c.text.trim()) parts.push(c.text.trim())
      }
      if (parts.length > 0) return parts.join("\n")
    }
  }

  // Chat Completions-style fallback
  const choices = obj.choices
  if (Array.isArray(choices) && choices.length > 0) {
    const first = choices[0] as Record<string, unknown>
    const msg = first.message ?? first
    const message = msg as Record<string, unknown>
    const content = message.content
    if (typeof content === "string") return content
    if (Array.isArray(content)) {
      const text = content
        .map((c) => (typeof c === "object" && c && "text" in c ? (c as { text?: string }).text : null))
        .filter(Boolean)
        .join("\n")
      if (text) return text
    }
  }

  // Deep fallback: find any substantial string under key "text" or "body" in the response
  const found = deepFindTextOrBody(body)
  if (found) return found

  return ""
}

/** Walk object and return first non-empty string from a "text" or "body" key (min length to avoid noise). */
function deepFindTextOrBody(value: unknown, minLen = 40): string | null {
  if (value === null || value === undefined) return null
  if (typeof value === "string") {
    const t = value.trim()
    return t.length >= minLen ? t : null
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const v = deepFindTextOrBody(item, minLen)
      if (v) return v
    }
    return null
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>
    if (typeof obj.text === "string") {
      const t = obj.text.trim()
      if (t.length >= minLen) return t
    }
    if (typeof obj.body === "string") {
      const t = obj.body.trim()
      if (t.length >= minLen) return t
    }
    for (const k of Object.keys(obj)) {
      if (k === "error" || k === "usage" || k === "id" || k === "object" || k === "created_at") continue
      const v = deepFindTextOrBody(obj[k], minLen)
      if (v) return v
    }
  }
  return null
}

async function requestJson<T>(
  prompt: string,
  options?: {
    modelKind?: ReasoningModelKind
    effort?: "low" | "medium" | "high"
    debug?: {
      onRequest?: (payload: Record<string, unknown>) => void
      onResponse?: (payload: Record<string, unknown>) => void
    }
  }
): Promise<T | null> {
  const apiKey = getApiKey()
  if (!apiKey) return null
  const model = getReasoningModel(options?.modelKind ?? "default")
  const requestBody = {
    model,
    reasoning: { effort: options?.effort ?? "low" },
    input: [
      {
        role: "user",
        content: [{ type: "input_text", text: prompt }],
      },
    ],
  }
  options?.debug?.onRequest?.(requestBody)

  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  })

  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message =
      body && typeof body === "object" && "error" in body
        ? String((body as { error?: { message?: string } }).error?.message ?? "OpenAI request failed")
        : "OpenAI request failed"
    console.error("[OpenAI] request failed:", response.status, message)
    options?.debug?.onResponse?.({
      ok: response.ok,
      status: response.status,
      error: message,
    })
    throw new Error(`OpenAI request failed (${response.status}): ${message}`)
  }

  const text = extractOutputText(body)
  options?.debug?.onResponse?.({
    ok: response.ok,
    status: response.status,
    outputText: text,
  })
  if (!text) {
    const keys = body && typeof body === "object" ? Object.keys(body as object).join(", ") : "no body"
    console.error("[OpenAI] no text output in response; top-level keys:", keys)
    throw new Error("OpenAI returned no text output")
  }

  try {
    return parseJsonResponse<T>(text)
  } catch (error) {
    const message = error instanceof Error ? error.message : "OpenAI returned invalid JSON output"
    console.error("[OpenAI] parse error:", message, clipErrorText(text))
    throw new Error(`${message}: ${clipErrorText(text)}`)
  }
}

async function requestText(
  prompt: string,
  options?: {
    modelKind?: ReasoningModelKind
    effort?: "low" | "medium" | "high"
    debug?: {
      onRequest?: (payload: Record<string, unknown>) => void
      onResponse?: (payload: Record<string, unknown>) => void
    }
  }
): Promise<{ text: string; model: string } | null> {
  const apiKey = getApiKey()
  if (!apiKey) return null
  const model = getReasoningModel(options?.modelKind ?? "default")
  const requestBody = {
    model,
    reasoning: { effort: options?.effort ?? "low" },
    input: [
      {
        role: "user",
        content: [{ type: "input_text", text: prompt }],
      },
    ],
  }
  options?.debug?.onRequest?.(requestBody)

  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  })

  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message =
      body && typeof body === "object" && "error" in body
        ? String((body as { error?: { message?: string } }).error?.message ?? "OpenAI request failed")
        : "OpenAI request failed"
    console.error("[OpenAI] request failed:", response.status, message)
    options?.debug?.onResponse?.({
      ok: response.ok,
      status: response.status,
      error: message,
    })
    throw new Error(`OpenAI request failed (${response.status}): ${message}`)
  }

  const text = extractOutputText(body).trim()
  options?.debug?.onResponse?.({
    ok: response.ok,
    status: response.status,
    outputText: text,
  })
  if (!text) {
    const keys = body && typeof body === "object" ? Object.keys(body as object).join(", ") : "no body"
    console.error("[OpenAI] no text output in response (requestText); top-level keys:", keys)
    throw new Error("OpenAI returned no text output")
  }

  return { text, model }
}

function normalizeUrgency(value: unknown): PendingAction["urgency"] {
  if (value === "urgent" || value === "important" || value === "low") {
    return value
  }
  return "important"
}

function normalizePriority(value: unknown): PriorityItem["priority"] {
  if (value === "urgent" || value === "important" || value === "can_wait") {
    return value
  }
  return "important"
}

export function hasOpenAIReasoning() {
  return Boolean(getApiKey())
}

export async function rankActionCandidates(params: {
  displayName: string
  candidates: Array<{
    thread: GmailThread
    heuristicScore: number
    urgency: PendingAction["urgency"]
  }>
}): Promise<RankedAction[] | null> {
  if (
    params.candidates.length === 0 ||
    !hasOpenAIReasoning() ||
    (await shouldBypassOpenAIForDevTests())
  ) {
    return null
  }

  try {
    const result = await requestJson<{ ranked?: RankedAction[] }>(
      buildActionRankingPrompt(params),
      { effort: "low" }
    )
    const allowedIds = new Set(params.candidates.map((candidate) => candidate.thread.id))
    const ranked = (result?.ranked ?? [])
      .filter((item) => typeof item?.threadId === "string" && allowedIds.has(item.threadId))
      .map((item) => ({
        threadId: item.threadId,
        score: Number.isFinite(item.score) ? item.score : 0,
        urgency: normalizeUrgency(item.urgency),
        whySurfaced:
          typeof item.whySurfaced === "string" && item.whySurfaced.trim().length > 0
            ? item.whySurfaced.trim()
            : "OpenAI reasoning ranked this as a strong reply candidate from the live inbox.",
      }))

    return ranked.length > 0 ? ranked : null
  } catch (error) {
    console.warn("OpenAI action ranking failed:", error)
    return null
  }
}

export async function generateDraftEmailBody(params: {
  displayName: string
  userEmail: string
  recipientName: string
  recipientEmail?: string
  thread: GmailThread
  threadContext?: GmailThreadContext | null
  styleProfile: EmailStyleProfile
  settings: RelayCustomizationSettings
  debug?: {
    onRequest?: (payload: Record<string, unknown>) => void
    onResponse?: (payload: Record<string, unknown>) => void
  }
}): Promise<{ body: string | null; model: string; errorMessage?: string } | null> {
  if (!hasOpenAIReasoning() || (await shouldBypassOpenAIForDevTests())) return null

  try {
    const result = await requestText(buildDraftEmailPrompt(params), {
      effort: "low",
      debug: params.debug,
    })
    if (!result) return null

    let body = result.text.trim()
    try {
      const parsed = parseJsonResponse<{ body?: string }>(result.text)
      if (typeof parsed?.body === "string" && parsed.body.trim()) {
        body = parsed.body.trim()
      }
    } catch {
      // Plain-text draft bodies are acceptable for the email drafting path.
    }

    return body
      ? {
          body,
          model: result.model,
        }
      : {
          body: null,
          model: result.model,
          errorMessage: "OpenAI returned an empty draft body",
        }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "OpenAI draft email generation failed"
    console.error("[OpenAI] draft email generation failed:", errorMessage, error)
    return {
      body: null,
      model: getReasoningModel("default"),
      errorMessage,
    }
  }
}

export async function enhanceBriefingPriorities(params: {
  displayName: string
  candidates: PriorityItem[]
  threads: GmailThread[]
  upcomingMeeting?: CalendarEvent
}): Promise<PriorityItem[] | null> {
  if (
    params.candidates.length === 0 ||
    !hasOpenAIReasoning() ||
    (await shouldBypassOpenAIForDevTests())
  ) {
    return null
  }

  try {
    const result = await requestJson<{
      priorities?: Array<{
        id: string
        priority: PriorityItem["priority"]
        whySurfaced: string
      }>
    }>(
      buildBriefingPrioritiesPrompt({
        displayName: params.displayName,
        candidates: params.candidates,
        threads: params.threads,
        upcomingMeeting: params.upcomingMeeting,
      }),
      { effort: "low" }
    )

    const candidateMap = new Map(params.candidates.map((candidate) => [candidate.id, candidate]))
    const enhanced = (result?.priorities ?? [])
      .map((item) => {
        const candidate = candidateMap.get(item.id)
        if (!candidate) return null
        return {
          ...candidate,
          priority: normalizePriority(item.priority),
          whySurfaced:
            typeof item.whySurfaced === "string" && item.whySurfaced.trim().length > 0
              ? item.whySurfaced.trim()
              : candidate.whySurfaced,
        } satisfies PriorityItem
      })
      .filter(Boolean) as PriorityItem[]

    return enhanced.length > 0 ? enhanced : null
  } catch (error) {
    console.error("[OpenAI] briefing prioritization failed:", error)
    return null
  }
}
