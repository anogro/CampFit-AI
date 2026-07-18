import { describe, expect, it, vi } from "vitest"
import {
  buildGeminiObservabilityResult,
  hasExactSubjectSeparationArguments,
  runSubjectSeparationObservation,
} from "@/scripts/campfit/v3/geminiObservability"
import type { CampfitV3ModelResponse } from "@/lib/campfit/v3/provider"
import type {
  CampfitV3AiDiagnostics,
  CampfitV3ConversationResponse,
  CampfitV3Fact,
  CampfitV3FactKey,
} from "@/types/campfitV3"

describe("Gemini observability result", () => {
  it("serializes fixture A AI success without raw content", () => {
    const result = buildGeminiObservabilityResult({
      response: responseFixture({ diagnostics: diagnosticsFixture(), aiUsed: true }),
      providerModel: providerModelFixture(),
      externalHttpStatus: 200,
      totalElapsedMs: 14_500,
    })

    expect(result).toMatchObject({
      evaluationCompleted: true,
      observabilityStatus: "complete",
      providerCallAttempted: true,
      providerResponseReceived: true,
      providerResponseValidated: true,
      aiUsed: true,
      fallbackReason: null,
      providerHttpStatus: 200,
      providerRequestCount: 1,
      facts: {
        childEnglishLevel: "beginner",
        parentEnglishCommunication: "possible",
        koreanSupportNeed: "unknown",
      },
      forbiddenInferences: [],
      error: null,
    })
    expect(JSON.stringify(result)).not.toContain("evidence")
    expect(JSON.stringify(result)).not.toContain("assistantMessage")
  })

  it("serializes fixture B deterministic fallback without claiming AI success", () => {
    const diagnostics = diagnosticsFixture({
      providerResponseValidated: false,
      aiUsed: false,
      fallbackReason: "schema_validation_failed",
    })
    const result = buildGeminiObservabilityResult({
      response: responseFixture({ diagnostics, aiUsed: false }),
      providerModel: null,
      externalHttpStatus: 200,
      totalElapsedMs: 12_000,
    })

    expect(result).toMatchObject({
      evaluationCompleted: true,
      observabilityStatus: "complete",
      providerResponseValidated: false,
      aiUsed: false,
      fallbackReason: "schema_validation_failed",
      factCollectionMode: "deterministic_fallback",
      facts: {
        childEnglishLevel: "beginner",
        parentEnglishCommunication: "possible",
      },
    })
  })

  it("serializes fixture C missing diagnostics with explicit nulls", () => {
    const response = responseFixture({ diagnostics: diagnosticsFixture(), aiUsed: true })
    const { diagnostics: _diagnostics, ...withoutDiagnostics } = response
    const result = buildGeminiObservabilityResult({
      response: withoutDiagnostics,
      providerModel: providerModelFixture(),
      externalHttpStatus: 200,
      totalElapsedMs: 100,
    })

    expect(result).toMatchObject({
      evaluationCompleted: false,
      observabilityStatus: "diagnostics_missing",
      providerCallAttempted: null,
      providerResponseReceived: null,
      providerResponseValidated: null,
      aiUsed: null,
      providerRequestCount: null,
      error: {
        code: "OBSERVABILITY_MISSING",
        path: "conversationResponse.diagnostics",
      },
    })
    expect(JSON.stringify(result)).not.toContain("undefined")
  })

  it("serializes fixture D partial facts as null without crashing", () => {
    const result = buildGeminiObservabilityResult({
      response: responseFixture({
        diagnostics: diagnosticsFixture({
          providerResponseValidated: false,
          aiUsed: false,
          fallbackReason: "schema_validation_failed",
        }),
        aiUsed: false,
        facts: {
          childEnglishLevel: fact("childEnglishLevel", "beginner"),
        },
      }),
      providerModel: null,
      externalHttpStatus: null,
      totalElapsedMs: 50,
    })

    expect(result.facts).toEqual({
      childEnglishLevel: "beginner",
      parentEnglishCommunication: null,
      koreanSupportNeed: "unknown",
    })
    expect(result.factSources).toEqual({
      childEnglishLevel: "explicit_user_statement",
      parentEnglishCommunication: null,
      koreanSupportNeed: null,
    })
  })

  it("serializes fixture E API error envelope without raw body or credentials", () => {
    const result = buildGeminiObservabilityResult({
      response: {
        message: "secret-key and raw prompt must not escape",
        rawProviderBody: { credential: "secret-key" },
      },
      providerModel: null,
      externalHttpStatus: 500,
      totalElapsedMs: Number.NaN,
    })
    const serialized = JSON.stringify(result)

    expect(result).toMatchObject({
      evaluationCompleted: false,
      observabilityStatus: "api_error",
      externalHttpStatus: 500,
      totalElapsedMs: 0,
      providerCallAttempted: null,
      facts: {
        childEnglishLevel: null,
        parentEnglishCommunication: null,
        koreanSupportNeed: null,
      },
      error: { code: "API_RESPONSE_INVALID", path: "conversationResponse" },
    })
    expect(serialized).not.toContain("secret-key")
    expect(serialized).not.toContain("raw prompt")
    expect(serialized).not.toContain("rawProviderBody")
  })

  it("accepts only the exact single-case CLI arguments", () => {
    const valid = [
      "--case=subject-separation",
      "--max-provider-requests=1",
      "--json",
    ]
    expect(hasExactSubjectSeparationArguments(valid)).toBe(true)
    expect(hasExactSubjectSeparationArguments([...valid, "--full-suite"])).toBe(false)
    expect(hasExactSubjectSeparationArguments([
      "--case=subject-separation",
      "--max-provider-requests=2",
      "--json",
    ])).toBe(false)
  })

  it("runs the subject-separation harness through the mock provider exactly once", async () => {
    const model = providerModelFixture()
    const analyzeConversation = vi.fn(async () => model)
    const provider = {
      analyzeConversation,
      generateConsultingResponse: analyzeConversation,
      explainRecommendation: vi.fn(async () => null),
      getLastDiagnostic: () => ({
        code: "ok" as const,
        providerResponseReceived: true,
        httpStatus: 200,
        errorStatus: null,
        repaired: false,
        requestCount: 1,
        elapsedMs: 10,
      }),
      getLastValidatedResponse: () => model,
    }

    const result = await runSubjectSeparationObservation(provider)

    expect(analyzeConversation).toHaveBeenCalledTimes(1)
    expect(result).toMatchObject({
      evaluationCompleted: true,
      observabilityStatus: "complete",
      providerCallAttempted: true,
      providerResponseValidated: true,
      providerRequestCount: 1,
      facts: {
        childEnglishLevel: "beginner",
        parentEnglishCommunication: "possible",
        koreanSupportNeed: "unknown",
      },
      forbiddenInferences: [],
      error: null,
    })
  })

  it("keeps deterministic fallback free of unsupported gate inferences", async () => {
    const analyzeConversation = vi.fn(async () => null)
    const provider = {
      analyzeConversation,
      generateConsultingResponse: analyzeConversation,
      explainRecommendation: vi.fn(async () => null),
      getLastDiagnostic: () => ({
        code: "network_error" as const,
        providerResponseReceived: false,
        httpStatus: null,
        errorStatus: null,
        repaired: false,
        requestCount: 1,
        elapsedMs: 12,
      }),
      getLastValidatedResponse: () => null,
    }

    const result = await runSubjectSeparationObservation(provider)

    expect(analyzeConversation).toHaveBeenCalledTimes(1)
    expect(result).toMatchObject({
      providerCallAttempted: true,
      providerResponseReceived: false,
      providerResponseValidated: false,
      aiUsed: false,
      fallbackReason: "network_error",
      facts: {
        childEnglishLevel: "beginner",
        parentEnglishCommunication: "possible",
        koreanSupportNeed: "unknown",
      },
      forbiddenInferences: [],
      factCollectionMode: "deterministic_fallback",
    })
  })
})

