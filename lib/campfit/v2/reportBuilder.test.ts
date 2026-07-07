import { describe, expect, it } from "vitest"
import { camps } from "@/data/campfit/camps"
import { buildCampfitV2ConsultingProfile } from "@/lib/campfit/v2/profileBuilder"
import { buildCampfitV2Report } from "@/lib/campfit/v2/reportBuilder"
import { recommendCampsV2 } from "@/lib/campfit/v2/v2MatchingWrapper"
import type { AIExtractionResult, RequiredIntake } from "@/types/campfitV2"

const requiredIntake: RequiredIntake = {
  childAgeAtStart: 10,
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
  understandingSummaryForUser: "상담 요약",
  extractedProfile: {
    detectedRegions: ["oceania"],
    detectedProgramTypes: ["international_school_regular"],
    parentGoals: ["english_improvement"],
    childSignals: [],
    riskSignals: ["english_overload", "separation_risk"],
    avoidSignals: [],
    flexibilitySignals: [],
  },
  missingSlots: [],
  conflicts: [],
  confidenceMap: {},
  recommendedQuestionKeys: [],
}

describe("buildCampfitV2Report", () => {
  it("Given no exact match When building report Then condition relaxation is normal output", () => {
    const profile = buildProfile()
    const matching = recommendCampsV2(profile, { camps: camps.filter((camp) => camp.id === "canada_global_challenge_20") })
    const report = buildCampfitV2Report(profile, matching)

    expect(report.conditionRelaxationSuggestions.length).toBeGreaterThan(0)
    expect(report.consultingChecklist.some((item) => item.includes("실제 견적"))).toBe(true)
  })

  it("Given report When serialized Then forbidden v2 concepts are absent", () => {
    const profile = buildProfile()
    const matching = recommendCampsV2(profile, { camps: camps.filter((camp) => camp.country === "Australia") })
    const report = buildCampfitV2Report(profile, matching)
    const serialized = JSON.stringify(report)

    expect(serialized).not.toMatch(/\bgrade\b/i)
    expect(serialized).not.toMatch(/\bbudgetIncludesFlight\b/)
  })
})

function buildProfile() {
  return buildCampfitV2ConsultingProfile({
    requiredIntake,
    naturalInput: { situationText: "오세아니아 스쿨링이 좋아 보이지만 영어 초급과 분리가 걱정됩니다." },
    extraction,
    budgetEstimates: [
      {
        regionGroup: "oceania",
        flags: ["unknown_cost_assumption", "needs_consultation_check"],
        note: "상담 전 확인 필요",
      },
    ],
  })
}
