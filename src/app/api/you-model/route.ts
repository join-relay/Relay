import { NextResponse } from "next/server";
import { loadYouModel, saveYouModel } from "@/lib/you-model-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const model = loadYouModel();
  if (!model) return NextResponse.json({ model: null }, { status: 404 });
  return NextResponse.json({ model });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    saveYouModel(body);
    return NextResponse.json({ ok: true, model: body });
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
}
