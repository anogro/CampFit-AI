import { describe, expect, it } from "vitest"
import type { V3Catalog, V3CatalogCity, V3CatalogProgram } from "@/lib/campfit/v3/catalogRepository"
import { inferDirectionSignals } from "@/lib/campfit/v3/catalogPolicy"
import { buildRecommendation, scoreExperienceDirections } from "@/lib/campfit/v3/recommendationEngine"
import { createFact, createInitialConversationState, mergeFacts } from "@/lib/campfit/v3/stateEngine"
import type { CampfitV3BasicInfo, CampfitV3ConversationState, ExperienceDirectionKey } from "@/types/campfitV3"

const now = new Date("2026-07-13T00:00:00.000Z")
const basicInfo: CampfitV3BasicInfo = {
  childAges: [8],
  departureWindow: "2026-07-20 ~ 2026-07-31",
  durationWeeks: 2,
  budgetMinKrw: 5_000_000,
  budgetMaxKrw: 8_000_000,
  adultCount: 1,
  childCount: 1,
  guardianStaysNearby: true,
}

describe("CampFit v3 recommendation engine", () => {
  it("scenario A selects a production-shaped Cebu culture program with DB provenance", () => {
    const result = recommend("cultureActivity", productionCatalog([
      program({ id: "culture-cebu", city: "Cebu", country: "Philippines", direction: "cultureActivity" }),
    ]), { childEnglishLevel: "beginner", parentStayGoals: ["restWellness", "cafeDining"] })

    expect(result.catalogSource).toBe("supabase")
    expect(result.experienceDirections[0]?.key).toBe("cultureActivity")
    expect(result.destinationRecommendations[0]?.cityName).toBe("Cebu")
    expect(result.programCandidates[0]).toMatchObject({ programId: "culture-cebu", primaryDirection: "문화·활동 경험" })
    expect(result.programCandidates[0]?.reason).toContain("실제 DB 후보")
  })

  it("scenario B selects the structured schooling program instead of a generic ESL program", () => {
    const result = recommend("schoolSchooling", productionCatalog([
      program({ id: "school-singapore", city: "Singapore", country: "Singapore", direction: "schoolSchooling", price: 7_000_000 }),
      program({ id: "generic-esl", city: "Cebu", country: "Philippines", direction: "englishIntensive" }),
    ]), { childEnglishLevel: "intermediate", parentStayGoals: ["childScheduleFirst"] }, { budgetMaxKrw: 15_000_000 })

    expect(result.experienceDirections[0]?.key).toBe("schoolSchooling")
    expect(result.programCandidates.map((item) => item.programId)).toEqual(["school-singapore"])
    expect(result.destinationRecommendations[0]?.cityName).toBe("Singapore")
  })

  it("scenario C returns no program rather than an unrelated English filler when active STEM evidence is absent", () => {
    const filler = program({ id: "english-only", city: "Cebu", country: "Philippines", direction: "englishIntensive" })
    const result = recommend("subjectProject", productionCatalog([filler]), { childEnglishLevel: "basic", parentStayGoals: ["remoteWork"] })

    expect(result.experienceDirections[0]?.key).toBe("subjectProject")
    expect(result.programCandidates).toEqual([])
    expect(result.destinationRecommendations).toEqual([])
    expect(result.alternatives.join(" ")).toContain("조건을 통과한 후보가 적습니다")
  })

  it("keeps a parent-compatible four-week program when 창의활동 supplies the requested project direction", () => {
    const directionSignals = inferDirectionSignals({
      profileProgramType: "managed_immersion",
      traits: [" 창의 활동 "],
      structuredText: "방학캠프 영어몰입형",
    })
    const candidate = program({
      id: "creative-family-four-week",
      direction: "subjectProject",
      programType: "managed_immersion",
      traits: [" 창의 활동 "],
      directionSignals,
      sessionWindows: [session("2026-08-03", "2026-08-30", 4)],
      priceOptions: [{ adultCount: 1, childCount: 1, durationWeeks: 4, currency: "KRW", priceValue: 10_000_000, status: "active" }],
      durationWeeks: [4],
    })
    const result = buildRecommendation({
      basicInfo: {
        ...basicInfo,
        childAges: [7],
        departureWindow: "2026년 8월",
        durationWeeks: 4,
        budgetMinKrw: 8_000_000,
        budgetMaxKrw: 12_000_000,
      },
      state: stateFor("subjectProject", { parentStayGoals: ["restWellness"] }),
      catalog: productionCatalog([candidate]),
      now: new Date("2026-07-18T00:00:00.000Z"),
    })

    expect(directionSignals.subjectProject).toBe(90)
    expect(result.programCandidates.map((item) => item.programId)).toContain("creative-family-four-week")
    expect(result.destinationRecommendations.map((item) => item.cityName)).toContain("Cebu")
  })

  it("keeps special-care follow-up out of direction scores", () => {
    const none = scoreExperienceDirections(stateFor("cultureActivity", { specialCareFollowUp: "none" })).map(({ key, score }) => [key, score])
    const required = scoreExperienceDirections(stateFor("cultureActivity", { specialCareFollowUp: "required" })).map(({ key, score }) => [key, score])
    expect(required).toEqual(none)
  })

  it("keeps unknown special-care support in the conditional group", () => {
    const result = recommend("cultureActivity", productionCatalog([program({ direction: "cultureActivity", specialCareSupport: "unknown" })]), { specialCareFollowUp: "required" })
    expect(result.programCandidates[0]?.group).toBe("조건 확인 후 살펴볼 프로그램")
    expect(result.requiredSupportConditions).toContain("특별 식사 대응 확인")
  })

  it("excludes explicit child residential and homestay programs", () => {
    const residential = program({
      id: "boarding-family-name",
      direction: "cultureActivity",
      parentScope: { participationMode: "child_only_allowed", stayMode: "child_residential", guardianNearbyCompatible: false },
    })
    const result = recommend("cultureActivity", productionCatalog([residential]))
    expect(result.programCandidates).toEqual([])
  })

  it("matches departure and duration on the same scheduled non-past session", () => {
    const splitMatch = program({
      direction: "cultureActivity",
      sessionWindows: [
        session("2026-07-20", "2026-07-26", 1),
        session("2026-09-01", "2026-09-14", 2),
      ],
    })
    const result = recommend("cultureActivity", productionCatalog([splitMatch]))
    expect(result.programCandidates).toEqual([])
  })

  it("excludes inquiry-only and all-past session inventory", () => {
    const inquiry = program({
      id: "inquiry",
      direction: "cultureActivity",
      hasSessionRows: true,
      hasScheduledSessionRows: false,
      sessionWindows: [{ ...session("2026-07-20", "2026-08-02", 2), status: "inquiry" }],
    })
    const past = program({ id: "past", direction: "cultureActivity", sessionWindows: [session("2026-06-01", "2026-06-14", 2)] })
    const result = recommend("cultureActivity", productionCatalog([inquiry, past]))
    expect(result.programCandidates).toEqual([])
  })

  it("treats price-only duration as conditional rather than confirmed session availability", () => {
    const priceOnly = program({
      id: "price-only",
      direction: "cultureActivity",
      hasSessionRows: false,
      hasScheduledSessionRows: false,
      sessionWindows: [],
    })
    const result = recommend("cultureActivity", productionCatalog([priceOnly]))
    expect(result.programCandidates[0]?.group).toBe("조건 확인 후 살펴볼 프로그램")
    expect(result.programCandidates[0]?.verify.join(" ")).toContain("scheduled 세션")
  })

  it("does not substitute another family composition when selecting a price", () => {
    const mismatched = program({
      id: "wrong-family-price",
      direction: "cultureActivity",
      budgetMinKrw: null,
      budgetMaxKrw: null,
      priceOptions: [{ adultCount: 2, childCount: 1, durationWeeks: 2, currency: "KRW", priceValue: 4_000_000, status: "active" }],
    })
    const result = recommend("cultureActivity", productionCatalog([mismatched]))
    expect(result.programCandidates[0]?.priceLabel).toBe("가격 확인 필요")
    expect(result.programCandidates[0]?.verify).toContain("가족 구성·기간에 맞는 프로그램 가격")
  })

  it("prices only camp participants when younger traveling children are also present", () => {
    const result = recommend(
      "cultureActivity",
      productionCatalog([program({
        direction: "cultureActivity",
        priceOptions: [{ adultCount: 1, childCount: 1, durationWeeks: 2, currency: "KRW", priceValue: 4_000_000, status: "active" }],
      })]),
      {},
      { childAges: [8], childCount: 2 },
    )

    expect(result.programCandidates[0]?.priceLabel).not.toBe("가격 확인 필요")
  })

  it("uses only an exact active family price for the budget hard filter", () => {
    const exactTooHigh = program({ id: "too-high", direction: "cultureActivity", price: 9_000_000 })
    const referenceTooHigh = program({
      id: "reference-only",
      direction: "cultureActivity",
      budgetMinKrw: 9_000_000,
      budgetMaxKrw: null,
      priceOptions: [],
    })
    const result = recommend("cultureActivity", productionCatalog([exactTooHigh, referenceTooHigh]))
    expect(result.programCandidates.map((item) => item.programId)).toEqual(["reference-only"])
    expect(result.programCandidates[0]?.group).toBe("조건 확인 후 살펴볼 프로그램")
  })

  it("does not invent a total maximum when only a program minimum is known", () => {
    const referenceOnly = program({
      id: "reference-only",
      direction: "cultureActivity",
      budgetMinKrw: 3_000_000,
      budgetMaxKrw: null,
      priceOptions: [],
    })
    const result = recommend("cultureActivity", productionCatalog([referenceOnly]))
    expect(result.destinationRecommendations[0]?.costEstimate.estimatedTotalMinKrw).not.toBeNull()
    expect(result.destinationRecommendations[0]?.costEstimate.estimatedTotalMaxKrw).toBeNull()
    expect(result.destinationRecommendations[0]?.costEstimate.missingComponents).toContain("프로그램비 최대값")
  })

  it("keeps an unknown age as a verification item instead of inventing a range", () => {
    const unknownAge = program({ id: "unknown-age", direction: "cultureActivity", ageMin: null, ageMax: null, ageSource: "unknown" })
    const result = recommend("cultureActivity", productionCatalog([unknownAge]))
    expect(result.programCandidates[0]?.ageLabel).toBe("연령 확인 필요")
    expect(result.programCandidates[0]?.group).toBe("조건 확인 후 살펴볼 프로그램")
  })

  it("returns an honest unavailable result without static recommendations", () => {
    const result = recommend("cultureActivity", { programs: [], cities: [], source: "unavailable", warnings: ["DB read failed"] })
    expect(result.catalogSource).toBe("unavailable")
    expect(result.programCandidates).toEqual([])
    expect(result.verificationChecklist).toContain("DB read failed")
  })


  it("does not render program cards when their public city rows are unavailable", () => {
    const catalog: V3Catalog = { programs: [program({ direction: "cultureActivity" })], cities: [], source: "supabase", warnings: ["도시 카탈로그 없음"] }
    const result = recommend("cultureActivity", catalog)
    expect(result.destinationRecommendations).toEqual([])
    expect(result.programCandidates).toEqual([])
    expect(result.verificationChecklist).toContain("도시 카탈로그 없음")
  })
})

