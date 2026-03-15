/**
 * One-off script to run a single decision cycle against real Claude (Haiku).
 * Usage: npx tsx scripts/test-agent.ts
 * Requires: .env with ANTHROPIC_API_KEY set.
 */
import "dotenv/config";

import { runDecisionCycle } from "../lib/agent";
import { createClaudeClient } from "../lib/claude";
import type { YouModel, MeetingContext } from "../types";

const profile: YouModel = {
  userName: "Alex",
  staticIdentity: {
    communicationStyle: "Brief and direct. Prefer short sentences.",
    decisionOwnership: "I own product and scope decisions; escalate anything over $10k.",
    hardLimits: ["No legal commitments without review", "Budget cap $10k", "No new hires without approval"],
    riskTolerance: "Low; when in doubt, escalate.",
  },
  dynamicContext: {},
};

const meetingContext: MeetingContext = {
  meetingId: "test-meet-1",
  transcriptChunk:
    "Sarah: Can we ship the dashboard by end of week? Alex, is that realistic given your current load?",
};

async function main() {
  const claude = createClaudeClient();
  console.log("Running one decision cycle (Haiku)...\n");
  const decision = await runDecisionCycle(meetingContext, {
    profile,
    claude,
    minConfidenceToSpeak: 0.5,
  });
  console.log("Decision:", JSON.stringify(decision, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
