import { z } from "zod"
import { buildConversationPrompt } from "@/lib/campfit/v3/geminiPrompt"
import { parseStructuredProviderText } from "@/lib/campfit/v3/providerNormalization"
import { resolveAiTimeoutMs } from "@/lib/campfit/v3/providerConfig"
import { requestProviderJson, type ProviderTransportResult } from "@/lib/campfit/v3/providerTransport"
import type {
  AnalyzeConversationInput,
  CampfitV3LLMProvider,
  CampfitV3ModelResponse,
  CampfitV3ProviderDiagnostic,
  CampfitV3ProviderDiagnosticCode,
} from "@/lib/campfit/v3/provider"
import { campfitV3FactKeys, campfitV3FactSubjects } from "@/types/campfitV3"

const OPENAI_RESPONSES_ENDPOINT = "https://api.openai.com/v1/responses"

/**
 * JSON Schema sent to the Responses API. Every field is required because
 * OpenAI strict Structured Outputs rejects optional object properties.
 */
export const campfitModelResponseJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    assistantMessage: { type: "string", minLength: 1, maxLength: 500 },
    facts: {
      type: "array",
      maxItems: 20,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          key: { type: "string", enum: [...campfitV3FactKeys] },
          subject: { type: "string", enum: [...campfitV3FactSubjects] },
          value: {
            anyOf: [
              { type: "string" },
              { type: "boolean" },
              { type: "number" },
              { type: "array", items: { type: "string" } },
              {
                type: "object",
                additionalProperties: false,
                properties: {
                  schoolSchooling: { type: "string", enum: ["primary", "secondary", "mentioned", "none"] },
                  englishIntensive: { type: "string", enum: ["primary", "secondary", "mentioned", "none"] },
                  subjectProject: { type: "string", enum: ["primary", "secondary", "mentioned", "none"] },
                  cultureActivity: { type: "string", enum: ["primary", "secondary", "mentioned", "none"] },
                },
                required: ["schoolSchooling", "englishIntensive", "subjectProject", "cultureActivity"],
              },
              {
                type: "object",
                additionalProperties: false,
                properties: { min: { type: "integer", minimum: 0 }, max: { type: "integer", minimum: 1 } },
                required: ["min", "max"],
              },
            ],
          },
          source: { type: "string", enum: ["explicit_user_statement", "ai_inference"] },
          confidence: { type: "number", minimum: 0, maximum: 1 },
          evidence: { type: "string", minLength: 1, maxLength: 240 },
        },
        required: ["key", "subject", "value", "source", "confidence", "evidence"],
      },
    },
    unresolved: { type: "array", maxItems: 20, items: { type: "string", enum: [...campfitV3FactKeys] } },
    conflicts: {
      type: "array",
      maxItems: 20,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          key: { type: "string", enum: [...campfitV3FactKeys] },
          reason: { type: "string", maxLength: 240 },
        },
        required: ["key", "reason"],
      },
    },
    suggestedNextQuestionKey: { type: ["string", "null"] },
    nextAction: { type: "string", enum: ["ask", "recommend"] },
    readyForRecommendation: { type: "boolean" },
  },
  required: [
    "assistantMessage",
    "facts",
    "unresolved",
    "conflicts",
    "suggestedNextQuestionKey",
    "nextAction",
    "readyForRecommendation",
  ],
} as const

const conclusionJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: { conclusion: { type: "string", minLength: 1, maxLength: 500 } },
  required: ["conclusion"],
} as const

const OpenAIResponseEnvelopeSchema = z.object({
  output_text: z.string().optional(),
  output: z.array(z.object({
    type: z.string().optional(),
    content: z.array(z.object({ type: z.string().optional(), text: z.string().optional() })).optional(),
  }).passthrough()).optional(),
}).passthrough()

const ConclusionSchema = z.object({ conclusion: z.string().trim().min(1).max(500) })

export type OpenAIProviderOptions = {
  readonly maxProviderRequests?: 1 | 2
  /** Injectable for deterministic timeout tests; production uses AI_TIMEOUT_MS. */
  readonly timeoutMs?: number
}

type OpenAIRequestResult = {
  readonly text: string | null
  readonly code: Exclude<CampfitV3ProviderDiagnosticCode, "schema_validation_failed" | "semantic_validation_failed">
  readonly requestMade: boolean
  readonly providerResponseReceived: boolean
  readonly httpStatus: number | null
  readonly errorStatus: string | null
}

type ParsedResponseText = { readonly text: string | null; readonly envelopeValid: boolean }

/** CLI-safe OpenAI Responses API adapter. */
export class OpenAICampfitV3ProviderCore implements CampfitV3LLMProvider {
  private diagnostic: CampfitV3ProviderDiagnostic | null = null
  private validatedResponse: CampfitV3ModelResponse | null = null
  private readonly maxProviderRequests: 1 | 2
  private readonly timeoutMs: number

