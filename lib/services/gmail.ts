import "server-only"

import type { GmailThread } from "@/types"
import {
  clearGoogleAccountConnection,
  getGoogleAccessToken,
  getGoogleOAuthClient,
} from "@/lib/services/google-auth"
import { google } from "googleapis"
import { getDevLiveDataState } from "@/lib/persistence/dev-test-state"
import type { GmailThreadContext, GmailThreadMessage, SentEmailSample } from "@/types"

const SIGN_OFF_LINE_PATTERN =
  /^(best regards|best|thanks|thank you|regards|kind regards|sincerely|warmly)[,!]?\s*$/i

function isDevAuthBypassEnabled() {
  return process.env.NODE_ENV !== "production" && process.env.RELAY_DEV_AUTH_BYPASS === "1"
}

function decodeHtmlEntities(value?: string | null) {
  if (!value) return ""

  return value
    .replace(/&#(\d+);/g, (_, code) => {
      const parsed = Number.parseInt(code, 10)
      return Number.isNaN(parsed) ? _ : String.fromCodePoint(parsed)
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => {
      const parsed = Number.parseInt(code, 16)
      return Number.isNaN(parsed) ? _ : String.fromCodePoint(parsed)
    })
    .replace(/&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
}

function getHeader(headers: { name?: string | null; value?: string | null }[] | undefined, name: string) {
  const value =
    headers?.find((header) => header.name?.toLowerCase() === name.toLowerCase())?.value ?? undefined
  return value ? decodeHtmlEntities(value) : undefined
}

function parseEmailAddress(value?: string | null) {
  if (!value) return undefined
  const bracketMatch = value.match(/<([^>]+)>/)
  if (bracketMatch?.[1]) return bracketMatch[1].trim().toLowerCase()

  const emailMatch = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)
  return emailMatch?.[0]?.trim().toLowerCase()
}

function parseReferenceMessageIds(value?: string | null) {
  if (!value) return []
  return Array.from(new Set(value.match(/<[^>]+>/g) ?? []))
}