function recommend(
  primary: ExperienceDirectionKey,
  catalog: V3Catalog,
  overrides: Record<string, unknown> = {},
  infoOverrides: Partial<CampfitV3BasicInfo> = {},
) {
  return buildRecommendation({ basicInfo: { ...basicInfo, ...infoOverrides }, state: stateFor(primary, overrides), catalog, now })
}

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
  return mergeFacts(createInitialConversationState(), Object.entries(values).map(([key, value]) => createFact({
    key: key as keyof CampfitV3ConversationState["facts"],
    subject: "preference",
    value,
    source: "quick_reply",
    evidence: "테스트",
  })))
}

function goalValues(primary: ExperienceDirectionKey) {
  return {
    schoolSchooling: primary === "schoolSchooling" ? "primary" : "none",
    englishIntensive: primary === "englishIntensive" ? "primary" : "none",
    subjectProject: primary === "subjectProject" ? "primary" : "none",
    cultureActivity: primary === "cultureActivity" ? "primary" : "none",
  }
}

function productionCatalog(programs: readonly V3CatalogProgram[]): V3Catalog {
  const uniqueCities = new Map<string, V3CatalogCity>()
  for (const item of programs) uniqueCities.set(`${item.country}|${item.city}`, city(item.city, item.country, region(item.country)))
  return { programs, cities: [...uniqueCities.values()], source: "supabase", warnings: [] }
}

