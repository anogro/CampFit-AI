import { loadEnvConfig } from "@next/env"
import { processConversationMessage, startConversation } from "@/lib/campfit/v3/conversationService"
import { GeminiCampfitV3ProviderCore } from "@/lib/campfit/v3/geminiProviderCore"
import type { CampfitV3ModelResponse, CampfitV3ProviderDiagnostic } from "@/lib/campfit/v3/provider"
import {
  buildGeminiObservabilityResult,
  hasExactSubjectSeparationArguments,
  isGeminiObservabilityGatePassed,
  runSubjectSeparationObservation,
} from "@/scripts/campfit/v3/geminiObservability"
import type {
  CampfitV3BasicInfo,
  CampfitV3ConversationResponse,
  CampfitV3ConversationState,
  CampfitV3FactKey,
  CampfitV3TranscriptMessage,
} from "@/types/campfitV3"

loadEnvConfig(process.cwd())

const baseBasicInfo: CampfitV3BasicInfo = {
  childAges: [8],
  departureWindow: "다음 여름방학",
  durationWeeks: 2,
  budgetMinKrw: 5_000_000,
  budgetMaxKrw: 8_000_000,
  adultCount: 1,
  childCount: 1,
  guardianStaysNearby: true,
}

type EvaluationCase = {
  readonly name: string
  readonly currentQuestionKey: string
  readonly message: string
  readonly basicInfo?: CampfitV3BasicInfo
  readonly selectedKeys: readonly CampfitV3FactKey[]
  readonly assertModel: (model: CampfitV3ModelResponse | null) => Record<string, boolean>
  readonly assertOrchestration?: ((response: CampfitV3ConversationResponse) => Record<string, boolean>) | undefined
}

const cases: readonly EvaluationCase[] = [
  {
    name: "child beginner and parent English separation",
    currentQuestionKey: "child_english_level",
    message: "아이 영어는 초급이지만 저는 영어로 소통할 수 있어요.",
    selectedKeys: ["childEnglishLevel", "parentEnglishCommunication"],
    assertModel: (model) => ({
      childIsBeginner: modelFactValue(model, "childEnglishLevel") === "beginner",
      parentCanCommunicate: modelFactValue(model, "parentEnglishCommunication") === "possible",
      subjectsRemainSeparated: modelFact(model, "childEnglishLevel")?.subject === "child"
        && modelFact(model, "parentEnglishCommunication")?.subject === "parent",
      noInventedKoreanSupport: modelFactValue(model, "koreanSupportNeed") === undefined,
    }),
  },
  {
    name: "emergency-only Korean support",
    currentQuestionKey: "korean_support_need",
    message: "평소에는 한국어 지원이 필요 없지만 아이가 아플 때는 있었으면 좋겠어요.",
    selectedKeys: ["koreanSupportNeed"],
    assertModel: (model) => ({
      emergencyOnly: modelFactValue(model, "koreanSupportNeed") === "emergency_only",
      notDaily: modelFactValue(model, "koreanSupportNeed") !== "must_daily",
    }),
  },
  {
    name: "English growth with study-only avoidance",
    currentQuestionKey: "primary_experience_goal",
    message: "영어 실력도 늘었으면 좋겠지만 공부만 하는 캠프는 싫어요.",
    selectedKeys: ["experienceGoals", "studyOnlyAvoidance"],
    assertModel: (model) => ({
      EnglishGrowthPrimary: readModelGoal(model, "englishIntensive") === "primary",
      studyOnlyAvoidance: modelFactValue(model, "studyOnlyAvoidance") === true,
      noInventedSchoolGoal: readModelGoal(model, "schoolSchooling") === "none",
      noInventedProjectGoal: readModelGoal(model, "subjectProject") === "none",
      noInventedCultureGoal: readModelGoal(model, "cultureActivity") === "none",
    }),
  },
  {
    name: "parent cafe massage and rest goals",
    currentQuestionKey: "parent_stay_goal",
    message: "아이 캠프 시간에는 저는 카페에 가거나 마사지도 받고 쉬고 싶어요.",
    selectedKeys: ["parentStayGoals"],
    assertModel: (model) => ({
      cafeGoal: stringArrayModelFact(model, "parentStayGoals").includes("cafeDining"),
      restGoal: stringArrayModelFact(model, "parentStayGoals").includes("restWellness"),
      noInventedChildExperienceGoal: modelFactValue(model, "experienceGoals") === undefined,
    }),
  },
  {
    name: "Australia first with budget-aware alternatives",
    currentQuestionKey: "preferred_region",
    message: "호주가 가장 좋지만 가족 전체 예산은 700만 원 정도라 다른 지역도 괜찮아요.",
    basicInfo: { ...baseBasicInfo, budgetMaxKrw: 7_000_000 },
    selectedKeys: ["preferredRegions", "regionImportance", "budgetRangeKrw"],
    assertModel: (model) => ({
      OceaniaPreferred: stringArrayModelFact(model, "preferredRegions").includes("oceania"),
      alternativesAllowedWithStrongPreference: modelFactValue(model, "regionImportance") === "strong",
      regionIsNotMandatory: modelFactValue(model, "regionImportance") !== "must",
      modelBudgetMaximumSevenMillion: readModelBudgetMaximum(model) === 7_000_000,
    }),
    assertOrchestration: (response) => ({
      budgetMaximumSevenMillion: response.updatedBasicInfo.budgetMaxKrw === 7_000_000,
    }),
  },
]

