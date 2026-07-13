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
const factKeys = [
  "childEnglishLevel",
  "parentEnglishCommunication",
  "isFirstOverseasEducationExperience",
  "dayProgramSeparationReadiness",
  "preferredActivities",
  "experienceGoals",
  "preferredRegions",
  "regionImportance",
  "koreanSupportNeed",
  "parentCommunicationNeed",
  "beginnerSupportNeed",
  "initialAdaptationSupportNeed",
  "parentStayGoals",
  "specialCareFollowUp",
  "studyOnlyAvoidance",
  "budgetRangeKrw",
  "departureWindow",
  "durationWeeks",
] as const
const factSubjects = ["child", "parent", "preference", "constraint"] as const
const factSources = ["explicit_user_statement", "ai_inference"] as const
const goalStrengths = ["primary", "secondary", "mentioned", "none"] as const
const factResponseContracts: Readonly<Record<(typeof factKeys)[number], {
  readonly subject: (typeof factSubjects)[number]
  readonly value: Readonly<Record<string, unknown>>
}>> = {
  childEnglishLevel: { subject: "child", value: { type: "string", enum: ["beginner", "basic", "intermediate", "advanced"] } },
  parentEnglishCommunication: { subject: "parent", value: { type: "string", enum: ["possible", "limited", "not_possible"] } },
  isFirstOverseasEducationExperience: { subject: "child", value: { type: "boolean" } },
  dayProgramSeparationReadiness: { subject: "child", value: { type: "string", enum: ["needs_close_support", "with_initial_support", "ready"] } },
  preferredActivities: { subject: "preference", value: { type: "array", maxItems: 12, items: { type: "string" } } },
  experienceGoals: {
    subject: "preference",
    value: {
      type: "object",
      additionalProperties: false,
      properties: {
        schoolSchooling: { type: "string", enum: [...goalStrengths] },
        englishIntensive: { type: "string", enum: [...goalStrengths] },
        subjectProject: { type: "string", enum: [...goalStrengths] },
        cultureActivity: { type: "string", enum: [...goalStrengths] },
      },
      required: ["schoolSchooling", "englishIntensive", "subjectProject", "cultureActivity"],
    },
  },
  preferredRegions: {
    subject: "preference",
    value: {
      type: "array",
      maxItems: 4,
      items: { type: "string", enum: ["southeast_asia", "oceania", "north_america", "europe"] },
    },
  },
  regionImportance: { subject: "preference", value: { type: "string", enum: ["must", "strong", "soft", "no_preference"] } },
  koreanSupportNeed: { subject: "constraint", value: { type: "string", enum: ["must_daily", "emergency_only", "preferred", "none"] } },
  parentCommunicationNeed: { subject: "constraint", value: { type: "string", enum: ["daily", "issue_only", "occasional", "not_important"] } },
  beginnerSupportNeed: { subject: "constraint", value: { type: "boolean" } },
  initialAdaptationSupportNeed: { subject: "constraint", value: { type: "boolean" } },
  parentStayGoals: {
    subject: "parent",
    value: {
      type: "array",
      maxItems: 6,
      items: { type: "string", enum: ["restWellness", "cafeDining", "tourismCulture", "natureBeach", "remoteWork", "childScheduleFirst"] },
    },
  },
  specialCareFollowUp: { subject: "constraint", value: { type: "string", enum: ["none", "required", "unknown"] } },
  studyOnlyAvoidance: { subject: "preference", value: { type: "boolean" } },
  budgetRangeKrw: {
    subject: "constraint",
    value: {
      type: "object",
      additionalProperties: false,
      properties: {
        min: { type: "integer", minimum: 0 },
        max: { type: "integer", minimum: 1 },
      },
      required: ["min", "max"],
    },
  },
  departureWindow: { subject: "constraint", value: { type: "string" } },
  durationWeeks: { subject: "constraint", value: { type: "integer", minimum: 1, maximum: 4 } },
}

const GeminiResponseSchema = z.object({
  candidates: z.array(z.object({
    content: z.object({ parts: z.array(z.object({ text: z.string().optional() })).optional() }).optional(),
  })).optional(),
})

type GeminiRequestResult = {
  readonly text: string | null
  readonly code: Exclude<CampfitV3ProviderDiagnosticCode, "schema_invalid">
  readonly httpStatus: number | null
}

/**
 * CLI-safe Gemini implementation. Product code must import the server-only wrapper
 * instead so this transport never enters a client bundle accidentally.
 */
