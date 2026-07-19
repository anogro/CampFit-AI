export type CostLineStatus = "included" | "exact" | "partial" | "estimated" | "inquiry" | "not_available"

export type TripPriceStatus = "exact" | "partial" | "estimated" | "inquiry"
export type TripCostConfidence = "high" | "medium" | "low"

export type TripCostSourceAmount = {
  readonly label: string
  readonly currency: string
  readonly low: number | null
  readonly high: number | null
  readonly lowKrw: number | null
  readonly highKrw: number | null
  readonly exchangeRateToKrw: number | null
  readonly exchangeRateAsOf: string | null
  readonly exchangeRateSource: string | null
}

export type TripCostLine = {
  readonly low: number | null
  readonly high: number | null
  readonly status: CostLineStatus
  readonly selectedVariant: string | null
  readonly travelerCount: number | null
  readonly includedItems: readonly string[]
  readonly notes: readonly string[]
  readonly sourceAmounts: readonly TripCostSourceAmount[]
}

export type TripCostBreakdown = {
  readonly program: TripCostLine
  readonly accommodation: TripCostLine
  readonly flights: TripCostLine
  readonly living: TripCostLine
  readonly localTransport: TripCostLine
  readonly other: TripCostLine & { readonly items: readonly string[] }
}

export type CampfitV3TripCost = {
  readonly currency: "KRW"
  readonly totalLow: number | null
  readonly totalHigh: number | null
  readonly confidence: TripCostConfidence
  readonly priceStatus: TripPriceStatus
  readonly calculatedAt: string
  readonly assumptions: readonly string[]
  readonly unresolvedItems: readonly string[]
  readonly breakdown: TripCostBreakdown
}
