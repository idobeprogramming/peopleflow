/**
 * Fixed-window counter of failed attempts, kept in memory. Enough for one API instance;
 * several instances would share it through a store such as Redis or Postgres.
 */
export interface RateLimiterOptions {
  limit: number
  windowMs: number
  now?: () => number
}

export function createRateLimiter({ limit, windowMs, now = Date.now }: RateLimiterOptions) {
  const failures = new Map<string, { count: number; resetAt: number }>()

  function current(key: string) {
    const entry = failures.get(key)
    if (entry && entry.resetAt <= now()) {
      failures.delete(key)
      return undefined
    }
    return entry
  }

  return {
    /** Seconds until the key may try again, or 0 when it is allowed. */
    retryAfter(key: string) {
      const entry = current(key)
      return entry && entry.count >= limit ? Math.ceil((entry.resetAt - now()) / 1000) : 0
    },
    fail(key: string) {
      const entry = current(key) ?? { count: 0, resetAt: now() + windowMs }
      entry.count += 1
      failures.set(key, entry)
      if (failures.size > 10_000) for (const stale of failures.keys()) current(stale)
    },
    reset(key: string) {
      failures.delete(key)
    },
  }
}

export type RateLimiter = ReturnType<typeof createRateLimiter>
