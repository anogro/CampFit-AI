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

  it.each([
    ["A beginner + immersion", personaState("support_required", { englishIntensive: "primary", cultureActivity: "secondary" }), ["english_burden_possible", "manageable_with_support"]],
    ["B beginner + activity", personaState("support_required", { cultureActivity: "primary", englishIntensive: "secondary" }), ["comfortable", "manageable_with_support", "unknown"]],
    ["C general + STEM", personaState("general_program_ready", { subjectProject: "primary", englishIntensive: "secondary" }), ["comfortable", "manageable_with_support"]],
    ["D academic + schooling", personaState("academic_ready", { schoolSchooling: "primary", subjectProject: "secondary" }), ["comfortable", "manageable_with_support"]],
    ["E English unknown", personaState("unknown", { cultureActivity: "primary" }), ["unknown", "comfortable", "manageable_with_support"]],
  ] as const)("keeps persona %s non-empty and exposes English matching", (_label, state, acceptedStatuses) => {
    const result = buildRecommendation({
      basicInfo: demoBasicInfo,
      state,
      catalog: loadDemoCatalog(2026),
      now: new Date("2026-07-19T00:00:00.000Z"),
    })
    expect(result.programCandidates.length).toBeGreaterThan(0)
    expect(result.programCandidates.some((candidate) => (acceptedStatuses as readonly string[]).includes(candidate.englishMatchStatus ?? "unknown"))).toBe(true)
    expect(result.programCandidates.some((candidate) => candidate.englishMatchLabel)).toBe(true)
  })
})

const demoBasicInfo: CampfitV3BasicInfo = {
  childAges: [8],
  departureWindow: "2026-08",
  durationWeeks: 4,
  budgetMinKrw: 8_000_000,
  budgetMaxKrw: 12_000_000,
  adultCount: 1,
  childCount: 1,
  guardianStaysNearby: true,
}

function personaState(readiness: "support_required" | "beginner_friendly" | "general_program_ready" | "academic_ready" | "unknown", goals: Record<string, string>): CampfitV3ConversationState {
  const facts: CampfitV3ConversationState["facts"] = {
    experienceGoals: fact("experienceGoals", goals, "preference"),
    preferredRegions: fact("preferredRegions", [], "preference"),
    regionImportance: fact("regionImportance", "no_preference", "preference"),
    parentStayGoals: fact("parentStayGoals", ["restWellness"], "parent"),
    koreanSupportNeed: fact("koreanSupportNeed", "emergency_only", "constraint"),
    parentCommunicationNeed: fact("parentCommunicationNeed", "issue_only", "constraint"),
    specialCareFollowUp: fact("specialCareFollowUp", "none", "constraint"),
  }
  if (readiness === "unknown") return baseState(facts)
  if (readiness === "support_required") return baseState({ ...facts, childEnglishLevel: fact("childEnglishLevel", "beginner", "child") })
  const detailed = readiness === "academic_ready"
    ? {
        childEnglishListening: "understands_class_explanation",
        childEnglishSpeaking: "initiates_speech",
        childEnglishReading: "understands_english_books",
        childEnglishWriting: "can_explain_in_english",
      }
    : {
        childEnglishListening: "understands_class_explanation",
        childEnglishSpeaking: "can_converse",
        childEnglishReading: "reads_simple_text",
        childEnglishWriting: "simple_words",
      }
  return baseState({
    ...facts,
    ...Object.fromEntries(Object.entries(detailed).map(([key, value]) => [key, fact(key as keyof CampfitV3ConversationState["facts"], value, "child")])),
  })
}

function baseState(facts: CampfitV3ConversationState["facts"]): CampfitV3ConversationState {
  return {
    facts,
    askedQuestionKeys: [],
    completedQuestionKeys: [],
    failedQuestionKeys: [],
    currentQuestionKey: null,
    questionCount: 10,
    progress: 100,
    unresolved: [],
    conflicts: [],
  }
}

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
