import { loadEnvConfig } from "@next/env"
import { processConversationMessage, startConversation } from "@/lib/campfit/v3/conversationService"
import { GeminiCampfitV3ProviderCore, parseGeminiStructuredResponse } from "@/lib/campfit/v3/geminiProviderCore"
import { getQuestion } from "@/lib/campfit/v3/questionBank"
import type { CampfitV3LLMProvider, CampfitV3ModelResponse, CampfitV3ProviderDiagnostic } from "@/lib/campfit/v3/provider"
import { createFact, extractDeterministicFacts, mergeFacts } from "@/lib/campfit/v3/stateEngine"
import { runSubjectSeparationObservation } from "@/scripts/campfit/v3/geminiObservability"
import type {
  CampfitV3BasicInfo,
  CampfitV3ConversationResponse,
  CampfitV3ConversationState,
  CampfitV3Fact,
  CampfitV3FactKey,
  CampfitV3FactSource,
  CampfitV3FactStatus,
  CampfitV3FactSubject,
  CampfitV3TranscriptMessage,
} from "@/types/campfitV3"
import type {
  CounselingEvaluationCase,
  CounselingEvaluationScenario,
  CounselingEvaluationTurn,
  EvaluationMatcher,
} from "@/scripts/campfit/v3/counselingEvaluationFixtures"
import {
  counselingEvaluationCases,
  counselingEvaluationScenarios,
} from "@/scripts/campfit/v3/counselingEvaluationFixtures"

export type CounselingEvaluationMode = "fallback" | "mock" | "live"
export type EvaluationStatus = "PASS" | "PARTIAL" | "FAIL" | "NOT_APPLICABLE" | "NOT_TESTED"

export type MatcherCheck = {
  readonly path: string
  readonly matcher: EvaluationMatcher["matcher"]
  readonly expected?: unknown
  readonly actual?: unknown
  readonly passed: boolean
}

export type CounselingCaseResult = {
  readonly id: string
  readonly category: string
  readonly status: EvaluationStatus
  readonly criteria: Readonly<Record<string, EvaluationStatus>>
  readonly checks: readonly MatcherCheck[]
  readonly forbiddenFacts: readonly CampfitV3FactKey[]
  readonly questionKey: string | null
  readonly questionTargetPassed: boolean | null
  readonly diagnostic: PublicDiagnostic | null
}

export type CounselingScenarioResult = {
  readonly id: string
  readonly title: string
  readonly status: EvaluationStatus
  readonly turns: readonly ScenarioTurnResult[]
  readonly finalChecks: readonly MatcherCheck[]
  readonly repeatedQuestionKeys: readonly string[]
  readonly duplicateQuestionKeys: readonly string[]
}

export type ScenarioTurnResult = {
  readonly turn: number
  readonly checks: readonly MatcherCheck[]
  readonly forbiddenFacts: readonly CampfitV3FactKey[]
  readonly questionKey: string | null
}

export type MockValidationResult = {
  readonly id: string
  readonly expected: string
  readonly actual: string
  readonly passed: boolean
}

export type CounselingEvaluationReport = {
  readonly mode: CounselingEvaluationMode
  readonly fixtureCounts: { readonly singleTurn: number; readonly scenarios: number; readonly scenarioTurns: number }
  readonly summary: {
    readonly totalCases: number
    readonly passed: number
    readonly partial: number
    readonly failed: number
    readonly unsupportedInferenceFailures: number
    readonly duplicateQuestionFailures: number
    readonly privacySafetyFailures: number
    readonly fieldFailures: Readonly<Record<string, number>>
  }
  readonly cases: readonly CounselingCaseResult[]
  readonly scenarios: readonly CounselingScenarioResult[]
  readonly mockValidation?: readonly MockValidationResult[]
  readonly live?: LiveEvaluationResult
}

export type PublicDiagnostic = {
  readonly code: CampfitV3ProviderDiagnostic["code"]
  readonly providerResponseReceived: boolean
  readonly httpStatus: number | null
  readonly errorStatus: string | null
  readonly repaired: boolean
  readonly requestCount: number
  readonly elapsedMs: number
}

