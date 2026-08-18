import { describe, expect, it } from "vitest"
import {
  assessEnglishRequirementMatch,
  englishRequirementLevels,
  englishMatchLabels,
  isEnglishRequirementLevel,
  type V3ProgramEnglishRequirement,
} from "@/lib/campfit/v3/englishRequirement"
import { campfitV3EnglishReadinessValues } from "@/types/campfitV3"

const inferred = (level: V3ProgramEnglishRequirement["level"]): V3ProgramEnglishRequirement => ({
  level,
  source: "inferred",
  confidence: 0.95,
  version: "test-v1",
  officialVerified: false,
  officialText: null,
  officialQualification: null,
  instructionLanguageMode: null,
  beginnerParticipation: null,
  officialMinimumReadiness: null,
})

describe("CampFit English requirement matching", () => {
  it("keeps child readiness and program requirement taxonomies separate", () => {
    expect(campfitV3EnglishReadinessValues).toEqual([
      "support_required",
      "beginner_friendly",
      "general_program_ready",
      "academic_ready",
      "unknown",
    ])
    expect(englishRequirementLevels).toEqual([
      "no_requirement",
      "beginner_friendly",
      "general_english",
      "academic_english",
      "unknown",
    ])
    expect(isEnglishRequirementLevel("beginner_friendly")).toBe(true)
    expect(isEnglishRequirementLevel("academic_ready")).toBe(false)
    expect(isEnglishRequirementLevel("general_program_ready")).toBe(false)
  })

  it("keeps English burden as an explanation instead of a hard filter", () => {
    const result = assessEnglishRequirementMatch("beginner_friendly", inferred("academic_english"))
    expect(result.status).toBe("english_burden_possible")
    expect(result.scoreAdjustment).toBeLessThan(0)
    expect(result.label).toBe(englishMatchLabels.english_burden_possible)
  })

  it("maps unknown child or program information to unknown", () => {
    expect(assessEnglishRequirementMatch("unknown", inferred("general_english")).status).toBe("unknown")
    expect(assessEnglishRequirementMatch("general_program_ready", inferred("unknown")).status).toBe("unknown")
  })

  it("only creates official mismatch with verified official evidence and an explicit floor", () => {
    const official: V3ProgramEnglishRequirement = {
      ...inferred("academic_english"),
      source: "official",
      officialVerified: true,
      officialMinimumReadiness: "academic_ready",
    }
    expect(assessEnglishRequirementMatch("general_program_ready", official).status).toBe("official_requirement_mismatch")
    expect(assessEnglishRequirementMatch("general_program_ready", { ...official, officialVerified: false }).status).toBe("manageable_with_support")
  })
})
