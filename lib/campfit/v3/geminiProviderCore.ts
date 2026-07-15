import { z } from "zod"
import { buildConversationPrompt, parseGeminiJson } from "@/lib/campfit/v3/geminiPrompt"
import { CampfitV3ModelResponseSchema } from "@/lib/campfit/v3/schemas"
import { isSemanticallyValidModelFact } from "@/lib/campfit/v3/stateEngine"
import type {
  AnalyzeConversationInput,
  CampfitV3LLMProvider,
  CampfitV3ModelResponse,
  CampfitV3ProviderDiagnostic,
  CampfitV3ProviderDiagnosticCode,
} from "@/lib/campfit/v3/provider"

const defaultModel = "gemini-2.5-flash"
const requestTimeoutMs = 25_000

const GeminiResponseSchema = z.object({
  candidates: z.array(z.object({
    content: z.object({ parts: z.array(z.object({ text: z.string().optional() })).optional() }).optional(),
  })).optional(),
})

type GeminiRequestResult = {
  readonly text: string | null
  readonly code: Exclude<CampfitV3ProviderDiagnosticCode, "schema_validation_failed" | "semantic_validation_failed">
  readonly requestMade: boolean
  readonly providerResponseReceived: boolean
  readonly httpStatus: number | null
  readonly errorStatus: string | null
}

type StructuredParseResult =
  | { readonly model: CampfitV3ModelResponse; readonly error: null }
  | { readonly model: null; readonly error: "json_parse_failed" | "schema_validation_failed" | "semantic_validation_failed" }

export type GeminiProviderOptions = {
  readonly maxProviderRequests?: 1 | 2
}

/**
 * CLI-safe Gemini implementation. Product code must import the server-only wrapper
 * instead so this transport never enters a client bundle accidentally.
 */
export class GeminiCampfitV3ProviderCore implements CampfitV3LLMProvider {
  private diagnostic: CampfitV3ProviderDiagnostic | null = null
  private validatedResponse: CampfitV3ModelResponse | null = null
  private readonly maxProviderRequests: 1 | 2

  constructor(options: GeminiProviderOptions = {}) {
    this.maxProviderRequests = options.maxProviderRequests ?? 2
  }

  getLastDiagnostic(): CampfitV3ProviderDiagnostic | null {
    return this.diagnostic
  }

  getLastValidatedResponse(): CampfitV3ModelResponse | null {
    return this.validatedResponse
  }

  async analyzeConversation(input: AnalyzeConversationInput): Promise<CampfitV3ModelResponse | null> {
    return this.requestStructured(buildConversationPrompt(input), input.allowedQuestionKeys)
  }

  async generateConsultingResponse(input: AnalyzeConversationInput): Promise<CampfitV3ModelResponse | null> {
    return this.analyzeConversation(input)
  }

  async explainRecommendation(input: Parameters<CampfitV3LLMProvider["explainRecommendation"]>[0]): Promise<string | null> {
    const prompt = [
      "당신은 부모동반 해외 교육 경험을 돕는 CampFit AI 상담가입니다.",
      "아래 결과는 코드와 DB가 계산한 allowlist입니다. 도시, 프로그램, 가격, 지원 사실을 새로 만들지 마세요.",
      "사용자에게 보여줄 오늘의 상담 결론을 자연스러운 한국어 2~3문장으로 작성하세요.",
      "상세 질환명, 알레르기명, 약 이름 등 민감정보를 언급하지 마세요.",
      "설명이나 markdown 없이 {\"conclusion\":\"...\"} JSON 객체만 반환하세요.",
      JSON.stringify({ basicInfo: input.basicInfo, facts: input.state.facts, result: input.deterministicResult }),
    ].join("\n")
    const started = Date.now()
    const result = await requestGeminiOnce(prompt)
    this.diagnostic = diagnosticFromRequest(result, false, result.requestMade ? 1 : 0, Date.now() - started)
    if (result.text === null) return null
    const parsed = parseGeminiJson(result.text)
    if (parsed.success
      && typeof parsed.value === "object"
      && parsed.value !== null
      && "conclusion" in parsed.value
      && typeof parsed.value.conclusion === "string") {
      this.diagnostic = successfulDiagnostic(result, false, 1, Date.now() - started)
      return parsed.value.conclusion.slice(0, 500)
    }
    this.diagnostic = {
      ...diagnosticFromRequest(result, false, 1, Date.now() - started),
      code: parsed.success ? "schema_validation_failed" : "json_parse_failed",
    }
    return null
  }

