import { describe, expect, it } from "vitest"
import { demoCostEstimateForCity } from "@/data/campfit/v3/demoCostEstimates"
import { loadDemoCatalog } from "@/lib/campfit/v3/demoCatalog"
import { attachTripCosts } from "@/lib/campfit/v3/cost/attachTripCosts"
import { calculateTotalTripCost } from "@/lib/campfit/v3/cost/calculateTotalTripCost"
import type { V3CatalogCity, V3CatalogProgram } from "@/lib/campfit/v3/catalogRepository"
import type { CampfitV3BasicInfo, CampfitV3RecommendationResult } from "@/types/campfitV3"

const catalog = loadDemoCatalog(2026)
const calculatedAt = "2026-07-19T00:00:00.000Z"

describe("CampFit v3 family trip cost calculation", () => {
  it("calculates one adult and one child for a three-week stay", () => {
    const cost = calculateFor("demo-cebu-family-esl", { adultCount: 1, childCount: 1, durationWeeks: 3 })
    expect(cost.breakdown.program.travelerCount).toBe(2)
    expect(cost.breakdown.flights.travelerCount).toBe(2)
    expect(cost.breakdown.living.travelerCount).toBe(2)
    expect(cost.totalLow).toBeGreaterThan(0)
    expect(cost.totalHigh).toBeGreaterThanOrEqual(cost.totalLow ?? 0)
  })

  it("includes two adults and one child in all travel components", () => {
    const cost = calculateFor("demo-cebu-family-esl", { adultCount: 2, childCount: 1, durationWeeks: 4 })
    expect(cost.breakdown.flights.travelerCount).toBe(3)
    expect(cost.breakdown.living.travelerCount).toBe(3)
    expect(cost.breakdown.localTransport.travelerCount).toBe(3)
  })

  it("includes two adults and two children in non-program travel costs", () => {
    const cost = calculateFor("demo-cebu-family-esl", { adultCount: 2, childCount: 2, durationWeeks: 4 })
    expect(cost.breakdown.flights.travelerCount).toBe(4)
    expect(cost.breakdown.program.travelerCount).toBe(3)
    expect(cost.breakdown.program.notes.join(" ")).toContain("추가 아동 1명")
  })

  it("does not select a room that cannot hold the family", () => {
    const cost = calculateFor("demo-singapore-stem-maker", { adultCount: 2, childCount: 2, durationWeeks: 4 })
    expect(cost.breakdown.accommodation.status).toBe("inquiry")
    expect(cost.breakdown.program.status).toBe("partial")
    expect(cost.unresolvedItems.join(" ")).toContain("가족 인원")
  })

  it("does not add accommodation again when the package includes it", () => {
    const cost = calculateFor("demo-cebu-family-esl", { adultCount: 1, childCount: 1, durationWeeks: 4 })
    expect(cost.breakdown.accommodation.status).toBe("included")
    expect(cost.breakdown.accommodation.low).toBe(0)
    expect(cost.breakdown.accommodation.high).toBe(0)
    expect(cost.breakdown.accommodation.sourceAmounts).toEqual([])
  })

  it("reduces living cost only for the explicitly declared meal plan", () => {
    const cost = calculateFor("demo-cebu-family-esl", { adultCount: 1, childCount: 1, durationWeeks: 4 })
    expect(cost.breakdown.living.notes.join(" ")).toContain("35% 감액")
    expect(cost.breakdown.living.includedItems.join(" ")).toContain("weekday_two_meals")
  })

  it("does not add airport transfer twice", () => {
    const cost = calculateFor("demo-cebu-family-esl", { adultCount: 1, childCount: 1, durationWeeks: 4 })
    expect(cost.breakdown.localTransport.notes.join(" ")).toContain("중복 합산하지 않았습니다")
    expect(cost.breakdown.localTransport.includedItems.join(" ")).toContain("공항 이동")
  })

  it("reduces local transport when the program includes a shuttle", () => {
    const cost = calculateFor("demo-singapore-stem-maker", { adultCount: 1, childCount: 1, durationWeeks: 4 })
    expect(cost.breakdown.localTransport.notes.join(" ")).toContain("셔틀 포함")
    expect(cost.breakdown.localTransport.includedItems.join(" ")).toContain("프로그램 셔틀 일부 포함")
  })

  it("uses an exact four-week price variant first", () => {
    const cost = calculateFor("demo-cebu-family-esl", { adultCount: 1, childCount: 1, durationWeeks: 4 })
    expect(cost.breakdown.program.status).toBe("exact")
    expect(cost.breakdown.program.notes.join(" ")).not.toContain("일치하는 가격이 없어")
  })

  it("marks reference prices as estimated", () => {
    const cost = calculateFor("demo-cm-school-break", { adultCount: 1, childCount: 1, durationWeeks: 4 })
    expect(cost.breakdown.program.status).toBe("estimated")
    expect(cost.breakdown.program.notes.join(" ")).toContain("참고값")
  })

  it("keeps inquiry prices as inquiry without inventing an amount", () => {
    const cost = calculateFor("demo-cebu-junior-residential", { adultCount: 1, childCount: 1, durationWeeks: 4 })
    expect(cost.breakdown.program.status).toBe("inquiry")
    expect(cost.breakdown.program.low).toBeNull()
    expect(cost.breakdown.program.high).toBeNull()
    expect(cost.breakdown.program.sourceAmounts).toEqual([])
  })

  it("does not invent a program fee for an additional child", () => {
    const cost = calculateFor("demo-cebu-family-esl", { adultCount: 1, childCount: 2, durationWeeks: 4 })
    expect(cost.breakdown.program.status).toBe("partial")
    expect(cost.breakdown.program.notes.join(" ")).toContain("추가 아동 1명의 프로그램비")
  })

  it("upgrades the accommodation variant to fit three children", () => {
    const cost = calculateFor("demo-cebu-family-esl", { adultCount: 1, childCount: 3, durationWeeks: 4 })
    expect(cost.breakdown.accommodation.selectedVariant).toBe("2BR")
    expect(cost.breakdown.program.selectedVariant).toBe("2BR")
  })

  it("uses the nearest duration as an estimated reference when exact duration is absent", () => {
    const cost = calculateFor("demo-cm-school-break", { adultCount: 1, childCount: 1, durationWeeks: 5 })
    expect(cost.breakdown.program.status).toBe("estimated")
    expect(cost.breakdown.program.notes.join(" ")).toContain("요청 5주와 일치하는 가격이 없어")
  })

  it("converts demo source amounts to KRW while retaining the original currency", () => {
    const cost = calculateFor("demo-cebu-family-esl", { adultCount: 1, childCount: 1, durationWeeks: 4 })
    const flightAmount = cost.breakdown.flights.sourceAmounts[0]
    expect(flightAmount?.currency).toBe("PHP")
    expect(flightAmount?.exchangeRateSource).toBe("demo estimate")
    expect(flightAmount?.lowKrw).toBeGreaterThan(flightAmount?.low ?? 0)
  })

  it("is deterministic when the calculation timestamp is fixed", () => {
    const input = { adultCount: 1, childCount: 1, durationWeeks: 4 }
    expect(calculateFor("demo-cebu-family-esl", input)).toEqual(calculateFor("demo-cebu-family-esl", input))
  })

  it("keeps unresolved insurance and administration costs visible", () => {
    const cost = calculateFor("demo-cebu-family-esl", { adultCount: 1, childCount: 1, durationWeeks: 4 })
    expect(cost.breakdown.other.status).toBe("inquiry")
    expect(cost.breakdown.other.items).toContain("보험·비자")
    expect(cost.unresolvedItems.join(" ")).toContain("보험·비자")
  })

  it("does not leak demo estimates into a production-shaped calculation", () => {
    const program = findProgram("demo-cebu-family-esl")
    const city = findCity(program.city)
    const cost = calculateTotalTripCost({ basicInfo: info({ adultCount: 1, childCount: 1, durationWeeks: 4 }), program, city, estimateProfile: null, calculatedAt })
    expect(cost.breakdown.flights.sourceAmounts[0]?.exchangeRateSource).toBe("catalog reference")
    expect(cost.breakdown.flights.sourceAmounts[0]?.currency).toBe("KRW")
    expect(cost.breakdown.localTransport.status).toBe("inquiry")
  })

  it("marks a production-shaped program without package inclusion data as unresolved", () => {
    const source = findProgram("demo-singapore-stem-maker")
    const { packageInclusions: _packageInclusions, demoProfile: _demoProfile, ...program } = source
    const city = findCity(program.city)
    const cost = calculateTotalTripCost({ basicInfo: info({ adultCount: 1, childCount: 1, durationWeeks: 4 }), program, city, estimateProfile: null, calculatedAt })
    expect(cost.breakdown.accommodation.status).toBe("inquiry")
    expect(cost.breakdown.living.status).toBe("partial")
    expect(cost.breakdown.localTransport.status).toBe("inquiry")
  })

  it("uses the existing Cities housing reference only when package exclusion is explicit", () => {
    const source = findProgram("demo-singapore-stem-maker")
    const { demoProfile: _demoProfile, ...withoutDemoProfile } = source
    const program = { ...withoutDemoProfile, packageInclusions: { ...source.packageInclusions!, accommodationIncluded: false } }
    const city = findCity(program.city)
    const cost = calculateTotalTripCost({ basicInfo: info({ adultCount: 1, childCount: 1, durationWeeks: 4 }), program, city, estimateProfile: null, calculatedAt })
    expect(cost.breakdown.accommodation.status).toBe("partial")
    expect(cost.breakdown.accommodation.sourceAmounts[0]?.exchangeRateSource).toBe("catalog reference")
    expect(cost.breakdown.accommodation.notes.join(" ")).toContain("Cities의 1BR 월 주거비")
  })

  it("preserves program and city ordering when costs are attached", () => {
    const result: CampfitV3RecommendationResult = {
      consultingConclusion: "테스트 결과",
      experienceDirections: [],
      destinationRecommendations: [destination("Cebu"), destination("Singapore")],
      requiredSupportConditions: [],
      programCandidates: [candidate("demo-cebu-family-esl", "Cebu"), candidate("demo-singapore-stem-maker", "Singapore")],
      verificationChecklist: [],
      alternatives: [],
      limitedResult: false,
      catalogSource: "demo",
    }
    const attached = attachTripCosts({ result, catalog, basicInfo: info({ adultCount: 1, childCount: 1, durationWeeks: 4 }), calculatedAt })
    expect(attached.programCandidates.map((item) => item.programId)).toEqual(result.programCandidates.map((item) => item.programId))
    expect(attached.destinationRecommendations.map((item) => item.cityName)).toEqual(result.destinationRecommendations.map((item) => item.cityName))
  })

  it("attaches a cost to a program and its recommended city", () => {
    const result: CampfitV3RecommendationResult = {
      consultingConclusion: "테스트 결과",
      experienceDirections: [],
      destinationRecommendations: [destination("Cebu")],
      requiredSupportConditions: [],
      programCandidates: [candidate("demo-cebu-family-esl", "Cebu")],
      verificationChecklist: [],
      alternatives: [],
      limitedResult: false,
      catalogSource: "demo",
    }
    const attached = attachTripCosts({ result, catalog, basicInfo: info({ adultCount: 1, childCount: 1, durationWeeks: 4 }), calculatedAt })
    expect(attached.programCandidates[0]?.tripCost?.currency).toBe("KRW")
    expect(attached.destinationRecommendations[0]?.tripCost?.breakdown.program.status).toBe("exact")
  })

  it("keeps total price status honest when any required component needs inquiry", () => {
    const cost = calculateFor("demo-cebu-family-esl", { adultCount: 1, childCount: 1, durationWeeks: 4 })
    expect(cost.priceStatus).toBe("inquiry")
    expect(cost.confidence).toBe("low")
  })

  it("reports known amounts as a lower and upper bound rather than a false exact total", () => {
    const cost = calculateFor("demo-cebu-family-esl", { adultCount: 1, childCount: 1, durationWeeks: 4 })
    expect(cost.totalLow).not.toBeNull()
    expect(cost.totalHigh).not.toBeNull()
    expect(cost.totalHigh).toBeGreaterThanOrEqual(cost.totalLow ?? 0)
    expect(cost.priceStatus).not.toBe("exact")
  })

  it("does not turn a completely unknown catalog into a zero-cost trip", () => {
    const source = findProgram("demo-cebu-junior-residential")
    const { packageInclusions: _packageInclusions, demoProfile: _demoProfile, ...base } = source
    const program: V3CatalogProgram = { ...base, priceOptions: [], budgetMinKrw: null, budgetMaxKrw: null }
    const sourceCity = findCity(program.city)
    const city: V3CatalogCity = { ...sourceCity, flightCostKrw: null, livingCostMonthlyKrw: null, housingCostMonthlyKrw: null }
    const cost = calculateTotalTripCost({ basicInfo: info(), program, city, estimateProfile: null, calculatedAt })
    expect(cost.totalLow).toBeNull()
    expect(cost.totalHigh).toBeNull()
  })
})

