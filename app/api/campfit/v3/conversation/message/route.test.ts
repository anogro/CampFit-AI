import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const processConversationMessage = vi.hoisted(() => vi.fn())
const providerConstructed = vi.hoisted(() => vi.fn())
const createConversationProvider = vi.hoisted(() => vi.fn((options?: unknown) => {
  providerConstructed(options)
  return {}
}))

vi.mock("@/lib/campfit/v3/conversationService", () => ({ processConversationMessage }))
vi.mock("@/lib/campfit/v3/server/providerFactory", () => ({ createConversationProvider }))

import { POST } from "@/app/api/campfit/v3/conversation/message/route"

const basicInfo = {
  childAges: [8],
  departureWindow: "2026년 8월",
  durationWeeks: 2,
  budgetMinKrw: 5_000_000,
  budgetMaxKrw: 8_000_000,
  adultCount: 1,
  childCount: 1,
  guardianStaysNearby: true as const,
}

const state = {
  facts: {},
  askedQuestionKeys: ["childEnglishLevel"],
  completedQuestionKeys: [],
  failedQuestionKeys: [],
  currentQuestionKey: "childEnglishLevel",
  questionCount: 1,
  progress: 0,
  unresolved: [],
  conflicts: [],
}

const serviceResponse = {
  assistantMessage: "답변을 확인했어요.",
  updatedState: state,
  updatedBasicInfo: basicInfo,
  quickReplies: [],
  questionKey: "experienceGoals",
  progress: 12,
  progressMessage: "상담을 시작했어요.",
  readyForRecommendation: false,
  conflicts: [],
  warnings: [],
  aiUsed: true,
  diagnostics: {
    providerCallAttempted: true,
    providerResponseReceived: true,
    providerResponseValidated: true,
    aiUsed: true,
    fallbackReason: null,
    providerHttpStatus: 200,
    providerErrorStatus: null,
    providerRequestCount: 1,
    elapsedMs: 5_106,
    rawPrompt: "must never leave the server",
    rawProviderBody: "must also never leave the server",
    apiKey: "secret-key",
    model: "internal-model-name",
  },
}

function request(): Request {
  return new Request("http://localhost/api/campfit/v3/conversation/message", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      transcript: [],
      currentState: state,
      basicInfo,
      userMessage: "영어는 초급이에요",
      quickReplyKey: null,
    }),
  })
}

describe("CampFit v3 conversation message route", () => {
  beforeEach(() => {
    processConversationMessage.mockResolvedValue(serviceResponse)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.clearAllMocks()
  })

  it("uses the selected server provider for a normal free-text request", async () => {
    vi.stubEnv("NODE_ENV", "test")
    const response = await POST(request())

    expect(response.status).toBe(200)
    expect(providerConstructed).toHaveBeenCalledTimes(1)
    expect(providerConstructed).toHaveBeenCalledWith({ maxProviderRequests: 1 })
    expect(processConversationMessage).toHaveBeenCalledWith(expect.objectContaining({
      userMessage: "영어는 초급이에요",
      quickReplyKey: null,
      provider: expect.anything(),
    }))
  })

  it("keeps the product path to one provider request even with evaluation flags", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("CAMPFIT_V3_GEMINI_EVALUATION_SINGLE_REQUEST", "true")

    expect((await POST(request())).status).toBe(200)
    expect(providerConstructed).toHaveBeenCalledWith({ maxProviderRequests: 1 })
  })

  it("keeps the product path to one provider request in production", async () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("CAMPFIT_V3_GEMINI_EVALUATION_SINGLE_REQUEST", "true")

    expect((await POST(request())).status).toBe(200)
    expect(providerConstructed).toHaveBeenCalledWith({ maxProviderRequests: 1 })
  })

  it("always strips diagnostics from production responses", async () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("CAMPFIT_V3_INCLUDE_DIAGNOSTICS", "true")

    const payload = await (await POST(request())).json() as Record<string, unknown>

    expect(payload).not.toHaveProperty("diagnostics")
    expect(JSON.stringify(payload)).not.toContain("must never leave the server")
    expect(JSON.stringify(payload)).not.toContain("internal-model-name")
  })

  it("exposes only the safe diagnostics allowlist during explicit local debugging", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("CAMPFIT_V3_INCLUDE_DIAGNOSTICS", "true")

    const payload = await (await POST(request())).json() as Record<string, unknown>

    expect(payload["diagnostics"]).toEqual({
      providerCallAttempted: true,
      providerResponseReceived: true,
      providerResponseValidated: true,
      aiUsed: true,
      fallbackReason: null,
      providerHttpStatus: 200,
      providerErrorStatus: null,
      providerRequestCount: 1,
      elapsedMs: 5_106,
    })
    expect(JSON.stringify(payload)).not.toContain("rawPrompt")
    expect(JSON.stringify(payload)).not.toContain("rawProviderBody")
    expect(JSON.stringify(payload)).not.toContain("secret-key")
    expect(JSON.stringify(payload)).not.toContain("model")
  })

  it("does not expose diagnostics without the explicit debug flag", async () => {
    vi.stubEnv("NODE_ENV", "development")
    vi.stubEnv("CAMPFIT_V3_INCLUDE_DIAGNOSTICS", "false")

    const payload = await (await POST(request())).json() as Record<string, unknown>

    expect(payload).not.toHaveProperty("diagnostics")
  })

  it("does not claim a failed answer was saved", async () => {
    processConversationMessage.mockRejectedValue(new Error("provider failed"))

    const response = await POST(request())
    const payload = await response.json() as Record<string, unknown>

    expect(response.status).toBe(500)
    expect(payload).toEqual({
      message: "답변을 처리하지 못했어요. 선택지를 고르거나 잠시 후 다시 시도해 주세요.",
    })
    expect(JSON.stringify(payload)).not.toContain("보관")
    expect(JSON.stringify(payload)).not.toContain("provider failed")
  })
})
