import "server-only"

import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { google } from "googleapis"
import type { GoogleIntegrationStatus } from "@/types"
import { decryptSecret, encryptSecret, isEncryptionConfigured } from "@/lib/security/encryption"

export const GOOGLE_GMAIL_READ_SCOPE = "https://www.googleapis.com/auth/gmail.readonly"
export const GOOGLE_GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send"
export const GOOGLE_CALENDAR_READ_SCOPE = "https://www.googleapis.com/auth/calendar.readonly"
export const GOOGLE_CALENDAR_WRITE_SCOPE = "https://www.googleapis.com/auth/calendar.events"
export const GOOGLE_DRIVE_FILE_SCOPE = "https://www.googleapis.com/auth/drive.file"
/** Read meeting space data (e.g. post-meeting transcripts) from Google Meet REST API. */
export const GOOGLE_MEET_READ_SCOPE = "https://www.googleapis.com/auth/meetings.space.readonly"

const LEGACY_GOOGLE_CALENDAR_READ_SCOPE =
  "https://www.googleapis.com/auth/calendar.events.readonly"

export const GOOGLE_BASE_SCOPES = [
  "openid",
  "email",
  "profile",
  GOOGLE_GMAIL_READ_SCOPE,
  GOOGLE_GMAIL_SEND_SCOPE,
  GOOGLE_CALENDAR_READ_SCOPE,
  GOOGLE_CALENDAR_WRITE_SCOPE,
  GOOGLE_DRIVE_FILE_SCOPE,
  GOOGLE_MEET_READ_SCOPE,
] as const

type GoogleTokenRecord = {
  subject: string
  email?: string
  name?: string | null
  image?: string | null
  scopes: string[]
  refreshTokenEncrypted?: string
  accessToken?: string
  accessTokenExpiresAt?: number
  updatedAt: string
}

const STORE_DIRECTORY = path.join(process.cwd(), ".relay")
const STORE_FILE = path.join(STORE_DIRECTORY, "google-connections.json")

declare global {
  // eslint-disable-next-line no-var
  var __relayGoogleTokenStore: Map<string, GoogleTokenRecord> | undefined
}

function getTokenStore() {
  globalThis.__relayGoogleTokenStore ??= new Map()
  return globalThis.__relayGoogleTokenStore
}

async function readPersistentStore(): Promise<Record<string, GoogleTokenRecord>> {
  try {
    const contents = await readFile(STORE_FILE, "utf8")
    return JSON.parse(contents) as Record<string, GoogleTokenRecord>
  } catch (error) {
    const isMissingFile =
      error instanceof Error && "code" in error && error.code === "ENOENT"
    if (isMissingFile) {
      return {}
    }

    console.error("Failed to read Google connection store:", error)
    return {}
  }
}

async function writePersistentStore(records: Record<string, GoogleTokenRecord>) {
  await mkdir(STORE_DIRECTORY, { recursive: true })
  await writeFile(STORE_FILE, JSON.stringify(records, null, 2), "utf8")
}

/** Persist a single updated record (e.g. after refresh) so file and in-memory stay in sync. */
async function persistRecordToFile(record: GoogleTokenRecord) {
  const key = getRecordKey(record.email, record.subject)
  if (!key) return
  const fileRecords = await readPersistentStore()
  fileRecords[key] = record
  await writePersistentStore(fileRecords)
}

function normalizeEmail(email?: string | null) {
  return email?.trim().toLowerCase()
}

function normalizeScopes(scopeValue?: string | null) {
  return scopeValue
    ?.split(/\s+/)
    .map((scope) => scope.trim())
    .filter(Boolean) ?? []
}

function hasGrantedScope(scopes: string[], requiredScope: string) {
  return scopes.includes(requiredScope)
}

function hasLegacyCalendarReadScope(scopes: string[]) {
  return (
    hasGrantedScope(scopes, LEGACY_GOOGLE_CALENDAR_READ_SCOPE) &&
    !hasGrantedScope(scopes, GOOGLE_CALENDAR_READ_SCOPE)
  )
}

function getRecordKey(email?: string | null, subject?: string | null) {
  const normalizedEmail = normalizeEmail(email)
  if (normalizedEmail) return normalizedEmail
  if (subject) return `sub:${subject}`
  return null
}