export type LiveEvaluationResult = {
  readonly status: EvaluationStatus
  readonly enabled: boolean
  readonly stopReason: "rate_limited" | "network_error" | "provider_failed" | null
  readonly observation: {
    readonly evaluationCompleted: boolean
    readonly externalHttpStatus: number | null
    readonly providerCallAttempted: boolean | null
    readonly providerResponseValidated: boolean | null
    readonly aiUsed: boolean | null
    readonly fallbackReason: string | null
    readonly facts: {
      readonly childEnglishLevel: string | null
      readonly parentEnglishCommunication: string | null
      readonly koreanSupportNeed: string | null
    }
    readonly totalElapsedMs: number
  } | null
}

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

type EvaluationContext = {
  readonly response: CampfitV3ConversationResponse
  readonly state: CampfitV3ConversationState
  readonly basicInfo: CampfitV3BasicInfo
  readonly questionKey: string | null
}

export function evaluateMatcher(matcher: EvaluationMatcher, context: EvaluationContext | Record<string, unknown>): MatcherCheck {
  const actual = matcher.path === "questionKey"
    ? (context as EvaluationContext).questionKey
    : getPath(toMatcherContext(context), matcher.path)
  let passed = false
  switch (matcher.matcher) {
    case "equals": passed = deepEqual(actual, matcher.expected); break
    case "contains": passed = contains(actual, matcher.expected); break
    case "containsAll": passed = Array.isArray(actual) && Array.isArray(matcher.expected) && matcher.expected.every((item) => actual.some((value) => deepEqual(value, item))); break
    case "doesNotContain": passed = !contains(actual, matcher.expected); break
    case "oneOf": passed = Array.isArray(matcher.expected) && matcher.expected.some((item) => deepEqual(actual, item)); break
    case "statusIs": passed = typeof actual === "string" && actual === matcher.expected; break
    case "confidenceAtLeast": passed = typeof actual === "number" && typeof matcher.expected === "number" && actual >= matcher.expected; break
    case "confidenceBelow": passed = typeof actual === "number" && typeof matcher.expected === "number" && actual < matcher.expected; break
    case "isUnknown": passed = actual === undefined || actual === null || (typeof actual === "object" && actual !== null && "status" in actual && actual.status === "unknown"); break
    case "isAbsent": passed = actual === undefined || actual === null; break
    case "questionTargets": passed = questionMatches((context as EvaluationContext).questionKey, matcher.expected); break
    case "questionDoesNotTarget": passed = !questionMatches((context as EvaluationContext).questionKey, matcher.expected); break
  }
  return { path: matcher.path, matcher: matcher.matcher, expected: matcher.expected, actual, passed }
}

function toMatcherContext(context: EvaluationContext | Record<string, unknown>): unknown {
  if (!("response" in context) || !("state" in context) || !("basicInfo" in context)) return context
  const typed = context as EvaluationContext
  return {
    response: typed.response,
    state: typed.state,
    basicInfo: typed.basicInfo,
    updatedBasicInfo: typed.basicInfo,
    facts: typed.state.facts,
    questionKey: typed.questionKey,
  }
}

export async function runFallbackEvaluation(): Promise<CounselingEvaluationReport> {
  return runCounselingEvaluation("fallback", fallbackProvider)
}

export async function runMockEvaluation(): Promise<CounselingEvaluationReport> {
  const report = await runCounselingEvaluation("mock", new MockGeminiProvider())
  return { ...report, mockValidation: runMockValidationSuite() }
}

export async function runCounselingEvaluation(mode: "fallback" | "mock", provider: CampfitV3LLMProvider): Promise<CounselingEvaluationReport> {
  const cases = [] as CounselingCaseResult[]
  for (const evaluationCase of counselingEvaluationCases) cases.push(await evaluateCase(evaluationCase, provider))
  const scenarios = [] as CounselingScenarioResult[]
  for (const scenario of counselingEvaluationScenarios) scenarios.push(await evaluateScenario(scenario, provider))
  return buildReport(mode, cases, scenarios)
}

