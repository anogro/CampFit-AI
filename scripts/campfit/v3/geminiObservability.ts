import { processConversationMessage, startConversation } from "@/lib/campfit/v3/conversationService"
import type { CampfitV3LLMProvider, CampfitV3ModelResponse } from "@/lib/campfit/v3/provider"
import {
  CampfitV3ConversationResponseSchema,
  CampfitV3ModelResponseSchema,
} from "@/lib/campfit/v3/schemas"
import type {
  CampfitV3AiDiagnostics,
  CampfitV3ConversationResponse,
  CampfitV3FactKey,
  CampfitV3FactSource,
} from "@/types/campfitV3"

const subjectSeparationMessage = "아이는 영어가 초급이지만 저는 영어로 소통할 수 있어요."
const expectedFactKeys = new Set<CampfitV3FactKey>([
  "budgetRangeKrw",
  "departureWindow",
  "durationWeeks",
  "budgetIncludesFlight",
  "childEnglishLevel",
  "parentEnglishCommunication",
])

export type GeminiObservabilityStatus =
  | "complete"
  | "diagnostics_missing"
  | "api_error"
  | "harness_failed"

export type GeminiObservabilityResult = {
  readonly caseId: "subject-separation"
  readonly evaluationCompleted: boolean
  readonly observabilityStatus: GeminiObservabilityStatus
  readonly externalHttpStatus: number | null
  readonly providerCallAttempted: boolean | null
  readonly providerResponseReceived: boolean | null
  readonly providerResponseValidated: boolean | null
  readonly aiUsed: boolean | null
  readonly fallbackReason: CampfitV3AiDiagnostics["fallbackReason"]
  readonly providerHttpStatus: number | null
  readonly providerErrorStatus: string | null
  readonly providerRequestCount: number | null
  readonly providerElapsedMs: number | null
  readonly totalElapsedMs: number
  readonly facts: {
    readonly childEnglishLevel: string | null
    readonly parentEnglishCommunication: string | null
    readonly koreanSupportNeed: string | null
  }
  readonly factSources: {
    readonly childEnglishLevel: CampfitV3FactSource | null
    readonly parentEnglishCommunication: CampfitV3FactSource | null
    readonly koreanSupportNeed: CampfitV3FactSource | null
  }
  readonly factCollectionMode: "ai_validated_provider_response" | "deterministic_fallback" | null
  readonly forbiddenInferences: readonly CampfitV3FactKey[]
  readonly error: {
    readonly code: "OBSERVABILITY_MISSING" | "API_RESPONSE_INVALID" | "EVALUATION_EXECUTION_FAILED" | "INVALID_EVALUATION_ARGUMENT"
    readonly path: "conversationResponse" | "conversationResponse.diagnostics" | "conversationService" | "cli.arguments"
  } | null
}

type BuildObservationInput = {
  readonly response: unknown
  readonly providerModel?: unknown
  readonly externalHttpStatus: number | null
  readonly totalElapsedMs: number
  readonly executionFailed?: boolean
  readonly invalidArguments?: boolean
}