  private async requestStructured(prompt: string, allowedQuestionKeys: readonly string[]): Promise<CampfitV3ModelResponse | null> {
    this.validatedResponse = null
    const started = Date.now()
    const first = await requestGeminiOnce(prompt)
    const firstCount = first.requestMade ? 1 : 0
    if (first.text === null) {
      this.diagnostic = diagnosticFromRequest(first, false, firstCount, Date.now() - started)
      return null
    }

    const parsed = parseGeminiStructuredResponse(first.text, allowedQuestionKeys)
    if (parsed.model !== null) {
      this.validatedResponse = parsed.model
      this.diagnostic = successfulDiagnostic(first, false, 1, Date.now() - started)
      return parsed.model
    }

    if (this.maxProviderRequests === 1) {
      this.diagnostic = {
        ...diagnosticFromRequest(first, false, 1, Date.now() - started),
        code: parsed.error,
      }
      return null
    }

    const repair = await requestGeminiOnce([
      prompt,
      "이전 응답은 JSON 또는 fact 의미 계약을 충족하지 못했습니다.",
      "위 계약을 다시 확인하고 설명이나 markdown 없이 올바른 JSON 객체만 한 번 다시 반환하세요.",
    ].join("\n"))
    if (repair.text === null) {
      this.diagnostic = diagnosticFromRequest(repair, true, 2, Date.now() - started)
      return null
    }
    const repaired = parseGeminiStructuredResponse(repair.text, allowedQuestionKeys)
    this.validatedResponse = repaired.model
    this.diagnostic = repaired.model === null
      ? { ...diagnosticFromRequest(repair, true, 2, Date.now() - started), code: repaired.error }
      : successfulDiagnostic(repair, true, 2, Date.now() - started)
    return repaired.model
  }
}

export function parseGeminiStructuredResponse(text: string, allowedQuestionKeys: readonly string[]): StructuredParseResult {
  const result = parseGeminiJson(text)
  if (!result.success) return { model: null, error: "json_parse_failed" }
  const json = normalizeSuggestedNextQuestion(result.value)
  const parsed = CampfitV3ModelResponseSchema.safeParse(json)
  if (!parsed.success) return { model: null, error: "schema_validation_failed" }
  if (new Set(parsed.data.facts.map((fact) => fact.key)).size !== parsed.data.facts.length) {
    return { model: null, error: "semantic_validation_failed" }
  }
  if (parsed.data.suggestedNextQuestionKey !== null
    && !allowedQuestionKeys.includes(parsed.data.suggestedNextQuestionKey)) {
    return { model: null, error: "semantic_validation_failed" }
  }
  if (!isSafeUserFacingMessage(parsed.data.assistantMessage)
    || parsed.data.assistantMessage.split(/[?？]/u).length - 1 > 1
    || parsed.data.facts.some((fact) => containsDetailedHealthDisclosure(fact.evidence))
    || parsed.data.facts.some((fact) => fact.source === "explicit_user_statement" && fact.confidence < 0.85)) {
    return { model: null, error: "semantic_validation_failed" }
  }
  if (!parsed.data.facts.every(isSemanticallyValidModelFact)) {
    return { model: null, error: "semantic_validation_failed" }
  }
  return { model: parsed.data, error: null }
}

const internalCounselorTerms = [
  "slot",
  "target",
  "schema",
  "validation",
  "confidence score",
  "fallback",
  "parser",
  "state merge",
  "조건으로 연결하지 못했어요",
] as const

function isSafeUserFacingMessage(message: string): boolean {
  const normalized = message.toLocaleLowerCase()
  return !internalCounselorTerms.some((term) => normalized.includes(term.toLocaleLowerCase()))
    && !containsDetailedHealthDisclosure(message)
}

function containsDetailedHealthDisclosure(value: string): boolean {
  return /(질환명|진단명|복용약|약\s*이름|약명|복용량|병력|알레르기\s*(항목|이름|명칭)|천식|당뇨|아토피|뇌전증|간질|ADHD|자폐|우울증|공황장애|갑상선|심장병|크론병|셀리악)/iu.test(value)
}

