import { describe, expect, it } from "vitest"
import type { V3Catalog, V3CatalogProgram } from "@/lib/campfit/v3/catalogRepository"
import { buildRecommendation, scoreExperienceDirections } from "@/lib/campfit/v3/recommendationEngine"
import { createFact, createInitialConversationState, mergeFacts } from "@/lib/campfit/v3/stateEngine"
import type { CampfitV3BasicInfo, CampfitV3ConversationState, ExperienceDirectionKey } from "@/types/campfitV3"

const basicInfo: CampfitV3BasicInfo = {
  childAges: [8], departureWindow: "여름방학", durationWeeks: 2,
  budgetMinKrw: 5_000_000, budgetMaxKrw: 8_000_000,
  adultCount: 1, childCount: 1, guardianStaysNearby: true,
}

describe("CampFit v3 recommendation engine", () => {
  it("ranks the explicit culture goal first for scenario A", () => {
    const result = buildRecommendation({ basicInfo, state: stateFor("cultureActivity", { childEnglishLevel: "beginner", parentStayGoals: ["restWellness", "cafeDining"] }), catalog })
    expect(result.experienceDirections[0]?.key).toBe("cultureActivity")
    expect(result.programCandidates[0]?.programId).toBe("culture-cebu")
    expect(result.destinationRecommendations[0]?.cityName).toBe("Cebu")
  })

  it("ranks schooling first for scenario B", () => {
    const result = buildRecommendation({ basicInfo: { ...basicInfo, budgetMaxKrw: 15_000_000 }, state: stateFor("schoolSchooling", { childEnglishLevel: "intermediate", parentStayGoals: ["childScheduleFirst"] }), catalog })
    expect(result.experienceDirections[0]?.key).toBe("schoolSchooling")
    expect(result.programCandidates[0]?.programId).toBe("school-singapore")
    expect(result.destinationRecommendations[0]?.cityName).toBe("Singapore")
  })

  it("ranks project experience first for scenario C", () => {
    const result = buildRecommendation({ basicInfo, state: stateFor("subjectProject", { childEnglishLevel: "basic", parentStayGoals: ["remoteWork"] }), catalog })
    expect(result.experienceDirections[0]?.key).toBe("subjectProject")
    expect(result.programCandidates[0]?.programId).toBe("stem-auckland")
    expect(result.destinationRecommendations[0]?.cityName).toBe("Auckland")
  })

  it("keeps special-care follow-up out of experience direction scores", () => {
    const none = scoreExperienceDirections(stateFor("cultureActivity", { specialCareFollowUp: "none" })).map(({ key, score }) => [key, score])
    const required = scoreExperienceDirections(stateFor("cultureActivity", { specialCareFollowUp: "required" })).map(({ key, score }) => [key, score])
    expect(required).toEqual(none)
  })

  it("moves unknown special-care support to the conditional group", () => {
    const result = buildRecommendation({ basicInfo, state: stateFor("cultureActivity", { specialCareFollowUp: "required" }), catalog })
    expect(result.programCandidates[0]?.group).toBe("조건 확인 후 살펴볼 프로그램")
    expect(result.requiredSupportConditions).toContain("특별 식사 대응 확인")
  })

  it("filters out programs that are not parent-accompanied", () => {
    const withBoarding: V3Catalog = { ...catalog, programs: [...catalog.programs, { ...catalog.programs[0]!, id: "boarding", name: "Boarding", parentAccompanied: false }] }
    const result = buildRecommendation({ basicInfo, state: stateFor("schoolSchooling"), catalog: withBoarding })
    expect(result.programCandidates.map((item) => item.programId)).not.toContain("boarding")
  })

  it("filters programs outside the child age range", () => {
    const result = buildRecommendation({ basicInfo: { ...basicInfo, childAges: [12] }, state: stateFor("cultureActivity"), catalog })
    expect(result.programCandidates.map((item) => item.programId)).not.toContain("culture-cebu")
  })

  it("filters programs without the requested duration", () => {
    const result = buildRecommendation({ basicInfo: { ...basicInfo, durationWeeks: 4 }, state: stateFor("cultureActivity"), catalog })
    expect(result.programCandidates).toHaveLength(0)
  })

  it("excludes a program explicitly unable to provide required daily Korean support", () => {
    const noKorean: V3Catalog = { ...catalog, programs: catalog.programs.map((program) => program.id === "culture-cebu" ? { ...program, koreanManager: false } : program) }
    const result = buildRecommendation({ basicInfo, state: stateFor("cultureActivity", { koreanSupportNeed: "must_daily" }), catalog: noKorean })
    expect(result.programCandidates.map((item) => item.programId)).not.toContain("culture-cebu")
  })

  it("does not represent a missing program price as zero", () => {
    const noPrice: V3Catalog = { ...catalog, programs: catalog.programs.map((program) => program.id === "culture-cebu" ? { ...program, priceOptions: [{ adultCount: 1, childCount: 1, durationWeeks: 2, currency: "KRW", priceValue: 0 }], budgetMinKrw: 0, budgetMaxKrw: 0 } : program) }
    const result = buildRecommendation({ basicInfo, state: stateFor("cultureActivity"), catalog: noPrice })
    expect(result.programCandidates.find((item) => item.programId === "culture-cebu")?.priceLabel).toBe("가격 확인 필요")
  })

  it("returns distinct cities with different recommendation roles", () => {
    const result = buildRecommendation({ basicInfo, state: stateFor("cultureActivity"), catalog })
    expect(new Set(result.destinationRecommendations.map((item) => item.cityId)).size).toBe(result.destinationRecommendations.length)
    expect(new Set(result.destinationRecommendations.map((item) => item.role)).size).toBe(result.destinationRecommendations.length)
  })

  it("uses a must-region preference as a city hard filter", () => {
    const result = buildRecommendation({ basicInfo, state: stateFor("subjectProject", { preferredRegions: ["oceania"], regionImportance: "must" }), catalog })
    expect(result.destinationRecommendations.map((item) => item.cityName)).toEqual(["Auckland"])
  })

  it("prorates monthly housing and living costs for the stay", () => {
    const result = buildRecommendation({ basicInfo, state: stateFor("cultureActivity", { preferredRegions: ["southeast_asia"], regionImportance: "must" }), catalog })
    const cebu = result.destinationRecommendations.find((item) => item.cityName === "Cebu")
    expect(cebu?.costEstimate.includedComponents).toContain("주거비 참고값")
    expect(cebu?.costEstimate.includedComponents).toContain("생활비 참고값")
    expect(cebu?.costEstimate.label).toBe("비교용 추정")
  })

  it("keeps family airfare as a missing component because airfare metadata is incomplete", () => {
    const result = buildRecommendation({ basicInfo, state: stateFor("cultureActivity"), catalog })
    expect(result.destinationRecommendations[0]?.costEstimate.missingComponents).toContain("가족 항공권 실제 견적")
  })

  it("keeps candidates when cost components are incomplete", () => {
    const noCosts: V3Catalog = { programs: catalog.programs, cities: catalog.cities.map((city) => ({ ...city, flightCostKrw: null, livingCostMonthlyKrw: null, housingCostMonthlyKrw: null })) }
    const result = buildRecommendation({ basicInfo, state: stateFor("cultureActivity"), catalog: noCosts })
    expect(result.programCandidates.length).toBeGreaterThan(0)
    expect(result.destinationRecommendations[0]?.costEstimate.confidence).toBe("low")
  })

  it("does not invent programs when the catalog is empty", () => {
    const result = buildRecommendation({ basicInfo, state: stateFor("cultureActivity"), catalog: { programs: [], cities: catalog.cities } })
    expect(result.programCandidates).toEqual([])
    expect(result.destinationRecommendations).toEqual([])
    expect(result.limitedResult).toBe(true)
  })
})

