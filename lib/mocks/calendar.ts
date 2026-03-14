import { seededEvents } from "@/lib/demo/seed"
import type { CalendarEvent } from "@/types"

export function getMockEvents(
  startDate?: string,
  endDate?: string
): CalendarEvent[] {
  return seededEvents
}
