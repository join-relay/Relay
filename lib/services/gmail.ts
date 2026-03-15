import "server-only"

import type { GmailThread } from "@/types"
import { getGoogleAccessToken, getGoogleOAuthClient } from "@/lib/services/google-auth"
import { google } from "googleapis"

function getHeader(headers: { name?: string | null; value?: string | null }[] | undefined, name: string) {
  return (
    headers?.find((header) => header.name?.toLowerCase() === name.toLowerCase())?.value ?? undefined
  )
}

export async function getLiveGmailThreads(email?: string | null, limit = 8): Promise<GmailThread[]> {
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
}
