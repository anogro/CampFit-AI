import { describe, expect, it } from "vitest"
import { camps } from "@/data/campfit/camps"
import { buildLegacyMatchingPayload } from "@/lib/campfit/v2/legacyAdapter"
import { buildCampfitV2ConsultingProfile } from "@/lib/campfit/v2/profileBuilder"
import { recommendCampsV2 } from "@/lib/campfit/v2/v2MatchingWrapper"
import type { AIExtractionResult, BudgetEstimate, ConsultingProfile, RequiredIntake } from "@/types/campfitV2"

const unknownBudget: BudgetEstimate = {
  regionGroup: "oceania",
  flags: ["unknown_cost_assumption", "needs_consultation_check"],
  note: "지역별 항공권/부대비 비교용 추정치가 없어 예산 판정은 상담 전 확인이 필요합니다.",
}

const baseIntake: RequiredIntake = {
  childAgeAtStart: 10,
  departureWindow: "summer_break",
  durationWeeksMin: 2,
  durationWeeksMax: 4,
  totalBudgetAllInKrwMin: 5_000_000,
  totalBudgetAllInKrwMax: 8_000_000,
  budgetScope: "family_total",
  travelerCounts: { child: 1, parent: 1, sibling: 0 },
  preferredRegionGroups: ["oceania"],
  regionPriority: "strong",
  parentAccompanimentMode: "parent_can_stay",
  koreanSupportNeed: "daily_korean_communication",
  accommodationPreferences: ["parent_stay"],
}

const extraction: AIExtractionResult = {
  understandingSummaryForUser: "오세아니아 스쿨링을 원하지만 영어 준비도 확인이 필요합니다.",
  extractedProfile: {
    detectedRegions: ["oceania"],
    detectedProgramTypes: ["international_school_regular"],
    parentGoals: ["english_improvement"],
    childSignals: [],
    riskSignals: ["english_overload"],
    avoidSignals: [],
    flexibilitySignals: [],
  },
  missingSlots: [],
  conflicts: [],
  confidenceMap: {},
  recommendedQuestionKeys: [],
}

