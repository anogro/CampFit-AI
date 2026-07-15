import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

import { GeminiCampfitV3Provider } from "@/lib/campfit/v3/server/geminiProvider"
import { createInitialConversationState } from "@/lib/campfit/v3/stateEngine"
import type { AnalyzeConversationInput } from "@/lib/campfit/v3/provider"

const originalKey = process.env["GEMINI_API_KEY"]

const input: AnalyzeConversationInput = {
  transcript: [{ role: "user", content: "아이는 영어 초급이에요" }],
  currentState: createInitialConversationState(),
  basicInfo: {
    childAges: [8], departureWindow: "다음 여름방학", durationWeeks: 2,
    budgetMinKrw: 5_000_000, budgetMaxKrw: 8_000_000,
    adultCount: 1, childCount: 1, guardianStaysNearby: true,
  },
  userMessage: "아이는 영어 초급이에요",
  allowedQuestionKeys: ["child_english_level"],
}

describe("GeminiCampfitV3Provider", () => {
  beforeEach(() => {
    process.env["GEMINI_API_KEY"] = "test-key"
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
    if (originalKey === undefined) delete process.env["GEMINI_API_KEY"]
    else process.env["GEMINI_API_KEY"] = originalKey
  })

  it("uses one request when the first structured response is valid", async () => {
    const fetchMock = vi.fn(async () => geminiResponse(validModelResponse()))
    vi.stubGlobal("fetch", fetchMock)
    const provider = new GeminiCampfitV3Provider()
    const response = await provider.analyzeConversation(input)
    expect(response?.facts[0]?.value).toBe("beginner")
    expect(provider.getLastValidatedResponse()?.facts[0]?.value).toBe("beginner")
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(provider.getLastDiagnostic()).toMatchObject({
      code: "ok",
      providerResponseReceived: true,
      httpStatus: 200,
      errorStatus: null,
      repaired: false,
      requestCount: 1,
    })
    const body = requestBody(fetchMock, 0)
    const generationConfig = body["generationConfig"] as Record<string, unknown>
    expect(generationConfig).toEqual({
      responseMimeType: "application/json",
      temperature: 0,
      maxOutputTokens: 4_096,
    })
    expect(generationConfig).not.toHaveProperty("responseJsonSchema")
    expect(generationConfig).not.toHaveProperty("responseSchema")
    expect(generationConfig).not.toHaveProperty("_responseJsonSchema")
  })

  it("repairs a response with missing required control fields", async () => {
    const raw = validModelResponse()
    delete raw.suggestedNextQuestionKey
    delete raw.nextAction
    delete raw.readyForRecommendation
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(geminiResponse(raw))
      .mockResolvedValueOnce(geminiResponse(validModelResponse()))
    vi.stubGlobal("fetch", fetchMock)
    const provider = new GeminiCampfitV3Provider()
    const response = await provider.analyzeConversation(input)
    expect(response).not.toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(provider.getLastDiagnostic()).toMatchObject({ code: "ok", repaired: true, requestCount: 2 })
  })

  it("repairs a suggested question outside the service allowlist", async () => {
    const raw = validModelResponse()
    raw.suggestedNextQuestionKey = "not_an_allowed_question"
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(geminiResponse(raw))
      .mockResolvedValueOnce(geminiResponse(validModelResponse()))
    vi.stubGlobal("fetch", fetchMock)
    const provider = new GeminiCampfitV3Provider()
    const response = await provider.analyzeConversation(input)
    expect(response?.suggestedNextQuestionKey).toBe("child_english_level")
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(provider.getLastDiagnostic()).toMatchObject({ code: "ok", repaired: true, requestCount: 2 })
  })

  it("performs at most one schema repair", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(geminiResponse({ invalid: true }))
      .mockResolvedValueOnce(geminiResponse(validModelResponse()))
    vi.stubGlobal("fetch", fetchMock)
    const provider = new GeminiCampfitV3Provider()
    const response = await provider.analyzeConversation(input)
    expect(response).not.toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    for (const index of [0, 1]) {
      const generationConfig = requestBody(fetchMock, index)["generationConfig"] as Record<string, unknown>
      expect(generationConfig).toEqual({
        responseMimeType: "application/json",
        temperature: 0,
        maxOutputTokens: 4_096,
      })
      expect(generationConfig).not.toHaveProperty("responseJsonSchema")
      expect(generationConfig).not.toHaveProperty("responseSchema")
      expect(generationConfig).not.toHaveProperty("_responseJsonSchema")
    }
    expect(provider.getLastDiagnostic()).toMatchObject({ code: "ok", repaired: true, requestCount: 2 })
  })

  it("repairs a semantic fact-contract violation rather than accepting it", async () => {
    const wrongSubject = validModelResponse()
    wrongSubject.facts[0]!.subject = "parent"
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(geminiResponse(wrongSubject))
      .mockResolvedValueOnce(geminiResponse(validModelResponse()))
    vi.stubGlobal("fetch", fetchMock)
    const provider = new GeminiCampfitV3Provider()
    expect(await provider.analyzeConversation(input)).not.toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(provider.getLastDiagnostic()).toMatchObject({ code: "ok", repaired: true, requestCount: 2 })
  })

  it("repairs prose-wrapped JSON instead of extracting an inner object", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(geminiTextResponse(`설명입니다.\n${JSON.stringify(validModelResponse())}`))
      .mockResolvedValueOnce(geminiResponse(validModelResponse()))
    vi.stubGlobal("fetch", fetchMock)
    const provider = new GeminiCampfitV3Provider()
    expect(await provider.analyzeConversation(input)).not.toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(provider.getLastDiagnostic()).toMatchObject({ code: "ok", repaired: true, requestCount: 2 })
  })

  it("accepts an exact full JSON markdown fence", async () => {
    const fetchMock = vi.fn(async () => geminiTextResponse(`\uFEFF\n\`\`\`json\n${JSON.stringify(validModelResponse())}\n\`\`\``))
    vi.stubGlobal("fetch", fetchMock)
    const provider = new GeminiCampfitV3Provider()
    expect(await provider.analyzeConversation(input)).not.toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("normalizes an empty suggested question to null in JSON mode", async () => {
    const raw = validModelResponse()
    raw.suggestedNextQuestionKey = ""
    const fetchMock = vi.fn(async () => geminiResponse(raw))
    vi.stubGlobal("fetch", fetchMock)
    const provider = new GeminiCampfitV3Provider({ maxProviderRequests: 1 })

    const response = await provider.analyzeConversation({ ...input, allowedQuestionKeys: [] })

    expect(response?.suggestedNextQuestionKey).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(provider.getLastDiagnostic()).toMatchObject({ code: "ok", repaired: false, requestCount: 1 })
  })

  it("does not repair invalid JSON when the evaluation request limit is one", async () => {
    const fetchMock = vi.fn(async () => geminiTextResponse("not-json"))
    vi.stubGlobal("fetch", fetchMock)
    const provider = new GeminiCampfitV3Provider({ maxProviderRequests: 1 })

    expect(await provider.analyzeConversation(input)).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(provider.getLastDiagnostic()).toMatchObject({
      code: "json_parse_failed",
      providerResponseReceived: true,
      repaired: false,
      requestCount: 1,
    })
  })

  it("classifies valid JSON with a schema mismatch without evaluation repair", async () => {
    const fetchMock = vi.fn(async () => geminiTextResponse("null"))
    vi.stubGlobal("fetch", fetchMock)
    const provider = new GeminiCampfitV3Provider({ maxProviderRequests: 1 })

    expect(await provider.analyzeConversation(input)).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(provider.getLastDiagnostic()).toMatchObject({
      code: "schema_validation_failed",
      repaired: false,
      requestCount: 1,
    })
  })

  it("classifies a semantic mismatch without evaluation repair", async () => {
    const duplicate = validModelResponse()
    duplicate.facts.push({ ...duplicate.facts[0]! })
    const fetchMock = vi.fn(async () => geminiResponse(duplicate))
    vi.stubGlobal("fetch", fetchMock)
    const provider = new GeminiCampfitV3Provider({ maxProviderRequests: 1 })

    expect(await provider.analyzeConversation(input)).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(provider.getLastDiagnostic()).toMatchObject({
      code: "semantic_validation_failed",
      repaired: false,
      requestCount: 1,
    })
  })

  it("rejects internal counselor terms and multiple user-facing questions", async () => {
    const raw = validModelResponse()
    raw.assistantMessage = "slot validation을 확인했어요? 다음 질문도 답해주세요?"
    const fetchMock = vi.fn(async () => geminiResponse(raw))
    vi.stubGlobal("fetch", fetchMock)
    const provider = new GeminiCampfitV3Provider({ maxProviderRequests: 1 })

    expect(await provider.analyzeConversation(input)).toBeNull()
    expect(provider.getLastDiagnostic()).toMatchObject({
      code: "semantic_validation_failed",
      requestCount: 1,
    })
  })

  it("rejects detailed health information echoed in the model response", async () => {
    const raw = validModelResponse()
    raw.assistantMessage = "알레르기 항목은 상담 전에 확인할게요."
    const fetchMock = vi.fn(async () => geminiResponse(raw))
    vi.stubGlobal("fetch", fetchMock)
    const provider = new GeminiCampfitV3Provider({ maxProviderRequests: 1 })

    expect(await provider.analyzeConversation(input)).toBeNull()
    expect(provider.getLastDiagnostic()).toMatchObject({
      code: "semantic_validation_failed",
      requestCount: 1,
    })
  })

  it("repairs duplicate fact keys instead of silently applying the last value", async () => {
    const duplicate = validModelResponse()
    duplicate.facts.push({ ...duplicate.facts[0]!, value: "advanced", evidence: "duplicate" })
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(geminiResponse(duplicate))
      .mockResolvedValueOnce(geminiResponse(validModelResponse()))
    vi.stubGlobal("fetch", fetchMock)
    const provider = new GeminiCampfitV3Provider()
    expect(await provider.analyzeConversation(input)).not.toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(provider.getLastDiagnostic()).toMatchObject({ code: "ok", repaired: true, requestCount: 2 })
  })

  it("stops after the one repair also fails", async () => {
    const fetchMock = vi.fn(async () => geminiResponse({ invalid: true }))
    vi.stubGlobal("fetch", fetchMock)
    const provider = new GeminiCampfitV3Provider()
    const response = await provider.analyzeConversation(input)
    expect(response).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(provider.getLastDiagnostic()).toMatchObject({ code: "schema_validation_failed", repaired: true, requestCount: 2 })
  })

  it("does not retry a quota response", async () => {
    const fetchMock = vi.fn(async () => providerErrorResponse(429, "RESOURCE_EXHAUSTED"))
    vi.stubGlobal("fetch", fetchMock)
    const provider = new GeminiCampfitV3Provider()
    expect(await provider.analyzeConversation(input)).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(provider.getLastDiagnostic()).toMatchObject({
      code: "rate_limited",
      providerResponseReceived: true,
      httpStatus: 429,
      errorStatus: "RESOURCE_EXHAUSTED",
      requestCount: 1,
    })
  })

  it("clears the last validated response before a later failed request", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(geminiResponse(validModelResponse()))
      .mockResolvedValueOnce(providerErrorResponse(429, "RESOURCE_EXHAUSTED"))
    vi.stubGlobal("fetch", fetchMock)
    const provider = new GeminiCampfitV3Provider()
    expect(await provider.analyzeConversation(input)).not.toBeNull()
    expect(provider.getLastValidatedResponse()).not.toBeNull()
    expect(await provider.analyzeConversation(input)).toBeNull()
    expect(provider.getLastValidatedResponse()).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("does not retry a transport response that has no candidate text", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ candidates: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }))
    vi.stubGlobal("fetch", fetchMock)
    const provider = new GeminiCampfitV3Provider()
    expect(await provider.analyzeConversation(input)).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(provider.getLastDiagnostic()).toMatchObject({ code: "empty_response", providerResponseReceived: true, httpStatus: 200, requestCount: 1 })
  })

  it("joins every text part before parsing the structured response", async () => {
    const serialized = JSON.stringify(validModelResponse())
    const midpoint = Math.floor(serialized.length / 2)
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      candidates: [{ content: { parts: [
        { text: serialized.slice(0, midpoint) },
        { text: serialized.slice(midpoint) },
      ] } }],
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }))
    vi.stubGlobal("fetch", fetchMock)
    const provider = new GeminiCampfitV3Provider()
    expect(await provider.analyzeConversation(input)).not.toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(provider.getLastDiagnostic()).toMatchObject({ code: "ok", repaired: false, requestCount: 1 })
  })

  it("does not retry a network failure", async () => {
    const fetchMock = vi.fn(async () => { throw new Error("network unavailable") })
    vi.stubGlobal("fetch", fetchMock)
    const provider = new GeminiCampfitV3Provider()
    expect(await provider.analyzeConversation(input)).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(provider.getLastDiagnostic()).toMatchObject({ code: "network_error", providerResponseReceived: false, httpStatus: null, requestCount: 1 })
  })

  it("reports missing configuration without making a request", async () => {
    delete process.env["GEMINI_API_KEY"]
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    const provider = new GeminiCampfitV3Provider()
    expect(await provider.analyzeConversation(input)).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(provider.getLastDiagnostic()).toMatchObject({ code: "provider_unavailable", providerResponseReceived: false, requestCount: 0 })
  })

  it.each([
    [400, "INVALID_ARGUMENT", "invalid_request"],
    [403, "PERMISSION_DENIED", "permission_denied"],
    [404, "NOT_FOUND", "model_not_found"],
    [429, "RESOURCE_EXHAUSTED", "rate_limited"],
    [500, "INTERNAL", "provider_internal"],
    [503, "UNAVAILABLE", "provider_unavailable"],
  ] as const)("maps HTTP %i to %s safely", async (status, errorStatus, code) => {
    const fetchMock = vi.fn(async () => providerErrorResponse(status, errorStatus))
    vi.stubGlobal("fetch", fetchMock)
    const provider = new GeminiCampfitV3Provider()

    expect(await provider.analyzeConversation(input)).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(provider.getLastDiagnostic()).toMatchObject({
      code,
      providerResponseReceived: true,
      httpStatus: status,
      errorStatus,
      requestCount: 1,
    })
  })

  it("classifies the provider timeout without retrying", async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })))
    }))
    vi.stubGlobal("fetch", fetchMock)
    const provider = new GeminiCampfitV3Provider()
    const pending = provider.analyzeConversation(input)

    await vi.advanceTimersByTimeAsync(25_000)
    expect(await pending).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(provider.getLastDiagnostic()).toMatchObject({
      code: "timeout",
      providerResponseReceived: false,
      httpStatus: null,
      requestCount: 1,
    })
  })

  it("distinguishes provider cancellation from its own timeout", async () => {
    const fetchMock = vi.fn(async () => { throw Object.assign(new Error("cancelled"), { name: "AbortError" }) })
    vi.stubGlobal("fetch", fetchMock)
    const provider = new GeminiCampfitV3Provider()

    expect(await provider.analyzeConversation(input)).toBeNull()
    expect(provider.getLastDiagnostic()).toMatchObject({
      code: "provider_cancelled",
      providerResponseReceived: false,
      requestCount: 1,
    })
  })

  it("separates an invalid HTTP 200 JSON body from an empty model response", async () => {
    const fetchMock = vi.fn(async () => new Response("not-json", {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }))
    vi.stubGlobal("fetch", fetchMock)
    const provider = new GeminiCampfitV3Provider()

    expect(await provider.analyzeConversation(input)).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(provider.getLastDiagnostic()).toMatchObject({
      code: "json_parse_failed",
      providerResponseReceived: true,
      httpStatus: 200,
      requestCount: 1,
    })
  })

  it("classifies a repeated semantic violation after the single repair", async () => {
    const duplicate = validModelResponse()
    duplicate.facts.push({ ...duplicate.facts[0]! })
    const fetchMock = vi.fn(async () => geminiResponse(duplicate))
    vi.stubGlobal("fetch", fetchMock)
    const provider = new GeminiCampfitV3Provider()

    expect(await provider.analyzeConversation(input)).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(provider.getLastDiagnostic()).toMatchObject({
      code: "semantic_validation_failed",
      providerResponseReceived: true,
      repaired: true,
      requestCount: 2,
    })
  })

  it("never places the API key, prompt, or raw provider error in diagnostics", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify({
      error: {
        status: "INVALID_ARGUMENT",
        message: "test-key and the full prompt must not escape",
        details: [{ raw: input.userMessage }],
      },
    }), { status: 400, headers: { "Content-Type": "application/json" } }))
    vi.stubGlobal("fetch", fetchMock)
    const provider = new GeminiCampfitV3Provider()

    expect(await provider.analyzeConversation(input)).toBeNull()
    const diagnostic = provider.getLastDiagnostic()
    const serialized = JSON.stringify(diagnostic)
    const endpoint = String(fetchMock.mock.calls[0]?.[0])
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined
    expect(endpoint).not.toContain("test-key")
    expect(new Headers(init?.headers).get("x-goog-api-key")).toBe("test-key")
    expect(serialized).not.toContain("test-key")
    expect(serialized).not.toContain(input.userMessage)
    expect(serialized).not.toContain("full prompt")
    expect(diagnostic).toMatchObject({ code: "invalid_request", errorStatus: "INVALID_ARGUMENT" })
  })
})

