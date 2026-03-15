import { calendar_v3, google } from "googleapis";
import type { CalendarEvent } from "@/types/context";

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

export async function syncCalendar(auth: calendar_v3.Options["auth"]): Promise<CalendarEvent[]> {
  const calendar = google.calendar({ version: "v3", auth });
  const now = new Date();
  const timeMin = new Date(now);
  timeMin.setHours(0, 0, 0, 0);
  const timeMax = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const res = await calendar.events.list({
    calendarId: "primary",
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: true,
    orderBy: "startTime",
  });

  const items = res.data.items || [];
  const syncedAt = new Date().toISOString();
  const events: CalendarEvent[] = items.map((e) => {
    const start = (e.start?.dateTime || e.start?.date) || "";
    const end = (e.end?.dateTime || e.end?.date) || "";
    const description = e.description ? stripHtml(e.description) : undefined;
    const conferenceData = e.conferenceData as { notes?: string } | undefined;
    const conferenceDataNotes = conferenceData?.notes;
    const hasMeet =
      !!e.conferenceData ||
      (!!e.description && e.description.includes("meet.google.com"));
    const attendees = (e.attendees || []).map((a) => a.email || "").filter(Boolean);

    return {
      id: e.id!,
      summary: e.summary || "(No title)",
      start,
      end,
      description,
      location: typeof e.location === "string" ? e.location : undefined,
      conferenceDataNotes,
      attendees,
      isMeet: hasMeet,
      sourceId: e.id!,
      syncedAt,
    };
  });

  return events;
}