function getRequiredGoogleEnv() {
  const missingEnv = [
    "NEXTAUTH_SECRET",
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "ENCRYPTION_KEY",
  ].filter((key) => !process.env[key])

  return {
    missingEnv,
    ready: missingEnv.length === 0,
  }
}

async function refreshAccessToken(record: GoogleTokenRecord) {
  if (!record.refreshTokenEncrypted) {
    throw new Error("No refresh token stored for this Google connection")
  }
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    throw new Error("Google OAuth server environment variables are missing")
  }

  const refreshToken = decryptSecret(record.refreshTokenEncrypted)
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  })

  const body = (await response.json().catch(() => ({}))) as {
    access_token?: string
    expires_in?: number
    scope?: string
    refresh_token?: string
    error?: string
  }

  if (!response.ok || !body.access_token) {
    throw new Error(body.error ?? "Google token refresh failed")
  }

  record.accessToken = body.access_token
  record.accessTokenExpiresAt = Date.now() + Math.max((body.expires_in ?? 3600) - 60, 60) * 1000
  record.scopes = body.scope ? normalizeScopes(body.scope) : record.scopes
  if (body.refresh_token && isEncryptionConfigured()) {
    record.refreshTokenEncrypted = encryptSecret(body.refresh_token)
  }
  record.updatedAt = new Date().toISOString()

  await persistRecordToFile(record)
  return record.accessToken
}

export function getGoogleOAuthClient(accessToken: string) {
  const authClient = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  )
  authClient.setCredentials({ access_token: accessToken })
  return authClient
}

export async function upsertGoogleAccountTokens(params: {
  subject?: string | null
  email?: string | null
  name?: string | null
  image?: string | null
  accessToken?: string | null
  refreshToken?: string | null
  expiresAt?: number | null
  scope?: string | null
}) {
  const key = getRecordKey(params.email, params.subject)
  if (!key) return null

  const store = getTokenStore()
  const fileRecords = await readPersistentStore()
  const existing = store.get(key) ?? fileRecords[key]
  const scopes = normalizeScopes(params.scope).length > 0
    ? normalizeScopes(params.scope)
    : existing?.scopes ?? []

  const nextRecord: GoogleTokenRecord = {
    subject: params.subject ?? existing?.subject ?? key,
    email: normalizeEmail(params.email) ?? existing?.email,
    name: params.name ?? existing?.name,
    image: params.image ?? existing?.image,
    scopes,
    refreshTokenEncrypted:
      params.refreshToken && isEncryptionConfigured()
        ? encryptSecret(params.refreshToken)
        : existing?.refreshTokenEncrypted,
    accessToken: params.accessToken ?? existing?.accessToken,
    accessTokenExpiresAt:
      typeof params.expiresAt === "number" && params.expiresAt > 0
        ? params.expiresAt * 1000
        : existing?.accessTokenExpiresAt,
    updatedAt: new Date().toISOString(),
  }

  store.set(key, nextRecord)
  fileRecords[key] = nextRecord
  await writePersistentStore(fileRecords)
  return nextRecord
}

export async function clearGoogleAccountConnection(email?: string | null) {
  const key = getRecordKey(email, null)
  if (!key) return
  getTokenStore().delete(key)

  const fileRecords = await readPersistentStore()
  if (key in fileRecords) {
    delete fileRecords[key]
    await writePersistentStore(fileRecords)
  }
}

export async function getGoogleAccountRecord(email?: string | null) {
  const key = getRecordKey(email, null)
  if (!key) return null

  const store = getTokenStore()
  const inMemory = store.get(key)
  if (inMemory) {
    return inMemory
  }

  const fileRecords = await readPersistentStore()
  const persisted = fileRecords[key] ?? null
  if (persisted) {
    store.set(key, persisted)
  }

  return persisted
}

export async function getGoogleAccessToken(email?: string | null) {
  const record = await getGoogleAccountRecord(email)
  if (!record) {
    return null
  }

  if (
    record.accessToken &&
    record.accessTokenExpiresAt &&
    record.accessTokenExpiresAt > Date.now()
  ) {
    return record.accessToken
  }

  return await refreshAccessToken(record)
}

