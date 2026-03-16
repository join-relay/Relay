import "server-only"

import type {
  MeetingRunRecord,
  RecallBotCreateRequest,
  RecallBotCreateResponse,
  RecallProviderReadiness,
} from "@/types"

// In dev, ensure .env.local is loaded with override so Recall vars are visible (Next.js may
// skip loading when dotenv is in deps, or workers may not get env set in next.config).
let recallEnvLoaded = false
function getProjectRoot(): string {
  const path = require("path")
  const fs = require("fs")
  if (typeof __dirname !== "undefined") {
    let dir = __dirname
    while (dir !== path.dirname(dir)) {
      if (
        fs.existsSync(path.join(dir, "next.config.js")) ||
        fs.existsSync(path.join(dir, "next.config.mjs"))
      ) {
        return dir
      }
      dir = path.dirname(dir)
    }
  }
  try {
    const nextPkg = require.resolve("next/package.json")
    return path.dirname(path.dirname(path.dirname(nextPkg)))
  } catch {
    return process.env.RELAY_PROJECT_ROOT || process.cwd()
  }
}
function ensureRecallEnvLoaded() {
  if (recallEnvLoaded) return
  if (typeof process === "undefined" || process.env.NODE_ENV === "production") return
  try {
    const path = require("path")
    const fs = require("fs")
    const envPath =
      process.env.RELAY_ENV_LOCAL_PATH ||
      path.join(getProjectRoot(), ".env.local")
    if (fs.existsSync(envPath)) {
      require("dotenv").config({ path: envPath, override: true })
    }
    recallEnvLoaded = true
  } catch {
    recallEnvLoaded = true
  }
}

const DEFAULT_RECALL_API_BASE_URL = "https://us-west-2.recall.ai/api/v1"

function getRecallApiBaseUrl() {
  return process.env.RECALL_API_BASE_URL?.trim() || DEFAULT_RECALL_API_BASE_URL
}

/** Base URL for Recall webhooks (realtime_endpoints). Must be publicly reachable; localhost is excluded (Recall blocks it). */
export function getRecallWebhookBaseUrl(): string | null {
  const url =
    process.env.RELAY_PUBLIC_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    ""
  if (!url) return null
  const base = url.replace(/\/$/, "")
  try {
    const u = new URL(base)
    const host = u.hostname.toLowerCase()
    if (host === "localhost" || host === "127.0.0.1" || host.startsWith("127.")) {
      return null
    }
  } catch {
    return null
  }
  return base
}

const RECALL_REQUIRED_ENV_KEYS = ["RECALL_API_KEY"] as const

function isRecallEnvSet(key: string): boolean {
  const value = process.env[key]
  return typeof value === "string" && value.trim().length > 0
}

export function getRecallProviderReadiness(): RecallProviderReadiness {
  ensureRecallEnvLoaded()
  const missingEnv = RECALL_REQUIRED_ENV_KEYS.filter((key) => !isRecallEnvSet(key))
  const configured = missingEnv.length === 0
  // Single verification secret for Recall webhook signatures; use RECALL_WEBHOOK_SECRET consistently.
  const webhookConfigured = isRecallEnvSet("RECALL_WEBHOOK_SECRET")

  return {
    provider: "recall_ai",
    configState: configured ? "configured" : "not_configured",
    botCreationScaffoldingState: "ready",
    liveBotState: "untested",
    missingEnv,
    apiBaseUrl: getRecallApiBaseUrl(),
    webhookConfigured,
    note: configured
      ? "Recall.ai server configuration is present. Bot creation scaffolding is wired, but no live join has been validated in this pass."
      : "Recall.ai is not configured yet. This pass only adds server-side scaffolding and honest readiness reporting.",
  }
}

/** Public base URL for assets (e.g. bot avatar). Uses NEXTAUTH_URL or RELAY_PUBLIC_URL. */
function getPublicBaseUrl(): string | null {
  const url =
    process.env.RELAY_PUBLIC_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    ""
  if (!url) return null
  try {
    const u = new URL(url)
    const host = u.hostname.toLowerCase()
    if (host === "localhost" || host === "127.0.0.1" || host.startsWith("127.")) return null
  } catch {
    return null
  }
  return url.replace(/\/$/, "")
}

export function buildRecallBotCreatePayload(input: RecallBotCreateRequest): Record<string, unknown> {
  const base: Record<string, unknown> = {
    meeting_url: input.meetingUrl,
    bot_name: input.botName?.trim() || "Relay",
    deduplication_key: input.deduplicationKey,
    metadata: input.metadata,
  }

  base.recording_config = {
    transcript: {
      provider: {
        recallai_streaming: {
          mode: "prioritize_low_latency",
          language_code: "en",
        },
      },
    },
    video_mixed_mp4: {},
  }

  const avatarUrl = getPublicBaseUrl()
  if (avatarUrl) {
    base.image_url = `${avatarUrl}/relay-logo.png`
  }

  return base
}