function validModelResponse(): {
  assistantMessage: string
  facts: Array<{ key: string; subject: string; value: unknown; source: string; confidence: number; evidence: string }>
  unresolved: string[]
  conflicts: unknown[]
  suggestedNextQuestionKey?: string | null
  nextAction?: string
  readyForRecommendation?: boolean
} {
  return {
    assistantMessage: "아이와 부모님의 영어 수준을 나누어 반영했어요.",
    facts: [{
      key: "childEnglishLevel", subject: "child", value: "beginner",
      source: "explicit_user_statement", confidence: 1, evidence: "아이 영어 초급",
    }],
    unresolved: [], conflicts: [], suggestedNextQuestionKey: "child_english_level",
    nextAction: "ask", readyForRecommendation: false,
  }
}

function requestBody(fetchMock: ReturnType<typeof vi.fn>, index: number): Record<string, unknown> {
  const init = fetchMock.mock.calls[index]?.[1] as RequestInit | undefined
  return JSON.parse(String(init?.body)) as Record<string, unknown>
}

function geminiResponse(value: unknown): Response {
  return geminiTextResponse(JSON.stringify(value))
}

function geminiTextResponse(text: string): Response {
  return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  })
}

function providerErrorResponse(status: number, errorStatus: string): Response {
  return new Response(JSON.stringify({ error: { status: errorStatus, message: "safe test error" } }), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}
