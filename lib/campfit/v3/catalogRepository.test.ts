import { beforeEach, describe, expect, it, vi } from "vitest"
import { loadDemoCatalog } from "@/lib/campfit/v3/demoCatalog"

const createServerSupabaseClient = vi.hoisted(() => vi.fn())

vi.mock("server-only", () => ({}))
vi.mock("@/lib/campfit/supabaseServer", () => ({ createServerSupabaseClient }))

import { loadV3Catalog, mergeCatalogPrograms } from "@/lib/campfit/v3/catalogRepository"

describe("CampFit v3 catalog composition", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("combines production and demo programs while preserving demo mapping fields", async () => {
    createServerSupabaseClient.mockReturnValue(mockClient({ demoRows: [demoRow()] }))

    const catalog = await loadV3Catalog()
    const production = catalog.programs.find((program) => program.catalogSource === "supabase")
    const demo = catalog.programs.find((program) => program.catalogSource === "demo")

    expect(catalog.source).toBe("supabase")
    expect(catalog.programs).toHaveLength(2)
    expect(production?.id).toBe("production-1")
    expect(demo?.city).toBe("London")
    expect(demo?.country).toBe("UK")
    expect(demo?.durationWeeks).toEqual([2, 3, 4, 6])
    expect(demo?.priceOptions).toEqual([])
    expect(demo?.budgetMinKrw).toBe(3_900_000)
    expect(demo?.sessionWindows).toEqual([])
    expect(demo?.demoProfile?.availableSeasons).toEqual(["summer", "year_round"])
    expect(demo?.englishRequirement?.level).toBe("beginner_friendly")
    expect(demo?.parentScope.stayMode).toBe("family_stay")
  })

  it("keeps production programs when the optional demo query fails", async () => {
    createServerSupabaseClient.mockReturnValue(mockClient({ demoError: "demo table unavailable" }))

    const catalog = await loadV3Catalog()

    expect(catalog.source).toBe("supabase")
    expect(catalog.programs.map((program) => program.id)).toEqual(["production-1"])
    expect(catalog.warnings.some((warning) => warning.includes("campfit_demo_programs"))).toBe(true)
  })

  it("keeps distinct programs and returns 15 production plus 148 demo entries", () => {
    const demoPrograms = loadDemoCatalog(2026).programs
    const productionPrograms = demoPrograms.slice(0, 15).map((program, index) => ({
      ...program,
      id: `production-${index + 1}`,
      slug: `production-${index + 1}`,
      catalogSource: "supabase" as const,
    }))

    const merged = mergeCatalogPrograms(productionPrograms, demoPrograms)

    expect(demoPrograms).toHaveLength(148)
    expect(merged.programs).toHaveLength(163)
    expect(merged.duplicateCount).toBe(0)
  })

  it("gives production priority for ID or normalized slug collisions", () => {
    const production = { ...loadDemoCatalog(2026).programs[0]!, catalogSource: "supabase" as const, name: "Production record" }
    const demo = { ...production, catalogSource: "demo" as const, name: "Demo record", id: production.id.toUpperCase(), slug: `/${production.slug!.toUpperCase()}/` }

    const merged = mergeCatalogPrograms([production], [demo])

    expect(merged.programs).toHaveLength(1)
    expect(merged.programs[0]?.name).toBe("Production record")
    expect(merged.duplicateCount).toBe(1)
  })
})

function mockClient(input: { readonly demoRows?: readonly Record<string, unknown>[]; readonly demoError?: string }) {
  const tables: Record<string, readonly Record<string, unknown>[]> = {
    programs: [productionRow()],
    program_price_options: [],
    campfit_program_profiles: [{ program_id: "production-1", active: true, parent_accompanied: true }],
    Cities: [
      { id: "london-uk", "City name": "London", Country: "UK", is_listed: true },
      { id: "london-canada", "City name": "London", Country: "Canada", is_listed: true },
    ],
    program_sessions: [],
    program_provider_claims: [],
    program_evidence_sources: [],
    program_fact_observations: [],
    campfit_demo_programs: input.demoRows ?? [],
  }
  return {
    from: (table: string) => ({
      select: async () => table === "campfit_demo_programs" && input.demoError
        ? { data: null, error: { message: input.demoError } }
        : { data: tables[table] ?? [], error: null },
    }),
  }
}

function productionRow(): Record<string, unknown> {
  return {
    id: "production-1",
    slug: "production-1",
    name: "Production program",
    location_city: "London",
    location_country: "UK",
    status: "active",
    visible: true,
    is_listed: true,
    age_min: 6,
    age_max: 12,
  }
}

function demoRow(): Record<string, unknown> {
  return {
    id: "demo-london-uk",
    slug: "demo-london-uk",
    name: "London demo program",
    location_city: "London",
    location_country: "UK",
    status: "active",
    visible: true,
    is_listed: true,
    age_min: 6,
    age_max: 12,
    minimum_price_currency: "KRW",
    minimum_price_value: 3_900_000,
    detail_payload: {
      durations: [2, 3, 4, 6],
      seasons: ["summer", "year_round"],
      parentMode: "family",
      accommodations: ["Studio"],
      category: "english",
      priceQuality: "reference",
      demoEnglishRequirementLevel: "beginner_friendly",
      demoEnglishRequirementConfidence: 0.9,
      demoEnglishRequirementVersion: "test",
      demoEnglishRequirementSource: "demo_fixture",
      packageInclusions: { accommodationIncluded: true, mealPlan: "none" },
    },
  }
}