export async function runLiveEvaluation(): Promise<CounselingEvaluationReport> {
  if (process.env["RUN_GEMINI_LIVE_EVAL"] !== "1") {
    return {
      ...buildReport("live", [], []),
      live: { status: "NOT_TESTED", enabled: false, stopReason: null, observation: null },
    }
  }
  loadEnvConfig(process.cwd())
  const requested = Number(process.env["CAMPFIT_V3_LIVE_MAX_REQUESTS"] ?? "1")
  const maxProviderRequests: 1 | 2 = requested >= 2 ? 2 : 1
  const provider = new GeminiCampfitV3ProviderCore({ maxProviderRequests })
  const observation = await runSubjectSeparationObservation(provider)
  const diagnostic = provider.getLastDiagnostic?.()
  const stopReason = classifyLiveStopReason(diagnostic?.code ?? null, observation.fallbackReason)
  const passed = observation.evaluationCompleted
    && observation.providerCallAttempted === true
    && observation.providerResponseValidated === true
    && observation.aiUsed === true
    && observation.fallbackReason === null
    && observation.externalHttpStatus === 200
    && observation.facts.childEnglishLevel === "beginner"
    && observation.facts.parentEnglishCommunication === "possible"
    && observation.facts.koreanSupportNeed === "unknown"
    && observation.forbiddenInferences.length === 0
  return {
    ...buildReport("live", [], []),
    live: {
      enabled: true,
      status: passed ? "PASS" : "FAIL",
      stopReason,
      observation: {
        evaluationCompleted: observation.evaluationCompleted,
        externalHttpStatus: observation.externalHttpStatus,
        providerCallAttempted: observation.providerCallAttempted,
        providerResponseValidated: observation.providerResponseValidated,
        aiUsed: observation.aiUsed,
        fallbackReason: observation.fallbackReason,
        facts: observation.facts,
        totalElapsedMs: observation.totalElapsedMs,
      },
    },
  }
}

export function classifyLiveStopReason(code: string | null, fallbackReason: string | null): LiveEvaluationResult["stopReason"] {
  if (code === "rate_limited" || fallbackReason === "rate_limited") return "rate_limited"
  if (code === "network_error" || fallbackReason === "network_error") return "network_error"
  return null
}

export function runMockValidationSuite(): readonly MockValidationResult[] {
  const valid = JSON.stringify(validModel())
  const fixtures: ReadonlyArray<{ id: string; input: string; expected: string }> = [
    { id: "valid", input: valid, expected: "accepted" },
    { id: "partial", input: JSON.stringify({ ...validModel(), facts: [], unresolved: ["childEnglishLevel"] }), expected: "accepted" },
    { id: "schema-invalid", input: "{\"facts\":", expected: "json_parse_failed" },
    { id: "semantic-duplicate", input: JSON.stringify({ ...validModel(), facts: [validFact("childEnglishLevel"), validFact("childEnglishLevel")] }), expected: "semantic_validation_failed" },
    { id: "semantic-question", input: JSON.stringify({ ...validModel(), suggestedNextQuestionKey: "not_allowed" }), expected: "semantic_validation_failed" },
    { id: "semantic-multiple-questions", input: JSON.stringify({ ...validModel(), assistantMessage: "첫 질문인가요? 두 번째 질문도 알려주세요?" }), expected: "semantic_validation_failed" },
    { id: "semantic-internal", input: JSON.stringify({ ...validModel(), assistantMessage: "내부 schema validation을 확인했어요." }), expected: "semantic_validation_failed" },
    { id: "semantic-health", input: JSON.stringify({ ...validModel(), assistantMessage: "상세 질환명은 저장하지 않아요." }), expected: "semantic_validation_failed" },
    { id: "semantic-confidence", input: JSON.stringify({ ...validModel(), facts: [{ ...validFact("childEnglishLevel"), confidence: 0.2 }] }), expected: "semantic_validation_failed" },
  ]
  return fixtures.map((fixture) => {
    const parsed = parseGeminiStructuredResponse(fixture.input, ["child_english_level"])
    return { id: fixture.id, expected: fixture.expected, actual: parsed.model === null ? parsed.error : "accepted", passed: parsed.model === null ? parsed.error === fixture.expected : fixture.expected === "accepted" }
  })
}

