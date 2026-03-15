import { NextRequest, NextResponse } from "next/server"
import { getOptionalSession } from "@/auth"
import type { SelectedDriveFile } from "@/lib/services/drive"
import { getSelectedDriveFiles, setSelectedDriveFiles } from "@/lib/persistence/selected-drive-files"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const session = await getOptionalSession()
    const email = session?.user?.email
    if (!email) {
      return NextResponse.json({ files: [] })
    }
    const files = await getSelectedDriveFiles(email)
    return NextResponse.json({ files })
  } catch (error) {
    console.error("Drive selected GET error:", error)
    return NextResponse.json(
      { error: "Failed to load selected Drive files" },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getOptionalSession()
    const email = session?.user?.email
    if (!email) {
      return NextResponse.json({ error: "Sign in to save Drive selection" }, { status: 401 })
    }
    const body = await req.json().catch(() => ({}))
    const files = Array.isArray(body.files) ? body.files : []
    const normalized: SelectedDriveFile[] = files
      .filter((f: unknown) => f && typeof f === "object" && "id" in f && "name" in f)
      .map((f: { id: string; name: string; mimeType?: string; webViewLink?: string }) => ({
        id: String(f.id),
        name: String(f.name),
        mimeType: f.mimeType != null ? String(f.mimeType) : undefined,
        webViewLink: f.webViewLink != null ? String(f.webViewLink) : undefined,
      }))
    await setSelectedDriveFiles(email, normalized)
    return NextResponse.json({ files: normalized })
  } catch (error) {
    console.error("Drive selected POST error:", error)
    return NextResponse.json(
      { error: "Failed to save selected Drive files" },
      { status: 500 }
    )
  }
}
