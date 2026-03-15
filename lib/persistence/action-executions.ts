import "server-only"

import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import type { ActionExecutionRecord } from "@/types"

const STORE_DIR = path.join(process.cwd(), ".relay")
const STORE_FILE = path.join(STORE_DIR, "action-executions.json")

async function readAll(): Promise<ActionExecutionRecord[]> {
  try {
    const raw = await readFile(STORE_FILE, "utf8")
    const data = JSON.parse(raw)
    return Array.isArray(data) ? data : []
  } catch (error) {
    const isMissing =
      error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT"
    if (isMissing) return []
    console.error("Failed to read action executions store:", error)
    return []
  }
}

async function writeAll(records: ActionExecutionRecord[]) {
  await mkdir(STORE_DIR, { recursive: true })
  await writeFile(STORE_FILE, JSON.stringify(records, null, 2), "utf8")
}

export async function appendActionExecution(record: ActionExecutionRecord): Promise<void> {
  const list = await readAll()
  list.push(record)
  await writeAll(list)
}

export async function listActionExecutions(): Promise<ActionExecutionRecord[]> {
  const list = await readAll()
  return list.sort((a, b) => new Date(b.executedAt).getTime() - new Date(a.executedAt).getTime())
}