function calculateFor(programId: string, overrides: Partial<Pick<CampfitV3BasicInfo, "adultCount" | "childCount" | "durationWeeks">> = {}) {
  const program = findProgram(programId)
  return calculateTotalTripCost({
    basicInfo: info(overrides),
    program,
    city: findCity(program.city),
    estimateProfile: requireDemoEstimate(program.city),
    calculatedAt,
  })
}

function info(overrides: Partial<Pick<CampfitV3BasicInfo, "adultCount" | "childCount" | "durationWeeks">> = {}): CampfitV3BasicInfo {
  return {
    childAges: [7],
    departureWindow: "2026년 8월",
    durationWeeks: overrides.durationWeeks ?? 4,
    budgetMinKrw: 8_000_000,
    budgetMaxKrw: 12_000_000,
    adultCount: overrides.adultCount ?? 1,
    childCount: overrides.childCount ?? 1,
    guardianStaysNearby: true,
  }
}

function findProgram(programId: string): V3CatalogProgram {
  const program = catalog.programs.find((item) => item.id === programId)
  if (!program) throw new Error(`Missing demo program ${programId}`)
  return program
}

function findCity(cityName: string): V3CatalogCity {
  const city = catalog.cities.find((item) => item.name === cityName)
  if (!city) throw new Error(`Missing demo city ${cityName}`)
  return city
}

function requireDemoEstimate(cityName: string) {
  const profile = demoCostEstimateForCity(cityName)
  if (!profile) throw new Error(`Missing demo estimate city ${cityName}`)
  return profile
}

function destination(cityName: string): CampfitV3RecommendationResult["destinationRecommendations"][number] {
  const city = findCity(cityName)
  return {
    cityId: city.id,
    cityName: city.name,
    countryName: city.country,
    role: "가장 균형 잡힌 선택",
    imageUrl: null,
    reason: "테스트 도시",
    verify: [],
    costEstimate: { estimatedTotalMinKrw: null, estimatedTotalMaxKrw: null, includedComponents: [], missingComponents: [], confidence: "low", label: "비교용 추정" },
  }
}

function candidate(programId: string, cityName: string): CampfitV3RecommendationResult["programCandidates"][number] {
  const program = findProgram(programId)
  return {
    programId,
    name: program.name,
    cityName,
    countryName: program.country,
    imageUrl: null,
    ageLabel: "7~13세",
    durationLabel: "4주",
    priceLabel: "확인 필요",
    primaryDirection: "프로젝트",
    reason: "테스트 프로그램",
    verify: [],
    detailUrl: null,
    group: "우선 살펴볼 프로그램",
    score: 80,
  }
}
