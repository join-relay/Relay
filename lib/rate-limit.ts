/**
 * Simple in-memory rate limiter for API routes.
 * Uses a sliding window per key (e.g. user email or IP). For production at scale,
 * use Redis/KV; this is suitable for single-instance and moderate traffic.
 */

const windowMs = 60 * 1000 // 1 minute
const store = new Map<string, { count: number; resetAt: number }>()

function prune() {
  const now = Date.now()
  for (const [key, entry] of store.entries()) {
    if (entry.resetAt <= now) store.delete(key)
  }
}

export type RateLimitConfig = {
  /** Max requests per window (per key). */
  max: number
  /** Window in ms. Default 60000. */
  windowMs?: number
}

/**
 * Returns true if the request is allowed, false if rate limited.
 * Call this at the start of a route with a stable key (e.g. session.user.email or IP).
 */
export function checkRateLimit(key: string, config: RateLimitConfig): boolean {
  const now = Date.now()
  const window = config.windowMs ?? windowMs
  if (store.size > 5000) prune()

  let entry = store.get(key)
  if (!entry) {
    store.set(key, { count: 1, resetAt: now + window })
    return true
  }
  if (entry.resetAt <= now) {
    entry = { count: 1, resetAt: now + window }
    store.set(key, entry)
    return true
  }
  if (entry.count >= config.max) return false
  entry.count++
  return true
}

/** Response headers to send when rate limited (Retry-After, X-RateLimit-*). */
export function rateLimitHeaders(config: RateLimitConfig): Record<string, string> {
  return {
    "Retry-After": "60",
    "X-RateLimit-Limit": String(config.max),
    "X-RateLimit-Window": "60",
  }
}

/** Limits suitable for token-heavy routes. */
export const RATE_LIMITS = {
  /** Briefing: 30/min per user. */
  briefing: { max: 30, windowMs: 60_000 },
  /** Actions list: 40/min per user. */
  actionsList: { max: 40, windowMs: 60_000 },
  /** Draft generation (OpenAI): 10/min per user. */
  draftGeneration: { max: 10, windowMs: 60_000 },
  /** Generic API: 60/min per user. */
  api: { max: 60, windowMs: 60_000 },
} as const