export class GeminiCampfitV3ProviderCore implements CampfitV3LLMProvider {
  private diagnostic: CampfitV3ProviderDiagnostic | null = null
  private validatedResponse: CampfitV3ModelResponse | null = null

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
    const result = await requestGeminiOnce(prompt, conclusionResponseSchema)
    this.diagnostic = diagnosticFromRequest(result, false, result.code === "not_configured" ? 0 : 1, Date.now() - started)
    if (result.text === null) return null
    const parsed = parseGeminiJson(result.text)
    if (typeof parsed === "object" && parsed !== null && "conclusion" in parsed && typeof parsed.conclusion === "string") {
      this.diagnostic = { code: "ok", httpStatus: result.httpStatus, repaired: false, requestCount: 1, elapsedMs: Date.now() - started }
      return parsed.conclusion.slice(0, 500)
    }
    this.diagnostic = { code: "schema_invalid", httpStatus: result.httpStatus, repaired: false, requestCount: 1, elapsedMs: Date.now() - started }
    return null
  }

  private async requestStructured(prompt: string, allowedQuestionKeys: readonly string[]): Promise<CampfitV3ModelResponse | null> {
    this.validatedResponse = null
    const started = Date.now()
    const responseJsonSchema = conversationResponseJsonSchema(allowedQuestionKeys)
    const first = await requestGeminiOnce(prompt, responseJsonSchema)
    const firstCount = first.code === "not_configured" ? 0 : 1
    if (first.text === null) {
      this.diagnostic = diagnosticFromRequest(first, false, firstCount, Date.now() - started)
      return null
    }

    const parsed = parseStructured(first.text, allowedQuestionKeys)
    if (parsed !== null) {
      this.validatedResponse = parsed
      this.diagnostic = { code: "ok", httpStatus: first.httpStatus, repaired: false, requestCount: 1, elapsedMs: Date.now() - started }
      return parsed
    }

    const repair = await requestGeminiOnce([
      prompt,
      "이전 응답은 JSON 또는 fact 의미 계약을 충족하지 못했습니다.",
      "위 계약을 다시 확인하고 설명이나 markdown 없이 올바른 JSON 객체만 한 번 다시 반환하세요.",
    ].join("\n"), responseJsonSchema)
    if (repair.text === null) {
      this.diagnostic = diagnosticFromRequest(repair, true, 2, Date.now() - started)
      return null
    }
    const repaired = parseStructured(repair.text, allowedQuestionKeys)
    this.validatedResponse = repaired
    this.diagnostic = repaired === null
      ? { code: "schema_invalid", httpStatus: repair.httpStatus, repaired: true, requestCount: 2, elapsedMs: Date.now() - started }
      : { code: "ok", httpStatus: repair.httpStatus, repaired: true, requestCount: 2, elapsedMs: Date.now() - started }
    return repaired
  }
}

function parseStructured(text: string, allowedQuestionKeys: readonly string[]): CampfitV3ModelResponse | null {
  const parsed = CampfitV3ModelResponseSchema.safeParse(parseGeminiJson(text))
  if (!parsed.success) return null
  if (new Set(parsed.data.facts.map((fact) => fact.key)).size !== parsed.data.facts.length) return null
  if (parsed.data.suggestedNextQuestionKey !== null
    && !allowedQuestionKeys.includes(parsed.data.suggestedNextQuestionKey)) return null
  if (!parsed.data.facts.every(isSemanticallyValidModelFact)) return null
  return parsed.data
}

async function requestGeminiOnce(prompt: string, responseJsonSchema: Readonly<Record<string, unknown>>): Promise<GeminiRequestResult> {
  const apiKey = process.env["GEMINI_API_KEY"]
  if (!apiKey) return { text: null, code: "not_configured", httpStatus: null }

  const model = process.env["GEMINI_MODEL"] ?? defaultModel
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs)
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseJsonSchema,
          temperature: 0,
          maxOutputTokens: 4_096,
        },
      }),
    })
    if (!response.ok) {
      await response.arrayBuffer()
      return {
        text: null,
        code: response.status === 429 ? "quota_limited" : "http_error",
        httpStatus: response.status,
      }
    }
    const parsed = GeminiResponseSchema.safeParse(await response.json())
    const textParts = parsed.success
      ? parsed.data.candidates?.[0]?.content?.parts
        ?.flatMap((part) => part.text === undefined ? [] : [part.text]) ?? []
      : []
    const text = textParts.length === 0 ? null : textParts.join("")
    return text === null
      ? { text: null, code: "http_error", httpStatus: response.status }
      : { text, code: "ok", httpStatus: response.status }
  } catch {
    return { text: null, code: "network_error", httpStatus: null }
  } finally {
    clearTimeout(timeout)
  }
}

const conclusionResponseSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    conclusion: { type: "string", description: "한국어 상담 결론 2~3문장" },
  },
  required: ["conclusion"],
} as const

function conversationResponseJsonSchema(allowedQuestionKeys: readonly string[]): Readonly<Record<string, unknown>> {
  const suggestedNextQuestionKey = allowedQuestionKeys.length === 0
    ? { type: "null" }
    : {
      anyOf: [
        { type: "string", enum: [...allowedQuestionKeys] },
        { type: "null" },
      ],
    }
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      assistantMessage: {
        type: "string",
        description: "다음 질문을 포함하지 않는 짧은 한국어 확인 문구",
      },
      facts: {
        type: "array",
        maxItems: 20,
        description: "현재 사용자 발화에서 직접 확인되거나 낮은 confidence로 추론된 사실만 포함",
        items: { anyOf: factKeys.map(factResponseVariant) },
      },
      unresolved: {
        type: "array",
        maxItems: 20,
        items: { type: "string", enum: [...factKeys] },
      },
      conflicts: {
        type: "array",
        maxItems: 20,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            key: { type: "string", enum: [...factKeys] },
            reason: { type: "string", description: "민감 건강 상세정보를 포함하지 않는 짧은 충돌 사유" },
          },
          required: ["key", "reason"],
        },
      },
      suggestedNextQuestionKey,
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
  }
}

function factResponseVariant(key: (typeof factKeys)[number]): Readonly<Record<string, unknown>> {
  const contract = factResponseContracts[key]
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      key: { type: "string", enum: [key] },
      subject: { type: "string", enum: [contract.subject] },
      value: contract.value,
      source: { type: "string", enum: [...factSources] },
      confidence: { type: "number", minimum: 0, maximum: 1 },
      evidence: {
        type: "string",
        description: "민감 건강 상세정보를 포함하지 않는 240자 이하의 짧은 근거",
      },
    },
    required: ["key", "subject", "value", "source", "confidence", "evidence"],
  }
}

function diagnosticFromRequest(
  result: GeminiRequestResult,
  repaired: boolean,
  requestCount: number,
  elapsedMs: number,
): CampfitV3ProviderDiagnostic {
  return { code: result.code, httpStatus: result.httpStatus, repaired, requestCount, elapsedMs }
}
