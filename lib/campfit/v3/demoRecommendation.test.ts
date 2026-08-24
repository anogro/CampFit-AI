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
    expect(result.destinationRecommendations.every((city) => city.citySlug)).toBe(true)
    expect(new Set(result.programCandidates.map((program) => program.programId)).size).toBe(result.programCandidates.length)
    expect(result.programCandidates.every((program) => program.detailUrl?.includes("/program/campfit-demo-") === true)).toBe(true)
    expect(result.programCandidates.every((program) => program.imageUrl !== null)).toBe(true)
    expect(result.programCandidates.every((program, index, programs) => programs.findIndex((candidate) => candidate.programId === program.programId) === index)).toBe(true)
    expect(result.programCandidates[1]?.reason).not.toContain("점수")
  })

  it("uses the matched catalog city image when a program row has no image", () => {
    const catalog = loadDemoCatalog(2026)
    const cityImages = new Map(catalog.cities.map((city) => [city.name, city.imageUrl]))
    const result = buildRecommendation({
      basicInfo: demoBasicInfo,
      state: demoState,
      catalog: {
        ...catalog,
        programs: catalog.programs.map((program) => ({ ...program, imageUrl: null })),
      },
      now: new Date("2026-07-19T00:00:00.000Z"),
    })

    expect(result.programCandidates.length).toBeGreaterThan(0)
    expect(result.programCandidates.every((program) => program.imageUrl === cityImages.get(program.cityName))).toBe(true)
  })

  it("uses direct program evidence for a peer-primary STEM family scenario", () => {
    const { childEnglishLevel: _childEnglishLevel, ...demoFactsWithoutLegacyLevel } = demoState.facts
    const result = buildRecommendation({
      basicInfo: {
        ...demoBasicInfo,
        durationWeeks: 3,
        departureWindow: "2026년 8월",
      },
      state: {
        ...demoState,
        facts: {
          ...demoFactsWithoutLegacyLevel,
          childEnglishListening: fact("childEnglishListening", "understands_simple_instructions", "child"),
          childEnglishSpeaking: fact("childEnglishSpeaking", "answers_simple_questions", "child"),
          parentExperienceNeeds: fact("parentExperienceNeeds", {
            english_growth: { importance: "nice_to_have", evidence: ["영어도 늘면 좋겠어요"] },
            peer_interaction: { importance: "primary", evidence: ["외국 친구들과 어울리는 경험이 가장 중요해요"] },
            global_experience: { importance: "unspecified", evidence: [] },
            independence_confidence: { importance: "unspecified", evidence: [] },
            school_learning_experience: { importance: "unspecified", evidence: [] },
          }, "preference"),
          activityPreferences: fact("activityPreferences", {
            preferences: [{ category: "stem_maker", strength: "strong", rank: 1, mentionedActivities: ["과학실험", "만들기"], evidence: ["과학실험과 만들기를 좋아해요"] }],
            varietyPreference: "unspecified",
            evidence: ["과학실험과 만들기를 좋아해요"],
          }, "preference"),
        },
      },
      catalog: loadDemoCatalog(2026),
      now: new Date("2026-07-19T00:00:00.000Z"),
    })

    const reasons = result.programCandidates.map((candidate) => candidate.reason)
    expect(result.programCandidates).toHaveLength(3)
    expect(new Set(reasons).size).toBeGreaterThan(1)
    expect(result.programCandidates.some((candidate) => /또래|친구|교류|국제학생|다국적/iu.test([candidate.reason, ...(candidate.matchHighlights ?? [])].join(" ")))).toBe(true)
    expect(result.programCandidates.flatMap((candidate) => candidate.matchHighlights).join(" ")).not.toMatch(/연령에 맞는|옵션 선택지/iu)
  })

  it("does not repeat the same semantic reason across the top three candidates", () => {
    const catalog = loadDemoCatalog(2026)
    const { childEnglishLevel: _childEnglishLevel, ...demoFactsWithoutLegacyLevel } = demoState.facts
    const result = buildRecommendation({
      basicInfo: {
        ...demoBasicInfo,
        durationWeeks: 3,
        departureWindow: "2026년 8월",
      },
      state: {
        ...demoState,
        facts: {
          ...demoFactsWithoutLegacyLevel,
          childEnglishListening: fact("childEnglishListening", "understands_simple_instructions", "child"),
          childEnglishSpeaking: fact("childEnglishSpeaking", "answers_simple_questions", "child"),
          parentExperienceNeeds: fact("parentExperienceNeeds", {
            english_growth: { importance: "nice_to_have", evidence: ["영어도 늘면 좋겠어요"] },
            peer_interaction: { importance: "primary", evidence: ["외국 친구들과 어울리는 경험이 가장 중요해요"] },
            global_experience: { importance: "unspecified", evidence: [] },
            independence_confidence: { importance: "unspecified", evidence: [] },
            school_learning_experience: { importance: "unspecified", evidence: [] },
          }, "preference"),
          activityPreferences: fact("activityPreferences", {
            preferences: [{ category: "stem_maker", strength: "strong", rank: 1, mentionedActivities: ["과학실험", "만들기"], evidence: ["과학실험과 만들기를 좋아해요"] }],
            varietyPreference: "unspecified",
            evidence: ["과학실험과 만들기를 좋아해요"],
          }, "preference"),
        },
      },
      catalog,
      now: new Date("2026-07-19T00:00:00.000Z"),
    })

    const groundedProgramEvidence = result.programCandidates.map((candidate) => {
      const program = catalog.programs.find((item) => item.id === candidate.programId)
      if (program === undefined) return null
      const evidence = [
        ...program.traits,
        ...(program.demoProfile?.strengths ?? []),
        ...(typeof program.description === "string" ? [program.description] : []),
      ].map((value) => value.replace(/[.!?。！？]+$/u, "").trim()).filter(Boolean)
      return evidence.find((value) => candidate.reason.includes(value)) ?? null
    })

    expect(result.programCandidates).toHaveLength(3)
    const nonNullEvidence = groundedProgramEvidence.filter((value): value is string => value !== null)
    expect(nonNullEvidence).toHaveLength(groundedProgramEvidence.length)
    expect(new Set(nonNullEvidence).size).toBe(nonNullEvidence.length)
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
