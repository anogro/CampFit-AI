import { describe, expect, it } from "vitest"
import { buildFallbackExtraction, sanitizeAIExtractionResult } from "@/lib/campfit/v2/aiExtraction"
import type { AIExtractionResult, NaturalConsultationInput, RequiredIntake } from "@/types/campfitV2"

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

describe("buildFallbackExtraction", () => {
  it("Given Oceania schooling concern When falling back Then extracts region, program, risk, and conflict", () => {
    const naturalInput: NaturalConsultationInput = {
      situationText: "만 8세 아이 첫 해외캠프를 알아보고 있어요. 호주나 뉴질랜드 스쿨링이 좋아 보이지만 영어 초급이라 걱정돼요.",
    }

    const extraction = buildFallbackExtraction(requiredIntake, naturalInput)

    expect(extraction.extractedProfile["detectedRegions"]).toContain("oceania")
    expect(extraction.extractedProfile["detectedProgramTypes"]).toContain("schooling")
    expect(extraction.extractedProfile["riskSignals"]).toContain("english_overload")
    expect(extraction.conflicts.some((conflict) => conflict.conflictKey === "conflict_schooling_low_english")).toBe(true)
    expect(JSON.stringify(extraction)).not.toMatch(/\bgrade\b/i)
  })
})

describe("sanitizeAIExtractionResult", () => {
  it("Given unknown question keys When sanitizing Then removes them", () => {
    const extraction: AIExtractionResult = {
      understandingSummaryForUser: "요약",
      extractedProfile: {},
      missingSlots: [],
      conflicts: [
        {
          conflictKey: "unknown_conflict",
          description: "알 수 없는 질문 key",
          severity: "medium",
          recommendedQuestionKey: "not_in_bank",
        },
      ],
      confidenceMap: {},
      recommendedQuestionKeys: ["english_help_seeking", "not_in_bank"],
    }

    const sanitized = sanitizeAIExtractionResult(extraction)

    expect(sanitized.recommendedQuestionKeys).toEqual(["english_help_seeking"])
    expect(sanitized.conflicts[0]?.recommendedQuestionKey).toBeUndefined()
  })
})
