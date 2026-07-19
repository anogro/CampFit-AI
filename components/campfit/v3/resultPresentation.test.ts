import { describe, expect, it } from "vitest"
import {
  buildAnogroCityHref,
  buildCityComparisons,
  buildDecisionAxes,
  decisionAxesSummary,
  programCatalogPresentation,
  safeProgramDetailHref,
} from "@/components/campfit/v3/resultPresentation"
import type { CampfitV3TripCost } from "@/lib/campfit/v3/cost/types"
import type { CampfitV3BasicInfo, CampfitV3ConversationState, CampfitV3RecommendationResult } from "@/types/campfitV3"

describe("CampFit v3 result presentation", () => {
  it("builds six qualitative decision axes without exposing score labels", () => {
    const axes = buildDecisionAxes(result, state, basicInfo)

    expect(axes).toHaveLength(6)
    expect(axes.map((axis) => axis.label)).toEqual([
      "영어 경험",
      "학교·학습",
      "주제·프로젝트",
      "문화·활동",
      "지원 필요",
      "가족 체류 현실성",
    ])
    expect(axes.find((axis) => axis.key === "culture")?.level).toBe("high")
    expect(axes.find((axis) => axis.key === "english")?.level).toBe("medium")
    expect(axes.find((axis) => axis.key === "school")?.level).toBe("low")
    expect(axes.find((axis) => axis.key === "support")?.level).toBe("medium")
    expect(axes.find((axis) => axis.key === "family")?.level).toBe("high")
    expect(axes.every((axis) => ["low", "medium", "high"].includes(axis.level))).toBe(true)
    expect(decisionAxesSummary(axes)).not.toMatch(/\d+점/)
  })

  it("uses the verified ANOGRO city route and rejects unsafe program URLs", () => {
    expect(buildAnogroCityHref("Cebu", "https://www.anogro.com")).toBe("https://www.anogro.com/city/Cebu")
    expect(buildAnogroCityHref("Chiang Mai", "https://www.anogro.com")).toBe("https://www.anogro.com/city/Chiang%20Mai")
    expect(buildAnogroCityHref(" Cebu ", " https://www.anogro.com/ ")).toBe("https://www.anogro.com/city/Cebu")
    expect(buildAnogroCityHref("", "https://www.anogro.com")).toBeNull()
    expect(buildAnogroCityHref("세부", "https://www.anogro.com/")).toBe("https://www.anogro.com/city/%EC%84%B8%EB%B6%80")
    expect(buildAnogroCityHref("Cebu", undefined)).toBe("https://www.anogro.com/city/Cebu")
    expect(buildAnogroCityHref("Cebu", "")).toBeNull()
    expect(buildAnogroCityHref("Cebu", "javascript:alert(1)")).toBeNull()
    expect(safeProgramDetailHref("https://www.anogro.com/program/camp-slug")).toBe("https://www.anogro.com/program/camp-slug")
    expect(safeProgramDetailHref("javascript:alert(1)")).toBeNull()
    expect(safeProgramDetailHref(null)).toBeNull()
  })

  it("distinguishes verified and unavailable catalog sources", () => {
    const verified = programCatalogPresentation("supabase")
    const demo = programCatalogPresentation("demo")
    const unavailable = programCatalogPresentation("unavailable")

    expect(verified.showProgramCards).toBe(true)
    expect(verified.notice).toBeNull()
    expect(verified.sectionSubtitle).toContain("실제 프로그램 DB")
    expect(demo.showProgramCards).toBe(true)
    expect(demo.notice).toContain("Demo Catalog")
    expect(unavailable.showProgramCards).toBe(false)
    expect(unavailable.unavailableTitle).toBe("프로그램 정보를 불러오지 못했습니다")
    expect(unavailable.unavailableGuidance).toContain("다시")
  })

  it("builds distinct city groups, keeps matching programs, and aggregates city cost bounds", () => {
    const comparisons = buildCityComparisons({
      ...result,
      destinationRecommendations: [destination("Cebu"), destination("Cebu"), destination("Chiang Mai")],
      programCandidates: [
        candidate("cebu-1", "Cebu", tripCost(7_800_000, 9_000_000, "estimated", "medium")),
        candidate("cebu-2", "Cebu", tripCost(8_500_000, 11_200_000, "inquiry", "low")),
        candidate("chiang-1", "Chiang Mai", tripCost(6_500_000, 8_000_000, "partial", "medium")),
        candidate("other", "Singapore", tripCost(9_000_000, 10_000_000, "exact", "high")),
      ],
    })

    expect(comparisons.map((item) => item.city.cityName)).toEqual(["Cebu", "Chiang Mai"])
    expect(comparisons[0]?.programs.map((item) => item.programId)).toEqual(["cebu-1", "cebu-2"])
    expect(comparisons[0]?.programs.every((item) => item.cityName === comparisons[0]?.city.cityName)).toBe(true)
    expect(comparisons[0]?.tripCost).toMatchObject({ totalLow: 7_800_000, totalHigh: 11_200_000, priceStatus: "inquiry", confidence: "low" })
    expect(comparisons[1]?.programs.map((item) => item.programId)).toEqual(["chiang-1"])
  })
})

