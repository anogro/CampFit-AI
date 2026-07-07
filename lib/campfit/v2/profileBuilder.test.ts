import { describe, expect, it } from "vitest"
import { buildCampfitV2ConsultingProfile } from "@/lib/campfit/v2/profileBuilder"
import type { AIExtractionResult, NaturalConsultationInput, RequiredIntake } from "@/types/campfitV2"

const requiredIntake: RequiredIntake = {
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

const naturalInput: NaturalConsultationInput = {
  situationText: "국제학교 분위기를 경험하고 싶지만 영어 초급이라 걱정됩니다.",
}

const extraction: AIExtractionResult = {
  understandingSummaryForUser: "요약",
  extractedProfile: {
    detectedProgramTypes: ["international_school_regular"],
    parentGoals: ["english_improvement"],
    childSignals: ["shy"],
    riskSignals: ["english_overload"],
    avoidSignals: [],
    flexibilitySignals: [],
  },
  missingSlots: [],
  conflicts: [
    {
      conflictKey: "conflict_schooling_low_english",
      description: "스쿨링과 영어 초급 신호가 함께 있습니다.",
      severity: "medium",
      recommendedQuestionKey: "conflict_schooling_low_english",
    },
  ],
  confidenceMap: { riskSignals: 0.7 },
  recommendedQuestionKeys: ["conflict_schooling_low_english"],
}

describe("buildCampfitV2ConsultingProfile", () => {
  it("Given dynamic answer When building profile Then dynamic answer overrides AI readiness signal", () => {
    const profile = buildCampfitV2ConsultingProfile({
      requiredIntake,
      naturalInput,
      extraction,
      dynamicAnswers: [{ questionKey: "english_help_seeking", answer: { value: "independent", score: 5 } }],
      budgetEstimates: [],
    })

    expect(profile.childReadiness["english_help_seeking"]).toBe(5)
    expect(profile.recommendationStrategy).toBe("parent_accompanied_exposure")
  })

  it("Given conflicts When building profile Then conflicts are preserved and forbidden concepts are absent", () => {
    const profile = buildCampfitV2ConsultingProfile({ requiredIntake, naturalInput, extraction, budgetEstimates: [] })
    const serialized = JSON.stringify(profile)

    expect(profile.riskProfile["conflicts"]).toEqual(extraction.conflicts)
    expect(serialized).not.toMatch(/\bgrade\b/i)
    expect(serialized).not.toMatch(/\bbudgetIncludesFlight\b/)
  })
})
