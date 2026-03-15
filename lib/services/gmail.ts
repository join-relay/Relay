import "server-only"

import type { GmailThread } from "@/types"
import {
  clearGoogleAccountConnection,
  getGoogleAccessToken,
  getGoogleOAuthClient,
} from "@/lib/services/google-auth"
import { google } from "googleapis"

function getHeader(headers: { name?: string | null; value?: string | null }[] | undefined, name: string) {
  return (
    headers?.find((header) => header.name?.toLowerCase() === name.toLowerCase())?.value ?? undefined
  )
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

export async function getLiveGmailThreads(email?: string | null, limit = 8): Promise<GmailThread[]> {
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
      q: "category:primary newer_than:7d",
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
          subject: getHeader(payloadHeaders, "Subject") ?? "(No subject)",
          from: getHeader(payloadHeaders, "From") ?? "Unknown sender",
          date: detail.data.internalDate
            ? new Date(Number(detail.data.internalDate)).toISOString()
            : new Date().toISOString(),
          snippet: detail.data.snippet ?? "",
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

/** Send an email (or reply) using Gmail API. Requires gmail.send scope. */
export async function sendEmail(
  email: string | null | undefined,
  payload: { to?: string; subject: string; body: string; threadId?: string }
): Promise<{ id: string; threadId: string }> {
  const accessToken = await getGoogleAccessToken(email)
  if (!accessToken) {
    throw new Error("No Google access token is available for Gmail send")
  }

  const to = payload.to ?? ""
  const subject = payload.subject ?? ""
  const body = payload.body ?? ""
  const lines = [
    `To: ${to}`,
    `Subject: ${subject.replace(/\r?\n/g, " ")}`,
    "Content-Type: text/plain; charset=utf-8",
    "",
    body,
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
