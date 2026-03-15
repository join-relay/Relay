/**
 * Preset demo scenarios for Relay Director (Phase 6).
 * Each scenario has cohesive seeded data for believable demos.
 */

export const SCENARIO_IDS = [
  "overwhelmed_morning",
  "inbox_rescue",
  "standup_handoff",
  "recovery_after_missed_followup",
] as const

export type ScenarioId = (typeof SCENARIO_IDS)[number]

export const SCENARIO_LABELS: Record<ScenarioId, string> = {
  overwhelmed_morning: "Overwhelmed Morning",
  inbox_rescue: "Inbox Rescue",
  standup_handoff: "Standup Handoff",
  recovery_after_missed_followup: "Recovery After Missed Follow-Up",
}
