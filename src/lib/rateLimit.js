// Fixed-window, in-memory rate limiter.
// Good enough for a single server instance. On serverless / multi-instance
// deployments each instance keeps its own counters, so swap this for a shared
// store (e.g. Upstash Redis) if you need strict global limits.

const buckets = global._pgbookRateLimit ?? new Map()
global._pgbookRateLimit = buckets

export function rateLimit(key, { limit, windowMs }) {
  const now = Date.now()
  const bucket = buckets.get(key)
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    if (buckets.size > 10000) prune(now)
    return { ok: true }
  }
  bucket.count += 1
  if (bucket.count > limit) {
    return { ok: false, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) }
  }
  return { ok: true }
}

function prune(now) {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key)
  }
}

export function clientIp(request) {
  const forwarded = request.headers.get('x-forwarded-for')
  return forwarded?.split(',')[0].trim() || request.headers.get('x-real-ip') || 'unknown'
}
