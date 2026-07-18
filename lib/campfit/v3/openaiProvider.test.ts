import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { OpenAICampfitV3ProviderCore } from "@/lib/campfit/v3/openaiProviderCore"
import { createInitialConversationState } from "@/lib/campfit/v3/stateEngine"
import type { AnalyzeConversationInput } from "@/lib/campfit/v3/provider"

const input: AnalyzeConversationInput = {
  transcript: [{ role: "user", content: "아이는 영어 초급이고 저는 영어로 소통할 수 있어요." }],
  currentState: createInitialConversationState(),
  basicInfo: {
    childAges: [8], departureWindow: "2026년 8월", durationWeeks: 2,
    budgetMinKrw: 5_000_000, budgetMaxKrw: 8_000_000,
    adultCount: 1, childCount: 1, guardianStaysNearby: true,
  },
  userMessage: "아이는 영어 초급이고 저는 영어로 소통할 수 있어요.",
  allowedQuestionKeys: ["child_english_level"],
}

describe("OpenAICampfitV3ProviderCore", () => {
  beforeEach(() => {
    vi.stubEnv("OPENAI_API_KEY", "test-openai-key")
    vi.stubEnv("OPENAI_MODEL", "test-openai-model")
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it("uses Responses API strict Structured Outputs and the common model contract", async () => {
    const fetchMock = vi.fn(async () => openaiResponse(validModelResponse()))
    vi.stubGlobal("fetch", fetchMock)
    const provider = new OpenAICampfitV3ProviderCore({ maxProviderRequests: 1 })

    const response = await provider.analyzeConversation(input)

    expect(response?.facts[0]?.value).toBe("beginner")
    expect(provider.getLastDiagnostic()).toMatchObject({
      code: "ok", providerResponseReceived: true, httpStatus: 200,
      errorStatus: null, repaired: false, requestCount: 1,
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [endpoint, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(endpoint).toBe("https://api.openai.com/v1/responses")
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer test-openai-key")
    const body = JSON.parse(String(init.body)) as Record<string, unknown>
    expect(body["model"]).toBe("test-openai-model")
    expect(body["input"]).toContain("CampFit AI v3")
    expect(body["text"]).toMatchObject({ format: { type: "json_schema", name: "campfit_model_response", strict: true } })
    expect((body["text"] as { format: { schema: Record<string, unknown> } }).format.schema["additionalProperties"]).toBe(false)
  })

  it("classifies a timeout without retrying", async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })))
    }))
    vi.stubGlobal("fetch", fetchMock)
    const provider = new OpenAICampfitV3ProviderCore({ maxProviderRequests: 1, timeoutMs: 50 })
    const pending = provider.analyzeConversation(input)

    await vi.advanceTimersByTimeAsync(50)
    expect(await pending).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(provider.getLastDiagnostic()).toMatchObject({
      code: "timeout", providerResponseReceived: false, httpStatus: null, requestCount: 1,
    })
  })

  it("classifies a network error without exposing provider details", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("private network detail") }))
    const provider = new OpenAICampfitV3ProviderCore({ maxProviderRequests: 1 })

    expect(await provider.analyzeConversation(input)).toBeNull()
    expect(provider.getLastDiagnostic()).toMatchObject({ code: "network_error", providerResponseReceived: false, requestCount: 1 })
    expect(JSON.stringify(provider.getLastDiagnostic())).not.toContain("private network detail")
  })

  it("classifies invalid JSON returned inside an otherwise valid response envelope", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => openaiResponseText("not-json")))
    const provider = new OpenAICampfitV3ProviderCore({ maxProviderRequests: 1 })

    expect(await provider.analyzeConversation(input)).toBeNull()
    expect(provider.getLastDiagnostic()).toMatchObject({
      code: "json_parse_failed", providerResponseReceived: true, httpStatus: 200, requestCount: 1,
    })
  })

  it("classifies a schema validation failure without applying malformed state", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => openaiResponse({ invalid: true })))
    const provider = new OpenAICampfitV3ProviderCore({ maxProviderRequests: 1 })

    expect(await provider.analyzeConversation(input)).toBeNull()
    expect(provider.getLastDiagnostic()).toMatchObject({ code: "schema_validation_failed", requestCount: 1 })
    expect(provider.getLastValidatedResponse()).toBeNull()
  })

  it("uses the shared semantic validator for duplicate fact keys", async () => {
    const duplicate = validModelResponse()
    duplicate["facts"] = [
      ...(duplicate["facts"] as Array<Record<string, unknown>>),
      ...(duplicate["facts"] as Array<Record<string, unknown>>),
    ]
    vi.stubGlobal("fetch", vi.fn(async () => openaiResponse(duplicate)))
    const provider = new OpenAICampfitV3ProviderCore({ maxProviderRequests: 1 })

    expect(await provider.analyzeConversation(input)).toBeNull()
    expect(provider.getLastDiagnostic()).toMatchObject({ code: "semantic_validation_failed", requestCount: 1 })
  })

  it.each([
    [400, "invalid_request"], [401, "permission_denied"], [404, "model_not_found"],
    [429, "rate_limited"], [500, "provider_internal"], [503, "provider_unavailable"],
  ] as const)("maps HTTP %i to %s", async (status, code) => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: { status: "SAFE_STATUS" } }), {
      status, headers: { "Content-Type": "application/json" },
    })))
    const provider = new OpenAICampfitV3ProviderCore({ maxProviderRequests: 1 })

    expect(await provider.analyzeConversation(input)).toBeNull()
    expect(provider.getLastDiagnostic()).toMatchObject({
      code, providerResponseReceived: true, httpStatus: status, errorStatus: "SAFE_STATUS", requestCount: 1,
    })
  })

  it("reports missing key or model as unavailable without a request", async () => {
    vi.stubEnv("OPENAI_API_KEY", "")
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    const provider = new OpenAICampfitV3ProviderCore({ maxProviderRequests: 1 })

    expect(await provider.analyzeConversation(input)).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(provider.getLastDiagnostic()).toMatchObject({ code: "provider_unavailable", requestCount: 0 })
  })
})

function validModelResponse(): Record<string, unknown> {
  return {
    assistantMessage: "아이와 부모님의 영어 상황을 함께 이해했어요.",
    facts: [{
      key: "childEnglishLevel", subject: "child", value: "beginner",
      source: "explicit_user_statement", confidence: 1, evidence: "아이가 영어 초급이라고 말함",
    }],
    unresolved: [], conflicts: [], suggestedNextQuestionKey: "child_english_level",
    nextAction: "ask", readyForRecommendation: false,
  }
}

function openaiResponse(value: unknown): Response {
  return openaiResponseText(JSON.stringify(value))
}

function openaiResponseText(text: string): Response {
  return new Response(JSON.stringify({
    id: "resp_test",
    output: [{ type: "message", content: [{ type: "output_text", text }] }],
  }), { status: 200, headers: { "Content-Type": "application/json" } })
}
