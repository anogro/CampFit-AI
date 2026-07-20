import { describe, expect, it } from "vitest"
import { loadDemoCatalog } from "@/lib/campfit/v3/demoCatalog"
import { buildRecommendation } from "@/lib/campfit/v3/recommendationEngine"
import type { CampfitV3BasicInfo, CampfitV3ConversationState } from "@/types/campfitV3"

describe("CampFit v3 Demo Catalog recommendation coverage", () => {
  it("returns three real demo cities and programs for the representative family scenario", () => {
    const result = buildRecommendation({
      basicInfo: {
        childAges: [8],
        departureWindow: "2026년 8월",
        durationWeeks: 4,
        budgetMinKrw: 8_000_000,
        budgetMaxKrw: 12_000_000,
        adultCount: 1,
        childCount: 1,
        guardianStaysNearby: true,
      } satisfies CampfitV3BasicInfo,
      state: demoState,
      catalog: loadDemoCatalog(2026),
      now: new Date("2026-07-19T00:00:00.000Z"),
    })

    expect(result.catalogSource).toBe("demo")
    expect(result.destinationRecommendations).toHaveLength(3)
    expect(result.programCandidates).toHaveLength(3)
    expect(new Set(result.destinationRecommendations.map((city) => city.cityName)).size).toBe(3)
    expect(new Set(result.programCandidates.map((program) => program.programId)).size).toBe(result.programCandidates.length)
    expect(result.programCandidates.every((program, index, programs) => programs.findIndex((candidate) => candidate.programId === program.programId) === index)).toBe(true)
    expect(result.programCandidates[1]?.reason).not.toContain("점수")
  })
})

const demoState: CampfitV3ConversationState = {
  facts: {
    childEnglishLevel: fact("childEnglishLevel", "basic", "child"),
    experienceGoals: fact("experienceGoals", { subjectProject: "primary", cultureActivity: "secondary" }, "preference"),
    preferredRegions: fact("preferredRegions", [], "preference"),
    regionImportance: fact("regionImportance", "no_preference", "preference"),
    parentStayGoals: fact("parentStayGoals", ["restWellness"], "parent"),
    koreanSupportNeed: fact("koreanSupportNeed", "emergency_only", "constraint"),
    parentCommunicationNeed: fact("parentCommunicationNeed", "issue_only", "constraint"),
    specialCareFollowUp: fact("specialCareFollowUp", "none", "constraint"),
  },
  askedQuestionKeys: [],
  completedQuestionKeys: [],
  failedQuestionKeys: [],
  currentQuestionKey: null,
  questionCount: 10,
  progress: 100,
  unresolved: [],
  conflicts: [],
}

function fact(key: keyof CampfitV3ConversationState["facts"], value: unknown, subject: "child" | "parent" | "preference" | "constraint") {
  return { key, subject, value, source: "explicit_user_statement" as const, confidence: 1, status: "confirmed" as const, evidence: "Demo Catalog recommendation fixture", updatedAt: "2026-07-19T00:00:00.000Z" }
}