export function buildGeminiObservabilityResult(input: BuildObservationInput): GeminiObservabilityResult {
  const parsed = CampfitV3ConversationResponseSchema.safeParse(input.response)
  if (!parsed.success) {
    if (input.invalidArguments === true) {
      return emptyObservation({
        externalHttpStatus: input.externalHttpStatus,
        totalElapsedMs: input.totalElapsedMs,
        observabilityStatus: "harness_failed",
        error: { code: "INVALID_EVALUATION_ARGUMENT", path: "cli.arguments" },
      })
    }
    const executionFailed = input.executionFailed === true
    return emptyObservation({
      externalHttpStatus: input.externalHttpStatus,
      totalElapsedMs: input.totalElapsedMs,
      observabilityStatus: executionFailed ? "harness_failed" : "api_error",
      error: executionFailed
        ? { code: "EVALUATION_EXECUTION_FAILED", path: "conversationService" }
        : { code: "API_RESPONSE_INVALID", path: "conversationResponse" },
    })
  }

  const response = parsed.data
  const diagnostics = response.diagnostics
  if (diagnostics === undefined) {
    return {
      ...observationFacts(response, input.providerModel, response.aiUsed),
      caseId: "subject-separation",
      evaluationCompleted: false,
      observabilityStatus: "diagnostics_missing",
      externalHttpStatus: input.externalHttpStatus,
      providerCallAttempted: null,
      providerResponseReceived: null,
      providerResponseValidated: null,
      aiUsed: null,
      fallbackReason: null,
      providerHttpStatus: null,
      providerErrorStatus: null,
      providerRequestCount: null,
      providerElapsedMs: null,
      totalElapsedMs: nonnegativeMilliseconds(input.totalElapsedMs),
      factCollectionMode: null,
      error: { code: "OBSERVABILITY_MISSING", path: "conversationResponse.diagnostics" },
    }
  }

  return {
    ...observationFacts(response, input.providerModel, diagnostics.aiUsed),
    caseId: "subject-separation",
    evaluationCompleted: true,
    observabilityStatus: "complete",
    externalHttpStatus: input.externalHttpStatus,
    providerCallAttempted: diagnostics.providerCallAttempted,
    providerResponseReceived: diagnostics.providerResponseReceived,
    providerResponseValidated: diagnostics.providerResponseValidated,
    aiUsed: diagnostics.aiUsed,
    fallbackReason: diagnostics.fallbackReason,
    providerHttpStatus: diagnostics.providerHttpStatus,
    providerErrorStatus: diagnostics.providerErrorStatus,
    providerRequestCount: diagnostics.providerRequestCount,
    providerElapsedMs: diagnostics.elapsedMs,
    totalElapsedMs: nonnegativeMilliseconds(input.totalElapsedMs),
    factCollectionMode: diagnostics.aiUsed
      ? CampfitV3ModelResponseSchema.safeParse(input.providerModel).success
        ? "ai_validated_provider_response"
        : null
      : "deterministic_fallback",
    error: null,
  }
}

export async function runSubjectSeparationObservation(
  provider: ObservableCampfitV3Provider,
): Promise<GeminiObservabilityResult> {
  const basicInfo = {
    childAges: [8],
    departureWindow: "다음 여름방학",
    durationWeeks: 2,
    budgetMinKrw: 5_000_000,
    budgetMaxKrw: 8_000_000,
    adultCount: 1,
    childCount: 1,
    guardianStaysNearby: true as const,
  }
  const start = startConversation(basicInfo)
  const currentState = stateForSubjectSeparation(start)
  const started = Date.now()

  try {
    const response = await processConversationMessage({
      transcript: [
        {
          role: "assistant",
          content: start.assistantMessage,
          questionKey: "child_english_level",
        },
        {
          role: "user",
          content: subjectSeparationMessage,
          questionKey: "child_english_level",
        },
      ],
      currentState,
      basicInfo,
      userMessage: subjectSeparationMessage,
      quickReplyKey: null,
      provider,
    })
    return buildGeminiObservabilityResult({
      response,
      providerModel: provider.getLastValidatedResponse?.() ?? null,
      externalHttpStatus: null,
      totalElapsedMs: Date.now() - started,
    })
  } catch {
    return buildGeminiObservabilityResult({
      response: null,
      providerModel: null,
      externalHttpStatus: null,
      totalElapsedMs: Date.now() - started,
      executionFailed: true,
    })
  }
}

export function isGeminiObservabilityGatePassed(result: GeminiObservabilityResult): boolean {
  return result.evaluationCompleted
    && result.observabilityStatus === "complete"
    && result.providerCallAttempted === true
    && result.providerResponseReceived === true
    && result.providerResponseValidated === true
    && result.aiUsed === true
    && result.fallbackReason === null
    && result.providerHttpStatus === 200
    && result.providerRequestCount === 1
    && result.facts.childEnglishLevel === "beginner"
    && result.facts.parentEnglishCommunication === "possible"
    && result.facts.koreanSupportNeed === "unknown"
    && result.forbiddenInferences.length === 0
}

export function hasExactSubjectSeparationArguments(args: readonly string[]): boolean {
  const expected = [
    "--case=subject-separation",
    "--max-provider-requests=1",
    "--json",
  ] as const
  return args.length === expected.length && expected.every((argument) => args.includes(argument))
}

