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
  catalogSource: "supabase" as const,
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
    loadV3Catalog.mockResolvedValue({ programs: [], cities: [], source: "supabase", warnings: [] })
    loadDemoCatalog.mockReturnValue({ programs: [], cities: [], source: "demo", warnings: [] })
    buildRecommendation.mockReturnValue(result)
    explainRecommendation.mockResolvedValue(null)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.clearAllMocks()
  })

  it("uses the real Supabase catalog and preserves its source", async () => {
    vi.stubEnv("CAMPFIT_V3_AI_RESULT_EXPLANATION", "false")

    const response = await POST(request())
    const payload = await response.json() as Record<string, unknown>

    expect(response.status).toBe(200)
    expect(payload["catalogSource"]).toBe("supabase")
  })

  it("uses the Demo Catalog only when explicitly requested", async () => {
    buildRecommendation.mockReturnValue({ ...result, catalogSource: "demo" })

    const response = await POST(request(true))
    const payload = await response.json() as Record<string, unknown>

    expect(response.status).toBe(200)
    expect(loadDemoCatalog).toHaveBeenCalledTimes(1)
    expect(loadV3Catalog).not.toHaveBeenCalled()
    expect(buildRecommendation).toHaveBeenCalledWith(expect.objectContaining({ catalog: expect.objectContaining({ source: "demo" }) }))
    expect(payload["catalogSource"]).toBe("demo")
  })

  it("returns an explicit service error when the production catalog is unavailable", async () => {
    loadV3Catalog.mockResolvedValue({ programs: [], cities: [], source: "unavailable", warnings: ["read failed"] })

    const response = await POST(request())
    const payload = await response.json() as Record<string, unknown>

    expect(response.status).toBe(503)
    expect(payload).toEqual({ ok: false, error: { code: "CATALOG_UNAVAILABLE", message: "추천 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요." } })
    expect(buildRecommendation).not.toHaveBeenCalled()
  })

  it("keeps catalog provenance when an optional AI conclusion is used", async () => {
    vi.stubEnv("CAMPFIT_V3_AI_RESULT_EXPLANATION", "true")
    explainRecommendation.mockResolvedValue("AI가 다듬은 설명입니다.")

    const payload = await (await POST(request())).json() as Record<string, unknown>

    expect(payload["consultingConclusion"]).toBe("AI가 다듬은 설명입니다.")
    expect(payload["catalogSource"]).toBe("supabase")
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

  it("preserves durationWeeks of 4 all the way through the endpoint request", async () => {
    vi.stubEnv("CAMPFIT_V3_AI_RESULT_EXPLANATION", "false")
    isReadyForRecommendation.mockReturnValue(true)

    loadV3Catalog.mockResolvedValue({
      programs: [
        {
          id: "prog-4w",
          name: "4 Weeks Camp",
          city: "Cebu",
          country: "Philippines",
          programType: "schooling",
          directionSignals: { schoolSchooling: 90, englishIntensive: 50, subjectProject: 50, cultureActivity: 50 },
          ageMin: 5,
          ageMax: 12,
          ageSource: "program",
          durationWeeks: [4],
          durationSource: "session_or_price",
          parentAccompanied: true,
          parentScope: { participationMode: "parent_recommended", stayMode: "day", guardianNearbyCompatible: true },
          koreanManager: true,
          koreanDailySupport: true,
          koreanEmergencySupport: true,
          emergencySupport: true,
          beginnerClass: true,
          earlyAdaptationSupport: true,
          dailyParentReport: true,
          traits: [],
          specialCareSupport: "unknown",
          budgetMinKrw: 3_000_000,
          budgetMaxKrw: 6_000_000,
          priceOptions: [
            { adultCount: 1, childCount: 1, durationWeeks: 4, currency: "KRW", priceValue: 4000000, status: "active" }
          ],
          sessionWindows: [
            { startDate: "2026-07-01", endDate: "2026-08-31", weeks: 4, status: "scheduled", source: "program_sessions", precision: "exact" }
          ],
          hasSessionRows: true,
          hasScheduledSessionRows: true,
          sessionStatusNeedsConfirmation: false,
          imageUrl: null,
          status: "active",
          catalogSource: "supabase",
          updatedAt: null,
        }
      ],
      cities: [
        {
          id: "philippines-cebu",
          slug: "cebu",
          name: "Cebu",
          country: "Philippines",
          regionGroup: "southeast_asia",
          imageUrl: null,
          description: "세부",
          parentStayEvidence: null,
          flightCostKrw: 500000,
          livingCostMonthlyKrw: 1000000,
          housingCostMonthlyKrw: 800000,
          catalogSource: "supabase",
        }
      ],
      source: "supabase",
      warnings: []
    })

    const { buildRecommendation: actualBuildRecommendation } = await vi.importActual<typeof import("@/lib/campfit/v3/recommendationEngine")>("@/lib/campfit/v3/recommendationEngine")
    buildRecommendation.mockImplementation(actualBuildRecommendation)

    const request4w = new Request("http://localhost/api/campfit/v3/recommend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        transcript: [],
        finalState: {
          facts: {
            childEnglishLevel: { key: "childEnglishLevel", subject: "child", value: "intermediate", source: "explicit_user_statement", confidence: 1, status: "confirmed", evidence: "영어 가능", updatedAt: "2026-07-13T00:00:00.000Z" },
            parentStayGoals: { key: "parentStayGoals", subject: "parent", value: ["remoteWork"], source: "explicit_user_statement", confidence: 1, status: "confirmed", evidence: "원격", updatedAt: "2026-07-13T00:00:00.000Z" },
          },
          askedQuestionKeys: [],
          completedQuestionKeys: [],
          failedQuestionKeys: [],
          currentQuestionKey: null,
          questionCount: 0,
          progress: 100,
          unresolved: [],
          conflicts: [],
        },
        basicInfo: {
          childAges: [8],
          departureWindow: "2026년 7월",
          durationWeeks: 4,
          budgetMinKrw: 5_000_000,
          budgetMaxKrw: 12_000_000,
          adultCount: 1,
          childCount: 1,
          guardianStaysNearby: true,
        },
      }),
    })

    const response = await POST(request4w)
    const payload = await response.json() as any
    expect(response.status).toBe(200)
    expect(payload.programCandidates).toHaveLength(1)
    expect(payload.programCandidates[0].programId).toBe("prog-4w")
    expect(payload.programCandidates[0].durationLabel).toContain("4주")
  })
})
