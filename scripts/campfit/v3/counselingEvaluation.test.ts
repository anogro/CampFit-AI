import { describe, expect, it } from "vitest"
import {
  classifyLiveStopReason,
  evaluateMatcher,
  runFallbackEvaluation,
  runLiveEvaluation,
  runMockEvaluation,
  runMockValidationSuite,
} from "@/scripts/campfit/v3/counselingEvaluation"
import { counselingEvaluationCases, counselingEvaluationScenarios } from "@/scripts/campfit/v3/counselingEvaluationFixtures"
import type { CampfitV3BasicInfo, CampfitV3ConversationResponse } from "@/types/campfitV3"

const basicInfo: CampfitV3BasicInfo = {
  childAges: [8],
  departureWindow: "다음 여름방학",
  durationWeeks: 2,
  budgetMinKrw: 5_000_000,
  budgetMaxKrw: 8_000_000,
  adultCount: 1,
  childCount: 1,
  guardianStaysNearby: true,
}

const emptyResponse = {} as CampfitV3ConversationResponse

describe("CampFit v3 counseling evaluation fixtures", () => {
  it("has 24 unique single-turn cases across the requested categories", () => {
    expect(counselingEvaluationCases).toHaveLength(24)
    expect(new Set(counselingEvaluationCases.map((item) => item.id)).size).toBe(24)
    expect(new Set(counselingEvaluationCases.map((item) => item.category)).size).toBeGreaterThanOrEqual(20)
    expect(counselingEvaluationCases.every((item) => item.utterance.length > 0 && item.notes.length > 0)).toBe(true)
  })

  it("has six multi-turn scenarios with three to six turns", () => {
    expect(counselingEvaluationScenarios).toHaveLength(6)
    expect(counselingEvaluationScenarios.every((scenario) => scenario.turns.length >= 3 && scenario.turns.length <= 6)).toBe(true)
    expect(new Set(counselingEvaluationScenarios.map((item) => item.id)).size).toBe(6)
  })

  it("matches nested values, arrays, status, confidence and absence", () => {
    const context = {
      response: emptyResponse,
      state: {
        facts: {
          destinationPreference: { value: ["Singapore", "Auckland"], status: "tentative", confidence: 0.6 },
          childEnglishLevel: { value: "beginner", status: "confirmed", confidence: 1 },
        },
      },
      basicInfo,
      questionKey: "preferred_region",
    } as never
    expect(evaluateMatcher({ path: "facts.destinationPreference.value", matcher: "containsAll", expected: ["Singapore", "Auckland"] }, context).passed).toBe(true)
    expect(evaluateMatcher({ path: "facts.destinationPreference.status", matcher: "statusIs", expected: "tentative" }, context).passed).toBe(true)
    expect(evaluateMatcher({ path: "facts.destinationPreference.confidence", matcher: "confidenceBelow", expected: 0.8 }, context).passed).toBe(true)
    expect(evaluateMatcher({ path: "facts.missing", matcher: "isUnknown" }, context).passed).toBe(true)
    expect(evaluateMatcher({ path: "facts.missing", matcher: "isAbsent" }, context).passed).toBe(true)
    expect(evaluateMatcher({ path: "questionKey", matcher: "questionTargets", expected: "preferred_region" }, context).passed).toBe(true)
    expect(evaluateMatcher({ path: "questionKey", matcher: "questionDoesNotTarget", expected: "child_english_level" }, context).passed).toBe(true)
  })

  it("runs the complete deterministic fallback suite without external calls", async () => {
    const report = await runFallbackEvaluation()
    expect(report.mode).toBe("fallback")
    expect(report.fixtureCounts).toEqual({ singleTurn: 24, scenarios: 6, scenarioTurns: 24 })
    expect(report.summary.failed).toBe(0)
    expect(report.summary.unsupportedInferenceFailures).toBe(0)
    expect(report.cases.every((result) => result.diagnostic === null)).toBe(true)
  })

  it("runs mock Gemini orchestration and all parser validation variants", async () => {
    const report = await runMockEvaluation()
    expect(report.mode).toBe("mock")
    expect(report.mockValidation).toHaveLength(9)
    expect(report.mockValidation?.every((result) => result.passed)).toBe(true)
    expect(report.cases.some((result) => result.diagnostic?.code === "ok")).toBe(true)
  })

  it("keeps live mode disabled by default and does not expose secrets or raw responses", async () => {
    const previous = process.env["RUN_GEMINI_LIVE_EVAL"]
    delete process.env["RUN_GEMINI_LIVE_EVAL"]
    const report = await runLiveEvaluation()
    if (previous === undefined) delete process.env["RUN_GEMINI_LIVE_EVAL"]
    else process.env["RUN_GEMINI_LIVE_EVAL"] = previous
    expect(report.live?.enabled).toBe(false)
    expect(report.live?.status).toBe("NOT_TESTED")
    const serialized = JSON.stringify(report)
    expect(serialized).not.toContain("GEMINI_API_KEY")
    expect(serialized).not.toContain("rawGemini")
  })

  it("stops live evaluation classification at rate limits and network errors", () => {
    expect(classifyLiveStopReason("rate_limited", null)).toBe("rate_limited")
    expect(classifyLiveStopReason(null, "rate_limited")).toBe("rate_limited")
    expect(classifyLiveStopReason("network_error", null)).toBe("network_error")
    expect(classifyLiveStopReason(null, "network_error")).toBe("network_error")
    expect(classifyLiveStopReason("schema_validation_failed", null)).toBe(null)
  })

  it("covers forbidden inference and privacy-safe special-care expectations", () => {
    const care = counselingEvaluationCases.find((item) => item.id === "n-special-care-flag")
    expect(care?.forbiddenInferences).toEqual([])
    expect(care?.expectedFacts.some((matcher) => matcher.path.includes("specialCareFollowUp"))).toBe(true)
    const unrelated = counselingEvaluationCases.find((item) => item.id === "o-unrelated-background")
    expect(unrelated?.forbiddenInferences).toContain("destinationPreference")
  })

  it("defines correction, deferral and no-reask scenario gates", () => {
    expect(counselingEvaluationCases.find((item) => item.id === "f-budget-correction")?.initialFacts).toBeDefined()
    expect(counselingEvaluationCases.find((item) => item.id === "p-ambiguous-english")?.expectedFacts.some((matcher) => matcher.matcher === "questionTargets" && matcher.expected === "child_english_level")).toBe(true)
    expect(counselingEvaluationScenarios.some((scenario) => (scenario.expectedNoRepeatTargets?.length ?? 0) > 0)).toBe(true)
  })

  it("passes each mock parser outcome independently", () => {
    expect(runMockValidationSuite().filter((result) => result.passed)).toHaveLength(9)
  })
})
