import "server-only"

import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import type { SelectedDriveFile } from "@/lib/services/drive"

const STORE_DIR = path.join(process.cwd(), ".relay")
const STORE_FILE = path.join(STORE_DIR, "selected-drive-files.json")

type Stored = Record<string, { files: SelectedDriveFile[]; updatedAt: string }>

async function readStore(): Promise<Stored> {
  try {
    const raw = await readFile(STORE_FILE, "utf8")
    const data = JSON.parse(raw)
    return typeof data === "object" && data !== null ? data : {}
  } catch (error) {
    const isMissing =
      error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT"
    if (isMissing) return {}
    console.error("Failed to read selected drive files store:", error)
    return {}
  }
}

async function writeStore(data: Stored) {
  await mkdir(STORE_DIR, { recursive: true })
  await writeFile(STORE_FILE, JSON.stringify(data, null, 2), "utf8")
}

export async function setSelectedDriveFiles(
  userEmail: string,
  files: SelectedDriveFile[]
): Promise<void> {
  const store = await readStore()
  store[userEmail] = { files, updatedAt: new Date().toISOString() }
  await writeStore(store)
}

export async function getSelectedDriveFiles(userEmail: string): Promise<SelectedDriveFile[]> {
  const store = await readStore()
  const entry = store[userEmail]
  return entry?.files ?? []
}
