import type { DemoCostEstimateProfile } from "@/data/campfit/v3/demoCostEstimates"
import { calculateAccommodationCost, selectAccommodationVariant } from "@/lib/campfit/v3/cost/calculateAccommodationCost"
import { calculateFlightCost } from "@/lib/campfit/v3/cost/calculateFlightCost"
import { calculateLivingCost } from "@/lib/campfit/v3/cost/calculateLivingCost"
import { calculateProgramCost } from "@/lib/campfit/v3/cost/calculateProgramCost"
import { calculateTransportCost } from "@/lib/campfit/v3/cost/calculateTransportCost"
import type { CampfitV3TripCost, TripCostLine } from "@/lib/campfit/v3/cost/types"
import { confidenceForLines, priceStatusForLines, sumRanges, uniqueStrings } from "@/lib/campfit/v3/cost/utils"
import type { V3CatalogCity, V3CatalogProgram } from "@/lib/campfit/v3/catalogRepository"
import type { CampfitV3BasicInfo } from "@/types/campfitV3"

export type TotalTripCostInput = {
  readonly basicInfo: CampfitV3BasicInfo
  readonly city: V3CatalogCity
  readonly program: V3CatalogProgram
  readonly estimateProfile: DemoCostEstimateProfile | null
  readonly calculatedAt: string
}

export function calculateTotalTripCost(input: TotalTripCostInput): CampfitV3TripCost {
  const accommodationSelection = selectAccommodationVariant(input.basicInfo, input.program)
  const program = calculateProgramCost({
    basicInfo: input.basicInfo,
    program: input.program,
    selectedAccommodationVariant: accommodationSelection.selectedVariant,
    accommodationNeedsConfirmation: accommodationSelection.needsConfirmation,
  })
  const accommodation = calculateAccommodationCost({ ...input }, accommodationSelection)
  const flights = calculateFlightCost({ basicInfo: input.basicInfo, city: input.city, estimateProfile: input.estimateProfile })
  const living = calculateLivingCost({ basicInfo: input.basicInfo, city: input.city, program: input.program, estimateProfile: input.estimateProfile })
  const localTransport = calculateTransportCost({ basicInfo: input.basicInfo, city: input.city, program: input.program, estimateProfile: input.estimateProfile })
  const other = otherCosts()
  const lines = [program, accommodation, flights, living, localTransport, other]
  const summed = sumRanges(lines)
  const hasKnownAmount = lines.some((line) => !["inquiry", "not_available"].includes(line.status) && (line.low !== null || line.high !== null))
  const unresolvedItems = collectUnresolvedItems(lines)
  const assumptions = [
    `성인 ${input.basicInfo.adultCount}명·아동 ${input.basicInfo.childCount}명 전체 여행비 기준`,
    "프로그램 추천과 참가비는 첫 번째 아이 기준",
    `${input.basicInfo.durationWeeks}주 체류 기준`,
    input.estimateProfile ? `${input.estimateProfile.referenceMonth} Demo estimate와 ${input.estimateProfile.currency}→KRW 환율을 사용` : "카탈로그에 확인된 비용만 사용",
  ]
  return {
    currency: "KRW",
    totalLow: hasKnownAmount ? summed.low : null,
    totalHigh: hasKnownAmount ? summed.high : null,
    confidence: confidenceForLines(lines, unresolvedItems),
    priceStatus: priceStatusForLines(lines),
    calculatedAt: input.calculatedAt,
    assumptions,
    unresolvedItems,
    breakdown: { program, accommodation, flights, living, localTransport, other },
  }
}

function otherCosts(): TripCostLine & { readonly items: readonly string[] } {
  return {
    low: 0,
    high: 0,
    status: "inquiry",
    selectedVariant: null,
    travelerCount: null,
    includedItems: [],
    notes: ["확인 필요: 보험·비자·현지 필수 행정비는 상품과 가족 상황에 따라 달라집니다."],
    sourceAmounts: [],
    items: ["보험·비자", "현지 필수 행정비", "추가 옵션 비용"],
  }
}

function collectUnresolvedItems(lines: readonly TripCostLine[]): readonly string[] {
  return uniqueStrings(lines.flatMap((line) => line.notes.filter((note) => /확인 필요|문의 필요|확인된 데이터가 없어|환율 설정이 없어|추가요금이 있을 수/.test(note))))
}
