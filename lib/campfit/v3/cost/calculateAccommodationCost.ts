import type { DemoCostEstimateProfile } from "@/data/campfit/v3/demoCostEstimates"
import { ACCOMMODATION_CAPACITY, ACCOMMODATION_UPGRADE_ORDER } from "@/lib/campfit/v3/cost/config"
import type { TripCostLine } from "@/lib/campfit/v3/cost/types"
import { emptyLine, sourceAmount, type NumericRange } from "@/lib/campfit/v3/cost/utils"
import type { V3CatalogCity, V3CatalogProgram } from "@/lib/campfit/v3/catalogRepository"
import type { CampfitV3BasicInfo } from "@/types/campfitV3"

export type AccommodationCostInput = {
  readonly basicInfo: CampfitV3BasicInfo
  readonly program: V3CatalogProgram
  readonly city: V3CatalogCity
  readonly estimateProfile: DemoCostEstimateProfile | null
}

export type AccommodationSelection = {
  readonly selectedVariant: string | null
  readonly needsConfirmation: boolean
  readonly note: string | null
}

export function selectAccommodationVariant(
  basicInfo: CampfitV3BasicInfo,
  program: V3CatalogProgram,
): AccommodationSelection {
  const travelers = basicInfo.adultCount + basicInfo.childCount
  const allowed = program.demoProfile?.accommodationOptions ?? []
  const packageIncluded = program.packageInclusions?.accommodationIncluded === true
  const optionNames = Array.from(new Set([
    ...allowed,
    ...program.priceOptions.map((option) => option.accommodationType ?? ""),
  ])).filter((value) => value && value !== "숙소미포함")
  const variants = optionNames
    .filter((value) => (ACCOMMODATION_CAPACITY[value] ?? 0) >= travelers)
    .sort((left, right) => (ACCOMMODATION_CAPACITY[left] ?? 99) - (ACCOMMODATION_CAPACITY[right] ?? 99))
  if (variants[0]) return { selectedVariant: variants[0], needsConfirmation: false, note: null }
  if (packageIncluded && optionNames.length === 0) return { selectedVariant: null, needsConfirmation: false, note: "프로그램 패키지에 숙소가 포함된 것으로 표시되어 있습니다." }
  return {
    selectedVariant: null,
    needsConfirmation: true,
    note: travelers > 0 ? `가족 ${travelers}명에 맞는 숙소 정원 variant를 확인해야 합니다.` : "숙소 정원 variant를 확인해야 합니다.",
  }
}

export function calculateAccommodationCost(input: AccommodationCostInput, selection = selectAccommodationVariant(input.basicInfo, input.program)): TripCostLine {
  const packageInclusions = input.program.packageInclusions
  if (packageInclusions === undefined) {
    return emptyLine("inquiry", ["확인 필요: 프로그램 가격에 숙소가 포함되는지 확인해야 중복 계산을 막을 수 있습니다."])
  }
  if (packageInclusions.accommodationIncluded) {
    return {
      low: 0,
      high: 0,
      status: "included",
      selectedVariant: selection.selectedVariant,
      travelerCount: input.basicInfo.adultCount + input.basicInfo.childCount,
      includedItems: [selection.selectedVariant ? `프로그램 패키지 숙소 (${selection.selectedVariant})` : "프로그램 패키지 숙소"],
      notes: selection.note ? [selection.note] : ["프로그램비에 숙소비를 포함해 별도 합산하지 않았습니다."],
      sourceAmounts: [],
    }
  }
  if (selection.needsConfirmation) {
    return emptyLine("inquiry", ["확인 필요: 가족 인원에 맞는 숙소 variant 또는 객실 업그레이드가 없습니다."])
  }
  if (input.estimateProfile === null) {
    if (input.city.housingCostMonthlyKrw !== null) {
      const monthlyReference = input.city.housingCostMonthlyKrw
      const weeks = input.basicInfo.durationWeeks
      const amount = sourceAmount({
        label: "도시 1BR 월 주거비 참고값",
        range: { low: monthlyReference * weeks / 4.345, high: monthlyReference * weeks / 4.345 },
        currency: "KRW",
        exchangeRateToKrw: 1,
        exchangeRateAsOf: null,
        exchangeRateSource: "catalog reference",
      })
      return {
        low: amount.lowKrw,
        high: amount.highKrw,
        status: "partial",
        selectedVariant: selection.selectedVariant,
        travelerCount: input.basicInfo.adultCount + input.basicInfo.childCount,
        includedItems: ["도시 1BR 월 주거비 참고값"],
        notes: ["Cities의 1BR 월 주거비를 체류 기간으로 환산한 참고값입니다.", "가족형 숙소·단기 숙박 가격과 프로그램 포함 여부는 확인이 필요합니다."],
        sourceAmounts: [amount],
      }
    }
    return emptyLine("inquiry", ["확인 필요: 숙소 유형·정원·기간별 가격 데이터가 없습니다."])
  }
  const variant = selection.selectedVariant
  const multiplier = variant ? input.estimateProfile.accommodation.variantMultipliers[variant] : undefined
  if (!variant || multiplier === undefined) {
    return emptyLine("inquiry", ["확인 필요: 선택 가능한 숙소 variant의 Demo estimate가 없습니다."])
  }
  const weeks = input.basicInfo.durationWeeks
  const range: NumericRange = {
    low: input.estimateProfile.accommodation.weeklyBase.low * weeks * multiplier,
    high: input.estimateProfile.accommodation.weeklyBase.high * weeks * multiplier,
  }
  const amount = sourceAmount({
    label: `숙소 ${variant}`,
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
    selectedVariant: variant,
    travelerCount: input.basicInfo.adultCount + input.basicInfo.childCount,
    includedItems: ["숙소비"],
    notes: [`가족 인원에 맞는 가장 작은 숙소 variant(${variant})를 Demo estimate로 선택했습니다.`],
    sourceAmounts: [amount],
  }
}

export function accommodationVariantOrder(): readonly string[] {
  return ACCOMMODATION_UPGRADE_ORDER
}
