import { getMockBriefing } from "@/lib/mocks/briefing"
import type { Briefing } from "@/types"

export async function getBriefing(): Promise<Briefing> {
  return getMockBriefing()
}
