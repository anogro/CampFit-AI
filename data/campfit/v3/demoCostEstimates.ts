export type DemoCostRange = {
  readonly low: number
  readonly high: number
}

export type DemoCostEstimateProfile = {
  readonly cityName: string
  readonly sourceType: "demo_estimate"
  readonly referenceMonth: string
  readonly originAssumption: string
  readonly currency: string
  readonly exchangeRateToKrw: number
  readonly exchangeRateAsOf: string
  readonly exchangeRateSource: "demo estimate"
  readonly flight: {
    readonly adultRoundTrip: DemoCostRange
    readonly childRoundTrip: DemoCostRange
  }
  readonly living: {
    readonly adultPerWeek: DemoCostRange
    readonly childPerWeek: DemoCostRange
  }
  readonly transport: {
    readonly familyPerWeek: DemoCostRange
    readonly airportRoundTrip: DemoCostRange
  }
  readonly accommodation: {
    readonly weeklyBase: DemoCostRange
    readonly variantMultipliers: Readonly<Record<string, number>>
  }
}

const defaultVariantMultipliers = {
  Studio: 1,
  Residence: 0.95,
  "1BR": 1.1,
  "2BR": 1.25,
  Hotel: 1.18,
  Homestay: 0.85,
} as const

export const demoCostEstimateProfiles: Readonly<Record<string, DemoCostEstimateProfile>> = {
  "Chiang Mai": {
    cityName: "Chiang Mai", sourceType: "demo_estimate", referenceMonth: "2026-07", originAssumption: "한국 출발 주요 공항 기준 Demo estimate", currency: "THB", exchangeRateToKrw: 40, exchangeRateAsOf: "2026-07-01", exchangeRateSource: "demo estimate",
    flight: { adultRoundTrip: { low: 12_000, high: 18_000 }, childRoundTrip: { low: 9_000, high: 14_000 } },
    living: { adultPerWeek: { low: 7_000, high: 10_000 }, childPerWeek: { low: 4_500, high: 7_000 } },
    transport: { familyPerWeek: { low: 1_200, high: 2_200 }, airportRoundTrip: { low: 800, high: 1_400 } },
    accommodation: { weeklyBase: { low: 10_000, high: 16_000 }, variantMultipliers: defaultVariantMultipliers },
  },
  Cebu: {
    cityName: "Cebu", sourceType: "demo_estimate", referenceMonth: "2026-07", originAssumption: "한국 출발 주요 공항 기준 Demo estimate", currency: "PHP", exchangeRateToKrw: 24, exchangeRateAsOf: "2026-07-01", exchangeRateSource: "demo estimate",
    flight: { adultRoundTrip: { low: 16_000, high: 24_000 }, childRoundTrip: { low: 12_000, high: 18_000 } },
    living: { adultPerWeek: { low: 9_000, high: 14_000 }, childPerWeek: { low: 6_000, high: 9_000 } },
    transport: { familyPerWeek: { low: 2_500, high: 4_500 }, airportRoundTrip: { low: 1_200, high: 2_200 } },
    accommodation: { weeklyBase: { low: 12_000, high: 20_000 }, variantMultipliers: defaultVariantMultipliers },
  },
  Singapore: {
    cityName: "Singapore", sourceType: "demo_estimate", referenceMonth: "2026-07", originAssumption: "한국 출발 주요 공항 기준 Demo estimate", currency: "SGD", exchangeRateToKrw: 1_050, exchangeRateAsOf: "2026-07-01", exchangeRateSource: "demo estimate",
    flight: { adultRoundTrip: { low: 450, high: 700 }, childRoundTrip: { low: 350, high: 550 } },
    living: { adultPerWeek: { low: 300, high: 450 }, childPerWeek: { low: 180, high: 300 } },
    transport: { familyPerWeek: { low: 120, high: 200 }, airportRoundTrip: { low: 80, high: 140 } },
    accommodation: { weeklyBase: { low: 900, high: 1_400 }, variantMultipliers: defaultVariantMultipliers },
  },
  Auckland: {
    cityName: "Auckland", sourceType: "demo_estimate", referenceMonth: "2026-07", originAssumption: "한국 출발 주요 공항 기준 Demo estimate", currency: "NZD", exchangeRateToKrw: 850, exchangeRateAsOf: "2026-07-01", exchangeRateSource: "demo estimate",
    flight: { adultRoundTrip: { low: 800, high: 1_200 }, childRoundTrip: { low: 600, high: 900 } },
    living: { adultPerWeek: { low: 300, high: 450 }, childPerWeek: { low: 180, high: 300 } },
    transport: { familyPerWeek: { low: 120, high: 220 }, airportRoundTrip: { low: 100, high: 180 } },
    accommodation: { weeklyBase: { low: 700, high: 1_100 }, variantMultipliers: defaultVariantMultipliers },
  },
  "Gold Coast": {
    cityName: "Gold Coast", sourceType: "demo_estimate", referenceMonth: "2026-07", originAssumption: "한국 출발 주요 공항 기준 Demo estimate", currency: "AUD", exchangeRateToKrw: 900, exchangeRateAsOf: "2026-07-01", exchangeRateSource: "demo estimate",
    flight: { adultRoundTrip: { low: 650, high: 1_000 }, childRoundTrip: { low: 500, high: 800 } },
    living: { adultPerWeek: { low: 280, high: 420 }, childPerWeek: { low: 180, high: 280 } },
    transport: { familyPerWeek: { low: 100, high: 180 }, airportRoundTrip: { low: 100, high: 180 } },
    accommodation: { weeklyBase: { low: 650, high: 1_050 }, variantMultipliers: defaultVariantMultipliers },
  },
  "Kuala Lumpur": {
    cityName: "Kuala Lumpur", sourceType: "demo_estimate", referenceMonth: "2026-07", originAssumption: "한국 출발 주요 공항 기준 Demo estimate", currency: "MYR", exchangeRateToKrw: 320, exchangeRateAsOf: "2026-07-01", exchangeRateSource: "demo estimate",
    flight: { adultRoundTrip: { low: 1_800, high: 2_800 }, childRoundTrip: { low: 1_400, high: 2_200 } },
    living: { adultPerWeek: { low: 750, high: 1_100 }, childPerWeek: { low: 450, high: 700 } },
    transport: { familyPerWeek: { low: 100, high: 180 }, airportRoundTrip: { low: 120, high: 220 } },
    accommodation: { weeklyBase: { low: 900, high: 1_500 }, variantMultipliers: defaultVariantMultipliers },
  },
  Bali: {
    cityName: "Bali", sourceType: "demo_estimate", referenceMonth: "2026-07", originAssumption: "한국 출발 주요 공항 기준 Demo estimate", currency: "IDR", exchangeRateToKrw: 0.085, exchangeRateAsOf: "2026-07-01", exchangeRateSource: "demo estimate",
    flight: { adultRoundTrip: { low: 5_500_000, high: 8_500_000 }, childRoundTrip: { low: 4_000_000, high: 6_500_000 } },
    living: { adultPerWeek: { low: 3_000_000, high: 4_800_000 }, childPerWeek: { low: 1_800_000, high: 3_000_000 } },
    transport: { familyPerWeek: { low: 400_000, high: 700_000 }, airportRoundTrip: { low: 250_000, high: 450_000 } },
    accommodation: { weeklyBase: { low: 4_000_000, high: 6_000_000 }, variantMultipliers: defaultVariantMultipliers },
  },
  Dubai: {
    cityName: "Dubai", sourceType: "demo_estimate", referenceMonth: "2026-07", originAssumption: "한국 출발 주요 공항 기준 Demo estimate", currency: "AED", exchangeRateToKrw: 380, exchangeRateAsOf: "2026-07-01", exchangeRateSource: "demo estimate",
    flight: { adultRoundTrip: { low: 2_500, high: 3_800 }, childRoundTrip: { low: 1_900, high: 2_900 } },
    living: { adultPerWeek: { low: 1_000, high: 1_500 }, childPerWeek: { low: 650, high: 1_000 } },
    transport: { familyPerWeek: { low: 300, high: 500 }, airportRoundTrip: { low: 250, high: 400 } },
    accommodation: { weeklyBase: { low: 1_200, high: 1_900 }, variantMultipliers: defaultVariantMultipliers },
  },
}

export function demoCostEstimateForCity(cityName: string): DemoCostEstimateProfile | null {
  return demoCostEstimateProfiles[cityName] ?? null
}
