import { NextRequest, NextResponse } from "next/server";
import { loadWellbeingCheckIns, appendWellbeingCheckIn, getWorkLifeContext } from "@/lib/store";
import type { WellbeingCheckIn } from "@/types/context";

export async function GET() {
  const checkIns = loadWellbeingCheckIns();
  return NextResponse.json({ checkIns: checkIns.slice(-20) });
}

export async function POST(request: NextRequest) {
  let body: { energyScore?: number; overwhelmScore?: number; note?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const context = getWorkLifeContext();
  const contextSnapshot = context
    ? {
        meetingCount: context.calendar.todayCount,
        unreadCount: context.email.unreadCount,
        activeDocsCount: context.docs.activeCount,
      }
    : undefined;
  const checkIn: WellbeingCheckIn = {
    id: `checkin-${Date.now()}`,
    timestamp: new Date().toISOString(),
    energyScore: body.energyScore,
    overwhelmScore: body.overwhelmScore,
    note: body.note,
    contextSnapshot,
  };
  appendWellbeingCheckIn(checkIn);
  return NextResponse.json({ ok: true, checkIn });
}