type EvaluationStopReason = "rate_limited" | "provider_failed"

if (process.env["VITEST"] !== "true") await main()

async function main(): Promise<void> {
  if (!hasExactSubjectSeparationArguments(process.argv.slice(2))) {
    const result = buildGeminiObservabilityResult({
      response: null,
      providerModel: null,
      externalHttpStatus: null,
      totalElapsedMs: 0,
      invalidArguments: true,
    })
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
    process.exitCode = 1
    return
  }

  const provider = new GeminiCampfitV3ProviderCore({ maxProviderRequests: 1 })
  const result = await runSubjectSeparationObservation(provider)
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  process.exitCode = isGeminiObservabilityGatePassed(result) ? 0 : 1
}

async function runFullEvaluation(): Promise<void> {
  const provider = new GeminiCampfitV3ProviderCore()
  const caseResults: unknown[] = []
  let stoppedReason: EvaluationStopReason | null = null
  let isolatedCasesPass = true

  for (let index = 0; index < cases.length; index += 1) {
    const evaluationCase = cases[index]!
    const basicInfo = evaluationCase.basicInfo ?? baseBasicInfo
    const start = startConversation(basicInfo)
    const currentState = stateForQuestion(start.updatedState, evaluationCase.currentQuestionKey)
    const started = Date.now()
    const response = await processConversationMessage({
      transcript: [],
      currentState,
      basicInfo,
      userMessage: evaluationCase.message,
      quickReplyKey: null,
      provider,
    })
    const providerDiagnostic = provider.getLastDiagnostic()
    const providerResponse = provider.getLastValidatedResponse()
    const assertions = {
      ...evaluationCase.assertModel(providerResponse),
      ...(evaluationCase.assertOrchestration?.(response) ?? {}),
      actualGeminiResponseValidated: response.aiUsed
        && response.diagnostics?.providerResponseValidated === true
        && providerDiagnostic?.code === "ok"
        && providerResponse !== null,
    }
    const pass = Object.values(assertions).every(Boolean)
    isolatedCasesPass = isolatedCasesPass && pass
    caseResults.push({
      name: evaluationCase.name,
      elapsedMs: Date.now() - started,
      diagnostics: response.diagnostics ?? null,
      providerDiagnostic: publicDiagnostic(providerDiagnostic),
      providerFacts: selectedModelFacts(providerResponse, evaluationCase.selectedKeys),
      mergedStateFacts: selectedFacts(response, evaluationCase.selectedKeys),
      assertions,
      pass,
    })
    if (isRateLimited(response, providerDiagnostic)) {
      stoppedReason = "rate_limited"
      break
    }
    if (!assertions.actualGeminiResponseValidated) {
      stoppedReason = "provider_failed"
      break
    }
    if (index < cases.length - 1) await delay(3_000)
  }

  let sessionResult: unknown = null
  let singleSessionPass = false
  if (stoppedReason === null) {
    const session = await evaluateSingleSession(provider)
    sessionResult = session.result
    singleSessionPass = session.pass
    if (session.stoppedReason !== null) stoppedReason = session.stoppedReason
  }

  process.stdout.write(`${JSON.stringify({
    executedCases: caseResults.length,
    plannedCases: cases.length,
    stoppedReason,
    cases: caseResults,
    singleSession: sessionResult,
  }, null, 2)}\n`)

  process.exitCode = stoppedReason === "rate_limited"
    ? 2
    : isolatedCasesPass && caseResults.length === cases.length && singleSessionPass
      ? 0
      : 1
}

