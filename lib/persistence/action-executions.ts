import "server-only"

import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import type { ActionExecutionRecord } from "@/types"

const STORE_DIR = path.join(process.cwd(), ".relay")
const STORE_FILE = path.join(STORE_DIR, "action-executions.json")

function normalizeActionExecutionRecord(raw: unknown): ActionExecutionRecord | null {
  if (!raw || typeof raw !== "object") return null

  const record = raw as Partial<ActionExecutionRecord> & {
    sourceContext?: unknown
    executionSummary?: unknown
    provider?: unknown
    sourceType?: unknown
    sourceIdentifiers?: unknown
  }

  if (
    typeof record.id !== "string" ||
    typeof record.actionId !== "string" ||
    typeof record.type !== "string" ||
    typeof record.title !== "string" ||
    typeof record.executedAt !== "string" ||
    (record.status !== "success" && record.status !== "failed" && record.status !== "rejected")
  ) {
    return null
  }

  const looksLikeLiveGmail = record.actionId.startsWith("gmail:")
  const looksLikeLiveCalendar = record.actionId.startsWith("calendar:")
  const inferredSource =
    looksLikeLiveGmail || looksLikeLiveCalendar
      ? "live"
      : record.source === "live"
        ? "live"
        : "mock"

  const inferredProvider = looksLikeLiveGmail
    ? "gmail"
    : looksLikeLiveCalendar
      ? "google_calendar"
      : "mock"

  const inferredSourceType = looksLikeLiveGmail
    ? "gmail_thread"
    : looksLikeLiveCalendar
      ? "calendar_event"
      : "demo_fallback"
  const payload = (record.proposedPayload ?? {}) as Record<string, unknown>
  const hasExplicitProvenance =
    record.provider === "gmail" ||
    record.provider === "google_calendar" ||
    record.provider === "mock" ||
    record.sourceType === "gmail_thread" ||
    record.sourceType === "calendar_event" ||
    record.sourceType === "demo_fallback"
  const inferredSourceIdentifiers = looksLikeLiveGmail
    ? {
        gmailThreadId:
          typeof payload.threadId === "string" ? payload.threadId : record.actionId.replace(/^gmail:/, ""),
      }
    : looksLikeLiveCalendar
      ? (() => {
          const compositeId =
            typeof payload.eventId === "string" && payload.eventId.length > 0
              ? payload.eventId
              : record.actionId.replace(/^calendar:/, "")
          const colon = compositeId.indexOf(":")
          return {
            calendarId: colon >= 0 ? compositeId.slice(0, colon) || "primary" : "primary",
            calendarEventId: colon >= 0 ? compositeId.slice(colon + 1) || compositeId : compositeId,
          }
        })()
      : { demoActionId: record.actionId }

  return {
    id: record.id,
    actionId: record.actionId,
    type: record.type,
    title: record.title,
    sourceContext:
      typeof record.sourceContext === "string" && record.sourceContext.length > 0
        ? record.sourceContext
        : "Legacy execution record imported before provenance tracking was added.",
    proposedPayload: payload as unknown as ActionExecutionRecord["proposedPayload"],
    executionSummary:
      typeof record.executionSummary === "string" ? record.executionSummary : undefined,
    executedAt: record.executedAt,
    status: record.status,
    errorMessage: typeof record.errorMessage === "string" ? record.errorMessage : undefined,
    userEmail: typeof record.userEmail === "string" || record.userEmail === null ? record.userEmail : null,
    source:
      hasExplicitProvenance && (record.source === "live" || record.source === "mock")
        ? record.source
        : inferredSource,
    provider:
      record.provider === "gmail" ||
      record.provider === "google_calendar" ||
      record.provider === "mock"
        ? record.provider
        : inferredProvider,
    sourceType:
      record.sourceType === "gmail_thread" ||
      record.sourceType === "calendar_event" ||
      record.sourceType === "demo_fallback"
        ? record.sourceType
        : inferredSourceType,
    sourceIdentifiers:
      record.sourceIdentifiers && typeof record.sourceIdentifiers === "object"
        ? record.sourceIdentifiers
        : inferredSourceIdentifiers,
  }
}

async function readAll(): Promise<ActionExecutionRecord[]> {
  try {
    const raw = await readFile(STORE_FILE, "utf8")
    const data = JSON.parse(raw)
    return Array.isArray(data)
      ? data
          .map(normalizeActionExecutionRecord)
          .filter((record): record is ActionExecutionRecord => record !== null)
      : []
  } catch (error) {
    const isMissing =
      error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT"
    if (isMissing) return []
    console.error("Failed to read action executions store:", error)
    return []
  }
}

async function writeAll(records: ActionExecutionRecord[]) {
  await mkdir(STORE_DIR, { recursive: true })
  await writeFile(STORE_FILE, JSON.stringify(records, null, 2), "utf8")
}

export async function appendActionExecution(record: ActionExecutionRecord): Promise<void> {
  const list = await readAll()
  list.push(record)
  await writeAll(list)
}

export async function listActionExecutions(): Promise<ActionExecutionRecord[]> {
  const list = await readAll()
  return list.sort((a, b) => new Date(b.executedAt).getTime() - new Date(a.executedAt).getTime())
}
