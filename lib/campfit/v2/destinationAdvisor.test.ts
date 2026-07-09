import { describe, expect, it } from "vitest"
import { buildDestinationRecommendations } from "@/lib/campfit/v2/destinationAdvisor"
import { buildCampfitV2ConsultingProfile } from "@/lib/campfit/v2/profileBuilder"
import type { CampfitV2MatchingResult } from "@/lib/campfit/v2/v2MatchingWrapper"
import type { AIExtractionResult, BudgetEstimate, CityFitProfile, ConsultingProfile, RequiredIntake } from "@/types/campfitV2"

const baseIntake: RequiredIntake = {
  childAgeAtStart: 8,
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
  understandingSummaryForUser: "오세아니아를 원하지만 초반 적응 지원이 필요합니다.",
  extractedProfile: {
    detectedRegions: ["oceania"],
    detectedProgramTypes: ["international_school_camp"],
    parentGoals: ["natural_english_exposure", "cultural_exposure"],
    childSignals: ["slow_to_adapt"],
    riskSignals: ["english_overload", "separation_risk"],
    avoidSignals: [],
    flexibilitySignals: [],
  },
  missingSlots: [],
  conflicts: [],
  confidenceMap: {},
  recommendedQuestionKeys: [],
}

const budgetEstimates: readonly BudgetEstimate[] = [
  {
    regionGroup: "oceania",
    availableProgramBudgetKrwMin: 3_000_000,
    availableProgramBudgetKrwMax: 6_500_000,
    flags: ["comparison_estimate", "needs_consultation_check"],
    note: "비교용 추정입니다.",
  },
]

describe("buildDestinationRecommendations", () => {
  it("Given Oceania preference When city data exists Then preferred region direction is first", () => {
    const recommendations = buildDestinationRecommendations({
      profile: makeProfile(),
      matchingResult: oneCandidateMatching,
      cityFitProfiles,
    })

    expect(recommendations).toHaveLength(3)
    expect(recommendations[0]?.key).toBe("keep_preferred_region")
    expect(recommendations[0]?.regionGroup).toBe("oceania")
    expect(recommendations[0]?.cityName).toBe("Auckland")
  })

  it("Given one matching candidate When building destination advice Then city directions still include at least three cards", () => {
    const recommendations = buildDestinationRecommendations({
      profile: makeProfile(),
      matchingResult: oneCandidateMatching,
      cityFitProfiles,
    })

    expect(recommendations.length).toBeGreaterThanOrEqual(3)
    expect(new Set(recommendations.map((item) => item.key))).toEqual(new Set([
      "keep_preferred_region",
      "prioritize_child_fit",
      "prioritize_budget_and_support",
    ]))
  })

  it("Given empty city data When building destination advice Then fallback directions are returned", () => {
    const recommendations = buildDestinationRecommendations({
      profile: makeProfile(),
      matchingResult: oneCandidateMatching,
      cityFitProfiles: [],
    })

    expect(recommendations).toHaveLength(3)
    expect(recommendations.every((item) => item.dataQuality === "fallback_direction")).toBe(true)
    expect(recommendations[0]?.title).toContain("오세아니아")
  })

  it("Given adaptation and budget constraints When city data exists Then Southeast Asia appears as realistic alternative", () => {
    const recommendations = buildDestinationRecommendations({
      profile: makeProfile(),
      matchingResult: oneCandidateMatching,
      cityFitProfiles,
    })

    expect(recommendations.some((item) => item.regionGroup === "southeast_asia")).toBe(true)
    expect(JSON.stringify(recommendations)).not.toMatch(/\bparent_can_stay\b/)
    expect(JSON.stringify(recommendations)).not.toMatch(/\bdaily_korean_communication\b/)
  })
})

function makeProfile(): ConsultingProfile {
  return buildCampfitV2ConsultingProfile({
    requiredIntake: baseIntake,
    naturalInput: {
      situationText: "자연스럽게 영어를 받아들이고 다양한 문화를 경험했으면 합니다.",
      childContextText: "낯가림이 조금 있고 초반 적응 도움이 필요합니다.",
      successAndConcernsText: "영어로 친구들에게 무시당하지 않을까 걱정됩니다.",
    },
    extraction,
    budgetEstimates,
  })
}

