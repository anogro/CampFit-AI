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
    vi.unstubAllGlobals()
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
    expect(provider.getLastDiagnostic()).toMatchObject({ code: "ok", repaired: false, requestCount: 1 })
    const body = requestBody(fetchMock, 0)
    const generationConfig = body["generationConfig"] as Record<string, unknown>
    const responseJsonSchema = generationConfig["responseJsonSchema"] as Record<string, unknown>
    expect(generationConfig).toMatchObject({ responseMimeType: "application/json", temperature: 0, maxOutputTokens: 4_096 })
    expect(generationConfig).not.toHaveProperty("responseSchema")
    expect(responseJsonSchema["required"]).toEqual([
      "assistantMessage", "facts", "unresolved", "conflicts",
      "suggestedNextQuestionKey", "nextAction", "readyForRecommendation",
    ])
    const properties = responseJsonSchema["properties"] as Record<string, Record<string, unknown>>
    expect(properties["suggestedNextQuestionKey"]?.["anyOf"]).toEqual([
      { type: "string", enum: ["child_english_level"] },
      { type: "null" },
    ])
    const factItems = properties["facts"]?.["items"] as Record<string, unknown>
    const variants = factItems["anyOf"] as Array<Record<string, unknown>>
    expect(variants).toHaveLength(18)
    const childEnglishVariant = variants.find((variant) => {
      const variantProperties = variant["properties"] as Record<string, Record<string, unknown>>
      return (variantProperties["key"]?.["enum"] as string[] | undefined)?.[0] === "childEnglishLevel"
    })
    expect(childEnglishVariant).toMatchObject({
      properties: {
        key: { enum: ["childEnglishLevel"] },
        subject: { enum: ["child"] },
        value: { enum: ["beginner", "basic", "intermediate", "advanced"] },
      },
    })
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
    expect(requestBody(fetchMock, 0)["generationConfig"]).toHaveProperty("responseJsonSchema")
    expect(requestBody(fetchMock, 1)["generationConfig"]).toHaveProperty("responseJsonSchema")
    expect(requestBody(fetchMock, 0)["generationConfig"]).not.toHaveProperty("responseSchema")
    expect(requestBody(fetchMock, 1)["generationConfig"]).not.toHaveProperty("responseSchema")
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
    expect(provider.getLastDiagnostic()).toMatchObject({ code: "schema_invalid", repaired: true, requestCount: 2 })
  })

  it("does not retry a quota response", async () => {
    const fetchMock = vi.fn(async () => new Response("", { status: 429 }))
    vi.stubGlobal("fetch", fetchMock)
    const provider = new GeminiCampfitV3Provider()
    expect(await provider.analyzeConversation(input)).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(provider.getLastDiagnostic()).toMatchObject({ code: "quota_limited", httpStatus: 429, requestCount: 1 })
  })

  it("clears the last validated response before a later failed request", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(geminiResponse(validModelResponse()))
      .mockResolvedValueOnce(new Response("", { status: 429 }))
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
    expect(provider.getLastDiagnostic()).toMatchObject({ code: "http_error", httpStatus: 200, requestCount: 1 })
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
    expect(provider.getLastDiagnostic()).toMatchObject({ code: "network_error", httpStatus: null, requestCount: 1 })
  })

  it("reports missing configuration without making a request", async () => {
    delete process.env["GEMINI_API_KEY"]
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    const provider = new GeminiCampfitV3Provider()
    expect(await provider.analyzeConversation(input)).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(provider.getLastDiagnostic()).toMatchObject({ code: "not_configured", requestCount: 0 })
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