export function formatEvaluationReport(report: CounselingEvaluationReport): string {
  const lines = [
    `CampFit v3 상담 품질 평가 (${report.mode})`,
    `fixture: 단일 ${report.fixtureCounts.singleTurn}건 / 시나리오 ${report.fixtureCounts.scenarios}개 / 시나리오 turn ${report.fixtureCounts.scenarioTurns}개`,
    `결과: PASS ${report.summary.passed}, PARTIAL ${report.summary.partial}, FAIL ${report.summary.failed}`,
    `unsupported inference ${report.summary.unsupportedInferenceFailures}, duplicate question ${report.summary.duplicateQuestionFailures}, privacy ${report.summary.privacySafetyFailures}`,
  ]
  for (const result of report.cases) lines.push(`- ${result.status} ${result.id} (${result.category})`)
  for (const result of report.scenarios) lines.push(`- ${result.status} ${result.id}`)
  if (report.mockValidation !== undefined) lines.push(`mock parser checks: ${report.mockValidation.filter((item) => item.passed).length}/${report.mockValidation.length}`)
  if (report.live !== undefined) lines.push(`live: ${report.live.status}${report.live.enabled ? " (opt-in)" : " (RUN_GEMINI_LIVE_EVAL=1 필요)"}`)
  return lines.join("\n")
}

async function evaluateCase(evaluationCase: CounselingEvaluationCase, provider: CampfitV3LLMProvider): Promise<CounselingCaseResult> {
  const prepared = prepareCase(evaluationCase)
  const response = await processConversationMessage({ transcript: [], currentState: prepared.state, basicInfo: prepared.basicInfo, userMessage: evaluationCase.utterance, quickReplyKey: null, provider })
  const context: EvaluationContext = { response, state: response.updatedState, basicInfo: response.updatedBasicInfo, questionKey: response.questionKey }
  const checks = evaluationCase.expectedFacts.map((matcher) => evaluateMatcher(matcher, context))
  const absentChecks = (evaluationCase.expectedAbsentFacts ?? []).map((path) => evaluateMatcher({ path, matcher: "isAbsent" }, context))
  const allChecks = [...checks, ...absentChecks]
  const forbiddenFacts = evaluationCase.forbiddenInferences.filter((key) => response.updatedState.facts[key] !== undefined)
  const questionTargetPassed = evaluationCase.expectedQuestionTarget === undefined
    ? null
    : response.questionKey === evaluationCase.expectedQuestionTarget
  const questionChecks = evaluationCase.expectedQuestionNotTargets?.map((key) => response.questionKey !== key) ?? []
  const passedAssertions = allChecks.filter((check) => check.passed).length + (questionTargetPassed === null ? 0 : questionTargetPassed ? 1 : 0) + questionChecks.filter(Boolean).length
  const assertionCount = allChecks.length + (questionTargetPassed === null ? 0 : 1) + questionChecks.length + forbiddenFacts.length
  const status = toStatus(passedAssertions, assertionCount, forbiddenFacts.length > 0)
  const criteria = {
    fact_recall: checks.length === 0 || checks.every((check) => check.passed) ? "PASS" : checks.some((check) => check.passed) ? "PARTIAL" : "FAIL",
    fact_precision: forbiddenFacts.length === 0 && absentChecks.every((check) => check.passed) ? "PASS" : "FAIL",
    unsupported_inference: forbiddenFacts.length === 0 ? "PASS" : "FAIL",
    state_transition: evaluationCase.initialFacts === undefined ? "NOT_APPLICABLE" : response.updatedState.facts !== undefined ? "PASS" : "FAIL",
    context_retention: "NOT_APPLICABLE",
    duplicate_question_prevention: "NOT_APPLICABLE",
    question_relevance: questionTargetPassed === null && questionChecks.length === 0 ? "NOT_APPLICABLE" : questionTargetPassed !== false && questionChecks.every(Boolean) ? "PASS" : "FAIL",
    correction_handling: evaluationCase.initialFacts?.some((seed) => seed.source === "structured_input" || seed.status === "tentative") ? response.updatedState.facts.budgetRangeKrw?.source === "user_correction" || !evaluationCase.initialFacts.some((seed) => seed.key === "budgetRangeKrw") ? "PASS" : "FAIL" : "NOT_APPLICABLE",
    privacy_safety: containsPrivacyLeak(response) ? "FAIL" : "PASS",
    semantic_validation: response.diagnostics?.fallbackReason === "semantic_validation_failed" ? "FAIL" : "PASS",
  } satisfies Readonly<Record<string, EvaluationStatus>>
  return { id: evaluationCase.id, category: evaluationCase.category, status, criteria, checks: allChecks, forbiddenFacts, questionKey: response.questionKey, questionTargetPassed, diagnostic: publicDiagnostic(provider.getLastDiagnostic?.() ?? null) }
}

