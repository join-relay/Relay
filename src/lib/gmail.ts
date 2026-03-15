import { gmail_v1, google } from "googleapis";
import type { EmailMessage } from "@/types/context";
import { decodeHtmlEntities } from "@/lib/text";

const MAX_MESSAGES_LIST = 50;
const MAX_FULL_BODY = 25;

function decodeBase64Url(data: string): string {
  const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(base64, "base64").toString("utf-8");
}

function extractBody(payload: gmail_v1.Schema$MessagePart | undefined): string | undefined {
  if (!payload) return undefined;
  if (payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === "text/plain" && part.body?.data) {
        return decodeBase64Url(part.body.data);
      }
    }
    for (const part of payload.parts) {
      if (part.mimeType === "text/html" && part.body?.data) {
        const html = decodeBase64Url(part.body.data);
        return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 2000);
      }
    }
  }
  return undefined;
}

function parseHeader(headers: gmail_v1.Schema$MessagePartHeader[] | undefined, name: string): string {
  if (!headers) return "";
  const h = headers.find((x) => x.name?.toLowerCase() === name.toLowerCase());
  return (h?.value as string) || "";
}

export async function syncGmail(auth: gmail_v1.Options["auth"]): Promise<EmailMessage[]> {
  const gmail = google.gmail({ version: "v1", auth });
  const listRes = await gmail.users.messages.list({
    userId: "me",
    maxResults: MAX_MESSAGES_LIST,
    labelIds: ["INBOX"],
  });

  const ids = (listRes.data.messages || []).map((m) => m.id!).filter(Boolean);
  const results: EmailMessage[] = [];
  const now = new Date().toISOString();

  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    const format = i < MAX_FULL_BODY ? "full" : "metadata";
    const msgRes = await gmail.users.messages.get({ userId: "me", id, format });
    const m = msgRes.data;

    const labelIds = (m.labelIds as string[]) || [];
    const unread = labelIds.includes("UNREAD");

    const payload = m.payload;
    const headers = payload?.headers;
    const from = parseHeader(headers, "From");
    const to = parseHeader(headers, "To");
    const subject = decodeHtmlEntities(parseHeader(headers, "Subject"));
    const date = parseHeader(headers, "Date");
    const rawSnippet = m.snippet as string | undefined;
    const snippet = rawSnippet ? decodeHtmlEntities(rawSnippet) : undefined;
    let bodyText: string | undefined;
    if (format === "full" && payload) {
      const raw = extractBody(payload as gmail_v1.Schema$MessagePart);
      bodyText = raw ? decodeHtmlEntities(raw) : undefined;
    }

    results.push({
      id: m.id!,
      threadId: m.threadId!,
      from,
      to,
      subject,
      date,
      labelIds,
      snippet,
      bodyText,
      unread,
      sourceId: m.id!,
      syncedAt: now,
    });
  }

  return results;
}
