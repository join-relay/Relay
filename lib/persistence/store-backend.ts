import "server-only"

import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

const STORE_DIR = path.join(process.cwd(), ".relay")
const KV_PREFIX = "relay:"

function isKvConfigured(): boolean {
  const url = process.env.KV_REST_API_URL ?? process.env.KV_URL
  const token = process.env.KV_REST_API_TOKEN
  return Boolean(typeof url === "string" && url.trim() && typeof token === "string" && token.trim())
}

/**
 * Get store data by name. On Vercel (when KV_* env is set) uses Vercel KV; otherwise uses .relay/<name>.json.
 */
export async function getStore(name: string): Promise<unknown> {
  if (isKvConfigured()) {
    try {
      const { kv } = await import("@vercel/kv")
      const key = `${KV_PREFIX}${name}`
      const value = await kv.get(key)
      return value ?? null
    } catch (err) {
      console.error("[store-backend] KV get failed:", err)
      return null
    }
  }
  try {
    const filePath = path.join(STORE_DIR, `${name}.json`)
    const raw = await readFile(filePath, "utf8")
    return JSON.parse(raw)
  } catch (error) {
    const isMissing =
      error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT"
    if (isMissing) return null
    console.error("[store-backend] File read failed:", error)
    return null
  }
}

/**
 * Set store data by name. On Vercel uses KV; otherwise writes to .relay/<name>.json.
 */
export async function setStore(name: string, value: unknown): Promise<void> {
  if (isKvConfigured()) {
    try {
      const { kv } = await import("@vercel/kv")
      const key = `${KV_PREFIX}${name}`
      await kv.set(key, value)
    } catch (err) {
      console.error("[store-backend] KV set failed:", err)
      throw err
    }
    return
  }
  await mkdir(STORE_DIR, { recursive: true })
  const filePath = path.join(STORE_DIR, `${name}.json`)
  await writeFile(filePath, JSON.stringify(value, null, 2), "utf8")
}