function stateFor(primary: ExperienceDirectionKey, overrides: Record<string, unknown> = {}): CampfitV3ConversationState {
  const values: Record<string, unknown> = {
    childEnglishLevel: "basic",
    experienceGoals: goalValues(primary),
    preferredRegions: [],
    regionImportance: "no_preference",
    koreanSupportNeed: "emergency_only",
    parentCommunicationNeed: "issue_only",
    parentStayGoals: ["childScheduleFirst"],
    specialCareFollowUp: "none",
    ...overrides,
  }
  return mergeFacts(createInitialConversationState(), Object.entries(values).map(([key, value]) => createFact({ key: key as keyof CampfitV3ConversationState["facts"], subject: "preference", value, source: "quick_reply", evidence: "테스트" })))
}

function goalValues(primary: ExperienceDirectionKey) {
  return {
    schoolSchooling: primary === "schoolSchooling" ? "primary" : "none",
    englishIntensive: primary === "englishIntensive" ? "primary" : "none",
    subjectProject: primary === "subjectProject" ? "primary" : "none",
    cultureActivity: primary === "cultureActivity" ? "primary" : "none",
  }
}

const programs: readonly V3CatalogProgram[] = [
  program("school-singapore", "Singapore School Experience", "Singapore", "Singapore", "schooling", 9_000_000),
  { ...program("culture-cebu", "Cebu Culture Day Camp", "Cebu", "Philippines", "activity", 3_000_000), ageMax: 11 },
  program("stem-auckland", "Auckland STEM Project", "Auckland", "New Zealand", "creative_daycamp", 6_000_000),
]

const catalog: V3Catalog = {
  programs,
  cities: [
    { id: "singapore", slug: "singapore", name: "Singapore", country: "Singapore", regionGroup: "southeast_asia", imageUrl: null, description: "도시 데이터", flightCostKrw: 900_000, livingCostMonthlyKrw: 2_100_000, housingCostMonthlyKrw: 3_800_000 },
    { id: "cebu", slug: "cebu", name: "Cebu", country: "Philippines", regionGroup: "southeast_asia", imageUrl: null, description: "도시 데이터", flightCostKrw: 500_000, livingCostMonthlyKrw: 900_000, housingCostMonthlyKrw: 1_100_000 },
    { id: "auckland", slug: "auckland", name: "Auckland", country: "New Zealand", regionGroup: "oceania", imageUrl: null, description: "도시 데이터", flightCostKrw: 1_500_000, livingCostMonthlyKrw: 1_800_000, housingCostMonthlyKrw: 2_600_000 },
  ],
}

function program(id: string, name: string, city: string, country: string, programType: V3CatalogProgram["programType"], price: number): V3CatalogProgram {
  return {
    id, slug: id, name, city, country, programType,
    ageMin: 5, ageMax: 12, durationWeeks: [1, 2, 3], parentAccompanied: true,
    koreanManager: true, beginnerClass: true, dailyParentReport: true, traits: [],
    budgetMinKrw: price, budgetMaxKrw: price,
    priceOptions: [{ adultCount: 1, childCount: 1, durationWeeks: 2, currency: "KRW", priceValue: price }],
    imageUrl: null,
  }
}
