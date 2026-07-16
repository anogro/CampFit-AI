import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const loadV3Catalog = vi.hoisted(() => vi.fn())
const loadDemoCatalog = vi.hoisted(() => vi.fn())
const isReadyForRecommendation = vi.hoisted(() => vi.fn())
const buildRecommendation = vi.hoisted(() => vi.fn())
const explainRecommendation = vi.hoisted(() => vi.fn())
const createConversationProvider = vi.hoisted(() => vi.fn(() => ({ explainRecommendation })))

vi.mock("@/lib/campfit/v3/catalogRepository", () => ({ loadV3Catalog }))
vi.mock("@/lib/campfit/v3/demoCatalog", () => ({ loadDemoCatalog }))
vi.mock("@/lib/campfit/v3/progress", () => ({ isReadyForRecommendation }))
vi.mock("@/lib/campfit/v3/recommendationEngine", () => ({ buildRecommendation }))
vi.mock("@/lib/campfit/v3/server/providerFactory", () => ({ createConversationProvider }))

import { POST } from "@/app/api/campfit/v3/recommend/route"

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

const finalState = {
  facts: {},
  askedQuestionKeys: [],
  completedQuestionKeys: [],
  failedQuestionKeys: [],
  currentQuestionKey: null,
  questionCount: 0,
  progress: 100,
  unresolved: [],
  conflicts: [],
}

const result = {
  consultingConclusion: "코드가 계산한 결론입니다.",
  experienceDirections: [],
  destinationRecommendations: [],
  requiredSupportConditions: [],
  programCandidates: [],
  verificationChecklist: [],
  alternatives: [],
  limitedResult: true,
  catalogSource: "static_fallback" as const,
}

function request(demo = false): Request {
  return new Request("http://localhost/api/campfit/v3/recommend", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transcript: [], finalState, basicInfo, ...(demo ? { demo: true } : {}) }),
  })
}

describe("CampFit v3 recommendation route", () => {
  beforeEach(() => {
    isReadyForRecommendation.mockReturnValue(true)
    loadV3Catalog.mockResolvedValue({ programs: [], cities: [], source: "static_fallback" })
    loadDemoCatalog.mockReturnValue({ programs: [], cities: [], source: "demo", warnings: [] })
    buildRecommendation.mockReturnValue(result)
    explainRecommendation.mockResolvedValue(null)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.clearAllMocks()
  })

  it("preserves the catalog source instead of presenting fallback data as real", async () => {
    vi.stubEnv("CAMPFIT_V3_AI_RESULT_EXPLANATION", "false")

    const response = await POST(request())
    const payload = await response.json() as Record<string, unknown>

    expect(response.status).toBe(200)
    expect(payload["catalogSource"]).toBe("static_fallback")
  })

  it("uses the demo catalog only when the request explicitly opts in", async () => {
    vi.stubEnv("CAMPFIT_V3_AI_RESULT_EXPLANATION", "false")
    buildRecommendation.mockReturnValue({ ...result, catalogSource: "demo" })

    const response = await POST(request(true))
    const payload = await response.json() as Record<string, unknown>

    expect(response.status).toBe(200)
    expect(loadDemoCatalog).toHaveBeenCalledTimes(1)
    expect(loadV3Catalog).not.toHaveBeenCalled()
    expect(buildRecommendation).toHaveBeenCalledWith(expect.objectContaining({ catalog: expect.objectContaining({ source: "demo" }) }))
    expect(payload["catalogSource"]).toBe("demo")
  })

  it("does not switch to demo when the production catalog is unavailable", async () => {
    loadV3Catalog.mockResolvedValue({ programs: [], cities: [], source: "unavailable", warnings: ["read failed"] })
    buildRecommendation.mockReturnValue({ ...result, catalogSource: "unavailable" })

    const response = await POST(request())

    expect(response.status).toBe(200)
    expect(loadDemoCatalog).not.toHaveBeenCalled()
    expect(buildRecommendation).toHaveBeenCalledWith(expect.objectContaining({ catalog: expect.objectContaining({ source: "unavailable" }) }))
  })

  it("keeps catalog provenance when an optional AI conclusion is used", async () => {
    vi.stubEnv("CAMPFIT_V3_AI_RESULT_EXPLANATION", "true")
    explainRecommendation.mockResolvedValue("AI가 다듬은 설명입니다.")

    const payload = await (await POST(request())).json() as Record<string, unknown>

    expect(payload["consultingConclusion"]).toBe("AI가 다듬은 설명입니다.")
    expect(payload["catalogSource"]).toBe("static_fallback")
  })

  it("rejects an unlabeled catalog result at the response boundary", async () => {
    const { catalogSource: _catalogSource, ...unlabeled } = result
    buildRecommendation.mockReturnValue(unlabeled)

    const response = await POST(request())
    const payload = await response.json() as Record<string, unknown>

    expect(response.status).toBe(500)
    expect(payload).toEqual({ message: "현재 후보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요." })
  })

  it("rejects an incomplete consultation before loading any catalog data", async () => {
    isReadyForRecommendation.mockReturnValue(false)

    const response = await POST(request())
    const payload = await response.json() as Record<string, unknown>

    expect(response.status).toBe(409)
    expect(payload).toEqual({
      message: "추천 전에 아직 확인할 상담 항목이 있어요. 상담을 이어서 완료해 주세요.",
    })
    expect(loadV3Catalog).not.toHaveBeenCalled()
    expect(buildRecommendation).not.toHaveBeenCalled()
    expect(explainRecommendation).not.toHaveBeenCalled()
  })
})