export async function getBaseGoogleIntegrationStatus(params: {
  email?: string | null
  name?: string | null
  hasSession: boolean
}): Promise<GoogleIntegrationStatus> {
  const env = getRequiredGoogleEnv()
  const encryptionReady = isEncryptionConfigured()
  const record = await getGoogleAccountRecord(params.email)
  const scopes = record?.scopes ?? []
  const canReadGmail = hasGrantedScope(scopes, GOOGLE_GMAIL_READ_SCOPE)
  const canReadCalendar = hasGrantedScope(scopes, GOOGLE_CALENDAR_READ_SCOPE)
  const hasStaleCalendarReadScope = hasLegacyCalendarReadScope(scopes)

  if (!env.ready) {
    return {
      status: "not_configured",
      displayName: params.name ?? record?.name ?? undefined,
      email: normalizeEmail(params.email) ?? record?.email,
      scopes,
      missingEnv: env.missingEnv,
      hasSession: params.hasSession,
      hasRefreshToken: Boolean(record?.refreshTokenEncrypted),
      encryptionReady,
      canReadGmail,
      canReadCalendar,
      canUseLiveBriefing: false,
      nextMeetEvent: null,
      note: "Relay still needs Google OAuth server configuration before live Gmail and Calendar reads can work.",
    }
  }

  if (!params.hasSession) {
    return {
      status: "fallback",
      displayName: params.name ?? record?.name ?? undefined,
      email: normalizeEmail(params.email) ?? record?.email,
      scopes,
      missingEnv: [],
      hasSession: false,
      hasRefreshToken: Boolean(record?.refreshTokenEncrypted),
      encryptionReady,
      canReadGmail: false,
      canReadCalendar: false,
      canUseLiveBriefing: false,
      nextMeetEvent: null,
      note: "Google auth is not connected, so Relay is using explicit mock fallback data.",
    }
  }

  if (!record?.refreshTokenEncrypted || !encryptionReady) {
    return {
      status: "blocked",
      displayName: params.name ?? record?.name ?? undefined,
      email: normalizeEmail(params.email) ?? record?.email,
      scopes,
      missingEnv: encryptionReady ? [] : ["ENCRYPTION_KEY"],
      hasSession: true,
      hasRefreshToken: Boolean(record?.refreshTokenEncrypted),
      encryptionReady,
      canReadGmail,
      canReadCalendar,
      canUseLiveBriefing: false,
      nextMeetEvent: null,
      note: encryptionReady
        ? "Google sign-in succeeded, but no refresh token is stored yet for live Gmail and Calendar reads."
        : "ENCRYPTION_KEY is missing, so Relay cannot safely store the Google refresh token for live reads.",
    }
  }

  return {
    status: canReadGmail && canReadCalendar ? "validated" : "blocked",
    displayName: params.name ?? record.name ?? undefined,
    email: normalizeEmail(params.email) ?? record.email,
    scopes,
    missingEnv: [],
    hasSession: true,
    hasRefreshToken: true,
    encryptionReady,
    canReadGmail,
    canReadCalendar,
    canUseLiveBriefing: canReadGmail && canReadCalendar,
    nextMeetEvent: null,
    note:
      canReadGmail && canReadCalendar
        ? "Google auth is connected and Relay can attempt live Gmail and Calendar reads."
        : hasStaleCalendarReadScope
          ? "Google auth is connected, but Relay now needs the broader Google Calendar readonly scope for the live multi-calendar read path. Disconnect and reconnect Google in Settings to re-consent."
          : "Google auth is connected, but the required read scopes are still missing for live briefing data.",
  }
}

export function applyCalendarReadFailureToStatus(
  status: GoogleIntegrationStatus,
  error: unknown
) {
  const message =
    error instanceof Error && error.message
      ? error.message
      : "Google auth is connected, but live Calendar read failed."
  const reconnectRequired =
    message.toLowerCase().includes("re-author") ||
    message.toLowerCase().includes("reconsent") ||
    message.toLowerCase().includes("reconnect")

  status.status = reconnectRequired ? "blocked" : "fallback"
  status.canReadCalendar = false
  status.canUseLiveBriefing = false
  status.nextMeetEvent = null
  status.note = reconnectRequired
    ? message
    : `Google auth is connected, but live Calendar read failed: ${message}`

  return status
}
