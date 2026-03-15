import { BriefingPageContent } from "@/components/briefing/BriefingPageContent"
import { getBriefing } from "@/lib/services/briefing"

export const dynamic = "force-dynamic"

export default async function BriefingPage() {
  const data = await getBriefing()
  return <BriefingPageContent initialData={data} />
}
