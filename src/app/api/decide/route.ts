import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { loadYouModel } from "@/lib/you-model-store";
import { buildYouModelPrompt } from "../../../../lib/you-model";
import type { AgentDecision, JudgmentResult, ConfidenceScore, MeetingSpecificInstructions } from "../../../../types";

export const dynamic = "force-dynamic";

const client = new Anthropic();

export async function POST(req: Request) {
  try {
    const body = await req.json() as {
      transcriptChunk: string;
      meetingSpecific?: MeetingSpecificInstructions;
    };

    const { transcriptChunk, meetingSpecific } = body;

    if (!transcriptChunk?.trim()) {
      return NextResponse.json({ error: "transcriptChunk is required" }, { status: 400 });
    }

    const profile = loadYouModel();
    if (!profile) {
      return NextResponse.json(
        { error: "No you-model profile found. Complete onboarding first at /onboarding." },
        { status: 404 }
      );
    }

    // Merge meeting-specific instructions from request (overrides stored ones)
    const profileForSession = meetingSpecific
      ? { ...profile, meetingSpecific }
      : profile;

    const systemPrompt = buildYouModelPrompt(profileForSession);

    // ── Call 1: Judgment — should Relay speak? ────────────────────────────────
    const judgmentMsg = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 200,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `Here is a transcript chunk from the current meeting. Should you (as ${profile.userName}'s digital double) speak right now?\n\nRespond ONLY with valid JSON — no markdown, no explanation:\n{"shouldSpeak": boolean, "reason": string}\n\nTranscript:\n${transcriptChunk}`,
        },
      ],
    });

    let judgment: JudgmentResult;
    try {
      const raw = judgmentMsg.content[0].type === "text" ? judgmentMsg.content[0].text.trim() : "";
      judgment = JSON.parse(raw) as JudgmentResult;
    } catch {
      return NextResponse.json({ error: "Judgment call returned unparseable JSON" }, { status: 502 });
    }

    if (!judgment.shouldSpeak) {
      const decision: AgentDecision = { spoke: false, judgmentReason: judgment.reason };
      return NextResponse.json({ decision });
    }

    // ── Call 2: Generation — draft the response ───────────────────────────────
    const generationMsg = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 400,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `Draft what you would say right now in ${profile.userName}'s voice. Be concise and direct. Output ONLY the response text — no preamble, no quotes, no meta-commentary.\n\nTranscript:\n${transcriptChunk}`,
        },
      ],
    });

    const response =
      generationMsg.content[0].type === "text" ? generationMsg.content[0].text.trim() : "";

    // ── Call 3: Confidence — score the response ───────────────────────────────
    const confidenceMsg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 150,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `Rate your confidence in this response (0–1). Consider: does it match the user's voice and respect their hard limits?\n\nRespond ONLY with valid JSON — no markdown:\n{"score": number, "reasoning": string}\n\nTranscript:\n${transcriptChunk}\n\nProposed response:\n${response}`,
        },
      ],
    });

    let confidence: ConfidenceScore;
    try {
      const raw =
        confidenceMsg.content[0].type === "text" ? confidenceMsg.content[0].text.trim() : "";
      confidence = JSON.parse(raw) as ConfidenceScore;
    } catch {
      confidence = { score: 0.5, reasoning: "Could not parse confidence score" };
    }

    const decision: AgentDecision = {
      spoke: true,
      response,
      confidence,
      judgmentReason: judgment.reason,
    };

    return NextResponse.json({ decision });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
