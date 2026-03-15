import type { EmailMessage } from "@/types/context";
import { decodeHtmlEntities } from "@/lib/text";

const GRAPH = "https://graph.microsoft.com/v1.0";
const MAX_MESSAGES = 50;
const MAX_FULL_BODY = 25;

async function graphGet(accessToken: string, path: string, params?: Record<string, string>) {
  const url = new URL(`${GRAPH}${path}`);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Graph ${path}: ${res.status}`);
  return res.json();
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

export async function syncOutlook(accessToken: string): Promise<EmailMessage[]> {
  const list = (await graphGet(accessToken, "/me/messages", {
    $top: String(MAX_MESSAGES),
    $orderby: "receivedDateTime desc",
    $select: "id,subject,from,receivedDateTime,isRead,bodyPreview,body",
  })) as {
    value?: Array<{
      id: string;
      subject?: string;
      from?: { emailAddress?: { address?: string; name?: string } };
      receivedDateTime?: string;
      isRead?: boolean;
      bodyPreview?: string;
      body?: { content?: string; contentType?: string };
    }>;
  };
  const items = list.value || [];
  const syncedAt = new Date().toISOString();
  const results: EmailMessage[] = [];
  for (let i = 0; i < items.length; i++) {
    const m = items[i];
    const from = decodeHtmlEntities(m.from?.emailAddress?.address || m.from?.emailAddress?.name || "");
    const rawBodyText =
      i < MAX_FULL_BODY && m.body?.content
        ? (m.body.contentType === "html" ? stripHtml(m.body.content) : m.body.content).slice(0, 5000)
        : undefined;
    const bodyText = rawBodyText ? decodeHtmlEntities(rawBodyText) : undefined;
    results.push({
      id: m.id,
      threadId: m.id,
      from,
      to: undefined,
      subject: decodeHtmlEntities(m.subject || "(No subject)"),
      date: m.receivedDateTime || syncedAt,
      labelIds: [],
      snippet: m.bodyPreview ? decodeHtmlEntities(m.bodyPreview) : undefined,
      bodyText,
      unread: !m.isRead,
      sourceId: m.id,
      syncedAt,
    });
  }
  return results;
}
