/**
 * Returns a short hint for LLM prompts so they convert local times to UTC correctly (avoids 1-hour DST issues).
 */
export function getTimezoneOffsetHint(tz: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en", {
      timeZone: tz,
      timeZoneName: "longOffset",
    }).formatToParts(new Date())
    const tzName = parts.find((p) => p.type === "timeZoneName")?.value ?? ""
    if (tzName.startsWith("GMT")) {
      return `${tz} is ${tzName}. Convert local time to UTC using this offset (e.g. 8 AM local = 14:00 UTC when offset is -6).`
    }
    return `User timezone: ${tz}. Interpret all times in this zone then convert to UTC for start/end.`
  } catch {
    return `User timezone: ${tz}. Interpret all times in this zone then convert to UTC for start/end.`
  }
}
