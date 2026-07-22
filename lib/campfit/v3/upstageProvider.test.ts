import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { UpstageCampfitV3ProviderCore } from "@/lib/campfit/v3/upstageProviderCore"
import { createInitialConversationState } from "@/lib/campfit/v3/stateEngine"
import type { AnalyzeConversationInput } from "@/lib/campfit/v3/provider"

const input: AnalyzeConversationInput = {
  transcript: [{ role: "user", content: "영어 수업에 참여할 수 있어요." }],
  currentState: createInitialConversationState(),
  basicInfo: { childAges: [8], departureWindow: "2026-08", durationWeeks: 2, budgetMinKrw: 5_000_000, budgetMaxKrw: 8_000_000, adultCount: 1, childCount: 1, guardianStaysNearby: true },
  userMessage: "영어 수업에 참여할 수 있어요.",
  allowedQuestionKeys: ["child_english_level"],
}

describe("UpstageCampfitV3ProviderCore", () => {
  beforeEach(() => {
    vi.stubEnv("UPSTAGE_API_KEY", "test-upstage-key")
    vi.stubEnv("UPSTAGE_MODEL", "solar-pro3")
    vi.stubEnv("UPSTAGE_BASE_URL", "https://api.upstage.ai/v1")
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it("uses Upstage Chat Completions and the shared CampFit contract", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(validModelResponse()) } }] }), { status: 200, headers: { "Content-Type": "application/json" } }))
    vi.stubGlobal("fetch", fetchMock)
    const provider = new UpstageCampfitV3ProviderCore({ maxProviderRequests: 1 })

    const response = await provider.analyzeConversation(input)

    expect(response?.facts[0]?.value).toBe("beginner")
    expect(provider.getLastDiagnostic()).toMatchObject({ code: "ok", providerResponseReceived: true, httpStatus: 200, requestCount: 1 })
    const [endpoint, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(endpoint).toBe("https://api.upstage.ai/v1/chat/completions")
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer test-upstage-key")
    const body = JSON.parse(String(init.body)) as Record<string, any>
    expect(body["model"]).toBe("solar-pro3")
    expect((body["messages"] as Array<{ content: string }>)[0]?.content).toContain("CampFit AI v3")
  })

  it("does not call the provider when the Upstage key or model is missing", async () => {
    vi.stubEnv("UPSTAGE_API_KEY", "")
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    const provider = new UpstageCampfitV3ProviderCore({ maxProviderRequests: 1 })

    expect(await provider.analyzeConversation(input)).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(provider.getLastDiagnostic()).toMatchObject({ code: "provider_unavailable", requestCount: 0 })
  })
})

function validModelResponse(): Record<string, unknown> {
  return {
    assistantMessage: "아이의 영어 상황을 확인했어요.",
    facts: [{ key: "childEnglishLevel", subject: "child", value: "beginner", source: "explicit_user_statement", confidence: 1, evidence: "영어 수업에 참여할 수 있어요" }],
    unresolved: [], conflicts: [], suggestedNextQuestionKey: "child_english_level", nextAction: "ask", readyForRecommendation: false,
  }
}
