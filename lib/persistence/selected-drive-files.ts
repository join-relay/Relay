import "server-only"

import type { SelectedDriveFile } from "@/lib/services/drive"
import { getStore, setStore } from "./store-backend"

type Stored = Record<string, { files: SelectedDriveFile[]; updatedAt: string }>

async function readStore(): Promise<Stored> {
  try {
    const data = await getStore("selected-drive-files")
    return typeof data === "object" && data !== null ? (data as Stored) : {}
  } catch (error) {
    console.error("Failed to read selected drive files store:", error)
    return {}
  }
}

async function writeStore(data: Stored) {
  await setStore("selected-drive-files", data)
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
