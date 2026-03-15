import { NextResponse } from "next/server"
import { getRecallProviderReadiness } from "@/lib/services/recall"

/**
 * Dev-only diagnostic: which Recall env vars the server sees (presence only, no values).
 * Use for debugging NOT_CONFIGURED when .env.local is set but Meeting page still shows not configured.
 */

const RECALL_EXPECTED_KEYS = ["RECALL_API_KEY", "RECALL_API_BASE_URL", "RECALL_WEBHOOK_SECRET"] as const

function isDevOnly() {
  return process.env.NODE_ENV !== "production"
}

function envPresent(key: string): boolean {
  const value = process.env[key]
  return typeof value === "string" && value.trim().length > 0
}

function getProjectRoot(): string {
  const path = require("path") as typeof import("path")
  const fs = require("fs") as typeof import("fs")
  if (typeof __dirname !== "undefined") {
    let dir = __dirname
    while (dir !== path.dirname(dir)) {
      if (
        fs.existsSync(path.join(dir, "next.config.js")) ||
        fs.existsSync(path.join(dir, "next.config.mjs"))
      ) {
        return dir
      }
      dir = path.dirname(dir)
    }
  }
  try {
    const nextPkg = require.resolve("next/package.json")
    return path.dirname(path.dirname(path.dirname(nextPkg)))
  } catch {
    return process.env.RELAY_PROJECT_ROOT || process.cwd()
  }
}

export async function GET() {
  if (!isDevOnly()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  try {
    // Ensure .env.local is loaded with override (dev only). Next.js may skip loading when dotenv is
    // in deps, or may have pre-populated empty RECALL_* so @next/env won't override; dotenv override fixes both.
    let loadedEnvFiles: { path: string }[] = []
    let envLocalHasRecallKeys = false
    let envLocalLineCount = 0
    const path = require("path") as typeof import("path")
    const envLocalPath =
      process.env.RELAY_ENV_LOCAL_PATH ||
      path.join(getProjectRoot(), ".env.local")
    if (!process.env.RECALL_API_KEY || !process.env.RECALL_WEBHOOK_SECRET) {
      try {
        const fs = require("fs")
        const dotenv = require("dotenv")
        const raw = fs.readFileSync(envLocalPath, "utf8")
        envLocalHasRecallKeys = raw.includes("RECALL_")
        envLocalLineCount = raw.split(/\r?\n/).filter((l) => l.trim().length > 0).length
        const result = dotenv.config({ path: envLocalPath, override: true })
        if (result?.parsed) loadedEnvFiles = [{ path: ".env.local" }]
      } catch {
        // ignore
      }
    }

    // Per-key: what the server actually sees (no secret values)
  const recallEnvDiagnostics = Object.fromEntries(
    RECALL_EXPECTED_KEYS.map((key) => {
      const value = process.env[key]
      const isString = typeof value === "string"
      const nonEmptyAfterTrim = isString && value.trim().length > 0
      return [
        key,
        {
          present: isString,
          nonEmptyAfterTrim,
          length: isString ? value.trim().length : 0,
        },
      ]
    })
  )

  const recallPresence = {
    RECALL_API_KEY: envPresent("RECALL_API_KEY"),
    RECALL_API_BASE_URL: envPresent("RECALL_API_BASE_URL"),
    RECALL_WEBHOOK_SECRET: envPresent("RECALL_WEBHOOK_SECRET"),
  }

  const providerReadiness = getRecallProviderReadiness()

  return NextResponse.json({
    expectedRecallKeys: RECALL_EXPECTED_KEYS,
    recallEnvDiagnostics,
    recallPresence,
    recallReadiness: {
      configState: providerReadiness.configState,
      missingEnv: providerReadiness.missingEnv,
      webhookConfigured: providerReadiness.webhookConfigured,
      whichCheckFailed:
        providerReadiness.missingEnv.length > 0
          ? "missingEnv"
          : !providerReadiness.webhookConfigured
            ? "webhookSecret"
            : "none",
    },
    serverContext: {
      cwd: process.cwd(),
      nodeEnv: process.env.NODE_ENV,
      loadedEnvFiles,
      envLocalHasRecallKeys,
      envLocalLineCount,
      envLocalPath,
    },
    note: "Presence only; secrets are never exposed. Restart dev server after changing .env.local.",
    ...(envLocalLineCount > 0 && !envLocalHasRecallKeys
      ? {
          hint: "Server's .env.local on disk has no RECALL_* lines (only " + envLocalLineCount + " non-empty lines). Add RECALL_API_KEY, RECALL_API_BASE_URL, RECALL_WEBHOOK_SECRET and save the file, then restart dev server.",
        }
      : {}),
  })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const stack = err instanceof Error ? err.stack : undefined
    return NextResponse.json(
      { error: "Diagnostics failed", message, stack },
      { status: 200 }
    )
  }
}
