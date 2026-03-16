import { describe, it, expect } from "vitest"
import {
  getConflictingEvents,
  getUpcomingGoogleMeet,
  isGoogleMeetEvent,
} from "../lib/services/calendar"
import type { CalendarEvent } from "../types"

function evt(
  id: string,
  start: string,
  end: string,
  opts: Partial<CalendarEvent> = {}
): CalendarEvent {
  return {
    id,
    title: `Event ${id}`,
    start,
    end,
    isAllDay: false,
    ...opts,
  }
}

describe("isGoogleMeetEvent", () => {
  it("returns true when meetingProvider is google_meet", () => {
    expect(isGoogleMeetEvent(evt("1", "2025-01-01T10:00:00Z", "2025-01-01T11:00:00Z", { meetingProvider: "google_meet" }))).toBe(true)
  })

  it("returns true when joinUrl contains meet.google.com", () => {
    expect(isGoogleMeetEvent(evt("1", "2025-01-01T10:00:00Z", "2025-01-01T11:00:00Z", { joinUrl: "https://meet.google.com/abc-defg-hij" }))).toBe(true)
  })

  it("returns false when no Meet link or provider", () => {
    expect(isGoogleMeetEvent(evt("1", "2025-01-01T10:00:00Z", "2025-01-01T11:00:00Z"))).toBe(false)
  })
})

describe("getConflictingEvents", () => {
  it("marks overlapping events as conflict", () => {
    const events = [
      evt("a", "2025-01-01T10:00:00Z", "2025-01-01T11:00:00Z"),
      evt("b", "2025-01-01T10:30:00Z", "2025-01-01T11:30:00Z"),
    ]
    const result = getConflictingEvents(events)
    expect(result.every((e) => e.isConflict)).toBe(true)
  })

  it("leaves non-overlapping events without conflict", () => {
    const events = [
      evt("a", "2025-01-01T10:00:00Z", "2025-01-01T11:00:00Z"),
      evt("b", "2025-01-01T11:00:00Z", "2025-01-01T12:00:00Z"),
    ]
    const result = getConflictingEvents(events)
    expect(result.every((e) => !e.isConflict)).toBe(true)
  })

  it("ignores all-day events for conflict detection", () => {
    const events = [
      evt("a", "2025-01-01", "2025-01-02", { isAllDay: true }),
      evt("b", "2025-01-01T10:00:00Z", "2025-01-01T11:00:00Z"),
    ]
    const result = getConflictingEvents(events)
    expect(result.every((e) => !e.isConflict)).toBe(true)
  })
})

describe("getUpcomingGoogleMeet", () => {
  it("returns null for empty events", () => {
    expect(getUpcomingGoogleMeet([])).toBeNull()
  })

  it("returns the next Meet that has not ended", () => {
    const base = new Date()
    const pastStart = new Date(base)
    pastStart.setHours(pastStart.getHours() - 2)
    const pastEnd = new Date(base)
    pastEnd.setHours(pastEnd.getHours() - 1)
    const futureStart = new Date(base)
    futureStart.setMinutes(futureStart.getMinutes() + 5)
    const futureEnd = new Date(base)
    futureEnd.setHours(futureEnd.getHours() + 1)
    const events = [
      evt("past", pastStart.toISOString(), pastEnd.toISOString(), { joinUrl: "https://meet.google.com/x" }),
      evt("current", futureStart.toISOString(), futureEnd.toISOString(), { joinUrl: "https://meet.google.com/y" }),
    ]
    const result = getUpcomingGoogleMeet(events)
    expect(result?.id).toBe("current")
  })

  it("returns null when all events are in the past", () => {
    const base = new Date()
    const pastStart = new Date(base)
    pastStart.setHours(pastStart.getHours() - 2)
    const pastEnd = new Date(base)
    pastEnd.setHours(pastEnd.getHours() - 1)
    const events = [
      evt("past", pastStart.toISOString(), pastEnd.toISOString(), { joinUrl: "https://meet.google.com/x" }),
    ]
    const result = getUpcomingGoogleMeet(events)
    expect(result).toBeNull()
  })
})