const basicInfo: CampfitV3BasicInfo = {
  childAges: [8],
  departureWindow: "다음 여름방학",
  durationWeeks: 2,
  budgetMinKrw: 5_000_000,
  budgetMaxKrw: 8_000_000,
  adultCount: 1,
  childCount: 1,
  guardianStaysNearby: true,
}

const state: CampfitV3ConversationState = {
  facts: {
    childEnglishLevel: fact("childEnglishLevel", "beginner"),
    specialCareFollowUp: fact("specialCareFollowUp", "none"),
    koreanSupportNeed: fact("koreanSupportNeed", "emergency_only"),
    parentStayGoals: fact("parentStayGoals", ["restWellness"]),
  },
  askedQuestionKeys: [],
  completedQuestionKeys: [],
  failedQuestionKeys: [],
  currentQuestionKey: null,
  questionCount: 8,
  progress: 100,
  unresolved: [],
  conflicts: [],
}

const result: CampfitV3RecommendationResult = {
  consultingConclusion: "문화·활동 경험을 중심으로 살펴보세요.",
  experienceDirections: [
    { key: "cultureActivity", label: "문화·활동 경험", fitLabel: "가장 잘 맞는 방향", score: 98, explanation: "설명" },
    { key: "englishIntensive", label: "영어 집중 경험", fitLabel: "함께 검토할 방향", score: 67, explanation: "설명" },
    { key: "schoolSchooling", label: "학교·스쿨링 경험", fitLabel: "조건을 조정하면 가능", score: 48, explanation: "설명" },
    { key: "subjectProject", label: "주제·프로젝트 경험", fitLabel: "현재 우선순위가 낮음", score: 35, explanation: "설명" },
  ],
  destinationRecommendations: [],
  requiredSupportConditions: [],
  programCandidates: [],
  verificationChecklist: [],
  alternatives: [],
  limitedResult: false,
  catalogSource: "supabase",
}

function fact(key: keyof CampfitV3ConversationState["facts"], value: unknown) {
  return { key, subject: "constraint" as const, value, source: "quick_reply" as const, confidence: 1, evidence: "테스트", updatedAt: "2026-07-13T00:00:00.000Z" }
}

function destination(cityName: string): CampfitV3RecommendationResult["destinationRecommendations"][number] {
  return {
    cityId: cityName,
    cityName,
    countryName: cityName === "Cebu" ? "Philippines" : cityName === "Chiang Mai" ? "Thailand" : "Singapore",
    role: "가장 균형 잡힌 선택",
    imageUrl: null,
    reason: "테스트 도시",
    verify: [],
    costEstimate: { estimatedTotalMinKrw: null, estimatedTotalMaxKrw: null, includedComponents: [], missingComponents: [], confidence: "low", label: "비교용 추정" },
  }
}

function candidate(programId: string, cityName: string, tripCost: CampfitV3TripCost): CampfitV3RecommendationResult["programCandidates"][number] {
  return {
    programId,
    name: programId,
    cityName,
    countryName: destination(cityName).countryName,
    imageUrl: null,
    ageLabel: "만 8세",
    durationLabel: "3주",
    priceLabel: "확인 필요",
    primaryDirection: "주제·프로젝트 경험",
    reason: "테스트 프로그램",
    verify: [],
    detailUrl: null,
    group: "우선 살펴볼 프로그램",
    score: 80,
    tripCost,
  }
}

function tripCost(totalLow: number, totalHigh: number, priceStatus: CampfitV3TripCost["priceStatus"], confidence: CampfitV3TripCost["confidence"]): CampfitV3TripCost {
  const line = { low: 1, high: 1, status: "exact" as const, selectedVariant: null, travelerCount: 2, includedItems: [], notes: [], sourceAmounts: [] }
  return {
    currency: "KRW",
    totalLow,
    totalHigh,
    confidence,
    priceStatus,
    calculatedAt: "2026-07-19T00:00:00.000Z",
    assumptions: [],
    unresolvedItems: priceStatus === "inquiry" ? ["확인 필요: 일부 비용"] : [],
    breakdown: { program: line, accommodation: line, flights: line, living: line, localTransport: line, other: { ...line, items: [] } },
  }
}
