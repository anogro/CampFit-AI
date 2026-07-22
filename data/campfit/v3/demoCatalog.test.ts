import { describe, expect, it } from "vitest"
import { demoCityDefinitions, demoProgramDefinitions } from "@/data/campfit/v3/demoCatalog"
import { loadDemoCatalog } from "@/lib/campfit/v3/demoCatalog"

describe("CampFit v3 Demo Catalog", () => {
  it("contains the production city profile set and four varied demo programs per city", () => {
    expect(demoCityDefinitions).toHaveLength(37)
    expect(demoProgramDefinitions).toHaveLength(148)
    expect(new Set(demoCityDefinitions.map((city) => city.profile.costLevel)).size).toBeGreaterThan(1)
    expect(new Set(demoCityDefinitions.map((city) => city.profile.medicalLevel)).size).toBeGreaterThan(1)
    expect(new Set(demoCityDefinitions.map((city) => city.profile.stemStrength)).size).toBeGreaterThan(1)
    expect(new Set(demoCityDefinitions.map((city) => city.profile.natureStrength)).size).toBeGreaterThan(1)
    expect(new Set(demoProgramDefinitions.map((program) => program.city)).size).toBe(37)
    expect(demoCityDefinitions.every((city) => demoProgramDefinitions.filter((program) => program.city === city.name).length >= 4)).toBe(true)
  })

  it("mixes duration, family, accommodation, and price-quality variants", () => {
    const durationSets = demoProgramDefinitions.map((program) => program.durations)
    expect(durationSets.filter((durations) => durations.includes(2) && durations.includes(3) && durations.includes(4)).length).toBeGreaterThanOrEqual(24)
    expect(durationSets.some((durations) => durations.includes(1))).toBe(true)
    expect(durationSets.some((durations) => durations.includes(6) || durations.includes(8))).toBe(true)
    expect(new Set(demoProgramDefinitions.map((program) => program.parentMode))).toEqual(new Set(["family", "day", "child_only"]))
    expect(new Set(demoProgramDefinitions.flatMap((program) => program.accommodations))).toEqual(new Set(["Studio", "1BR", "2BR", "Residence", "Hotel", "Homestay", "숙소미포함"]))
    expect(new Set(demoProgramDefinitions.map((program) => program.priceQuality))).toEqual(new Set(["exact", "official_surcharge", "reference", "inquiry"]))
  })

  it("maps the catalog into 148 scheduled products with family price variants", () => {
    const catalog = loadDemoCatalog(2026)
    expect(catalog.source).toBe("demo")
    expect(catalog.cities).toHaveLength(37)
    expect(catalog.programs).toHaveLength(148)
    expect(catalog.programs.every((program) => program.sessionWindows.length > 0)).toBe(true)
    expect(catalog.cities.every((city) => city.imageUrl !== null)).toBe(true)
    expect(catalog.programs.every((program) => program.priceOptions.some((option) => option.adultCount === 1 && option.childCount === 1 && option.durationWeeks === 4))).toBe(true)
    expect(catalog.programs.some((program) => program.priceOptions.some((option) => option.accommodationType === "Studio"))).toBe(true)
    const familyPriceVariants = catalog.programs[0]?.priceOptions.filter((option) => option.adultCount === 1 && option.childCount === 1 && option.durationWeeks === 4 && option.priceValue !== null)
    expect(new Set(familyPriceVariants?.map((option) => option.priceValue)).size).toBeGreaterThan(1)
  })
})