function stateForSubjectSeparation(
  response: CampfitV3ConversationResponse,
): CampfitV3ConversationResponse["updatedState"] {
  const state = response.updatedState
  const questionKey = "child_english_level"
  const alreadyAsked = state.askedQuestionKeys.includes(questionKey)
  return {
    ...state,
    currentQuestionKey: questionKey,
    askedQuestionKeys: alreadyAsked ? state.askedQuestionKeys : [...state.askedQuestionKeys, questionKey],
    completedQuestionKeys: state.completedQuestionKeys.filter((key) => key !== questionKey),
    failedQuestionKeys: state.failedQuestionKeys.filter((key) => key !== questionKey),
    questionCount: alreadyAsked ? state.questionCount : Math.min(10, state.questionCount + 1),
  }
}

type ObservableCampfitV3Provider = CampfitV3LLMProvider & {
  readonly getLastValidatedResponse?: () => CampfitV3ModelResponse | null
}

function observationFacts(
  response: CampfitV3ConversationResponse,
  providerModel: unknown,
  aiUsed: boolean,
): Pick<
  GeminiObservabilityResult,
  "facts" | "factSources" | "forbiddenInferences"
> {
  const parsedModel = CampfitV3ModelResponseSchema.safeParse(providerModel)
  const providerFacts = parsedModel.success
    ? new Map(parsedModel.data.facts.map((fact) => [fact.key, fact]))
    : null
  const useProviderFacts = aiUsed && providerFacts !== null
  const mergedFacts = response.updatedState.facts
  const childEnglishFact = useProviderFacts
    ? providerFacts.get("childEnglishLevel")
    : mergedFacts.childEnglishLevel
  const parentEnglishFact = useProviderFacts
    ? providerFacts.get("parentEnglishCommunication")
    : mergedFacts.parentEnglishCommunication
  const koreanSupportFact = useProviderFacts
    ? providerFacts.get("koreanSupportNeed")
    : mergedFacts.koreanSupportNeed
  const observedKeys = useProviderFacts
    ? Array.from(providerFacts.keys())
    : Object.keys(mergedFacts) as CampfitV3FactKey[]
  const forbiddenInferences = observedKeys
    .filter((key) => !expectedFactKeys.has(key))
    .sort()
  return {
    facts: {
      childEnglishLevel: stringFactValue(childEnglishFact?.value),
      parentEnglishCommunication: stringFactValue(parentEnglishFact?.value),
      koreanSupportNeed: koreanSupportFact === undefined
        ? "unknown"
        : stringFactValue(koreanSupportFact.value),
    },
    factSources: {
      childEnglishLevel: childEnglishFact?.source ?? null,
      parentEnglishCommunication: parentEnglishFact?.source ?? null,
      koreanSupportNeed: koreanSupportFact?.source ?? null,
    },
    forbiddenInferences,
  }
}

function emptyObservation(input: {
  readonly externalHttpStatus: number | null
  readonly totalElapsedMs: number
  readonly observabilityStatus: "api_error" | "harness_failed"
  readonly error: NonNullable<GeminiObservabilityResult["error"]>
}): GeminiObservabilityResult {
  return {
    caseId: "subject-separation",
    evaluationCompleted: false,
    observabilityStatus: input.observabilityStatus,
    externalHttpStatus: input.externalHttpStatus,
    providerCallAttempted: null,
    providerResponseReceived: null,
    providerResponseValidated: null,
    aiUsed: null,
    fallbackReason: null,
    providerHttpStatus: null,
    providerErrorStatus: null,
    providerRequestCount: null,
    providerElapsedMs: null,
    totalElapsedMs: nonnegativeMilliseconds(input.totalElapsedMs),
    facts: {
      childEnglishLevel: null,
      parentEnglishCommunication: null,
      koreanSupportNeed: null,
    },
    factSources: {
      childEnglishLevel: null,
      parentEnglishCommunication: null,
      koreanSupportNeed: null,
    },
    factCollectionMode: null,
    forbiddenInferences: [],
    error: input.error,
  }
}

function stringFactValue(value: unknown): string | null {
  return typeof value === "string" ? value : null
}

function nonnegativeMilliseconds(value: number): number {
  return Number.isFinite(value) && value >= 0 ? Math.round(value) : 0
}