function city(
  name: string,
  country: string,
  regionGroup: V3CatalogCity["regionGroup"],
  catalogSource: V3CatalogCity["catalogSource"] = "supabase",
): V3CatalogCity {
  return {
    id: `${country}-${name}`.toLowerCase().replace(/\s+/g, "-"),
    slug: name.toLowerCase(),
    name,
    country,
    regionGroup,
    imageUrl: null,
    description: "도시 비교 데이터",
    parentStayEvidence: "cafe museum beach coworking wifi",
    flightCostKrw: 700_000,
    livingCostMonthlyKrw: 1_200_000,
    housingCostMonthlyKrw: 1_800_000,
    catalogSource,
  }
}

function region(country: string): V3CatalogCity["regionGroup"] {
  return country === "New Zealand" || country === "Australia" ? "oceania" : "southeast_asia"
}

function session(startDate: string, endDate: string, weeks: number) {
  return { startDate, endDate, weeks, status: "scheduled", source: "program_sessions", precision: "exact" } as const
}

function program(input: {
  readonly id?: string
  readonly city?: string
  readonly country?: string
  readonly direction: ExperienceDirectionKey
  readonly price?: number
  readonly ageMin?: number | null
  readonly ageMax?: number | null
  readonly ageSource?: V3CatalogProgram["ageSource"]
  readonly parentScope?: V3CatalogProgram["parentScope"]
  readonly specialCareSupport?: V3CatalogProgram["specialCareSupport"]
  readonly budgetMinKrw?: number | null
  readonly budgetMaxKrw?: number | null
  readonly priceOptions?: V3CatalogProgram["priceOptions"]
  readonly sessionWindows?: V3CatalogProgram["sessionWindows"]
  readonly durationWeeks?: readonly number[]
  readonly programType?: V3CatalogProgram["programType"]
  readonly traits?: readonly string[]
  readonly directionSignals?: V3CatalogProgram["directionSignals"]
  readonly hasSessionRows?: boolean
  readonly hasScheduledSessionRows?: boolean
  readonly catalogSource?: V3CatalogProgram["catalogSource"]
}): V3CatalogProgram {
  const price = input.price ?? 3_000_000
  const signal = (key: ExperienceDirectionKey) => key === input.direction ? 95 : key === "englishIntensive" ? 45 : 15
  return {
    id: input.id ?? `${input.direction}-program`,
    slug: input.id ?? `${input.direction}-program`,
    name: input.id ?? `${input.direction} verified program`,
    city: input.city ?? "Cebu",
    country: input.country ?? "Philippines",
    programType: input.programType ?? (input.direction === "schoolSchooling" ? "schooling" : input.direction === "subjectProject" ? "creative_daycamp" : input.direction === "cultureActivity" ? "activity" : "managed_immersion"),
    directionSignals: input.directionSignals ?? {
      schoolSchooling: signal("schoolSchooling"),
      englishIntensive: signal("englishIntensive"),
      subjectProject: signal("subjectProject"),
      cultureActivity: signal("cultureActivity"),
    },
    ageMin: input.ageMin === undefined ? 5 : input.ageMin,
    ageMax: input.ageMax === undefined ? 12 : input.ageMax,
    ageSource: input.ageSource ?? "program",
    durationWeeks: input.durationWeeks ?? [2],
    durationSource: "session_or_price",
    parentAccompanied: input.parentScope?.guardianNearbyCompatible === true || input.parentScope === undefined,
    parentScope: input.parentScope ?? { participationMode: "parent_required", stayMode: "day", guardianNearbyCompatible: true },
    koreanManager: true,
    koreanDailySupport: true,
    koreanEmergencySupport: true,
    emergencySupport: true,
    beginnerClass: true,
    earlyAdaptationSupport: true,
    dailyParentReport: true,
    traits: input.traits ?? [],
    specialCareSupport: input.specialCareSupport ?? "unknown",
    budgetMinKrw: input.budgetMinKrw === undefined ? price : input.budgetMinKrw,
    budgetMaxKrw: input.budgetMaxKrw === undefined ? price : input.budgetMaxKrw,
    priceOptions: input.priceOptions ?? [{ adultCount: 1, childCount: 1, durationWeeks: 2, currency: "KRW", priceValue: price, status: "active" }],
    sessionWindows: input.sessionWindows ?? [session("2026-07-20", "2026-08-02", 2)],
    hasSessionRows: input.hasSessionRows ?? true,
    hasScheduledSessionRows: input.hasScheduledSessionRows ?? true,
    sessionStatusNeedsConfirmation: false,
    imageUrl: null,
    status: "active",
    catalogSource: input.catalogSource ?? "supabase",
    updatedAt: "2026-07-01T00:00:00.000Z",
  }
}
