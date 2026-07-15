import { describe, expect, it } from "vitest"
import { loadDemoCatalog } from "@/lib/campfit/v3/demoCatalog"
import { buildRecommendation } from "@/lib/campfit/v3/recommendationEngine"
import { createFact, createInitialConversationState, mergeFacts } from "@/lib/campfit/v3/stateEngine"
import type { CampfitV3BasicInfo, CampfitV3ConversationState, ExperienceDirectionKey } from "@/types/campfitV3"

const catalog = loadDemoCatalog(2026)

describe("CampFit v3 explicit demo recommendation catalog", () => {
  it("loads only the synthetic source and keeps demo programs non-bookable", () => {
    expect(catalog.source).toBe("demo")
    expect(catalog.programs).toHaveLength(18)
    expect(catalog.cities).toHaveLength(6)
    expect(catalog.programs.every((program) => program.catalogSource === "demo" && program.demoProfile?.isBookable === false)).toBe(true)
    expect(catalog.programs.every((program) => program.slug === null)).toBe(true)
  })

  it.each([
    { label: "A", age: 8, departureWindow: "2026년 8월", durationWeeks: 2, direction: "cultureActivity" as const, english: "beginner", expected: ["cultureActivity"] },
    { label: "B", age: 10, departureWindow: "2026년 8월", durationWeeks: 3, direction: "schoolSchooling" as const, english: "intermediate", expected: ["schoolSchooling"] },
    { label: "C", age: 9, departureWindow: "2026년 8월", durationWeeks: 3, direction: "subjectProject" as const, english: "basic", expected: ["subjectProject"] },
  ])("returns $label direction candidates without child-only programs", ({ age, departureWindow, durationWeeks, direction, english, expected }) => {
    const result = buildRecommendation({
      basicInfo: basicInfo({ childAges: [age], departureWindow, durationWeeks }),
      state: stateFor(direction, { childEnglishLevel: english }),
      catalog,
      now: new Date("2026-07-15T00:00:00.000Z"),
    })
    expect(result.catalogSource).toBe("demo")
    expect(result.experienceDirections[0]?.key).toBe(expected[0])
    expect(result.programCandidates.length).toBeGreaterThan(0)
    expect(result.programCandidates.every((program) => program.name.includes("시연용"))).toBe(true)
    expect(result.programCandidates.every((program) => program.detailUrl === null)).toBe(true)
    expect(result.programCandidates.some((program) => program.group === "우선 살펴볼 프로그램")).toBe(true)
    expect(result.consultingConclusion).toContain("시연용")
  })

  it("keeps a special-care flag as verification instead of changing direction ranking", () => {
    const none = buildRecommendation({
      basicInfo: basicInfo({ childAges: [8], departureWindow: "2026년 8월", durationWeeks: 2 }),
      state: stateFor("cultureActivity", { specialCareFollowUp: "none" }),
      catalog,
      now: new Date("2026-07-15T00:00:00.000Z"),
    })
    const required = buildRecommendation({
      basicInfo: basicInfo({ childAges: [8], departureWindow: "2026년 8월", durationWeeks: 2 }),
      state: stateFor("cultureActivity", { specialCareFollowUp: "required" }),
      catalog,
      now: new Date("2026-07-15T00:00:00.000Z"),
    })
    expect(required.experienceDirections.map(({ key, score }) => [key, score])).toEqual(none.experienceDirections.map(({ key, score }) => [key, score]))
    expect(required.verificationChecklist.join(" ")).toContain("특별 식사 대응 확인")
  })
})

function basicInfo(overrides: Partial<CampfitV3BasicInfo>): CampfitV3BasicInfo {
  const childAges = overrides.childAges ?? [8]
  return {
    childAges,
    departureWindow: "2026년 8월",
    durationWeeks: 2,
    budgetMinKrw: 2_000_000,
    budgetMaxKrw: 8_000_000,
    adultCount: 1,
    childCount: 1,
    guardianStaysNearby: true,
    ...overrides,
  }
}

function stateFor(primary: ExperienceDirectionKey, overrides: Record<string, unknown> = {}): CampfitV3ConversationState {
  const values: Record<string, unknown> = {
    childEnglishLevel: "basic",
    experienceGoals: {
      schoolSchooling: primary === "schoolSchooling" ? "primary" : "none",
      englishIntensive: primary === "englishIntensive" ? "primary" : "none",
      subjectProject: primary === "subjectProject" ? "primary" : "none",
      cultureActivity: primary === "cultureActivity" ? "primary" : "none",
    },
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
    evidence: "시연용 테스트 입력",
  })))
}
