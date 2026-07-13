import { beforeEach, describe, expect, it, vi } from "vitest"

const startConversation = vi.hoisted(() => vi.fn())

vi.mock("@/lib/campfit/v3/conversationService", () => ({ startConversation }))

import { POST } from "@/app/api/campfit/v3/conversation/start/route"

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

const serviceResponse = {
  assistantMessage: "아이의 영어 경험부터 알려주세요.",
  updatedState: {
    facts: {},
    askedQuestionKeys: ["childEnglishLevel"],
    completedQuestionKeys: [],
    failedQuestionKeys: [],
    currentQuestionKey: "childEnglishLevel",
    questionCount: 1,
    progress: 0,
    unresolved: [],
    conflicts: [],
  },
  updatedBasicInfo: basicInfo,
  quickReplies: [],
  questionKey: "childEnglishLevel",
  progress: 0,
  progressMessage: "상담을 시작했어요.",
  readyForRecommendation: false,
  conflicts: [],
  warnings: [],
  aiUsed: false,
  diagnostics: {
    providerCallAttempted: false,
    providerResponseValidated: false,
    aiUsed: false,
    fallbackReason: null,
    rawPrompt: "must never leave the server",
  },
}

function request(body: unknown): Request {
  return new Request("http://localhost/api/campfit/v3/conversation/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("CampFit v3 conversation start route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    startConversation.mockReturnValue(serviceResponse)
  })

  it("omits diagnostics from a valid start response", async () => {
    const response = await POST(request({ basicInfo }))
    const payload = await response.json() as Record<string, unknown>

    expect(response.status).toBe(200)
    expect(startConversation).toHaveBeenCalledWith(basicInfo)
    expect(payload).not.toHaveProperty("diagnostics")
    expect(JSON.stringify(payload)).not.toContain("must never leave the server")
  })

  it("returns 400 without starting a conversation for invalid input", async () => {
    const response = await POST(request({ basicInfo: { ...basicInfo, childAges: [] } }))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ message: "기본정보를 다시 확인해 주세요." })
    expect(startConversation).not.toHaveBeenCalled()
  })
})
