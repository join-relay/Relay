# Relay — Connecting frontend, context, and meeting output

## 1. What runs where (test vs API)

| What you run | Uses real Claude? | Purpose |
|--------------|-------------------|---------|
| **`npm run test:run`** (or `npm test`) | No — mock only | Unit tests: you-model assembly, agent logic, parsing. No API key needed. |
| **`npm run test:agent`** (or `npx tsx scripts/test-agent.ts`) | **Yes — real Haiku** | One live decision cycle with a hardcoded profile. Uses your `ANTHROPIC_API_KEY`. |

So when your test “works,” that’s the **real** Claude API (Haiku). The script makes 1–3 real calls per run depending on whether the judgment says “speak” or not.

---

## 2. How context gets in (no JSON file required)

Context = the **YouModel** object. It’s just a JS/TS object; it can come from your DB + prep form, not from a standalone JSON file.

| Layer | Where it comes from | When it’s set |
|-------|---------------------|----------------|
| **Layer 1** (static identity) | Onboarding in your frontend | Once per user (then stored in DB). |
| **Layer 2** (dynamic) | Integrations (Calendar, Drive, etc.) or empty | When you have it; can be empty at first. |
| **Layer 3** (meeting-specific) | Meeting prep in your frontend | Per meeting, before Relay joins. |

**Flow:**

1. **Onboarding** (your existing frontend): user answers questions → you save **Layer 1** (+ `userName`) to your DB (e.g. Supabase `user_profiles` or `you_model` table).
2. **Meeting prep** (your frontend): user sets goals, push-back points, thresholds for this meeting → you save **Layer 3** per meeting (e.g. `meeting_prep` table keyed by `meetingId` / `userId`).
3. **When the agent runs** (e.g. Recall webhook or your API): you **load** Layer 1 for the user, optional Layer 2, and Layer 3 for this meeting → build one **YouModel** object → pass it into `runDecisionCycle(meetingContext, { profile: youModel, claude })`.

So “giving context” = **building that YouModel from your DB + prep** and passing it in. No separate JSON file is required; your API can assemble the object from rows.

**Minimal YouModel shape (for your API/DB):**

```ts
interface YouModel {
  userName: string;
  staticIdentity: {
    communicationStyle: string;
    decisionOwnership: string;
    hardLimits: string[];
    riskTolerance: string;
  };
  dynamicContext: Partial<{
    currentProjects: string[];
    recentDecisions: string[];
    calendarPressure: string;
  }>;
  meetingSpecific?: {
    goals: string[];
    pushBackOn: string[];
    thresholds: string[];
    notes?: string;
  };
}
```

---

## 3. Plugging into your frontend (onboarding + prep)

You already have a frontend; you need **onboarding** and **meeting prep** to feed the engine.

### Option A — API routes that you call from the frontend

- **POST `/api/you-model` or `/api/onboarding`**  
  Body: `{ userName, communicationStyle, decisionOwnership, hardLimits, riskTolerance }` (and any other Layer 1 fields).  
  Your handler saves that to Supabase (e.g. one row per user).  
  Frontend: onboarding form submits here when the user finishes.

- **POST `/api/meeting/prep`** (or `PUT /api/meeting/[id]/prep`)  
  Body: `{ meetingId, goals, pushBackOn, thresholds, notes? }`.  
  Your handler saves Layer 3 for that meeting.  
  Frontend: prep form submits here before the meeting.

- **POST `/api/double`** (or whatever your “run the agent” endpoint is)  
  Body: `{ meetingId, transcriptChunk, recentRelayMessages? }`.  
  Your handler:  
  1. Loads user’s Layer 1 (and optional Layer 2) from DB.  
  2. Loads Layer 3 for this meeting from DB.  
  3. Builds `YouModel` + `MeetingContext`.  
  4. Calls `runDecisionCycle(meetingContext, { profile, claude })`.  
  5. Returns `AgentDecision` (and/or posts to meeting chat — see below).

Your frontend doesn’t call `/api/double` directly for real-time meeting flow; that’s for the pipeline (e.g. Recall webhook) that receives transcript chunks. The frontend only needs to talk to onboarding and prep endpoints.

### Option B — Frontend writes to Supabase directly

Same idea, but the onboarding and prep forms write to Supabase from the client. The “double” API still runs on the server (it needs the API key and must call Claude). So:

- Onboarding form → Supabase (e.g. `user_profiles`).
- Prep form → Supabase (e.g. `meeting_prep`).
- When the pipeline runs the agent, it reads from Supabase and builds `YouModel` on the server.

Either way, the **only** place that must run on the server with the API key is the code that calls `runDecisionCycle`.

---

## 4. Outputs: what to send back into the meeting

The agent returns an **AgentDecision**:

```ts
{
  spoke: boolean;           // true if we're allowed to post (confidence >= threshold)
  response?: string;        // THE MESSAGE TO POST TO MEETING CHAT (only if spoke)
  confidence?: { score: number; reasoning: string };
  judgmentReason: string;
}
```

**What actually goes into the meeting video/chat:**

- **The only thing you “output” into the meeting** is the **text** in `decision.response`.
- When `decision.spoke === true` and `decision.response` is set, your pipeline should **post `decision.response`** to the meeting (e.g. via Recall.ai’s “send chat message” or the Google Meet API your stack uses).
- You do **not** post `judgmentReason` or `confidence` into the meeting; those are for your **debrief** (and logging).

So the flow is:

1. Pipeline gets a transcript chunk (e.g. from Recall).
2. Pipeline calls your double API (or `runDecisionCycle` directly) with `meetingContext` and the assembled `YouModel`.
3. You get back `AgentDecision`.
4. If `decision.spoke && decision.response`:  
   → **Post `decision.response`** to the meeting chat.  
5. Store the full `decision` (including `response`, `confidence`, `judgmentReason`) for the debrief UI.

**Summary:**  
- **Input to the meeting** = one string: `decision.response`.  
- **Input to your debrief** = the full `AgentDecision` object (so you can show “what Relay said,” confidence, and “what needed you”).
