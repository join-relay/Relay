import { describe, it, expect } from "vitest";
import { buildYouModelPrompt } from "../lib/you-model";
import type { YouModel } from "../types";

const minimalProfile: YouModel = {
  userName: "Alex",
  staticIdentity: {
    communicationStyle: "Brief and direct.",
    decisionOwnership: "I own product decisions; escalate budget.",
    hardLimits: ["No legal commitments", "Budget cap $10k"],
    riskTolerance: "Low; prefer to escalate when unsure.",
  },
  dynamicContext: {},
};

describe("buildYouModelPrompt", () => {
  it("includes Layer 1 (static identity) with user name and all fields", () => {
    const prompt = buildYouModelPrompt(minimalProfile);
    expect(prompt).toContain("digital double for Alex");
    expect(prompt).toContain("LAYER 1 — STATIC IDENTITY");
    expect(prompt).toContain("Brief and direct.");
    expect(prompt).toContain("I own product decisions");
    expect(prompt).toContain("No legal commitments");
    expect(prompt).toContain("Budget cap $10k");
    expect(prompt).toContain("Low; prefer to escalate");
  });

  it("omits Layer 2 when dynamic context is empty", () => {
    const prompt = buildYouModelPrompt(minimalProfile);
    expect(prompt).not.toContain("LAYER 2");
  });

  it("includes Layer 2 when dynamic context has at least one field", () => {
    const withContext: YouModel = {
      ...minimalProfile,
      dynamicContext: {
        currentProjects: ["Project Alpha"],
        recentDecisions: [],
        calendarPressure: "",
      },
    };
    const prompt = buildYouModelPrompt(withContext);
    expect(prompt).toContain("LAYER 2 — DYNAMIC CONTEXT");
    expect(prompt).toContain("Project Alpha");
  });

  it("includes Layer 2 calendar pressure when set", () => {
    const withPressure: YouModel = {
      ...minimalProfile,
      dynamicContext: { calendarPressure: "Back-to-back until 3pm." },
    };
    const prompt = buildYouModelPrompt(withPressure);
    expect(prompt).toContain("LAYER 2");
    expect(prompt).toContain("Back-to-back until 3pm.");
  });

  it("includes Layer 3 when meeting-specific is provided and marks it as override", () => {
    const withMeeting: YouModel = {
      ...minimalProfile,
      meetingSpecific: {
        goals: ["Get timeline commitment"],
        pushBackOn: ["Scope creep"],
        thresholds: ["Anything over $5k"],
        notes: "VP is in the room.",
      },
    };
    const prompt = buildYouModelPrompt(withMeeting);
    expect(prompt).toContain("LAYER 3 — MEETING-SPECIFIC");
    expect(prompt).toContain("overrides above");
    expect(prompt).toContain("Get timeline commitment");
    expect(prompt).toContain("Scope creep");
    expect(prompt).toContain("Anything over $5k");
    expect(prompt).toContain("VP is in the room.");
  });

  it("assembles layers in order: 1, then 2 (if present), then 3 (if present)", () => {
    const full: YouModel = {
      ...minimalProfile,
      dynamicContext: { currentProjects: ["P1"] },
      meetingSpecific: {
        goals: ["G1"],
        pushBackOn: [],
        thresholds: [],
      },
    };
    const prompt = buildYouModelPrompt(full);
    const pos1 = prompt.indexOf("LAYER 1");
    const pos2 = prompt.indexOf("LAYER 2");
    const pos3 = prompt.indexOf("LAYER 3");
    expect(pos1).toBeLessThan(pos2);
    expect(pos2).toBeLessThan(pos3);
  });
});