async function evaluateScenario(scenario: CounselingEvaluationScenario, provider: CampfitV3LLMProvider): Promise<CounselingScenarioResult> {
  let state = startConversation(baseBasicInfo).updatedState
  let basicInfo = baseBasicInfo
  let transcript: CampfitV3TranscriptMessage[] = []
  const turns: ScenarioTurnResult[] = []
  const questionKeys: string[] = []
  const duplicateQuestionKeys: string[] = []
  for (const [index, turn] of scenario.turns.entries()) {
    const previousFactKeys = new Set(Object.keys(state.facts) as CampfitV3FactKey[])
    const response = await processConversationMessage({ transcript, currentState: state, basicInfo, userMessage: turn.utterance, quickReplyKey: null, provider })
    const context: EvaluationContext = { response, state: response.updatedState, basicInfo: response.updatedBasicInfo, questionKey: response.questionKey }
    const checks = turn.expectedStateDelta.map((matcher) => evaluateMatcher(matcher, context))
    const forbiddenFacts = turn.forbiddenInferences.filter((key) => !previousFactKeys.has(key) && response.updatedState.facts[key] !== undefined)
    turns.push({ turn: index + 1, checks, forbiddenFacts, questionKey: response.questionKey })
    if (response.questionKey !== null) {
      if (questionKeys.at(-1) === response.questionKey && questionTargetIsKnown(state, response.questionKey)) duplicateQuestionKeys.push(response.questionKey)
      questionKeys.push(response.questionKey)
    }
    transcript = [...transcript, { role: "user", content: turn.utterance }, { role: "assistant", content: response.assistantMessage, ...(response.questionKey === null ? {} : { questionKey: response.questionKey }) }]
    state = response.updatedState
    basicInfo = response.updatedBasicInfo
  }
  const finalContext: EvaluationContext = { response: { ...startConversation(basicInfo), updatedState: state, updatedBasicInfo: basicInfo }, state, basicInfo, questionKey: state.currentQuestionKey }
  const finalChecks = scenario.expectedFinalState.map((matcher) => evaluateMatcher(matcher, finalContext))
  const repeats = uniqueRepeated(questionKeys)
  const expectedNoRepeat = scenario.expectedNoRepeatTargets ?? []
  const prohibitedRepeats = duplicateQuestionKeys.filter((key) => expectedNoRepeat.includes(key))
  const checksPass = turns.every((turn) => turn.checks.every((check) => check.passed) && turn.forbiddenFacts.length === 0) && finalChecks.every((check) => check.passed) && prohibitedRepeats.length === 0
  const anyPass = turns.some((turn) => turn.checks.some((check) => check.passed)) || finalChecks.some((check) => check.passed)
  return { id: scenario.id, title: scenario.title, status: checksPass ? "PASS" : anyPass ? "PARTIAL" : "FAIL", turns, finalChecks, repeatedQuestionKeys: repeats, duplicateQuestionKeys }
}

function questionTargetIsKnown(state: CampfitV3ConversationState, questionKey: string): boolean {
  const question = getQuestion(questionKey)
  return question !== null && question.completedBy.every((key) => {
    const fact = state.facts[key as CampfitV3FactKey]
    return fact !== undefined && fact.status !== "unknown" && fact.status !== "tentative"
  })
}

