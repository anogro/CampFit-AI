import { describe, expect, it } from "vitest"
import { planCampfitV2Questions } from "@/lib/campfit/v2/questionPlanner"
import type { AIExtractionResult, RequiredIntake } from "@/types/campfitV2"

const requiredIntake: RequiredIntake = {
  childAgeAtStart: 8,
  departureWindow: "summer_break",
  durationWeeksMin: 2,
  durationWeeksMax: 4,
  totalBudgetAllInKrwMin: 4_000_000,
  totalBudgetAllInKrwMax: 5_000_000,
  budgetScope: "family_total",
  travelerCounts: { child: 1, parent: 1, sibling: 0 },
  preferredRegionGroups: ["oceania"],
  regionPriority: "strong",
  parentAccompanimentMode: "parent_can_stay",
  koreanSupportNeed: "daily_korean_communication",
  accommodationPreferences: ["parent_stay"],
}

const extraction: AIExtractionResult = {
  understandingSummaryForUser: "요약",
  extractedProfile: {
    detectedProgramTypes: ["international_school_regular"],
    riskSignals: ["english_overload"],
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
  confidenceMap: {},
  recommendedQuestionKeys: ["not_in_bank", "english_help_seeking", "flexibility"],
}

describe("planCampfitV2Questions", () => {
  it("Given required intake already has age and budget When planning Then does not repeat those questions", () => {
    const planned = planCampfitV2Questions({ requiredIntake, extraction })
    const keys = planned.map((item) => item.questionKey)

    expect(keys).not.toContain("child_age_at_start")
    expect(keys).not.toContain("total_budget_all_in")
  })

  it("Given undecided parent accompaniment When planning Then asks parent accompaniment question", () => {
    const planned = planCampfitV2Questions({
      requiredIntake: { ...requiredIntake, parentAccompanimentMode: "undecided" },
      extraction,
    })

    expect(planned.map((item) => item.questionKey)).toContain("parent_accompaniment_mode")
  })

  it("Given conflict and unknown AI key When planning Then conflict comes first and unknown key is removed", () => {
    const planned = planCampfitV2Questions({ requiredIntake, extraction })
    const keys = planned.map((item) => item.questionKey)

    expect(keys[0]).toBe("conflict_oceania_budget_parent")
    expect(keys).toContain("conflict_schooling_low_english")
    expect(keys).not.toContain("not_in_bank")
    expect(keys.length).toBeLessThanOrEqual(5)
  })

  it("Given answered question When planning Then excludes it", () => {
    const planned = planCampfitV2Questions({
      requiredIntake,
      extraction,
      answeredQuestions: [{ questionKey: "english_help_seeking", answer: { value: "basic_needs", score: 3 } }],
    })

    expect(planned.map((item) => item.questionKey)).not.toContain("english_help_seeking")
  })
})
