# Connecting to the you-model / agent layer

How to run the decision engine and where it fits in the pipeline.

---

## Running tests

From the project root:

```bash
npm install
npm run test
```

Or a single run (CI-style):

```bash
npm run test:run
```

Tests use a **mock Claude client**; no API key is required. They verify:

- **you-model**: Prompt assembly (all three layers, order, omission of empty Layer 2).
- **agent**: Judgment → no speak path (1 call), full cycle (3 calls), confidence threshold, JSON parsing and clamping.

---

## Where the agent sits in the pipeline

```
Recall.ai → transcript chunks (e.g. every 5s)
    → runDecisionCycle(meetingContext, { profile, claude })
    → AgentDecision { spoke, response?, confidence?, judgmentReason }
    → if spoke: post response to meeting chat (Recall / Meet API)
    → store decision for debrief (what Relay said, confidence, what needed user)
```

So the **caller** of the agent is whatever consumes the live transcript (e.g. your Recall webhook or a polling loop). It does **not** call the API itself; you inject a Claude client.

---

## Claude setup (Haiku for cost)

`lib/claude.ts` is implemented and uses **Claude Haiku** (`claude-haiku-4-5`) by default to keep the three-call cycle cheap.

### 1. Get an API key

1. Go to [console.anthropic.com](https://console.anthropic.com/).
2. Create an account or sign in.
3. Open **API keys** and create a key.
4. Copy the key (starts with `sk-ant-`).

### 2. Set the key locally

From the project root:

```bash
# Unix / Git Bash
cp .env.example .env

# PowerShell
Copy-Item .env.example .env
```

Edit `.env` and set:

```
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

Never commit `.env` (it's in `.gitignore`).

### 3. Install and run a live test

```bash
npm install
npx tsx scripts/test-agent.ts
```

Or: `npm run test:agent`

That runs one full decision cycle (Judgment → Generation → Confidence) with a hardcoded profile and transcript. You should see the `AgentDecision` logged.

### 4. Use in your app

```ts
import { runDecisionCycle } from "@/lib/agent";
import { createClaudeClient } from "@/lib/claude";

const claude = createClaudeClient(); // uses ANTHROPIC_API_KEY, Haiku

const decision = await runDecisionCycle(meetingContext, {
  profile,
  claude,
  minConfidenceToSpeak: 0.6,
});
```

To override the model (e.g. Sonnet for production):  
`createClaudeClient({ model: "claude-sonnet-4-20250514" })`.

---

## Wiring a real Claude client (reference)

The agent expects a `ClaudeClient` with a single method:

```ts
interface ClaudeClient {
  complete(messages: ClaudeMessage[], systemPrompt?: string): Promise<string>;
}
```

Example adapter using the Anthropic SDK (you’ll add `@anthropic-ai/sdk` and `lib/claude.ts` — already implemented):

```ts
// lib/claude.ts (you add this)
import Anthropic from "@anthropic-ai/sdk";
import type { ClaudeClient, ClaudeMessage } from "./agent";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const claudeClient: ClaudeClient = {
  async complete(messages, systemPrompt) {
    const system = systemPrompt ?? "";
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system,
      messages: messages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    });
    const text = response.content
      .filter((b): b is { type: "text"; text: string } => b.type === "text")
      .map((b) => b.text)
      .join("");
    return text;
  },
};
```

Then in your API route or Recall handler:

```ts
import { runDecisionCycle } from "@/lib/agent";
import { claudeClient } from "@/lib/claude";

// Fetch profile from Supabase (you-model for this user + meeting)
const profile: YouModel = await getYouModelForMeeting(userId, meetingId);
const meetingContext: MeetingContext = {
  meetingId,
  transcriptChunk: chunkFromWhisper,
  recentRelayMessages: await getRecentRelayMessages(meetingId),
};

const decision = await runDecisionCycle(meetingContext, {
  profile,
  claude: claudeClient,
  minConfidenceToSpeak: 0.6,
});

if (decision.spoke && decision.response) {
  await postToMeetingChat(meetingId, decision.response);
}
await saveDecisionForDebrief(meetingId, decision);
```

---

## Testing with a real API key (optional)

To run one cycle against Claude (e.g. from a small script or API route):

1. Implement `lib/claude.ts` as above and set `ANTHROPIC_API_KEY`.
2. Load a `YouModel` (e.g. hardcode a minimal profile or load from DB).
3. Call `runDecisionCycle(meetingContext, { profile, claude: claudeClient })` and log `decision`.

No UI or onboarding is required for this; the engine only needs a profile object and a transcript chunk.