function encodeMimeWord(value: string) {
  if (!/[^\x20-\x7E]/.test(value)) return value
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`
}

function chunkBase64(value: string, lineLength = 76) {
  const lines: string[] = []
  for (let index = 0; index < value.length; index += lineLength) {
    lines.push(value.slice(index, index + lineLength))
  }
  return lines.join("\r\n")
}

function decodeBase64Url(value?: string | null) {
  if (!value) return ""
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/")
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=")
  const buf = Buffer.from(padded, "base64")
  let text = buf.toString("utf8")
  if ((text.match(/\uFFFD/g) ?? []).length > 3) {
    text = buf.toString("latin1")
  }
  return text
}

/** Normalize email snippet/body for display: decode entities and strip control chars that can break UI. */
export function normalizeEmailTextForDisplay(value?: string | null) {
  if (!value) return ""
  const decoded = decodeHtmlEntities(value)
  return decoded.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ").trim()
}

function stripHtml(html: string) {
  return decodeHtmlEntities(
    html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim()
  )
}

type GmailPayloadPart = {
  mimeType?: string | null
  body?: { data?: string | null } | null
  parts?: GmailPayloadPart[] | null
}

function extractBodyText(part?: GmailPayloadPart | null): string {
  if (!part) return ""

  if (part.mimeType === "text/plain") {
    return decodeBase64Url(part.body?.data)
  }

  if (part.mimeType === "text/html") {
    return stripHtml(decodeBase64Url(part.body?.data))
  }

  if (part.parts?.length) {
    for (const child of part.parts) {
      const text = extractBodyText(child)
      if (text.trim()) return text
    }
  }

  return decodeBase64Url(part.body?.data)
}

function clipText(value: string, maxLength = 420) {
  const trimmed = decodeHtmlEntities(value).replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim()
  if (trimmed.length <= maxLength) return trimmed
  return `${trimmed.slice(0, maxLength).trimEnd()}...`
}

function isQuotedReplyBoundary(lines: string[], index: number) {
  const line = lines[index]?.trim() ?? ""
  if (!line) return false
  if (/^>+/.test(line)) return true
  if (/^On .+wrote:$/i.test(line)) return true
  if (/^Begin forwarded message:$/i.test(line)) return true
  if (/^-{2,}\s*Original Message\s*-{2,}$/i.test(line)) return true
  if (/^_{5,}$/.test(line)) return true

  if (/^From:\s.+/i.test(line)) {
    const nearbyHeaders = lines
      .slice(index, index + 5)
      .map((candidate) => candidate.trim())
      .filter(Boolean)
    const hasReplyHeaders =
      nearbyHeaders.some((candidate) => /^Sent:\s/i.test(candidate)) &&
      nearbyHeaders.some((candidate) => /^Subject:\s/i.test(candidate))
    if (hasReplyHeaders) return true
  }

  return false
}

export function stripQuotedReplyText(bodyText: string) {
  const normalized = bodyText.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim()
  if (!normalized) return ""

  const lines = normalized.split("\n")
  const activeLines: string[] = []

  for (let index = 0; index < lines.length; index += 1) {
    if (isQuotedReplyBoundary(lines, index)) {
      break
    }
    activeLines.push(lines[index] ?? "")
  }

  return activeLines.join("\n").replace(/\n{3,}/g, "\n\n").trim()
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function normalizeEmailBodyForSend(body: string) {
  const normalized = body.replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").trim()
  if (!normalized) return ""

  const paragraphs = normalized
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.split("\n").map((line) => line.trim()).filter(Boolean))
    .filter((paragraph) => paragraph.length > 0)

  return paragraphs
    .map((paragraph) => {
      const isListLike = paragraph.every((line) => /^([-*]|\d+\.)\s/.test(line))
      const isSignatureLike =
        paragraph.length > 1 &&
        (SIGN_OFF_LINE_PATTERN.test(paragraph[0] ?? "") ||
          paragraph.every((line) => line.length <= 48))

      if (isListLike || isSignatureLike) {
        return paragraph.join("\n")
      }

      return paragraph.join(" ")
    })
    .join("\n\n")
}

function buildHtmlEmailBody(body: string) {
  const normalized = normalizeEmailBodyForSend(body)
  const paragraphs = normalized
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)

  const htmlBody = paragraphs
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("")

  return [
    "<!DOCTYPE html>",
    '<html lang="en">',
    "<head>",
    '<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1.0" />',
    "</head>",
    '<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.5;color:#111827;">',
    `<div dir="ltr">${htmlBody}</div>`,
    "</body>",
    "</html>",
  ].join("")
}

function looksLikeLowValueSentSample(subject: string, bodyText: string) {
  const normalizedSubject = subject.toLowerCase()
  const normalizedBody = bodyText.toLowerCase()

  if (/^(fwd?:|automatic reply|out of office)/.test(normalizedSubject)) return true
  if (/(unsubscribe|view in browser|privacy policy|automatic reply|out of office)/.test(normalizedBody)) {
    return true
  }
  return false
}

function isInsufficientScopesError(err: unknown): boolean {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase()
    if (msg.includes("insufficient authentication scopes")) return true
    if (msg.includes("insufficient authentication")) return true
  }
  const status = (err as { code?: number; status?: number })?.code ?? (err as { code?: number; status?: number })?.status
  if (status === 403) {
    const msg = String((err as Error)?.message ?? "").toLowerCase()
    if (msg.includes("scope") || msg.includes("insufficient")) return true
  }
  return false
}

export async function getLiveGmailThreads(email?: string | null, limit = 18): Promise<GmailThread[]> {
  const devLiveData = isDevAuthBypassEnabled() ? await getDevLiveDataState() : null
  if (devLiveData?.enabled) {
    return (devLiveData.gmailThreads ?? []).slice(0, limit)
  }

  const accessToken = await getGoogleAccessToken(email)
  if (!accessToken) {
    throw new Error("No Google access token is available for Gmail")
  }

  try {
    const gmail = google.gmail({
      version: "v1",
      auth: getGoogleOAuthClient(accessToken),
    })

    const listResponse = await gmail.users.messages.list({
      userId: "me",
      labelIds: ["INBOX"],
      maxResults: limit,
      q: "newer_than:14d -category:promotions -category:social -label:chats",
    })

    const messages = listResponse.data.messages ?? []
    const threads = await Promise.all(
      messages.map(async (message) => {
        const detail = await gmail.users.messages.get({
          userId: "me",
          id: message.id ?? "",
          format: "metadata",
          metadataHeaders: ["Subject", "From", "Date"],
        })

        const payloadHeaders = detail.data.payload?.headers
        const labels = detail.data.labelIds ?? []

        return {
          id: detail.data.threadId ?? message.id ?? crypto.randomUUID(),
          messageId: detail.data.id ?? message.id ?? undefined,
          subject: getHeader(payloadHeaders, "Subject") ?? "(No subject)",
          from: getHeader(payloadHeaders, "From") ?? "Unknown sender",
          date: detail.data.internalDate
            ? new Date(Number(detail.data.internalDate)).toISOString()
            : new Date().toISOString(),
          snippet: normalizeEmailTextForDisplay(detail.data.snippet) ?? "",
          isUnread: labels.includes("UNREAD"),
          labels,
        } satisfies GmailThread
      })
    )

    return threads
  } catch (err) {
    if (isInsufficientScopesError(err) && email) {
      await clearGoogleAccountConnection(email)
      throw new Error(
        "Gmail access requires re-authorization. Please disconnect and reconnect Google in Settings to grant Gmail access."
      )
    }
    throw err
  }
}

export async function getLiveGmailThreadById(
  email?: string | null,
  threadId?: string | null
): Promise<GmailThread | null> {
  if (!threadId) return null

  const devLiveData = isDevAuthBypassEnabled() ? await getDevLiveDataState() : null
  if (devLiveData?.enabled) {
    return (devLiveData.gmailThreads ?? []).find((thread) => thread.id === threadId) ?? null
  }

  const accessToken = await getGoogleAccessToken(email)
  if (!accessToken) {
    throw new Error("No Google access token is available for Gmail")
  }

  try {
    const gmail = google.gmail({
      version: "v1",
      auth: getGoogleOAuthClient(accessToken),
    })

    const detail = await gmail.users.threads.get({
      userId: "me",
      id: threadId,
      format: "metadata",
      metadataHeaders: ["Subject", "From", "Date"],
    })

    const latestMessage = detail.data.messages?.at(-1)
    const payloadHeaders = latestMessage?.payload?.headers
    const labels = latestMessage?.labelIds ?? []

    return {
      id: detail.data.id ?? threadId,
      messageId: latestMessage?.id ?? undefined,
      subject: getHeader(payloadHeaders, "Subject") ?? "(No subject)",
      from: getHeader(payloadHeaders, "From") ?? "Unknown sender",
      date: latestMessage?.internalDate
        ? new Date(Number(latestMessage.internalDate)).toISOString()
        : new Date().toISOString(),
      snippet: normalizeEmailTextForDisplay(latestMessage?.snippet) ?? "",
      isUnread: labels.includes("UNREAD"),
      labels,
    } satisfies GmailThread
  } catch (err) {
    if (isInsufficientScopesError(err) && email) {
      await clearGoogleAccountConnection(email)
      throw new Error(
        "Gmail access requires re-authorization. Please disconnect and reconnect Google in Settings to grant Gmail access."
      )
    }
    throw err
  }
}

export async function getGmailThreadContext(
  email?: string | null,
  threadId?: string | null
): Promise<GmailThreadContext | null> {
  if (!threadId) return null

  const devLiveData = isDevAuthBypassEnabled() ? await getDevLiveDataState() : null
  if (devLiveData?.enabled) {
    return devLiveData.gmailThreadContexts?.[threadId] ?? null
  }

  const accessToken = await getGoogleAccessToken(email)
  if (!accessToken) {
    throw new Error("No Google access token is available for Gmail")
  }

  const gmail = google.gmail({
    version: "v1",
    auth: getGoogleOAuthClient(accessToken),
  })

  const detail = await gmail.users.threads.get({
    userId: "me",
    id: threadId,
    format: "full",
  })

  const messages = (detail.data.messages ?? [])
    .map((message) => {
      const headers = message.payload?.headers
      const bodyText = stripQuotedReplyText(extractBodyText(message.payload as GmailPayloadPart))
      const bodyPreview = clipText(bodyText)
      const from = getHeader(headers, "From") ?? "Unknown sender"
      const referenceMessageIds = parseReferenceMessageIds(getHeader(headers, "References"))
      return {
        id: message.id ?? crypto.randomUUID(),
        from,
        to: getHeader(headers, "To") ?? undefined,
        date: message.internalDate
          ? new Date(Number(message.internalDate)).toISOString()
          : new Date().toISOString(),
        snippet: normalizeEmailTextForDisplay(message.snippet) || bodyPreview,
        bodyPreview,
        bodyText,
        rfcMessageId: getHeader(headers, "Message-ID") ?? getHeader(headers, "Message-Id") ?? undefined,
        referenceMessageIds,
      } satisfies GmailThreadMessage
    })
    .sort((left, right) => new Date(left.date).getTime() - new Date(right.date).getTime())

  const subject =
    getHeader(detail.data.messages?.[0]?.payload?.headers, "Subject") ?? "(No subject)"
  const participants = Array.from(
    new Set(messages.flatMap((message) => [message.from, message.to].filter(Boolean) as string[]))
  )
  const latestMessage = messages[messages.length - 1]
  const normalizedUserEmail = parseEmailAddress(email) ?? email?.trim().toLowerCase()
  const replyTarget =
    [...messages]
      .reverse()
      .find((message) => parseEmailAddress(message.from) !== normalizedUserEmail && message.rfcMessageId) ??
    [...messages].reverse().find((message) => message.rfcMessageId)
  const referenceMessageIds = Array.from(
    new Set(
      messages.flatMap((message) => [
        ...(message.referenceMessageIds ?? []),
        ...(message.rfcMessageId ? [message.rfcMessageId] : []),
      ])
    )
  ).slice(-12)

  return {
    threadId,
    subject,
    preview: latestMessage?.bodyPreview || latestMessage?.snippet || subject,
    participants,
    replyToMessageId: replyTarget?.rfcMessageId,
    referenceMessageIds,
    messages,
  }
}

export async function getRecentSentEmailSamples(
  email?: string | null,
  limit = 18
): Promise<SentEmailSample[]> {
  const devLiveData = isDevAuthBypassEnabled() ? await getDevLiveDataState() : null
  if (devLiveData?.enabled) {
    return (devLiveData.sentEmailSamples ?? []).slice(0, limit)
  }

  const accessToken = await getGoogleAccessToken(email)
  if (!accessToken) {
    throw new Error("No Google access token is available for Gmail")
  }

  const gmail = google.gmail({
    version: "v1",
    auth: getGoogleOAuthClient(accessToken),
  })

  const listResponse = await gmail.users.messages.list({
    userId: "me",
    labelIds: ["SENT"],
    q: "newer_than:180d -category:promotions -category:social",
    maxResults: limit,
  })

  const messages = await Promise.all(
    (listResponse.data.messages ?? []).map(async (message) => {
      const detail = await gmail.users.messages.get({
        userId: "me",
        id: message.id ?? "",
        format: "full",
      })

      const bodyText = clipText(extractBodyText(detail.data.payload as GmailPayloadPart), 1200)
      if (!bodyText) return null
      const subject = getHeader(detail.data.payload?.headers, "Subject") ?? "(No subject)"
      if (looksLikeLowValueSentSample(subject, bodyText)) {
        return null
      }

      return {
        subject,
        snippet: normalizeEmailTextForDisplay(detail.data.snippet) || bodyText,
        bodyText,
      } satisfies SentEmailSample
    })
  )

  return messages.filter((message): message is SentEmailSample => message !== null)
}

/** Send an email (or reply) using Gmail API. Requires gmail.send scope. */
export async function sendEmail(
  email: string | null | undefined,
  payload: {
    to?: string
    subject: string
    body: string
    threadId?: string
    replyToMessageId?: string
    referenceMessageIds?: string[]
  }
): Promise<{ id: string; threadId: string }> {
  const accessToken = await getGoogleAccessToken(email)
  if (!accessToken) {
    throw new Error("No Google access token is available for Gmail send")
  }

  const to = payload.to ?? ""
  const subject = payload.subject ?? ""
  const body = payload.body ?? ""
  const referenceMessageIds = Array.from(
    new Set([...(payload.referenceMessageIds ?? []), ...(payload.replyToMessageId ? [payload.replyToMessageId] : [])])
  )
  const normalizedPlainTextBody = normalizeEmailBodyForSend(body).replace(/\n/g, "\r\n")
  const htmlBody = buildHtmlEmailBody(body)
  const boundary = `relay_${crypto.randomUUID()}`
  const encodedPlainTextBody = chunkBase64(Buffer.from(normalizedPlainTextBody, "utf8").toString("base64"))
  const encodedHtmlBody = chunkBase64(Buffer.from(htmlBody, "utf8").toString("base64"))
  const lines = [
    `To: ${to}`,
    `Subject: ${encodeMimeWord(subject.replace(/\r?\n/g, " "))}`,
    ...(payload.replyToMessageId ? [`In-Reply-To: ${payload.replyToMessageId}`] : []),
    ...(referenceMessageIds.length > 0 ? [`References: ${referenceMessageIds.join(" ")}`] : []),
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    encodedPlainTextBody,
    "",
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    encodedHtmlBody,
    "",
    `--${boundary}--`,
  ]
  const rawMessage = lines.join("\r\n")
  const encoded = Buffer.from(rawMessage, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")

  const gmail = google.gmail({
    version: "v1",
    auth: getGoogleOAuthClient(accessToken),
  })

  const sendPayload: { userId: string; requestBody: { raw: string; threadId?: string } } = {
    userId: "me",
    requestBody: { raw: encoded },
  }
  if (payload.threadId) {
    sendPayload.requestBody.threadId = payload.threadId
  }

  const res = await gmail.users.messages.send(sendPayload)
  const id = res.data.id ?? ""
  const threadId = res.data.threadId ?? id
  return { id, threadId }
}
