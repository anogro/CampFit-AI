export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

export function toPercentScore(value: number): number {
  return Math.round(clamp01(value) * 100)
}

export function average(values: readonly number[]): number {
  if (values.length === 0) {
    return 0
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length
}

export function weightedAverage(items: readonly { readonly value: number; readonly weight: number }[]): number {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0)
  if (totalWeight === 0) {
    return 0
  }

  return items.reduce((sum, item) => sum + item.value * item.weight, 0) / totalWeight
}

export function createSessionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }

  return `campfit_${Date.now()}_${Math.random().toString(16).slice(2)}`
}
