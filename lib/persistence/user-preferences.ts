import "server-only"

import type {
  ConcisenessPreference,
  FormalityPreference,
  MeetingUpdateStyle,
  RelayCustomizationSettings,
  TonePreference,
} from "@/types"

import { getStore, setStore } from "./store-backend"

type PreferenceRecord = Record<string, RelayCustomizationSettings>

const TONE_VALUES: TonePreference[] = ["warm", "professional", "direct", "friendly"]
const FORMALITY_VALUES: FormalityPreference[] = ["formal", "balanced", "casual"]
const CONCISENESS_VALUES: ConcisenessPreference[] = ["brief", "balanced", "detailed"]
const MEETING_STYLE_VALUES: MeetingUpdateStyle[] = [
  "crisp_status",
  "warm_summary",
  "action_focused",
]

export function getDefaultRelayCustomizationSettings(): RelayCustomizationSettings {
  return {
    emailTone: "professional",
    emailFormality: "balanced",
    emailConciseness: "brief",
    useSignature: true,
    emailSignatureOverride: "",
    includeGreeting: true,
    includeSignOff: true,
    enableBrowserNotifications: true,
    enableNotificationSound: true,
    meetingTone: "professional",
    meetingFormality: "balanced",
    meetingConciseness: "brief",
    meetingUpdateStyle: "action_focused",
  }
}

function normalizeEmail(email?: string | null) {
  return email?.trim().toLowerCase() ?? null
}

function isTonePreference(value: unknown): value is TonePreference {
  return TONE_VALUES.includes(value as TonePreference)
}

function isFormalityPreference(value: unknown): value is FormalityPreference {
  return FORMALITY_VALUES.includes(value as FormalityPreference)
}

function isConcisenessPreference(value: unknown): value is ConcisenessPreference {
  return CONCISENESS_VALUES.includes(value as ConcisenessPreference)
}

function isMeetingUpdateStyle(value: unknown): value is MeetingUpdateStyle {
  return MEETING_STYLE_VALUES.includes(value as MeetingUpdateStyle)
}

function normalizeSettings(value: unknown): RelayCustomizationSettings {
  const defaults = getDefaultRelayCustomizationSettings()
  const input = value && typeof value === "object" ? (value as Partial<RelayCustomizationSettings>) : {}

  return {
    emailTone: isTonePreference(input.emailTone) ? input.emailTone : defaults.emailTone,
    emailFormality: isFormalityPreference(input.emailFormality)
      ? input.emailFormality
      : defaults.emailFormality,
    emailConciseness: isConcisenessPreference(input.emailConciseness)
      ? input.emailConciseness
      : defaults.emailConciseness,
    useSignature: typeof input.useSignature === "boolean" ? input.useSignature : defaults.useSignature,
    emailSignatureOverride:
      typeof input.emailSignatureOverride === "string"
        ? input.emailSignatureOverride.trim()
        : defaults.emailSignatureOverride,
    includeGreeting:
      typeof input.includeGreeting === "boolean" ? input.includeGreeting : defaults.includeGreeting,
    includeSignOff:
      typeof input.includeSignOff === "boolean" ? input.includeSignOff : defaults.includeSignOff,
    enableBrowserNotifications:
      typeof input.enableBrowserNotifications === "boolean"
        ? input.enableBrowserNotifications
        : defaults.enableBrowserNotifications,
    enableNotificationSound:
      typeof input.enableNotificationSound === "boolean"
        ? input.enableNotificationSound
        : defaults.enableNotificationSound,
    meetingTone: isTonePreference(input.meetingTone) ? input.meetingTone : defaults.meetingTone,
    meetingFormality: isFormalityPreference(input.meetingFormality)
      ? input.meetingFormality
      : defaults.meetingFormality,
    meetingConciseness: isConcisenessPreference(input.meetingConciseness)
      ? input.meetingConciseness
      : defaults.meetingConciseness,
    meetingUpdateStyle: isMeetingUpdateStyle(input.meetingUpdateStyle)
      ? input.meetingUpdateStyle
      : defaults.meetingUpdateStyle,
  }
}

async function readStore(): Promise<PreferenceRecord> {
  try {
    const parsed = (await getStore("user-preferences")) as Record<string, unknown> | null
    if (!parsed || typeof parsed !== "object") return {}
    return Object.fromEntries(
      Object.entries(parsed).map(([key, value]) => [key, normalizeSettings(value)])
    )
  } catch (error) {
    console.error("Failed to read user preferences store:", error)
    return {}
  }
}

async function writeStore(records: PreferenceRecord) {
  await setStore("user-preferences", records)
}

export async function getRelayCustomizationSettings(email?: string | null) {
  const key = normalizeEmail(email)
  if (!key) return getDefaultRelayCustomizationSettings()

  const store = await readStore()
  return store[key] ?? getDefaultRelayCustomizationSettings()
}

export async function saveRelayCustomizationSettings(
  email: string,
  settings: RelayCustomizationSettings
) {
  const key = normalizeEmail(email)
  if (!key) {
    throw new Error("An authenticated email is required to save preferences")
  }

  const store = await readStore()
  store[key] = normalizeSettings(settings)
  await writeStore(store)
  return store[key]
}
