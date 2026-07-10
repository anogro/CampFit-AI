import { describe, expect, it } from "vitest"
import { buildProgramModeRecommendations } from "@/lib/campfit/v2/programModeAdvisor"
import type { ConsultingProfile } from "@/types/campfitV2"

describe("buildProgramModeRecommendations", () => {
  it("prioritizes natural exposure and culture modes without relying on camp candidates", () => {
    const recommendations = buildProgramModeRecommendations(buildProfile({
      preferredProgramTypes: ["international_school_camp", "family_esl", "culture_activity"],
      primaryGoals: ["natural_english_exposure", "cultural_exposure"],
      parentMode: "parent_can_stay",
    }))

    expect(recommendations).toHaveLength(3)
    expect(recommendations.map((item) => item.key)).toEqual(expect.arrayContaining([
      "international_school_camp",
      "family_esl",
      "culture_activity",
    ]))
    expect(new Set(recommendations.map((item) => item.score)).size).toBeGreaterThan(1)
  })

  it("keeps international school camp in the leading directions for natural English and culture goals", () => {
    const recommendations = buildProgramModeRecommendations(buildProfile({
      preferredProgramTypes: [],
      primaryGoals: ["natural_english_exposure", "cultural_exposure"],
      parentMode: "parent_can_stay",
      koreanSupportNeed: "daily_korean_communication",
      readiness: { english_comprehension: 2, english_help_seeking: 2, transition_readiness: 2, social_confidence: 2 },
    }))

    expect(recommendations.map((item) => item.key)).toContain("international_school_camp")
  })

  it("prioritizes academic and language-growth modes for those goals", () => {
    const recommendations = buildProgramModeRecommendations(buildProfile({
      preferredProgramTypes: ["language_school_esl", "international_school_regular", "steam_project"],
      primaryGoals: ["english_improvement", "academic_stimulation"],
      parentMode: "child_solo_or_chaperone_ok",
      readiness: { english_comprehension: 5, english_help_seeking: 5, transition_readiness: 5, daily_life_independence: 5 },
    }))

    expect(recommendations.map((item) => item.key)).toEqual(expect.arrayContaining([
      "language_school_esl",
      "international_school_regular",
      "steam_project",
    ]))
  })

  it("caps residential modes when a beginner needs a parent nearby", () => {
    const recommendations = buildProgramModeRecommendations(buildProfile({
      preferredProgramTypes: ["residential_international_camp"],
      primaryGoals: ["natural_english_exposure"],
      parentMode: "parent_required",
      koreanSupportNeed: "daily_korean_communication",
      readiness: { english_comprehension: 1, english_help_seeking: 1, transition_readiness: 1, daily_life_independence: 1 },
    }), { limit: 10 })
    const family = recommendations.find((item) => item.key === "family_esl")
    const residential = recommendations.find((item) => item.key === "residential_international_camp")

    expect(family?.score).toBeGreaterThan(residential?.score ?? 100)
    expect(residential?.tier).toBe("not_recommended")
    expect(residential?.tradeoffs.length).toBeGreaterThan(0)
  })
})

type ProfileOverrides = {
  readonly preferredProgramTypes: readonly string[]
  readonly primaryGoals: readonly string[]
  readonly parentMode: string
  readonly koreanSupportNeed?: string
  readonly readiness?: Record<string, number>
}

function buildProfile(overrides: ProfileOverrides): ConsultingProfile {
  return {
    hardConstraints: {
      childAgeAtStart: 8,
      parentAccompanimentMode: overrides.parentMode,
      koreanSupportNeed: overrides.koreanSupportNeed ?? "not_needed",
      durationWeeksMin: 2,
      durationWeeksMax: 4,
    },
    strongPreferences: {},
    softPreferences: {
      preferred_program_types: overrides.preferredProgramTypes,
    },
    childReadiness: {
      english_comprehension: 3,
      english_help_seeking: 3,
      transition_readiness: 3,
      daily_life_independence: 3,
      social_confidence: 3,
      resilience: 3,
      ...overrides.readiness,
    },
    parentIntent: { primary_goals: overrides.primaryGoals },
    riskProfile: { top_concerns: [], avoid_conditions: [] },
    flexibility: {},
    budgetEstimates: [],
  }
}
