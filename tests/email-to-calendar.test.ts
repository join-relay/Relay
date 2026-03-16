import { describe, it, expect, beforeEach, vi } from "vitest"
import { extractProposedMeetingFromEmail } from "../lib/services/email-to-calendar"

describe("extractProposedMeetingFromEmail", () => {
  beforeEach(() => {
    vi.stubEnv("OPENAI_API_KEY", "")
  })

  it("returns null for empty body", async () => {
    const result = await extractProposedMeetingFromEmail("")
    expect(result).toBeNull()
  })

  it("returns null for very short text", async () => {
    const result = await extractProposedMeetingFromEmail("Hi")
    expect(result).toBeNull()
  })
})