async function evaluateSingleSession(providerInstance: GeminiCampfitV3ProviderCore): Promise<{
  readonly result: unknown
  readonly stoppedReason: EvaluationStopReason | null
  readonly pass: boolean
}> {
  const turns = [
    "아이 영어는 초급이지만 저는 영어로 소통할 수 있어요.",
    "호주가 가장 좋지만 다른 지역도 괜찮아요.",
    "평소에는 한국어 지원이 필요 없고 비상 상황에서만 필요해요.",
    "예산은 700만 원이 아니라 900만 원까지 가능해요.",
  ] as const
  let basicInfo: CampfitV3BasicInfo = { ...baseBasicInfo, budgetMaxKrw: 7_000_000 }
  let state: CampfitV3ConversationState = { ...startConversation(basicInfo).updatedState, currentQuestionKey: null }
  let transcript: CampfitV3TranscriptMessage[] = []
  const elapsedByTurn: number[] = []
  const progressByTurn: number[] = [state.progress]
  const questionKeyByTurn: Array<string | null> = []
  const diagnostics: unknown[] = []
  const validatedModels: Array<CampfitV3ModelResponse | null> = []
  let response: CampfitV3ConversationResponse | null = null

  for (let index = 0; index < turns.length; index += 1) {
    const started = Date.now()
    response = await processConversationMessage({
      transcript,
      currentState: { ...state, currentQuestionKey: null },
      basicInfo,
      userMessage: turns[index]!,
      quickReplyKey: null,
      provider: providerInstance,
    })
    elapsedByTurn.push(Date.now() - started)
    progressByTurn.push(response.progress)
    questionKeyByTurn.push(response.questionKey)
    const providerDiagnostic = providerInstance.getLastDiagnostic()
    const validatedModel = providerInstance.getLastValidatedResponse()
    validatedModels.push(validatedModel)
    diagnostics.push({
      service: response.diagnostics ?? null,
      provider: publicDiagnostic(providerDiagnostic),
    })
    if (isRateLimited(response, providerDiagnostic)) {
      return {
        stoppedReason: "rate_limited",
        pass: false,
        result: {
          completedTurns: index + 1,
          stoppedReason: "rate_limited",
          elapsedByTurn,
          questionKeyByTurn,
          diagnostics,
        },
      }
    }
    if (!response.aiUsed
      || response.diagnostics?.providerResponseValidated !== true
      || providerDiagnostic?.code !== "ok"
      || validatedModel === null) {
      return {
        stoppedReason: "provider_failed",
        pass: false,
        result: {
          completedTurns: index + 1,
          stoppedReason: "provider_failed",
          elapsedByTurn,
          questionKeyByTurn,
          diagnostics,
        },
      }
    }
    transcript = [
      ...transcript,
      { role: "user", content: turns[index]! },
      { role: "assistant", content: response.assistantMessage },
    ]
    state = response.updatedState
    basicInfo = response.updatedBasicInfo
    if (index < turns.length - 1) await delay(3_000)
  }

  if (response === null) return { stoppedReason: "provider_failed", pass: false, result: null }
  const assertions = {
    modelTurn1ChildIsBeginner: modelFactValue(validatedModels[0] ?? null, "childEnglishLevel") === "beginner",
    modelTurn1ParentCanCommunicate: modelFactValue(validatedModels[0] ?? null, "parentEnglishCommunication") === "possible",
    modelTurn2OceaniaPreferred: stringArrayModelFact(validatedModels[1] ?? null, "preferredRegions").includes("oceania"),
    modelTurn2StrongButAlternativesAllowed: modelFactValue(validatedModels[1] ?? null, "regionImportance") === "strong",
    modelTurn3EmergencyKoreanOnly: modelFactValue(validatedModels[2] ?? null, "koreanSupportNeed") === "emergency_only",
    modelTurn4CorrectedBudgetMaximum: readModelBudgetMaximum(validatedModels[3] ?? null) === 9_000_000,
    stateChildIsBeginner: factValue(response, "childEnglishLevel") === "beginner",
    stateParentCanCommunicate: factValue(response, "parentEnglishCommunication") === "possible",
    stateOceaniaPreferred: stringArrayFact(response, "preferredRegions").includes("oceania"),
    stateStrongButAlternativesAllowed: factValue(response, "regionImportance") === "strong",
    stateEmergencyKoreanOnly: factValue(response, "koreanSupportNeed") === "emergency_only",
    correctedBudgetMaximum: response.updatedBasicInfo.budgetMaxKrw === 9_000_000,
    correctionSourcePreserved: response.updatedState.facts.budgetRangeKrw?.source === "user_correction",
    progressNeverDecreased: progressByTurn.every((value, index) => index === 0 || value >= progressByTurn[index - 1]!),
    completedChildEnglishNotReasked: !questionKeyByTurn.slice(0).includes("child_english_level"),
    completedRegionNotReasked: !questionKeyByTurn.slice(1).includes("preferred_region")
      && !questionKeyByTurn.slice(1).includes("region_importance"),
    completedKoreanSupportNotReasked: !questionKeyByTurn.slice(2).includes("korean_support_need"),
  }
  const pass = Object.values(assertions).every(Boolean)
  return {
    stoppedReason: null,
    pass,
    result: {
      completedTurns: turns.length,
      elapsedByTurn,
      diagnostics,
      providerFactsByTurn: validatedModels.map((model) => model?.facts.map((fact) => ({
        key: fact.key,
        subject: fact.subject,
        value: fact.value,
        source: fact.source,
      })) ?? null),
      mergedStateFacts: selectedFacts(response, [
        "childEnglishLevel",
        "parentEnglishCommunication",
        "preferredRegions",
        "regionImportance",
        "koreanSupportNeed",
        "budgetRangeKrw",
      ]),
      progressByTurn,
      questionKeyByTurn,
      assertions,
      pass,
    },
  }
}