describe("recommendCampsV2", () => {
  it("Given hard Oceania region When Southeast Asia camp exists Then it is not recommended", () => {
    const profile = makeProfile({ requiredIntake: { ...baseIntake, regionPriority: "hard" } })
    const result = recommendCampsV2(profile, {
      camps: camps.filter((camp) => camp.country === "Singapore" || camp.country === "Australia").slice(0, 2),
    })

    expect(result.recommendations.every((card) => !card.programName.includes("Singapore"))).toBe(true)
    expect(result.relaxedCandidates.some((card) => card.programName.includes("Singapore"))).toBe(true)
  })

  it("Given strong Oceania region When Oceania camp exists Then it is recommended first", () => {
    const profile = makeProfile()
    const result = recommendCampsV2(profile, {
      camps: camps.filter((camp) => camp.id === "cebu_confidence_bridge_03" || camp.id === "australia_activity_18"),
    })

    expect(result.recommendations[0]?.programName).toContain("Australia")
  })

  it("Given unknown budget assumption When matching Then budget alone does not exclude and checklist asks confirmation", () => {
    const profile = makeProfile({ budgetEstimates: [unknownBudget] })
    const result = recommendCampsV2(profile, { camps: camps.filter((camp) => camp.country === "Australia") })

    expect(result.excludedCandidates.every((candidate) => !candidate.excludedReasons.some((reason) => reason.includes("예산")))).toBe(true)
    expect([...result.recommendations, ...result.relaxedCandidates].some((card) => card.consultingChecklist.some((item) => item.includes("항공권")))).toBe(true)
  })

  it("Given parent required When camp cannot host parent Then excluded reason is recorded", () => {
    const profile = makeProfile({ requiredIntake: { ...baseIntake, parentAccompanimentMode: "parent_required" } })
    const result = recommendCampsV2(profile, { camps: camps.filter((camp) => camp.id === "australia_activity_18") })

    expect(result.excludedCandidates[0]?.excludedReasons).toContain("부모 동행 필수 조건과 맞지 않습니다.")
  })

  it("Given resident Korean manager required When camp lacks support Then excluded reason is recorded", () => {
    const profile = makeProfile({ requiredIntake: { ...baseIntake, koreanSupportNeed: "resident_korean_manager" } })
    const result = recommendCampsV2(profile, { camps: camps.filter((camp) => camp.id === "australia_activity_18") })

    expect(result.excludedCandidates[0]?.excludedReasons).toContain("한국어 지원 필수 조건을 충족하지 못합니다.")
  })

  it("Given schooling preference When managed immersion is recommended Then mismatch and despite reason exist", () => {
    const profile = makeProfile({ requiredIntake: { ...baseIntake, preferredRegionGroups: ["southeast_asia"], regionPriority: "flexible" } })
    const result = recommendCampsV2(profile, { camps: camps.filter((camp) => camp.id === "cebu_confidence_bridge_03") })

    expect(result.recommendations[0]?.mismatchedConditions.some((item) => item.includes("프로그램 유형"))).toBe(true)
    expect(result.recommendations[0]?.recommendDespiteMismatchReason).toBeTruthy()
  })

  it("Given no exact match When reporting candidates Then no forced best fit appears", () => {
    const profile = makeProfile({ requiredIntake: { ...baseIntake, preferredRegionGroups: ["oceania"], regionPriority: "strong" } })
    const result = recommendCampsV2(profile, { camps: camps.filter((camp) => camp.country === "Philippines").slice(0, 2) })

    expect(result.recommendations.every((card) => card.tier !== "best_fit")).toBe(true)
    expect([...result.recommendations, ...result.relaxedCandidates].some((card) => card.mismatchedConditions.length > 0)).toBe(true)
  })

  it("Given candidates When matching Then required explanation fields are present", () => {
    const profile = makeProfile({ requiredIntake: { ...baseIntake, parentAccompanimentMode: "parent_required" } })
    const result = recommendCampsV2(profile, { camps: camps.filter((camp) => camp.country === "Australia" || camp.country === "Philippines").slice(0, 4) })

    expect([...result.recommendations, ...result.relaxedCandidates].every((card) =>
      card.matchedConditions !== undefined &&
      card.mismatchedConditions !== undefined &&
      card.recommendDespiteMismatchReason !== undefined &&
      card.riskReasons !== undefined &&
      card.mitigation !== undefined &&
      card.consultingChecklist !== undefined,
    )).toBe(true)
    expect(result.excludedCandidates.every((candidate) =>
      candidate.excludedReasons !== undefined &&
      candidate.conditionRelaxation !== undefined &&
      candidate.stillWorthConsideringReason !== undefined,
    )).toBe(true)
  })

  it("Given v2 matching result When serialized Then forbidden v2 concepts are absent from wrapper output", () => {
    const profile = makeProfile()
    const result = recommendCampsV2(profile, { camps: camps.filter((camp) => camp.country === "Australia") })
    const serialized = JSON.stringify(result)

    expect(serialized).not.toMatch(/\bgrade\b/i)
    expect(serialized).not.toMatch(/\bbudgetIncludesFlight\b/)
  })

  it("Given legacy adapter When building payload Then dummy grade warning remains internal", () => {
    const profile = makeProfile()
    const payload = buildLegacyMatchingPayload(profile)

    expect(payload.warnings).toContain("legacy_required_dummy_grade: v1 matching type requires a school-year field; v2 does not store or expose it.")
  })
})

function makeProfile(input: {
  readonly requiredIntake?: RequiredIntake
  readonly budgetEstimates?: readonly BudgetEstimate[]
} = {}): ConsultingProfile {
  return buildCampfitV2ConsultingProfile({
    requiredIntake: input.requiredIntake ?? baseIntake,
    naturalInput: { situationText: "호주 스쿨링을 원하지만 영어 초급이라 걱정됩니다." },
    extraction,
    budgetEstimates: input.budgetEstimates ?? [
      {
        regionGroup: "oceania",
        availableProgramBudgetKrwMin: 4_000_000,
        availableProgramBudgetKrwMax: 9_000_000,
        flags: ["comparison_estimate", "needs_consultation_check"],
        note: "비교용 추정입니다.",
      },
    ],
  })
}
