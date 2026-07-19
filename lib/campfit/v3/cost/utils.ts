import type { TripCostConfidence, TripCostLine, TripCostSourceAmount, TripPriceStatus, CostLineStatus } from "@/lib/campfit/v3/cost/types"

export type NumericRange = { readonly low: number; readonly high: number }

export function toKrwRange(range: NumericRange, _currency: string, exchangeRateToKrw: number, _exchangeRateAsOf: string | null, _exchangeRateSource: string | null): NumericRange {
  return {
    low: Math.round(range.low * exchangeRateToKrw),
    high: Math.round(range.high * exchangeRateToKrw),
  }
}

export function sourceAmount(input: {
  readonly label: string
  readonly range: NumericRange
  readonly currency: string
  readonly exchangeRateToKrw: number
  readonly exchangeRateAsOf: string | null
  readonly exchangeRateSource: string | null
}): TripCostSourceAmount {
  const krw = toKrwRange(input.range, input.currency, input.exchangeRateToKrw, input.exchangeRateAsOf, input.exchangeRateSource)
  return {
    label: input.label,
    currency: input.currency,
    low: input.range.low,
    high: input.range.high,
    lowKrw: krw.low,
    highKrw: krw.high,
    exchangeRateToKrw: input.exchangeRateToKrw,
    exchangeRateAsOf: input.exchangeRateAsOf,
    exchangeRateSource: input.exchangeRateSource,
  }
}

export function emptyLine(status: CostLineStatus, notes: readonly string[] = []): TripCostLine {
  return { low: null, high: null, status, selectedVariant: null, travelerCount: null, includedItems: [], notes, sourceAmounts: [] }
}

export function sumRanges(lines: readonly TripCostLine[]): NumericRange {
  return lines.reduce((sum, line) => ({
    low: sum.low + (line.low ?? 0),
    high: sum.high + (line.high ?? 0),
  }), { low: 0, high: 0 })
}

export function priceStatusForLines(lines: readonly TripCostLine[]): TripPriceStatus {
  if (lines.some((line) => line.status === "inquiry" || line.status === "not_available")) return "inquiry"
  if (lines.some((line) => line.status === "estimated")) return "estimated"
  if (lines.some((line) => line.status === "partial")) return "partial"
  return "exact"
}

export function confidenceForLines(lines: readonly TripCostLine[], unresolvedItems: readonly string[]): TripCostConfidence {
  if (unresolvedItems.length || lines.some((line) => line.status === "inquiry" || line.status === "not_available")) return "low"
  if (lines.some((line) => line.status === "estimated" || line.status === "partial")) return "medium"
  return "high"
}

export function uniqueStrings(values: readonly string[]): readonly string[] {
  return Array.from(new Set(values.filter((value) => value.trim().length > 0)))
}
