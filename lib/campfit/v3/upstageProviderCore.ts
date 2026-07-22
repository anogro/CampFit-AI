import { z } from "zod"
import { buildConversationPrompt } from "@/lib/campfit/v3/geminiPrompt"
import { parseStructuredProviderText } from "@/lib/campfit/v3/providerNormalization"
import { resolveAiTimeoutMs } from "@/lib/campfit/v3/providerConfig"
import { requestProviderJson } from "@/lib/campfit/v3/providerTransport"
import type {
  AnalyzeConversationInput,
  CampfitV3LLMProvider,
  CampfitV3ModelResponse,
  CampfitV3ProviderDiagnostic,
  CampfitV3ProviderDiagnosticCode,
  CampfitV3ProviderErrorMetadata,
} from "@/lib/campfit/v3/provider"

const DEFAULT_UPSTAGE_BASE_URL = "https://api.upstage.ai/v1"
const ConclusionSchema = z.object({ conclusion: z.string().trim().min(1).max(500) })
const ChatResponseSchema = z.object({
  choices: z.array(z.object({
    message: z.object({ content: z.string().nullable().optional() }).passthrough(),
  }).passthrough()).min(1),
}).passthrough()

type UpstageProviderOptions = { readonly maxProviderRequests?: 1 | 2; readonly timeoutMs?: number }
type RequestResult = {
  readonly text: string | null
  readonly code: CampfitV3ProviderDiagnosticCode
  readonly requestMade: boolean
  readonly providerResponseReceived: boolean
  readonly httpStatus: number | null
  readonly errorStatus: string | null
  readonly error: CampfitV3ProviderErrorMetadata | null
}

/** OpenAI-compatible Chat Completions adapter for Upstage Solar. */
export class UpstageCampfitV3ProviderCore implements CampfitV3LLMProvider {
  private diagnostic: CampfitV3ProviderDiagnostic | null = null
  private validatedResponse: CampfitV3ModelResponse | null = null
  private readonly maxProviderRequests: 1 | 2
  private readonly timeoutMs: number

  constructor(options: UpstageProviderOptions = {}) {
    this.maxProviderRequests = options.maxProviderRequests ?? 2
    this.timeoutMs = resolveAiTimeoutMs(options.timeoutMs)
  }

  getLastDiagnostic(): CampfitV3ProviderDiagnostic | null { return this.diagnostic }
  getLastValidatedResponse(): CampfitV3ModelResponse | null { return this.validatedResponse }

  async analyzeConversation(input: AnalyzeConversationInput): Promise<CampfitV3ModelResponse | null> {
    return this.requestStructured(buildConversationPrompt(input), input.allowedQuestionKeys)
  }

  async generateConsultingResponse(input: AnalyzeConversationInput): Promise<CampfitV3ModelResponse | null> {
    return this.analyzeConversation(input)
  }

  async explainRecommendation(input: Parameters<CampfitV3LLMProvider["explainRecommendation"]>[0]): Promise<string | null> {
    const prompt = [
      "당신은 부모를 위한 해외 교육·체류 상담가입니다.",
      "아래 결정 결과에 근거해 사용자에게 보여줄 자연스러운 한국어 상담 결론을 2~3문장으로 작성하세요.",
      "새로운 도시, 프로그램, 가격, 사실을 만들지 말고 입력된 결과만 사용하세요.",
      '반드시 {"conclusion":"..."} JSON 객체 하나만 반환하세요.',
      JSON.stringify({ basicInfo: input.basicInfo, facts: input.state.facts, result: input.deterministicResult }),
    ].join("\n")
    const started = Date.now()
    const result = await this.requestOnce(prompt)
    if (result.text === null || result.code !== "ok") {
      this.diagnostic = diagnosticFromTransport(result, false, result.requestMade ? 1 : 0, Date.now() - started)
      return null
    }
    let raw: unknown
    try { raw = JSON.parse(result.text) as unknown } catch {
      this.diagnostic = { ...diagnosticFromTransport(result, false, 1, Date.now() - started), code: "json_parse_failed" }
      return null
    }
    const conclusion = ConclusionSchema.safeParse(raw)
    if (!conclusion.success) {
      this.diagnostic = { ...diagnosticFromTransport(result, false, 1, Date.now() - started), code: "schema_validation_failed" }
      return null
    }
    this.diagnostic = successfulDiagnostic(result, false, 1, Date.now() - started)
    return conclusion.data.conclusion
  }

  private async requestStructured(prompt: string, allowedQuestionKeys: readonly string[]): Promise<CampfitV3ModelResponse | null> {
    this.validatedResponse = null
    const started = Date.now()
    const first = await this.requestOnce(prompt)
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
      "이전 응답은 CampFit fact 계약을 통과하지 못했습니다.",
      "오류를 수정하고 strict JSON 객체 하나만 다시 반환하세요.",
    ].join("\n"))
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

  private async requestOnce(prompt: string): Promise<RequestResult> {
    const apiKey = process.env["UPSTAGE_API_KEY"]?.trim()
    const model = process.env["UPSTAGE_MODEL"]?.trim()
    if (!apiKey || !model) return unavailableResult()
    const baseUrl = process.env["UPSTAGE_BASE_URL"]?.trim() || DEFAULT_UPSTAGE_BASE_URL

    const started = Date.now()
    console.log(`🚀 [Upstage API] Sending request to Solar model: "${model}"`)

    const transport = await requestProviderJson({
      endpoint: `${baseUrl.replace(/\/+$/u, "")}/chat/completions`,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: { model, messages: [{ role: "user", content: prompt }], max_tokens: 4_096 },
      timeoutMs: this.timeoutMs,
    })
    const extracted = transport.code === "ok" ? extractChatResponseText(transport.body) : { text: null, envelopeValid: true }
    const code = transport.code !== "ok" ? transport.code : !extracted.envelopeValid ? "json_parse_failed" : extracted.text === null ? "empty_response" : "ok"

    const elapsed = Date.now() - started
    if (code === "ok") {
      console.log(`✅ [Upstage API] Solar response successfully received and parsed. (Elapsed: ${elapsed}ms)`)
    } else {
      console.warn(`⚠️ [Upstage API] Response failed with code: "${code}". Status: ${transport.httpStatus} (Elapsed: ${elapsed}ms)`)
    }

    return { ...transport, text: extracted.text, code }
  }
}

export function extractChatResponseText(value: unknown): { readonly text: string | null; readonly envelopeValid: boolean } {
  const parsed = ChatResponseSchema.safeParse(value)
  if (!parsed.success) return { text: null, envelopeValid: false }
  const text = parsed.data.choices[0]?.message.content?.trim() ?? ""
  return { text: text === "" ? null : text, envelopeValid: true }
}

function unavailableResult(): RequestResult {
  return { text: null, code: "provider_unavailable", requestMade: false, providerResponseReceived: false, httpStatus: null, errorStatus: null, error: null }
}

function diagnosticFromTransport(result: RequestResult, repaired: boolean, requestCount: number, elapsedMs: number): CampfitV3ProviderDiagnostic {
  return { code: result.code, providerResponseReceived: result.providerResponseReceived, httpStatus: result.httpStatus, errorStatus: result.errorStatus, repaired, requestCount, elapsedMs, ...result.error }
}

function successfulDiagnostic(result: RequestResult, repaired: boolean, requestCount: number, elapsedMs: number): CampfitV3ProviderDiagnostic {
  return { code: "ok", providerResponseReceived: true, httpStatus: result.httpStatus, errorStatus: null, repaired, requestCount, elapsedMs, ...result.error }
}
