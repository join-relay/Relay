import { describe, it, expect, beforeEach, vi } from "vitest"
import { generateMeetingSummary } from "../lib/services/meeting-summary"
import type { RecallTranscriptEntry } from "../types"

describe("generateMeetingSummary", () => {
  beforeEach(() => {
    vi.stubEnv("OPENAI_API_KEY", "")
  })

  it("returns fallback message for empty transcript", async () => {
    const result = await generateMeetingSummary([])
    expect(result).toBe("No transcript was captured for this meeting.")
  })

  it("returns fallback that includes transcript content when no API key", async () => {
    const entries: RecallTranscriptEntry[] = [
      { speaker: "Alice", text: "Let's meet same time next week." },
      { speaker: "Bob", text: "Sounds good." },
    ]
    const result = await generateMeetingSummary(entries)
    expect(result).toContain("Meeting transcript captured")
    expect(result).toContain("Alice")
    expect(result).toContain("Let's meet same time next week")
    expect(result).toContain("Bob")
    expect(result).toContain("Sounds good")
  })
})
