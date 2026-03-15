import type { CalendarEvent } from "@/types/context";

const GRAPH = "https://graph.microsoft.com/v1.0";

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

export async function syncMicrosoftCalendar(accessToken: string): Promise<CalendarEvent[]> {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const list = (await graphGet(accessToken, "/me/calendarView", {
    startDateTime: start.toISOString(),
    endDateTime: end.toISOString(),
    $top: "100",
    $select: "id,subject,start,end,body,bodyPreview,location,attendees,isOnlineMeeting,onlineMeeting",
  })) as {
    value?: Array<{
      id: string;
      subject?: string;
      start?: { dateTime?: string; timeZone?: string };
      end?: { dateTime?: string; timeZone?: string };
      body?: { content?: string };
      bodyPreview?: string;
      location?: { displayName?: string };
      attendees?: Array<{ emailAddress?: { address?: string } }>;
      isOnlineMeeting?: boolean;
      onlineMeeting?: unknown;
    }>;
  };
  const items = list.value || [];
  const syncedAt = new Date().toISOString();
  return items.map((e) => ({
    id: e.id,
    summary: e.subject || "(No title)",
    start: e.start?.dateTime || "",
    end: e.end?.dateTime || "",
    description: e.body?.content ? stripHtml(e.body.content) : e.bodyPreview,
    location: e.location?.displayName,
    conferenceDataNotes: undefined,
    attendees: (e.attendees || []).map((a) => a.emailAddress?.address || "").filter(Boolean),
    isMeet: !!e.isOnlineMeeting || !!e.onlineMeeting,
    sourceId: e.id,
    syncedAt,
  }));
}
