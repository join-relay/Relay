import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const TOKENS_FILE = path.join(process.cwd(), "data", "tokens.json");

export async function POST() {
  if (fs.existsSync(TOKENS_FILE)) {
    fs.unlinkSync(TOKENS_FILE);
  }
  return NextResponse.json({ ok: true });
}
