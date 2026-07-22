import type { DemoCostEstimateProfile } from "@/data/campfit/v3/demoCostEstimates"
import { MEAL_REDUCTION_RATES } from "@/lib/campfit/v3/cost/config"
import type { TripCostLine } from "@/lib/campfit/v3/cost/types"
import { emptyLine, sourceAmount } from "@/lib/campfit/v3/cost/utils"
import type { V3CatalogCity, V3CatalogProgram } from "@/lib/campfit/v3/catalogRepository"
import type { CampfitV3BasicInfo } from "@/types/campfitV3"

export function calculateLivingCost(input: {
  readonly basicInfo: CampfitV3BasicInfo
  readonly city: V3CatalogCity
  readonly program: V3CatalogProgram
  readonly estimateProfile: DemoCostEstimateProfile | null
}): TripCostLine {
  const weeks = input.basicInfo.durationWeeks
  const packageInclusions = input.program.packageInclusions
  const mealPlan = packageInclusions?.mealPlan ?? "none"
  const mealReduction = MEAL_REDUCTION_RATES[mealPlan]
  if (input.estimateProfile) {
    const fullRange = {
      low: (input.estimateProfile.living.adultPerWeek.low * input.basicInfo.adultCount + input.estimateProfile.living.childPerWeek.low * input.basicInfo.childCount) * weeks,
      high: (input.estimateProfile.living.adultPerWeek.high * input.basicInfo.adultCount + input.estimateProfile.living.childPerWeek.high * input.basicInfo.childCount) * weeks,
    }
    const range = { low: fullRange.low * (1 - mealReduction), high: fullRange.high * (1 - mealReduction) }
    const amount = sourceAmount({
      label: "가족 생활비",
      range,
      currency: input.estimateProfile.currency,
      exchangeRateToKrw: input.estimateProfile.exchangeRateToKrw,
      exchangeRateAsOf: input.estimateProfile.exchangeRateAsOf,
      exchangeRateSource: input.estimateProfile.exchangeRateSource,
    })
    const notes = [
      `${weeks}주·성인 ${input.basicInfo.adultCount}명·아동 ${input.basicInfo.childCount}명 기준입니다.`,
      mealReduction > 0 ? `${mealPlan} 포함으로 생활비를 ${Math.round(mealReduction * 100)}% 감액했습니다.` : "식사 포함 정보가 없어 생활비를 감액하지 않았습니다.",
    ]
    if (packageInclusions === undefined) notes.push("확인 필요: 프로그램·숙소의 식사 포함 범위")
    return {
      low: amount.lowKrw,
      high: amount.highKrw,
      status: packageInclusions === undefined ? "partial" : "estimated",
      selectedVariant: mealPlan,
      travelerCount: input.basicInfo.adultCount + input.basicInfo.childCount,
      includedItems: mealReduction > 0 ? [`${mealPlan} 식사 포함분 반영`] : [],
      notes,
      sourceAmounts: [amount],
    }
  }
  if (input.city.livingCostMonthlyKrw !== null) {
    const monthlyReference = input.city.livingCostMonthlyKrw * weeks / 4.345
    const amount = sourceAmount({
      label: "도시 생활비 월 기준 참고값",
      range: { low: monthlyReference, high: monthlyReference },
      currency: "KRW",
      exchangeRateToKrw: 1,
      exchangeRateAsOf: null,
      exchangeRateSource: "catalog reference",
    })
    return {
      low: amount.lowKrw,
      high: amount.highKrw,
      status: packageInclusions === undefined ? "partial" : "estimated",
      selectedVariant: mealPlan,
      travelerCount: input.basicInfo.adultCount + input.basicInfo.childCount,
      includedItems: [],
      notes: ["Cities 생활비 월 기준을 체류 기간으로 환산한 참고값입니다."],
      sourceAmounts: [amount],
    }
  }
  return emptyLine("inquiry", [])
}
