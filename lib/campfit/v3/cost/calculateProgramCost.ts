import type { V3CatalogProgram, V3PriceOption } from "@/lib/campfit/v3/catalogRepository"
import type { TripCostLine } from "@/lib/campfit/v3/cost/types"
import { emptyLine, sourceAmount } from "@/lib/campfit/v3/cost/utils"
import type { CampfitV3BasicInfo } from "@/types/campfitV3"

export type ProgramCostInput = {
  readonly basicInfo: CampfitV3BasicInfo
  readonly program: V3CatalogProgram
  readonly selectedAccommodationVariant: string | null
  readonly accommodationNeedsConfirmation?: boolean | undefined
}

export function calculateProgramCost(input: ProgramCostInput): TripCostLine {
  const packageInclusions = input.program.packageInclusions
  const programChildCount = 1
  const packageAccommodation = packageInclusions?.accommodationIncluded === true
  if (packageAccommodation && input.accommodationNeedsConfirmation === true && input.selectedAccommodationVariant === null) {
    return emptyLine("inquiry", ["확인 필요: 가족 인원에 맞는 프로그램 숙소 variant가 없어 참가비를 확정할 수 없습니다."])
  }
  const requestedAccommodation = packageAccommodation ? input.selectedAccommodationVariant : "숙소미포함"
  const familyOptions = input.program.priceOptions.filter((option) => option.status?.toLowerCase() === "active"
    && option.adultCount === input.basicInfo.adultCount
    && option.childCount === programChildCount)
  const accommodationOptions = requestedAccommodation
    ? familyOptions.filter((option) => option.accommodationType === requestedAccommodation)
    : familyOptions
  const durationOptions = (accommodationOptions.length ? accommodationOptions : familyOptions).filter((option) => option.durationWeeks !== null)
  const selected = selectClosestDuration(durationOptions, input.basicInfo.durationWeeks)

  if (!selected) {
    const referenceLow = input.program.budgetMinKrw
    const referenceHigh = input.program.budgetMaxKrw
    if (referenceLow !== null && referenceLow > 0) {
      return {
        low: referenceLow,
        high: referenceHigh ?? referenceLow,
        status: "estimated",
        selectedVariant: requestedAccommodation,
        travelerCount: input.basicInfo.adultCount + programChildCount,
        includedItems: ["첫째 프로그램 참가비"],
        notes: ["정확한 가족 구성·기간 가격 variant가 없어 카탈로그 참고값을 사용했습니다."],
        sourceAmounts: [{ label: "프로그램 참고 가격", currency: "KRW", low: referenceLow, high: referenceHigh ?? referenceLow, lowKrw: referenceLow, highKrw: referenceHigh ?? referenceLow, exchangeRateToKrw: 1, exchangeRateAsOf: null, exchangeRateSource: "catalog reference" }],
      }
    }
    return emptyLine("inquiry", ["확인 필요: 가족 구성·기간에 맞는 프로그램 가격 variant가 없습니다."])
  }

  const notes: string[] = []
  const includedItems = ["첫째 프로그램 참가비"]
  const hasExactDuration = selected.durationWeeks === input.basicInfo.durationWeeks
  if (!hasExactDuration) notes.push(`요청 ${input.basicInfo.durationWeeks}주와 일치하는 가격이 없어 ${selected.durationWeeks}주 variant를 참고했습니다.`)
  if (selected.priceQuality === "official_surcharge" || input.program.demoProfile?.priceQuality === "official_surcharge") notes.push("공식 추가요금이 있을 수 있어 최종 견적 확인이 필요합니다.")
  if (input.program.demoProfile?.priceNote) notes.push(input.program.demoProfile.priceNote)
  if (packageAccommodation && input.selectedAccommodationVariant) includedItems.push(`숙소 (${input.selectedAccommodationVariant})`)

  if (selected.priceValue === null || selected.currency === null) {
    return {
      low: null,
      high: null,
      status: "inquiry",
      selectedVariant: selected.accommodationType ?? requestedAccommodation,
      travelerCount: input.basicInfo.adultCount + programChildCount,
      includedItems,
      notes: [...notes, "프로그램비는 문의 필요하며 숫자를 임의로 생성하지 않았습니다."],
      sourceAmounts: [],
    }
  }

  if (selected.currency.toUpperCase() !== "KRW") {
    return {
      low: null,
      high: null,
      status: "inquiry",
      selectedVariant: selected.accommodationType ?? requestedAccommodation,
      travelerCount: input.basicInfo.adultCount + programChildCount,
      includedItems,
      notes: [...notes, `프로그램 통화 ${selected.currency}의 KRW 환율 설정이 없어 환산하지 않았습니다.`],
      sourceAmounts: [],
    }
  }

  const amount = sourceAmount({
    label: "첫째 프로그램 참가비",
    range: { low: selected.priceValue, high: selected.priceValue },
    currency: selected.currency,
    exchangeRateToKrw: selected.currency.toUpperCase() === "KRW" ? 1 : 1,
    exchangeRateAsOf: null,
    exchangeRateSource: "catalog",
  })
  const low = amount.lowKrw ?? 0
  const high = amount.highKrw ?? 0
  const extraChildPrice = packageInclusions?.additionalChildProgramPriceKrw ?? null
  const additionalChildren = Math.max(0, input.basicInfo.childCount - 1)
  const notesWithChildren = [...notes]
  let status: TripCostLine["status"] = resolveProgramStatus(selected, hasExactDuration)
  let totalLow = low
  let totalHigh = high
  if (additionalChildren > 0 && extraChildPrice === null) {
    status = status === "exact" ? "partial" : status
    notesWithChildren.push(`추가 아동 ${additionalChildren}명의 프로그램비는 확인된 데이터가 없어 포함하지 않았습니다.`)
  } else if (additionalChildren > 0 && extraChildPrice !== null) {
    totalLow += extraChildPrice * additionalChildren
    totalHigh += extraChildPrice * additionalChildren
    includedItems.push(`추가 아동 프로그램비 ${additionalChildren}명`)
  }
  if (packageInclusions?.registrationFeeKrw !== null && packageInclusions?.registrationFeeKrw !== undefined) {
    totalLow += packageInclusions.registrationFeeKrw
    totalHigh += packageInclusions.registrationFeeKrw
    includedItems.push("등록·행정비")
  }
  if (packageInclusions?.additionalAdultSurchargeKrw !== null && packageInclusions?.additionalAdultSurchargeKrw !== undefined && input.basicInfo.adultCount > 2) {
    const extraAdults = input.basicInfo.adultCount - 2
    totalLow += packageInclusions.additionalAdultSurchargeKrw * extraAdults
    totalHigh += packageInclusions.additionalAdultSurchargeKrw * extraAdults
    includedItems.push(`추가 성인 surcharge ${extraAdults}명`)
  }
  return {
    low: totalLow,
    high: totalHigh,
    status,
    selectedVariant: selected.accommodationType ?? requestedAccommodation,
    travelerCount: input.basicInfo.adultCount + programChildCount,
    includedItems,
    notes: notesWithChildren,
    sourceAmounts: [amount],
  }
}

function selectClosestDuration(options: readonly V3PriceOption[], requestedWeeks: number): V3PriceOption | null {
  return [...options].sort((left, right) => Math.abs((left.durationWeeks ?? 99) - requestedWeeks) - Math.abs((right.durationWeeks ?? 99) - requestedWeeks))[0] ?? null
}

function resolveProgramStatus(option: V3PriceOption, exactDuration: boolean): TripCostLine["status"] {
  const quality = option.priceQuality
  if (quality === "inquiry") return "inquiry"
  if (quality === "reference") return "estimated"
  if (quality === "official_surcharge") return "partial"
  return exactDuration ? "exact" : "estimated"
}