const cityFitProfiles: readonly CityFitProfile[] = [
  {
    cityId: "auckland",
    cityName: "Auckland",
    countryName: "New Zealand",
    regionGroup: "oceania",
    flightPerPersonKrwMin: 1_500_000,
    flightPerPersonKrwMax: 1_500_000,
    parentStayFit: 72,
    beginnerEnglishFit: 64,
    schoolingFit: 88,
    familyEslFit: 70,
    managedCampFit: 54,
    koreanSupportLikelihood: 58,
    budgetPressure: 76,
    safetyComfort: 92,
    medicalAccess: 85,
    livingCostLevel: 68,
    weatherComfort: 76,
    culturalExposure: 86,
    activityFit: 80,
    travelBurden: 78,
    dataQuality: "city_data",
    notes: ["오세아니아 선호를 유지하기 좋은 방향입니다."],
    verifyBeforeConsulting: ["항공권과 숙소 비용은 상담 전 확인이 필요합니다."],
  },
  {
    cityId: "chiang-mai",
    cityName: "Chiang Mai",
    countryName: "Thailand",
    regionGroup: "southeast_asia",
    flightPerPersonKrwMin: 700_000,
    flightPerPersonKrwMax: 700_000,
    parentStayFit: 92,
    beginnerEnglishFit: 72,
    schoolingFit: 58,
    familyEslFit: 88,
    managedCampFit: 76,
    koreanSupportLikelihood: 42,
    budgetPressure: 24,
    safetyComfort: 72,
    medicalAccess: 70,
    livingCostLevel: 24,
    weatherComfort: 64,
    culturalExposure: 78,
    activityFit: 82,
    travelBurden: 36,
    dataQuality: "city_data",
    notes: ["생활비 현실성과 부모 체류를 함께 보기 좋은 도시입니다."],
    verifyBeforeConsulting: ["한국어 지원 가능 범위는 상담 전 확인이 필요합니다."],
  },
  {
    cityId: "cebu",
    cityName: "Cebu",
    countryName: "Philippines",
    regionGroup: "southeast_asia",
    flightPerPersonKrwMin: 600_000,
    flightPerPersonKrwMax: 600_000,
    parentStayFit: 80,
    beginnerEnglishFit: 82,
    schoolingFit: 52,
    familyEslFit: 84,
    managedCampFit: 92,
    koreanSupportLikelihood: 70,
    budgetPressure: 32,
    safetyComfort: 62,
    medicalAccess: 66,
    livingCostLevel: 30,
    weatherComfort: 58,
    culturalExposure: 66,
    activityFit: 72,
    travelBurden: 34,
    dataQuality: "city_data",
    notes: ["관리형 캠프 공급을 함께 보기 좋은 도시입니다."],
    verifyBeforeConsulting: ["프로그램 공급과 숙소 조건은 상담 전 확인이 필요합니다."],
  },
]

const oneCandidateMatching: CampfitV2MatchingResult = {
  recommendations: [
    {
      programId: "single-candidate",
      programName: "단일 후보",
      tier: "possible_if_adjusted",
      fitScoreSummary: { overallScore: 62, tier: "possible_if_adjusted", label: "조건 확인 후 검토", axes: [] },
      fitSummary: "단일 후보입니다.",
      matchedConditions: ["부모 체류 조건과 일부 맞습니다."],
      mismatchedConditions: ["선호 지역과 일부 다릅니다."],
      recommendDespiteMismatchReason: "조건 확인 후 비교할 수 있습니다.",
      childFit: "초반 적응 지원 확인이 필요합니다.",
      familyFit: "가족 조건 확인이 필요합니다.",
      riskLevel: "medium",
      riskReasons: ["항공권 포함 비용 확인이 필요합니다."],
      mitigation: ["상담 전 비용을 확인하세요."],
      consultingChecklist: ["항공권과 숙소 비용을 확인하세요."],
      scoreBreakdown: { legacyScore: 50, v2Score: 62 },
    },
  ],
  relaxedCandidates: [],
  excludedCandidates: [],
  strategySummary: {},
}
