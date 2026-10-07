import { describe, expect, it, vi } from "vitest"
vi.mock("server-only", () => ({}))

// Explicit opt-in, read-only catalog audit. Never run database mutations.
describe.skipIf(process.env["CAMPFIT_READ_ONLY_AUDIT"] !== "true")("live public catalog", () => {
  it("loads the three source kinds and records unmatched public city names", async () => {
    process.loadEnvFile(".env.local")
    const { loadV3Catalog } = await import("@/lib/campfit/v3/catalogRepository")
    const catalog = await loadV3Catalog()
    expect(catalog.source).toBe("supabase")
    expect(catalog.programs.every((p) => p.catalogSource === "supabase")).toBe(true)
    const cityKeys = new Set(catalog.cities.map((c) => `${c.name.toLowerCase()}|${c.country.toLowerCase()}`))
    const counts = { package: 0, program: 0, school: 0 }
    const unmatched: string[] = []
    for (const program of catalog.programs) {
      counts[program.directCatalog?.sourceKind ?? "package"]++
      if (!cityKeys.has(`${program.city.toLowerCase()}|${program.country.toLowerCase()}`)) unmatched.push(`${program.name}: ${program.city}, ${program.country}`)
    }
    expect(counts.school).toBeGreaterThan(0)
    expect(counts.program).toBeGreaterThan(0)
    console.log(JSON.stringify({ counts, publicCityCount: catalog.cities.length, unmatched, warnings: catalog.warnings }))
  }, 20000)
})
