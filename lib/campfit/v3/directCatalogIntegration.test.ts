import { describe, expect, it } from "vitest"
import { mapDirectActivityCatalog, mapDirectSchoolCatalog } from "@/lib/campfit/v3/directCatalogAdapter"
import { buildRecommendation } from "@/lib/campfit/v3/recommendationEngine"
import { calculateProgramCost } from "@/lib/campfit/v3/cost/calculateProgramCost"
import type { V3Catalog, V3CatalogCity, V3CatalogProgram } from "@/lib/campfit/v3/catalogRepository"
import { createFact, createInitialConversationState, mergeFacts } from "@/lib/campfit/v3/stateEngine"
import type { CampfitV3BasicInfo, CampfitV3ConversationState, ExperienceDirectionKey } from "@/types/campfitV3"

const now = new Date("2026-10-07T00:00:00.000Z")
const today = "2026-10-07"
const basicInfo: CampfitV3BasicInfo = {
  childAges: [8], departureWindow: "2027-02-01 ~ 2027-02-28", durationWeeks: 3,
  budgetMinKrw: 5_000_000, budgetMaxKrw: 12_000_000, adultCount: 1, childCount: 1,
  guardianStaysNearby: true,
}
const auckland: V3CatalogCity = {
  id: "nz-auckland", slug: "auckland", name: "Auckland", country: "New Zealand",
  regionGroup: "oceania", imageUrl: null, description: null, parentStayEvidence: null,
  flightCostKrw: null, livingCostMonthlyKrw: null, housingCostMonthlyKrw: null, catalogSource: "supabase",
}

describe("direct catalog to recommendation and cost integration", () => {
  it("carries the school source identity and detail URL through recommendation, while a 3-week request remains eligible with the 5-week payable warning", () => {
    const [schoolProgram] = schoolCatalog({ min_weeks: 2, max_weeks: 4, minimum_payable_weeks: 5 })
    expect(schoolProgram).toBeDefined()
    const result = recommend([schoolProgram!], basicInfo, "schoolSchooling")
    const candidate = result.programCandidates.find((item) => item.sourceId === "school-raw-id")
    expect(candidate).toMatchObject({
      sourceKind: "school", sourceId: "school-raw-id", sourceOfferingId: "offering-raw-id",
    })
    expect(candidate?.detailUrl).toMatch(/\/schools\/auckland-school$/)
    expect(candidate?.verify.join(" ")).toContain("참여 3주와 별개로 최소 5주 결제 조건")
  })

  it("hard-excludes a school offering when the requested attendance is below its two-week minimum", () => {
    const [schoolProgram] = schoolCatalog({ min_weeks: 2, max_weeks: 4, minimum_payable_weeks: 5 })
    const result = recommend([schoolProgram!], { ...basicInfo, durationWeeks: 1 }, "schoolSchooling")
    expect(result.programCandidates.some((item) => item.sourceId === "school-raw-id")).toBe(false)
  })

  it("retains a fixed-period fee in its source currency without converting it to a zero/free KRW estimate", () => {
    const [schoolProgram] = schoolCatalog({
      fee_options: [{ amount: 4200, currency: "NZD", unit: "fixed_period", periodWeeks: 3, priceYear: 2027, appliesTo: "Year 4", notes: "tuition only" }],
    })
    const cost = calculateProgramCost({
      basicInfo, program: schoolProgram!, selectedAccommodationVariant: null,
    })
    expect(cost.status).toBe("inquiry")
    expect(cost.low).toBeNull()
    expect(cost.high).toBeNull()
    expect(cost.sourceAmounts).toMatchObject([{
      currency: "NZD", low: 4200, high: 4200, lowKrw: null, highKrw: null,
    }])
  })

  it("excludes a closed future activity session from the February 2027 recommendation", () => {
    const [activity] = mapDirectActivityCatalog([{
      id: "closed-camp-id", official_name: "February Activity Camp", city: "Auckland", country_code: "NZ",
      is_published: true, review_status: "verified", visitor_eligibility: "yes", direct_registration_status: "yes",
    }], [{
      id: "closed-offering-id", camp_id: "closed-camp-id", schedule_status: "announced",
      date_scope: "session", start_date: "2027-02-01", end_date: "2027-02-21",
      registration_status: "closed",
    }], today)
    expect(activity).toBeDefined()
    const result = recommend([activity!], basicInfo, "cultureActivity")
    expect(result.programCandidates.some((item) => item.sourceId === "closed-camp-id")).toBe(false)
  })
})

function schoolCatalog(facts: Record<string, unknown> = {}): readonly V3CatalogProgram[] {
  return mapDirectSchoolCatalog([{
    id: "school-raw-id", slug: "auckland-school", name: "Auckland School", city: "Auckland",
    country: "NZ", status: "published", short_term_confirmed: true,
    direct_registration_confirmed: true, verified_at: "2026-09-01",
  }], [{
    id: "offering-raw-id", school_id: "school-raw-id", name: "Short-term schooling",
    offering_type: "schooling", status: "published", ...facts,
  }], [], today)
}

function recommend(programs: readonly V3CatalogProgram[], info: CampfitV3BasicInfo, primary: ExperienceDirectionKey) {
  const catalog: V3Catalog = { programs, cities: [auckland], source: "supabase", warnings: [] }
  return buildRecommendation({ basicInfo: info, state: stateFor(primary), catalog, now })
}

function stateFor(primary: ExperienceDirectionKey): CampfitV3ConversationState {
  const goals = {
    schoolSchooling: primary === "schoolSchooling" ? "primary" : "none",
    englishIntensive: primary === "englishIntensive" ? "primary" : "none",
    subjectProject: primary === "subjectProject" ? "primary" : "none",
    cultureActivity: primary === "cultureActivity" ? "primary" : "none",
  }
  const values: Record<string, unknown> = {
    childEnglishLevel: "basic", experienceGoals: goals, preferredRegions: [],
    regionImportance: "no_preference", koreanSupportNeed: "emergency_only",
    parentCommunicationNeed: "issue_only", parentStayGoals: ["childScheduleFirst"],
    specialCareFollowUp: "none",
  }
  return mergeFacts(createInitialConversationState(), Object.entries(values).map(([key, value]) => createFact({
    key: key as keyof CampfitV3ConversationState["facts"], subject: "preference", value,
    source: "quick_reply", evidence: "direct catalog integration test",
  })))
}
