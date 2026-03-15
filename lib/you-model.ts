/**
 * Relay — You-Model prompt construction
 * Assembles the three-layer system prompt from a YouModel profile.
 * Layer 1 → Layer 2 → Layer 3 (meeting-specific overrides everything).
 */

import type { YouModel } from "../types";

const SECTION_HEADER = (title: string) => `\n---\n${title}\n---\n`;

/**
 * Builds the full you-model system prompt from a user profile.
 * Used as the system prompt for all three agent calls (judgment, generation, confidence).
 */
export function buildYouModelPrompt(profile: YouModel): string {
  const parts: string[] = [];

  parts.push(
    `You are acting as a digital double for ${profile.userName}.`,
    "Your job is to represent them in this meeting: speak in their voice, make decisions within their stated boundaries, and escalate when something falls outside those boundaries."
  );

  // Layer 1: Static identity (onboarding)
  parts.push(SECTION_HEADER("LAYER 1 — STATIC IDENTITY (always in effect)"));
  parts.push(buildLayer1(profile.staticIdentity));

  // Layer 2: Dynamic context (integrations)
  if (hasDynamicContext(profile.dynamicContext)) {
    parts.push(SECTION_HEADER("LAYER 2 — DYNAMIC CONTEXT (current moment)"));
    parts.push(buildLayer2(profile.dynamicContext));
  }

  // Layer 3: Meeting-specific (prep; overrides Layer 1 & 2 for this meeting)
  if (profile.meetingSpecific) {
    parts.push(
      SECTION_HEADER("LAYER 3 — MEETING-SPECIFIC INSTRUCTIONS (overrides above for this meeting)")
    );
    parts.push(buildLayer3(profile.meetingSpecific));
  }

  return parts.join("\n\n").trim();
}

function buildLayer1(identity: YouModel["staticIdentity"]): string {
  const lines: string[] = [
    `COMMUNICATION STYLE:\n${identity.communicationStyle}`,
    `DECISION OWNERSHIP:\n${identity.decisionOwnership}`,
    `HARD LIMITS (do not cross; escalate instead):\n${identity.hardLimits.map((l) => `- ${l}`).join("\n")}`,
    `RISK TOLERANCE:\n${identity.riskTolerance}`,
  ];
  return lines.join("\n\n");
}

function buildLayer2(context: NonNullable<YouModel["dynamicContext"]>): string {
  const lines: string[] = [];
  if (context.currentProjects?.length) {
    lines.push(
      "CURRENT PROJECTS:",
      context.currentProjects.map((p) => `- ${p}`).join("\n")
    );
  }
  if (context.recentDecisions?.length) {
    lines.push(
      "RECENT DECISIONS (relevant to this moment):",
      context.recentDecisions.map((d) => `- ${d}`).join("\n")
    );
  }
  if (context.calendarPressure?.trim()) {
    lines.push("CALENDAR / CONTEXTUAL PRESSURE:", context.calendarPressure);
  }
  return lines.join("\n\n");
}

function buildLayer3(instructions: NonNullable<YouModel["meetingSpecific"]>): string {
  const lines: string[] = [
    "GOALS FOR THIS MEETING:",
    instructions.goals.map((g) => `- ${g}`).join("\n"),
    "PUSH BACK ON:",
    instructions.pushBackOn.map((p) => `- ${p}`).join("\n"),
    "THRESHOLDS (escalate or stay silent if crossed):",
    instructions.thresholds.map((t) => `- ${t}`).join("\n"),
  ];
  if (instructions.notes?.trim()) {
    lines.push("ADDITIONAL NOTES:", instructions.notes);
  }
  return lines.join("\n\n");
}

function hasDynamicContext(
  ctx: YouModel["dynamicContext"]
): ctx is YouModel["dynamicContext"] & {
  currentProjects?: string[];
  recentDecisions?: string[];
  calendarPressure?: string;
} {
  if (!ctx) return false;
  const hasProjects = ctx.currentProjects?.length;
  const hasDecisions = ctx.recentDecisions?.length;
  const hasPressure = ctx.calendarPressure?.trim();
  return !!(hasProjects || hasDecisions || hasPressure);
}