function stateForQuestion(state: CampfitV3ConversationState, questionKey: string): CampfitV3ConversationState {
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

function selectedFacts(response: CampfitV3ConversationResponse, keys: readonly CampfitV3FactKey[]) {
  return keys.flatMap((key) => {
    const fact = response.updatedState.facts[key]
    return fact === undefined ? [] : [{ key: fact.key, subject: fact.subject, value: fact.value, source: fact.source }]
  })
}

function selectedModelFacts(model: CampfitV3ModelResponse | null, keys: readonly CampfitV3FactKey[]) {
  return keys.flatMap((key) => {
    const fact = modelFact(model, key)
    return fact === undefined ? [] : [{ key: fact.key, subject: fact.subject, value: fact.value, source: fact.source }]
  })
}

function modelFact(model: CampfitV3ModelResponse | null, key: CampfitV3FactKey) {
  return model?.facts.find((fact) => fact.key === key)
}

function modelFactValue(model: CampfitV3ModelResponse | null, key: CampfitV3FactKey): unknown {
  return modelFact(model, key)?.value
}

function stringArrayModelFact(model: CampfitV3ModelResponse | null, key: CampfitV3FactKey): readonly string[] {
  const value = modelFactValue(model, key)
  return Array.isArray(value) && value.every((item) => typeof item === "string") ? value : []
}

function readModelGoal(model: CampfitV3ModelResponse | null, key: string): unknown {
  const value = modelFactValue(model, "experienceGoals")
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)[key]
    : undefined
}

function readModelBudgetMaximum(model: CampfitV3ModelResponse | null): unknown {
  const value = modelFactValue(model, "budgetRangeKrw")
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)["max"]
    : undefined
}

function factValue(response: CampfitV3ConversationResponse, key: CampfitV3FactKey): unknown {
  return response.updatedState.facts[key]?.value
}

function stringArrayFact(response: CampfitV3ConversationResponse, key: CampfitV3FactKey): readonly string[] {
  const value = factValue(response, key)
  return Array.isArray(value) && value.every((item) => typeof item === "string") ? value : []
}

function readGoal(response: CampfitV3ConversationResponse, key: string): unknown {
  const value = factValue(response, "experienceGoals")
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)[key]
    : undefined
}

function publicDiagnostic(diagnostic: CampfitV3ProviderDiagnostic | null) {
  if (diagnostic === null) return null
  return {
    code: diagnostic.code,
    providerResponseReceived: diagnostic.providerResponseReceived,
    httpStatus: diagnostic.httpStatus,
    errorStatus: diagnostic.errorStatus,
    repaired: diagnostic.repaired,
    requestCount: diagnostic.requestCount,
    elapsedMs: diagnostic.elapsedMs,
  }
}

function isRateLimited(response: CampfitV3ConversationResponse, diagnostic: CampfitV3ProviderDiagnostic | null): boolean {
  return response.diagnostics?.fallbackReason === "rate_limited" || diagnostic?.code === "rate_limited"
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
