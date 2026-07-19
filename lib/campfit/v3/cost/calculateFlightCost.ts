import type { DemoCostEstimateProfile } from "@/data/campfit/v3/demoCostEstimates"
import type { TripCostLine } from "@/lib/campfit/v3/cost/types"
import { emptyLine, sourceAmount } from "@/lib/campfit/v3/cost/utils"
import type { V3CatalogCity } from "@/lib/campfit/v3/catalogRepository"
import type { CampfitV3BasicInfo } from "@/types/campfitV3"

export function calculateFlightCost(input: {
  readonly basicInfo: CampfitV3BasicInfo
  readonly city: V3CatalogCity
  readonly estimateProfile: DemoCostEstimateProfile | null
}): TripCostLine {
  const travelerCount = input.basicInfo.adultCount + input.basicInfo.childCount
  if (input.estimateProfile) {
    const adult = input.estimateProfile.flight.adultRoundTrip
    const child = input.estimateProfile.flight.childRoundTrip
    const range = {
      low: adult.low * input.basicInfo.adultCount + child.low * input.basicInfo.childCount,
      high: adult.high * input.basicInfo.adultCount + child.high * input.basicInfo.childCount,
    }
    const amount = sourceAmount({
      label: "가족 왕복 항공료",
      range,
      currency: input.estimateProfile.currency,
      exchangeRateToKrw: input.estimateProfile.exchangeRateToKrw,
      exchangeRateAsOf: input.estimateProfile.exchangeRateAsOf,
      exchangeRateSource: input.estimateProfile.exchangeRateSource,
    })
    return {
      low: amount.lowKrw,
      high: amount.highKrw,
      status: "estimated",
      selectedVariant: null,
      travelerCount,
      includedItems: ["성인 왕복 항공료", "아동 왕복 항공료"],
      notes: [
        `${input.basicInfo.adultCount}명 성인 + ${input.basicInfo.childCount}명 아동 기준입니다.`,
        `1인 기준 ${input.estimateProfile.currency} 범위를 가족 전체로 합산했습니다.`,
        input.estimateProfile.originAssumption,
        `${input.estimateProfile.referenceMonth} 기준 Demo estimate입니다.`,
      ],
      sourceAmounts: [amount],
    }
  }
  if (input.city.flightCostKrw !== null) {
    const amount = sourceAmount({
      label: "카탈로그 항공료 참고값",
      range: { low: input.city.flightCostKrw * travelerCount, high: input.city.flightCostKrw * travelerCount },
      currency: "KRW",
      exchangeRateToKrw: 1,
      exchangeRateAsOf: null,
      exchangeRateSource: "catalog reference",
    })
    return {
      low: amount.lowKrw,
      high: amount.highKrw,
      status: "estimated",
      selectedVariant: null,
      travelerCount,
      includedItems: ["가족 왕복 항공료 참고값"],
      notes: ["출발지·시기별 실제 항공권 가격은 확인이 필요합니다."],
      sourceAmounts: [amount],
    }
  }
  return emptyLine("inquiry", ["확인 필요: 출발지와 시기에 따른 가족 왕복 항공료가 없습니다."])
}