function responseFixture(input: {
  readonly diagnostics: CampfitV3AiDiagnostics
  readonly aiUsed: boolean
  readonly facts?: Partial<Record<CampfitV3FactKey, CampfitV3Fact>>
}): CampfitV3ConversationResponse {
  return {
    assistantMessage: "안전한 요약",
    updatedState: {
      facts: input.facts ?? {
        budgetRangeKrw: fact("budgetRangeKrw", { min: 5_000_000, max: 8_000_000 }),
        departureWindow: fact("departureWindow", "다음 여름방학"),
        durationWeeks: fact("durationWeeks", 2),
        childEnglishLevel: fact("childEnglishLevel", "beginner"),
        parentEnglishCommunication: fact("parentEnglishCommunication", "possible"),
      },
      askedQuestionKeys: ["child_english_level"],
      completedQuestionKeys: ["child_english_level"],
      failedQuestionKeys: [],
      currentQuestionKey: "first_overseas_experience",
      questionCount: 2,
      progress: 45,
      unresolved: [],
      conflicts: [],
    },
    updatedBasicInfo: {
      childAges: [8],
      departureWindow: "다음 여름방학",
      durationWeeks: 2,
      budgetMinKrw: 5_000_000,
      budgetMaxKrw: 8_000_000,
      adultCount: 1,
      childCount: 1,
      guardianStaysNearby: true,
    },
    quickReplies: [],
    questionKey: "first_overseas_experience",
    progress: 45,
    progressMessage: "상담을 이어가고 있어요.",
    readyForRecommendation: false,
    conflicts: [],
    warnings: [],
    aiUsed: input.aiUsed,
    diagnostics: input.diagnostics,
  }
}

function diagnosticsFixture(
  overrides: Partial<CampfitV3AiDiagnostics> = {},
): CampfitV3AiDiagnostics {
  return {
    providerCallAttempted: true,
    providerResponseReceived: true,
    providerResponseValidated: true,
    aiUsed: true,
    fallbackReason: null,
    providerHttpStatus: 200,
    providerErrorStatus: null,
    providerRequestCount: 1,
    elapsedMs: 12_000,
    ...overrides,
  }
}

function fact(key: CampfitV3FactKey, value: unknown): CampfitV3Fact {
  const subject = key === "childEnglishLevel"
    ? "child"
    : key === "parentEnglishCommunication"
      ? "parent"
      : "constraint"
  return {
    key,
    subject,
    value,
    source: key === "childEnglishLevel" || key === "parentEnglishCommunication"
      ? "explicit_user_statement"
      : "structured_input",
    confidence: 1,
    evidence: "fixture evidence must never be serialized",
    updatedAt: "2026-07-13T00:00:00.000Z",
  }
}

function providerModelFixture(): CampfitV3ModelResponse {
  return {
    assistantMessage: "아이와 부모님의 영어 수준을 나누어 확인했어요.",
    facts: [
      {
        key: "childEnglishLevel",
        subject: "child",
        value: "beginner",
        source: "explicit_user_statement",
        confidence: 1,
        evidence: "provider evidence must never be serialized",
      },
      {
        key: "parentEnglishCommunication",
        subject: "parent",
        value: "possible",
        source: "explicit_user_statement",
        confidence: 1,
        evidence: "provider evidence must never be serialized",
      },
    ],
    unresolved: ["koreanSupportNeed"],
    conflicts: [],
    suggestedNextQuestionKey: "first_overseas_experience",
    nextAction: "ask",
    readyForRecommendation: false,
  }
}