export function buildRecallMeetingRun(
  input: RecallBotCreateRequest,
  options?: { id?: string; botId?: string; status?: MeetingRunRecord["status"] }
): MeetingRunRecord {
  const timestamp = new Date().toISOString()
  return {
    id: options?.id ?? crypto.randomUUID(),
    provider: "recall_ai",
    meetingUrl: input.meetingUrl,
    botId: options?.botId,
    status: options?.status ?? "scaffolded",
    createdAt: timestamp,
    updatedAt: timestamp,
    artifactMetadata: {
      transcriptSource: "none",
      recordingSource: "none",
      transcriptEntries: 0,
    },
  }
}

/**
 * Create a Recall.ai bot for the given meeting (joins and can transcribe).
 * Returns the bot response when configured and the API call succeeds; null otherwise.
 */
export async function createRecallBot(
  input: RecallBotCreateRequest
): Promise<RecallBotCreateResponse | null> {
  ensureRecallEnvLoaded()
  const apiKey = process.env.RECALL_API_KEY?.trim()
  if (!apiKey) return null
  let baseUrl = getRecallApiBaseUrl().replace(/\/$/, "")
  if (!baseUrl.endsWith("/api/v1")) baseUrl = `${baseUrl}/api/v1`
  const url = `${baseUrl}/bot`
  const payload = buildRecallBotCreatePayload(input)
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Token ${apiKey}`,
      },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const text = await res.text()
      console.warn("[recall] create bot failed:", res.status, text)
      return null
    }
    const data = (await res.json()) as Record<string, unknown>
    return {
      id: String(data.id ?? ""),
      status: String(data.status ?? "unknown"),
      meetingUrl: data.meeting_url != null ? String(data.meeting_url) : undefined,
      joinUrl: data.join_url != null ? String(data.join_url) : undefined,
      raw: data,
    }
  } catch (err) {
    console.warn("[recall] create bot error:", err)
    return null
  }
}

type RecallBotRecordings = Array<{
  media_shortcuts?: {
    video_mixed?: { data?: { download_url?: string } }
    transcript?: { data?: { download_url?: string } }
  }
}>

/** Fetch bot by ID and return recordings (media_shortcuts). */
export async function fetchRecallBotRecordings(botId: string): Promise<RecallBotRecordings | null> {
  ensureRecallEnvLoaded()
  const apiKey = process.env.RECALL_API_KEY?.trim()
  if (!apiKey || !botId) return null
  const baseUrl = getRecallApiBaseUrl().replace(/\/$/, "")
  const apiBase = baseUrl.endsWith("/api/v1") ? baseUrl : `${baseUrl}/api/v1`
  try {
    const res = await fetch(`${apiBase}/bot/${encodeURIComponent(botId)}/`, {
      method: "GET",
      headers: { Authorization: `Token ${apiKey}` },
    })
    if (!res.ok) return null
    const data = (await res.json()) as Record<string, unknown>
    const recordings = data.recordings as RecallBotRecordings | undefined
    return Array.isArray(recordings) ? recordings : null
  } catch (err) {
    console.warn("[recall] fetch bot error:", err)
    return null
  }
}

/**
 * Fetch the recording video URL for a completed bot from Recall API.
 * Call after bot.done, recording.done, or video.mixed.done. URL is pre-signed and expires (e.g. 5 hours).
 */
export async function fetchRecallBotRecordingUrl(botId: string): Promise<string | null> {
  const recordings = await fetchRecallBotRecordings(botId)
  const first = recordings?.[0]
  const urlStr = first?.media_shortcuts?.video_mixed?.data?.download_url
  return typeof urlStr === "string" && urlStr.length > 0 ? urlStr : null
}

type RecallDownloadUtterance = { participant?: { name?: string | null }; words?: Array<{ text?: string }> }

/**
 * Fetch full transcript for a bot (after transcript.done). Downloads from Recall's transcript URL.
 */
export async function fetchRecallBotTranscript(
  botId: string
): Promise<import("@/types").RecallTranscriptEntry[] | null> {
  const recordings = await fetchRecallBotRecordings(botId)
  const first = recordings?.[0]
  const downloadUrl = first?.media_shortcuts?.transcript?.data?.download_url
  if (typeof downloadUrl !== "string" || !downloadUrl) return null
  try {
    const res = await fetch(downloadUrl)
    if (!res.ok) return null
    const raw = (await res.json()) as unknown
    const list = Array.isArray(raw) ? raw : null
    if (!list) return null
    const entries: import("@/types").RecallTranscriptEntry[] = []
    for (const item of list as RecallDownloadUtterance[]) {
      const words = item.words ?? []
      const text = words.map((w) => (typeof w?.text === "string" ? w.text : "")).filter(Boolean).join(" ").trim()
      if (!text) continue
      entries.push({
        speaker: typeof item.participant?.name === "string" ? item.participant.name : undefined,
        text,
      })
    }
    return entries.length > 0 ? entries : null
  } catch (err) {
    console.warn("[recall] fetch transcript download error:", err)
    return null
  }
}