function prepareCase(evaluationCase: CounselingEvaluationCase): { state: CampfitV3ConversationState; basicInfo: CampfitV3BasicInfo } {
  let basicInfo = baseBasicInfo
  let state = startConversation(basicInfo).updatedState
  if (evaluationCase.initialQuestionKey !== undefined) state = stateForQuestion(state, evaluationCase.initialQuestionKey)
  if (evaluationCase.initialFacts !== undefined) {
    const seeds = evaluationCase.initialFacts.map((seed) => {
      const input = {
        key: seed.key,
        subject: seed.subject,
        value: seed.value,
        source: seed.source ?? "structured_input" as CampfitV3FactSource,
        evidence: "평가 fixture 초기 상태",
        ...(seed.confidence === undefined ? {} : { confidence: seed.confidence }),
        ...(seed.status === undefined ? {} : { status: seed.status as CampfitV3FactStatus }),
      }
      return createFact(input)
    })
    state = mergeFacts(state, seeds)
    const budget = state.facts.budgetRangeKrw?.value
    if (isBudgetRange(budget)) basicInfo = { ...basicInfo, budgetMinKrw: budget.min, budgetMaxKrw: budget.max }
  }
  return { state, basicInfo }
}

function buildReport(mode: CounselingEvaluationMode, cases: readonly CounselingCaseResult[], scenarios: readonly CounselingScenarioResult[]): CounselingEvaluationReport {
  const all = [...cases, ...scenarios]
  const fieldFailures: Record<string, number> = {}
  for (const result of cases) for (const check of result.checks) if (!check.passed) fieldFailures[check.path] = (fieldFailures[check.path] ?? 0) + 1
  return {
    mode,
    fixtureCounts: { singleTurn: counselingEvaluationCases.length, scenarios: counselingEvaluationScenarios.length, scenarioTurns: counselingEvaluationScenarios.reduce((sum, scenario) => sum + scenario.turns.length, 0) },
    summary: {
      totalCases: all.length,
      passed: all.filter((result) => result.status === "PASS").length,
      partial: all.filter((result) => result.status === "PARTIAL").length,
      failed: all.filter((result) => result.status === "FAIL").length,
      unsupportedInferenceFailures: cases.filter((result) => result.forbiddenFacts.length > 0).length + scenarios.reduce((sum, result) => sum + result.turns.filter((turn) => turn.forbiddenFacts.length > 0).length, 0),
      duplicateQuestionFailures: scenarios.filter((result) => result.duplicateQuestionKeys.length > 0).length,
      privacySafetyFailures: cases.filter((result) => result.criteria["privacy_safety"] === "FAIL").length,
      fieldFailures,
    },
    cases,
    scenarios,
  }
}

function toStatus(passed: number, total: number, forbidden: boolean): EvaluationStatus {
  if (forbidden) return "FAIL"
  if (total === 0) return "NOT_APPLICABLE"
  if (passed === total) return "PASS"
  return passed === 0 ? "FAIL" : "PARTIAL"
}

function getPath(value: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, segment) => {
    if (current === null || current === undefined) return undefined
    if (Array.isArray(current) && /^\d+$/.test(segment)) return current[Number(segment)]
    if (typeof current !== "object") return undefined
    return (current as Record<string, unknown>)[segment]
  }, value)
}

function contains(value: unknown, expected: unknown): boolean {
  if (Array.isArray(value)) return value.some((item) => deepEqual(item, expected))
  return typeof value === "string" && typeof expected === "string" && value.includes(expected)
}

function questionMatches(questionKey: string | null, expected: unknown): boolean {
  return Array.isArray(expected) ? expected.includes(questionKey) : questionKey === expected
}

function deepEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function stateForQuestion(state: CampfitV3ConversationState, questionKey: string): CampfitV3ConversationState {
  return { ...state, currentQuestionKey: questionKey, askedQuestionKeys: state.askedQuestionKeys.includes(questionKey) ? state.askedQuestionKeys : [...state.askedQuestionKeys, questionKey], completedQuestionKeys: state.completedQuestionKeys.filter((key) => key !== questionKey), failedQuestionKeys: state.failedQuestionKeys.filter((key) => key !== questionKey), questionCount: state.askedQuestionKeys.includes(questionKey) ? state.questionCount : Math.min(10, state.questionCount + 1) }
}

