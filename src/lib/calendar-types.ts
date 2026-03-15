/**
 * Infer calendar event type from summary and flags for tab coloring.
 */
export type CalendarEventType =
  | "meeting"
  | "gathering"
  | "one-on-one"
  | "focus"
  | "interview"
  | "default";

export interface EventTypeStyle {
  type: CalendarEventType;
  bg: string;
  border: string;
  text: string;
}

const s = (summary: string) => (summary || "").toLowerCase();

export function getCalendarEventStyle(
  summary: string,
  isMeet?: boolean
): EventTypeStyle {
  const lower = s(summary);
  // Meetings (including video calls)
  if (
    isMeet ||
    /\b(meeting|standup|sync|call|huddle|all-hands|review meeting)\b/.test(lower)
  ) {
    return { type: "meeting", bg: "#fef2f2", border: "#dc2626", text: "#991b1b" };
  }
  // Gatherings / social
  if (
    /\b(gathering|party|social|team building|happy hour|celebration|event|offsite|retreat)\b/.test(
      lower
    )
  ) {
    return { type: "gathering", bg: "#f0fdf4", border: "#16a34a", text: "#166534" };
  }
  // 1:1s
  if (/\b(1:1|1-1|one.?on.?one|one on one)\b/.test(lower)) {
    return { type: "one-on-one", bg: "#eff6ff", border: "#2563eb", text: "#1e40af" };
  }
  // Focus / deep work
  if (/\b(focus|block|deep work|heads down|do not disturb|dnb)\b/.test(lower)) {
    return { type: "focus", bg: "#fffbeb", border: "#d97706", text: "#92400e" };
  }
  // Interview
  if (/\b(interview)\b/.test(lower)) {
    return { type: "interview", bg: "#f5f3ff", border: "#7c3aed", text: "#5b21b6" };
  }
  // Default
  return { type: "default", bg: "#f1f5f9", border: "#64748b", text: "#475569" };
}
