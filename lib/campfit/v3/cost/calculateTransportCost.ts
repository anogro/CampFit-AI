import type { DemoCostEstimateProfile } from "@/data/campfit/v3/demoCostEstimates"
import { TRANSPORT_REDUCTION_RATES } from "@/lib/campfit/v3/cost/config"
import type { TripCostLine } from "@/lib/campfit/v3/cost/types"
import { emptyLine, sourceAmount } from "@/lib/campfit/v3/cost/utils"
import type { V3CatalogCity, V3CatalogProgram } from "@/lib/campfit/v3/catalogRepository"
import type { CampfitV3BasicInfo } from "@/types/campfitV3"

export function calculateTransportCost(input: {
  readonly basicInfo: CampfitV3BasicInfo
  readonly city: V3CatalogCity
  readonly program: V3CatalogProgram
  readonly estimateProfile: DemoCostEstimateProfile | null
}): TripCostLine {
  const packageInclusions = input.program.packageInclusions
  if (input.estimateProfile) {
    const weeks = input.basicInfo.durationWeeks
    const daily = input.estimateProfile.transport.familyPerWeek
    const airport = input.estimateProfile.transport.airportRoundTrip
    const dailyFactor = packageInclusions?.localTransportIncluded ? 1 - TRANSPORT_REDUCTION_RATES.shuttleIncluded : 1
    const airportFactor = packageInclusions?.airportTransferIncluded ? 0 : 1
    const range = {
      low: daily.low * weeks * dailyFactor + airport.low * airportFactor,
      high: daily.high * weeks * dailyFactor + airport.high * airportFactor,
    }
    const amount = sourceAmount({
      label: "현지 교통비",
      range,
      currency: input.estimateProfile.currency,
      exchangeRateToKrw: input.estimateProfile.exchangeRateToKrw,
      exchangeRateAsOf: input.estimateProfile.exchangeRateAsOf,
      exchangeRateSource: input.estimateProfile.exchangeRateSource,
    })
    const includedItems = ["일상 이동비"]
    const notes: string[] = []
    if (packageInclusions?.localTransportIncluded) {
      includedItems.push("프로그램 셔틀 일부 포함")
      notes.push("프로그램 셔틀 포함으로 일상 이동비를 설정값만큼 감액했습니다.")
    }
    if (packageInclusions?.airportTransferIncluded) {
      includedItems.push("공항 이동")
      notes.push("공항 이동 포함으로 공항 이동비를 중복 합산하지 않았습니다.")
    }
    if (packageInclusions === undefined) notes.push("확인 필요: 프로그램 셔틀·공항 이동 포함 여부")
    return {
      low: amount.lowKrw,
      high: amount.highKrw,
      status: packageInclusions === undefined ? "partial" : "estimated",
      selectedVariant: null,
      travelerCount: input.basicInfo.adultCount + input.basicInfo.childCount,
      includedItems,
      notes,
      sourceAmounts: [amount],
    }
  }
  return emptyLine("inquiry", ["확인 필요: 도시별 일상 이동비·공항 이동비 estimate가 없습니다."])
}
