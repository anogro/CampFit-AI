import { describe, expect, it } from "vitest"
import type { CampfitInput } from "@/types/campfit"
import { scoreCampReadinessFromParentInput } from "@/lib/campfit/readiness"

const baseInput = {
  childAge: 8,
  grade: "초2",
  englishSelfLevel: "almost_none",
  overseasExperience: "none",
  shynessLevel: "high",
  separationTolerance: "medium",
  budgetRange: "3m_5m",
  destinationPreference: "no_preference",
  travelReadiness: "moderate_distance",
  durationWeeks: "2w",
  parentAccompanied: "preferred",
  koreanManagerRequired: "required",
  preferredProgramType: "managed_immersion",
  parentConcernText: "영어는 거의 처음이고 낯가림이 있어 초반 적응 지원이 필요합니다.",
} satisfies CampfitInput

describe("scoreCampReadinessFromParentInput", () => {
  it("Given parent-observed English levels When scoring readiness Then conversation level raises readiness", () => {
    const beginner = scoreCampReadinessFromParentInput(baseInput)
    const conversational = scoreCampReadinessFromParentInput({
      ...baseInput,
      englishSelfLevel: "simple_conversation",
      shynessLevel: "medium",
    })

    expect(conversational.basicSelfExpression).toBeGreaterThan(beginner.basicSelfExpression)
    expect(conversational.basicInstructionUnderstanding).toBeGreaterThan(beginner.basicInstructionUnderstanding)
    expect(conversational.overallReadiness).not.toBe("early_adaptation")
  })
})
