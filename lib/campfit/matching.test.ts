import { describe, expect, it } from "vitest"
import type { CampfitInput, ParentAnalysis, ReadinessAnswers } from "@/types/campfit"
import { recommendCamps } from "@/lib/campfit/matching"
import { scoreCampReadiness } from "@/lib/campfit/readiness"

const baseAnalysis: ParentAnalysis = {
  parentType: "안심형 도전 추구",
  parentGoal: {
    englishGrowth: 0.86,
    confidenceGrowth: 0.82,
    independenceGrowth: 0.58,
    socialGrowth: 0.52,
    safetyPriority: 0.78,
    academicResultPriority: 0.62,
    experiencePriority: 0.58,
  },
  childProfile: {
    englishReadiness: 0.34,
    socialConfidence: 0.36,
    separationTolerance: 0.48,
    newEnvironmentAdaptability: 0.44,
    challengeTolerance: 0.52,
  },
  supportNeeded: ["beginner_class", "korean_manager", "early_adaptation_support"],
  detectedTensions: [],
  evidence: [],
  summaryForParent: ["영어 성장과 자신감 회복을 기대합니다.", "초기 적응 지원이 필요합니다."],
  followUpQuestions: ["초기 적응에서 가장 걱정되는 상황은 무엇인가요?"],
}

const baseInput: CampfitInput = {
  childAge: 8,
  grade: "초2",
  englishSelfLevel: "almost_none",
  overseasExperience: "none",
  shynessLevel: "high",
  separationTolerance: "medium",
  budgetRange: "5m_8m",
  destinationPreference: "no_preference",
  travelReadiness: "moderate_distance",
  durationWeeks: "2w",
  parentAccompanied: "preferred",
  koreanManagerRequired: "required",
  preferredProgramType: "managed_immersion",
  parentConcernText: "영어 초급이고 낯가림이 있지만 영어 자신감을 키우고 싶습니다.",
}

const basicAnswers: ReadinessAnswers = {
  q1: "B",
  q2: "C",
  q3: "D",
  q4: "B",
  q5: "I like soccer.",
  q6: "B",
}

describe("recommendCamps", () => {
  it("Given beginner child and support preference When recommending Then managed immersion stretch fit appears", () => {
    const readiness = scoreCampReadiness(basicAnswers)

    const recommendations = recommendCamps({ input: baseInput, analysis: baseAnalysis, readiness })

    expect(recommendations.length).toBeGreaterThan(0)
    expect(recommendations[0]?.camp.programType).toBe("managed_immersion")
    expect(["stretch", "comfort"]).toContain(recommendations[0]?.fitType)
  })

  it("Given first overseas experience and parent accompanied requirement When recommending Then family options remain", () => {
    const readiness = scoreCampReadiness({ ...basicAnswers, q6: "C" })

    const recommendations = recommendCamps({
      input: {
        ...baseInput,
        budgetRange: "5m_8m",
        parentAccompanied: "required",
        koreanManagerRequired: "preferred",
        preferredProgramType: "family_esl",
      },
      analysis: { ...baseAnalysis, parentType: "안정 우선형", supportNeeded: ["parent_accompanied", "beginner_class"] },
      readiness,
    })

    expect(recommendations.length).toBeGreaterThan(0)
    expect(recommendations.every((item) => item.camp.parentAccompanied)).toBe(true)
    expect(recommendations[0]?.fitType).toBe("comfort")
  })

  it("Given confident older child When recommending Then high challenge camps can rank", () => {
    const readiness = scoreCampReadiness({ ...basicAnswers, q5: "I like science and new friends.", q6: "A" })

    const recommendations = recommendCamps({
      input: {
        ...baseInput,
        childAge: 12,
        grade: "초6",
        englishSelfLevel: "comfortable",
        overseasExperience: "camp_experience",
        shynessLevel: "low",
        separationTolerance: "high",
        budgetRange: "over_8m",
        destinationPreference: "north_america",
        travelReadiness: "long_flight_independent",
        durationWeeks: "3_4w",
        koreanManagerRequired: "not_needed",
        preferredProgramType: "international_camp",
      },
      analysis: {
        ...baseAnalysis,
        parentType: "도전 성장형",
        parentGoal: { ...baseAnalysis.parentGoal, independenceGrowth: 0.86, socialGrowth: 0.82, safetyPriority: 0.38 },
        childProfile: {
          englishReadiness: 0.82,
          socialConfidence: 0.78,
          separationTolerance: 0.84,
          newEnvironmentAdaptability: 0.8,
          challengeTolerance: 0.82,
        },
        supportNeeded: ["buddy_system"],
      },
      readiness,
    })

    expect(recommendations.length).toBeGreaterThan(0)
    expect(recommendations.some((item) => item.camp.country === "New Zealand" || item.camp.country === "Canada")).toBe(true)
  })

  it("Given same budget but Southeast Asia preference When recommending Then nearby managed options rank higher", () => {
    const readiness = scoreCampReadiness(basicAnswers)

    const recommendations = recommendCamps({
      input: {
        ...baseInput,
        budgetRange: "over_8m",
        destinationPreference: "southeast_asia",
        travelReadiness: "short_flight_care",
      },
      analysis: baseAnalysis,
      readiness,
    })

    expect(recommendations.length).toBeGreaterThan(0)
    expect(["Philippines", "Singapore", "Malaysia"]).toContain(recommendations[0]?.camp.country)
  })
})