  constructor(options: OpenAIProviderOptions = {}) {
    this.maxProviderRequests = options.maxProviderRequests ?? 2
    this.timeoutMs = resolveAiTimeoutMs(options.timeoutMs)
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
      JSON.stringify({ basicInfo: input.basicInfo, facts: input.state.facts, result: input.deterministicResult }),
    ].join("\n")
    const started = Date.now()
    const result = await this.requestOnce(prompt, conclusionJsonSchema, "campfit_conclusion")
    this.diagnostic = diagnosticFromTransport(result, false, result.requestMade ? 1 : 0, Date.now() - started)
    if (result.text === null) return null
    if (result.code !== "ok") {
      this.diagnostic = diagnosticFromTransport(result, false, 1, Date.now() - started)
      return null
    }
    let raw: unknown
    try {
      raw = JSON.parse(result.text) as unknown
    } catch {
      this.diagnostic = {
        ...diagnosticFromTransport(result, false, 1, Date.now() - started),
        code: "json_parse_failed",
      }
      return null
    }
    const conclusion = ConclusionSchema.safeParse(raw)
    if (!conclusion.success) {
      this.diagnostic = {
        ...diagnosticFromTransport(result, false, 1, Date.now() - started),
        code: "schema_validation_failed",
      }
      return null
    }
    this.diagnostic = successfulDiagnostic(result, false, 1, Date.now() - started)
    return conclusion.data.conclusion
  }

  private async requestStructured(prompt: string, allowedQuestionKeys: readonly string[]): Promise<CampfitV3ModelResponse | null> {
    this.validatedResponse = null
    const started = Date.now()
    const first = await this.requestOnce(prompt, campfitModelResponseJsonSchema, "campfit_model_response")
    if (first.text === null) {
      this.diagnostic = diagnosticFromTransport(first, false, first.requestMade ? 1 : 0, Date.now() - started)
      return null
    }
    const parsed = parseStructuredProviderText(first.text, allowedQuestionKeys)
    if (parsed.model !== null) {
      this.validatedResponse = parsed.model
      this.diagnostic = successfulDiagnostic(first, false, 1, Date.now() - started)
      return parsed.model
    }
    if (this.maxProviderRequests === 1) {
      this.diagnostic = { ...diagnosticFromTransport(first, false, 1, Date.now() - started), code: parsed.error }
      return null
    }

    const repair = await this.requestOnce([
      prompt,
      "이전 응답은 CampFit fact 의미 계약을 충족하지 못했습니다.",
      "위 계약을 다시 확인하고 strict JSON schema에 맞는 JSON 객체만 한 번 다시 반환하세요.",
    ].join("\n"), campfitModelResponseJsonSchema, "campfit_model_response")
    if (repair.text === null) {
      this.diagnostic = diagnosticFromTransport(repair, true, 2, Date.now() - started)
      return null
    }
    const repaired = parseStructuredProviderText(repair.text, allowedQuestionKeys)
    this.validatedResponse = repaired.model
    this.diagnostic = repaired.model === null
      ? { ...diagnosticFromTransport(repair, true, 2, Date.now() - started), code: repaired.error }
      : successfulDiagnostic(repair, true, 2, Date.now() - started)
    return repaired.model
  }

  private async requestOnce(prompt: string, schema: object, schemaName: string): Promise<OpenAIRequestResult> {
    const apiKey = process.env["OPENAI_API_KEY"]?.trim()
    const model = process.env["OPENAI_MODEL"]?.trim()
    if (!apiKey || !model) {
      return {
        text: null,
        code: "provider_unavailable",
        requestMade: false,
        providerResponseReceived: false,
        httpStatus: null,
        errorStatus: null,
      }
    }
    const transport = await requestProviderJson({
      endpoint: OPENAI_RESPONSES_ENDPOINT,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: {
        model,
        input: prompt,
        text: { format: { type: "json_schema", name: schemaName, strict: true, schema } },
        max_output_tokens: 4_096,
      },
      timeoutMs: this.timeoutMs,
    })
    const extracted = transport.code === "ok" ? extractResponseText(transport.body) : { text: null, envelopeValid: true }
    const code = transport.code !== "ok"
      ? transport.code
      : !extracted.envelopeValid
        ? "json_parse_failed"
        : extracted.text === null
          ? "empty_response"
          : "ok"
    return {
      text: extracted.text,
      code,
      requestMade: transport.requestMade,
      providerResponseReceived: transport.providerResponseReceived,
      httpStatus: transport.httpStatus,
      errorStatus: transport.errorStatus,
    }
  }
}

export function extractResponseText(value: unknown): ParsedResponseText {
  const parsed = OpenAIResponseEnvelopeSchema.safeParse(value)
  if (!parsed.success) return { text: null, envelopeValid: false }
  if (parsed.data.output_text !== undefined && parsed.data.output_text.trim() !== "") {
    return { text: parsed.data.output_text, envelopeValid: true }
  }
  const text = parsed.data.output
    ?.flatMap((item) => item.content ?? [])
    .map((part) => part.text ?? "")
    .filter((part) => part.trim() !== "")
    .join("") ?? ""
  return { text: text === "" ? null : text, envelopeValid: true }
}

function diagnosticFromTransport(
  result: OpenAIRequestResult,
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
  result: OpenAIRequestResult,
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

// Keep this type-level reference close to the adapter so future providers use
// the same transport result contract and diagnostics shape.
export type OpenAIProviderTransportResult = ProviderTransportResult
