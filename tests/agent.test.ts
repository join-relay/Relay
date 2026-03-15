import { describe, it, expect, vi } from "vitest";
import { runDecisionCycle, type ClaudeClient } from "../lib/agent";
import type { YouModel, MeetingContext } from "../types";

const testProfile: YouModel = {
  userName: "Jordan",
  staticIdentity: {
    communicationStyle: "Professional, concise.",
    decisionOwnership: "Decide on scope; escalate budget.",
    hardLimits: ["No legal", "Max $10k"],
    riskTolerance: "Medium.",
  },
  dynamicContext: {},
};

const testMeetingContext: MeetingContext = {
  meetingId: "meet-1",
  transcriptChunk: "So can we get this shipped by Friday?",
};

describe("runDecisionCycle", () => {
  it("returns spoke: false and no response when judgment says shouldSpeak: false", async () => {
    const mockClaude: ClaudeClient = {
      complete: vi.fn().mockResolvedValueOnce(
        JSON.stringify({ shouldSpeak: false, reason: "Just a status update." })
      ),
    };
    const result = await runDecisionCycle(testMeetingContext, {
      profile: testProfile,
      claude: mockClaude,
    });
    expect(result.spoke).toBe(false);
    expect(result.response).toBeUndefined();
    expect(result.confidence).toBeUndefined();
    expect(result.judgmentReason).toBe("Just a status update.");
    expect(mockClaude.complete).toHaveBeenCalledTimes(1);
  });

  it("runs all three calls when judgment says shouldSpeak: true and returns response + confidence", async () => {
    const mockClaude: ClaudeClient = {
      complete: vi
        .fn()
        .mockResolvedValueOnce(
          JSON.stringify({ shouldSpeak: true, reason: "Direct question to us." })
        )
        .mockResolvedValueOnce("Yes, we can commit to Friday.")
        .mockResolvedValueOnce(
          JSON.stringify({ score: 0.85, reasoning: "Clear commitment, within scope." })
        ),
    };
    const result = await runDecisionCycle(testMeetingContext, {
      profile: testProfile,
      claude: mockClaude,
    });
    expect(result.spoke).toBe(true);
    expect(result.response).toBe("Yes, we can commit to Friday.");
    expect(result.confidence).toEqual({
      score: 0.85,
      reasoning: "Clear commitment, within scope.",
    });
    expect(result.judgmentReason).toBe("Direct question to us.");
    expect(mockClaude.complete).toHaveBeenCalledTimes(3);
  });

  it("sets spoke: false when confidence is below minConfidenceToSpeak but still returns response and confidence", async () => {
    const mockClaude: ClaudeClient = {
      complete: vi
        .fn()
        .mockResolvedValueOnce(
          JSON.stringify({ shouldSpeak: true, reason: "They asked." })
        )
        .mockResolvedValueOnce("Maybe, let me check.")
        .mockResolvedValueOnce(
          JSON.stringify({ score: 0.3, reasoning: "Uncertain; needs human." })
        ),
    };
    const result = await runDecisionCycle(testMeetingContext, {
      profile: testProfile,
      claude: mockClaude,
      minConfidenceToSpeak: 0.5,
    });
    expect(result.spoke).toBe(false);
    expect(result.response).toBe("Maybe, let me check.");
    expect(result.confidence?.score).toBe(0.3);
    expect(mockClaude.complete).toHaveBeenCalledTimes(3);
  });

  it("clamps confidence score to 0-1 and handles malformed JSON gracefully", async () => {
    const mockClaude: ClaudeClient = {
      complete: vi
        .fn()
        .mockResolvedValueOnce(
          JSON.stringify({ shouldSpeak: true, reason: "Ok." })
        )
        .mockResolvedValueOnce("Sure.")
        .mockResolvedValueOnce(
          'Here is my reasoning: {"score": 1.5, "reasoning": "High"}'
        ),
    };
    const result = await runDecisionCycle(testMeetingContext, {
      profile: testProfile,
      claude: mockClaude,
    });
    expect(result.confidence?.score).toBe(1);
    expect(result.confidence?.reasoning).toBe("High");
  });

  it("uses default confidence 0.5 and default reason when confidence JSON is missing", async () => {
    const mockClaude: ClaudeClient = {
      complete: vi
        .fn()
        .mockResolvedValueOnce(
          JSON.stringify({ shouldSpeak: true, reason: "Ok." })
        )
        .mockResolvedValueOnce("Okay.")
        .mockResolvedValueOnce("Not valid json here"),
    };
    const result = await runDecisionCycle(testMeetingContext, {
      profile: testProfile,
      claude: mockClaude,
      minConfidenceToSpeak: 0.4,
    });
    expect(result.confidence?.score).toBe(0.5);
    expect(result.confidence?.reasoning).toContain("No reasoning");
    expect(result.spoke).toBe(true);
  });
});