function uniqueRepeated(values: readonly string[]): readonly string[] {
  const counts = new Map<string, number>()
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1)
  return [...counts.entries()].filter(([, count]) => count > 1).map(([key]) => key)
}

function isBudgetRange(value: unknown): value is { min: number; max: number } {
  const record = value as Record<string, unknown> | null
  return typeof value === "object" && value !== null && !Array.isArray(value) && typeof record?.["min"] === "number" && typeof record?.["max"] === "number"
}

function containsPrivacyLeak(response: CampfitV3ConversationResponse): boolean {
  const text = `${response.assistantMessage} ${response.warnings.join(" ")}`
  return /(질환명|진단명|복용약|약\s*이름|복용량|병력|천식|당뇨|아토피|뇌전증|ADHD)/iu.test(text)
}

function publicDiagnostic(diagnostic: CampfitV3ProviderDiagnostic | null): PublicDiagnostic | null {
  if (diagnostic === null) return null
  return { code: diagnostic.code, providerResponseReceived: diagnostic.providerResponseReceived, httpStatus: diagnostic.httpStatus, errorStatus: diagnostic.errorStatus, repaired: diagnostic.repaired, requestCount: diagnostic.requestCount, elapsedMs: diagnostic.elapsedMs }
}

const fallbackProvider: CampfitV3LLMProvider = {
  analyzeConversation: async () => null,
  generateConsultingResponse: async () => null,
  explainRecommendation: async () => null,
}

type MockBehavior = "normal"

export class MockGeminiProvider implements CampfitV3LLMProvider {
  private diagnostic: CampfitV3ProviderDiagnostic | null = null
  private validatedResponse: CampfitV3ModelResponse | null = null
  constructor(private readonly behavior: MockBehavior = "normal") {}

  async analyzeConversation(input: Parameters<CampfitV3LLMProvider["analyzeConversation"]>[0]): Promise<CampfitV3ModelResponse | null> {
    if (this.behavior !== "normal") return null
    const facts = extractDeterministicFacts(input.userMessage, input.basicInfo, input.currentState.currentQuestionKey).map((fact) => ({ key: fact.key, subject: fact.subject, value: fact.value, source: "explicit_user_statement" as const, confidence: 1, evidence: "사용자 발화에서 확인한 내용" }))
    const parsed = parseGeminiStructuredResponse(JSON.stringify({ assistantMessage: "말씀해 주신 내용을 함께 반영했어요.", facts, unresolved: [], conflicts: [], suggestedNextQuestionKey: null, nextAction: "ask", readyForRecommendation: false }), input.allowedQuestionKeys)
    this.validatedResponse = parsed.model
    this.diagnostic = { code: parsed.model === null ? (parsed.error ?? "semantic_validation_failed") : "ok", providerResponseReceived: true, httpStatus: 200, errorStatus: null, repaired: false, requestCount: 0, elapsedMs: 0 }
    return parsed.model
  }

  async generateConsultingResponse(input: Parameters<CampfitV3LLMProvider["generateConsultingResponse"]>[0]): Promise<CampfitV3ModelResponse | null> { return this.analyzeConversation(input) }
  async explainRecommendation(): Promise<string | null> { return null }
  getLastDiagnostic(): CampfitV3ProviderDiagnostic | null { return this.diagnostic }
  getLastValidatedResponse(): CampfitV3ModelResponse | null { return this.validatedResponse }
}

function validFact(key: "childEnglishLevel"): Record<string, unknown> {
  return { key, subject: "child", value: "beginner", source: "explicit_user_statement", confidence: 1, evidence: "아이가 초급이라고 말함" }
}

function validModel(): Record<string, unknown> {
  return { assistantMessage: "말씀해 주신 내용을 확인했어요.", facts: [], unresolved: ["childEnglishLevel"], conflicts: [], suggestedNextQuestionKey: null, nextAction: "ask", readyForRecommendation: false }
}
