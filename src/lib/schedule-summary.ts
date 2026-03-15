import type { WorkLifeContext } from "@/types/context";

/**
 * Build a natural-language summary like "You've got a stressful schedule! Next up is Standup at 9:00 AM, then a meeting with Sarah."
 */
export function getScheduleSummary(context: WorkLifeContext | null): string {
  if (!context) return "";

  const now = new Date();
  const todayKey = now.toISOString().slice(0, 10);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowKey = tomorrow.toISOString().slice(0, 10);

  const upcoming = context.calendar.events
    .filter((e) => {
      const key = e.start.slice(0, 10);
      return (key === todayKey || key === tomorrowKey) && new Date(e.start) >= now;
    })
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  const allTodayTomorrow = context.calendar.events
    .filter((e) => {
      const key = e.start.slice(0, 10);
      return key === todayKey || key === tomorrowKey;
    })
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  const nextEvent = upcoming[0] ?? allTodayTomorrow[0];
  const afterThat = upcoming[1] ?? (upcoming[0] ? allTodayTomorrow[1] : allTodayTomorrow[1]);

  const load = context.derivedStress?.score ?? context.wellbeing?.latest?.overwhelmScore;
  let vibe = "";
  if (load !== undefined) {
    if (load >= 4) vibe = "You've got a stressful schedule! ";
    else if (load >= 3) vibe = "It's a busy day. ";
    else if (load <= 2 && (context.calendar.todayCount === 0 || allTodayTomorrow.length === 0)) vibe = "Light day ahead. ";
    else vibe = "Here's how your day looks. ";
  } else if (context.lastSyncedAt) {
    vibe = "Here's how your day looks. ";
  }

  if (!nextEvent) {
    if (allTodayTomorrow.length === 0) return (vibe || "No events today or tomorrow. Sync to see your calendar.").trim();
    return (vibe + "Your next event is " + formatEventSummary(allTodayTomorrow[0]) + ".").trim();
  }

  const timeStr = new Date(nextEvent.start).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  let line = vibe + "Next up is " + (nextEvent.summary || "an event") + " at " + timeStr;

  if (afterThat) {
    const isMeeting = afterThat.isMeet || /meeting|standup|sync|call|1:1|1-1/i.test(afterThat.summary || "");
    const withWho = getMeetingWith(afterThat);
    if (isMeeting && withWho) line += ", then a meeting with " + withWho;
    else line += ", then " + (afterThat.summary || "another event");
    line += ".";
  } else {
    line += ".";
  }

  return line;
}

function formatEventSummary(e: { summary: string; start: string }): string {
  const time = new Date(e.start).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return (e.summary || "an event") + " at " + time;
}

/** Try to get a person name for "meeting with X" from event summary or attendees. */
function getMeetingWith(e: { summary?: string; attendees?: string[] }): string | null {
  const summary = (e.summary || "").trim();
  // "1:1 with Sarah" / "Meeting with John" / "Sarah - Review"
  const withMatch = summary.match(/(?:with|w\/)\s*([^–\-–—]+?)(?:\s*[-–—]|$)/i) || summary.match(/^([^–\-–—]+?)\s*[-–—]/);
  if (withMatch) return withMatch[1].trim();
  // First attendee email: use local part or strip domain for a short name
  const first = e.attendees?.[0];
  if (first) {
    const name = first.includes("@") ? first.replace(/@.*/, "").replace(/[._]/g, " ") : first;
    if (name.length > 0 && name.length < 30) return name;
  }
  return null;
}