function normalizeSuggestedNextQuestion(value: unknown): unknown {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return value
  if (!("suggestedNextQuestionKey" in value) || typeof value.suggestedNextQuestionKey !== "string") return value
  return value.suggestedNextQuestionKey.trim() === ""
    ? { ...value, suggestedNextQuestionKey: null }
    : value
}

async function requestGeminiOnce(prompt: string): Promise<GeminiRequestResult> {
  const apiKey = process.env["GEMINI_API_KEY"]
  if (!apiKey) {
    return {
      text: null,
      code: "provider_unavailable",
      requestMade: false,
      providerResponseReceived: false,
      httpStatus: null,
      errorStatus: null,
    }
  }

  const model = process.env["GEMINI_MODEL"] ?? defaultModel
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`
  const controller = new AbortController()
  let timedOut = false
  const timeout = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, requestTimeoutMs)
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0,
          maxOutputTokens: 4_096,
        },
      }),
    })
    if (!response.ok) {
      return {
        text: null,
        code: providerCodeFromHttpStatus(response.status),
        requestMade: true,
        providerResponseReceived: true,
        httpStatus: response.status,
        errorStatus: await readProviderErrorStatus(response),
      }
    }
    let responseBody: unknown
    try {
      responseBody = await response.json()
    } catch (error) {
      if (isAbortError(error)) throw error
      return {
        text: null,
        code: "json_parse_failed",
        requestMade: true,
        providerResponseReceived: true,
        httpStatus: response.status,
        errorStatus: null,
      }
    }
    const parsed = GeminiResponseSchema.safeParse(responseBody)
    const textParts = parsed.success
      ? parsed.data.candidates?.[0]?.content?.parts
        ?.flatMap((part) => part.text === undefined ? [] : [part.text]) ?? []
      : []
    const text = textParts.length === 0 ? null : textParts.join("")
    return text === null
      ? {
        text: null,
        code: "empty_response",
        requestMade: true,
        providerResponseReceived: true,
        httpStatus: response.status,
        errorStatus: null,
      }
      : {
        text,
        code: "ok",
        requestMade: true,
        providerResponseReceived: true,
        httpStatus: response.status,
        errorStatus: null,
      }
  } catch (error) {
    return {
      text: null,
      code: isAbortError(error) ? (timedOut ? "timeout" : "provider_cancelled") : "network_error",
      requestMade: true,
      providerResponseReceived: false,
      httpStatus: null,
      errorStatus: null,
    }
  } finally {
    clearTimeout(timeout)
  }
}

function providerCodeFromHttpStatus(status: number): Exclude<CampfitV3ProviderDiagnosticCode, "ok" | "schema_validation_failed" | "semantic_validation_failed"> {
  if (status === 400 || status === 422) return "invalid_request"
  if (status === 401 || status === 403) return "permission_denied"
  if (status === 404) return "model_not_found"
  if (status === 429) return "rate_limited"
  if (status === 499) return "provider_cancelled"
  if (status === 500) return "provider_internal"
  if (status === 502 || status === 503 || status === 504) return "provider_unavailable"
  return "unknown_provider_error"
}

async function readProviderErrorStatus(response: Response): Promise<string | null> {
  try {
    const body = await response.json() as unknown
    if (typeof body !== "object" || body === null || !("error" in body)) return null
    const error = body.error
    if (typeof error !== "object" || error === null || !("status" in error)) return null
    return typeof error.status === "string" && /^[A-Z][A-Z0-9_]{0,79}$/.test(error.status)
      ? error.status
      : null
  } catch (error) {
    if (isAbortError(error)) throw error
    return null
  }
}

function isAbortError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "name" in error && error.name === "AbortError"
}

function diagnosticFromRequest(
  result: GeminiRequestResult,
  repaired: boolean,
  requestCount: number,
  elapsedMs: number,
): CampfitV3ProviderDiagnostic {
  return {
    code: result.code,
    providerResponseReceived: result.providerResponseReceived,
    httpStatus: result.httpStatus,
    errorStatus: result.errorStatus,
    repaired,
    requestCount,
    elapsedMs,
  }
}

function successfulDiagnostic(
  result: GeminiRequestResult,
  repaired: boolean,
  requestCount: number,
  elapsedMs: number,
): CampfitV3ProviderDiagnostic {
  return {
    code: "ok",
    providerResponseReceived: true,
    httpStatus: result.httpStatus,
    errorStatus: null,
    repaired,
    requestCount,
    elapsedMs,
  }
}
