export const DEFAULT_AI_TIMEOUT_MS = 7_000
export const MIN_AI_TIMEOUT_MS = 50
export const MAX_AI_TIMEOUT_MS = 10_000

export function resolveAiTimeoutMs(value: number | string | undefined = process.env["AI_TIMEOUT_MS"]): number {
  const numericValue = typeof value === "number"
    ? value
    : typeof value === "string" && value.trim().length > 0
      ? Number(value)
      : undefined

  if (numericValue === undefined || !Number.isFinite(numericValue)) return DEFAULT_AI_TIMEOUT_MS
  return Math.min(MAX_AI_TIMEOUT_MS, Math.max(MIN_AI_TIMEOUT_MS, Math.round(numericValue)))
}
