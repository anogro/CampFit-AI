// Per-visitor request limits for the public CampFit v3 API routes.
// Counts live in this server instance's memory, so on Vercel each instance keeps its own
// counts: this stops a single client looping on the AI/DB routes, not a distributed flood.

export interface CampfitRequestPolicy {
  readonly bucket: string
  readonly limit: number
  readonly windowMs: number
  readonly maxBodyBytes: number
}

const TEN_MINUTES = 10 * 60 * 1000

export const campfitRequestPolicies = {
  conversationStart: { bucket: "v3-start", limit: 30, windowMs: TEN_MINUTES, maxBodyBytes: 16_000 },
  conversationMessage: { bucket: "v3-message", limit: 60, windowMs: TEN_MINUTES, maxBodyBytes: 128_000 },
  recommend: { bucket: "v3-recommend", limit: 10, windowMs: TEN_MINUTES, maxBodyBytes: 128_000 },
  analytics: { bucket: "v3-analytics", limit: 300, windowMs: TEN_MINUTES, maxBodyBytes: 16_000 },
} as const satisfies Record<string, CampfitRequestPolicy>

interface CounterRecord {
  count: number
  resetAt: number
}

const counters = new Map<string, CounterRecord>()

export function resetCampfitRequestCounters(): void {
  counters.clear()
}

export function getClientAddress(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  return forwardedFor || request.headers.get("x-real-ip")?.trim() || "unknown"
}

/** Returns an error response when the request must be refused, otherwise null. */
export function guardCampfitRequest(
  request: Request,
  policy: CampfitRequestPolicy,
  now: number = Date.now(),
): Response | null {
  const declaredLength = Number(request.headers.get("content-length") ?? "0")
  if (Number.isFinite(declaredLength) && declaredLength > policy.maxBodyBytes) {
    return Response.json({ message: "요청이 너무 커요. 내용을 줄여서 다시 시도해 주세요." }, { status: 413 })
  }

  for (const [key, record] of counters) {
    if (record.resetAt <= now) counters.delete(key)
  }

  const key = `${policy.bucket}:${getClientAddress(request)}`
  const current = counters.get(key)
  if (!current) {
    counters.set(key, { count: 1, resetAt: now + policy.windowMs })
    return null
  }
  if (current.count >= policy.limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1000))
    return Response.json(
      { message: "요청이 너무 많아요. 잠시 후 다시 시도해 주세요." },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
    )
  }
  current.count += 1
  return null
}
