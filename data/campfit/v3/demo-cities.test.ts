import { describe, expect, it } from "vitest"
import citiesDataset from "@/data/campfit/v3/demo-cities.json"
import programsDataset from "@/data/campfit/v3/demo-programs.json"

const cities = citiesDataset.cities
const cityNames = ["Chiang Mai", "Bali", "Cebu", "Singapore", "Auckland", "Gold Coast"] as const
const levels = ["low", "medium", "high"] as const
const directions = ["schoolSchooling", "englishIntensive", "subjectProject", "cultureActivity"] as const

function expectCompleteLevelRecord(record: object, ignoredKeys: readonly string[] = []) {
  for (const [key, value] of Object.entries(record)) {
    if (ignoredKeys.includes(key)) continue
    expect(typeof value).toBe("string")
    expect(levels).toContain(value)
  }
}

describe("CampFit v3 synthetic demo city catalog", () => {
  it("contains six unique synthetic city profiles", () => {
    expect(cities).toHaveLength(6)
    expect(new Set(cities.map((city) => city.id)).size).toBe(6)
    expect(new Set(cities.map((city) => city.cityName)).size).toBe(6)
    expect(new Set(cities.map((city) => city.cityName))).toEqual(new Set(cityNames))
    expect(citiesDataset.purpose).toBe("city_recommendation_demo_only")
    expect(citiesDataset.disclaimer).toContain("시연용")
    for (const city of cities) {
      expect(city.dataSource).toBe("synthetic_demo_profile")
      expect(city.isSyntheticProfile).toBe(true)
      expect(city.cityArchetype.length).toBeGreaterThanOrEqual(2)
      expect(city.cityArchetype.length).toBeLessThanOrEqual(4)
    }
  })

  it("keeps all city profile sections complete and differentiated", () => {
    const strengthSignatures = new Set<string>()
    const staySignatures = new Set<string>()
    const carRecommendations = new Set<boolean>()
    for (const city of cities) {
      expectCompleteLevelRecord(city.experienceStrengths)
      expectCompleteLevelRecord(city.parentStayProfile)
      expectCompleteLevelRecord(city.childStayProfile)
      expectCompleteLevelRecord(city.mobilityProfile, ["carRecommended"])
      expectCompleteLevelRecord(city.costProfile, ["sourcePolicy"])
      expectCompleteLevelRecord(city.environmentProfile)
      expectCompleteLevelRecord(city.supportEnvironment)
      expect(city.costProfile.sourcePolicy).toBe("use_existing_cities_cost_fields")
      expect(city.citySignals.length).toBeGreaterThanOrEqual(8)
      expect(city.citySignals.length).toBeLessThanOrEqual(16)
      expect(city.idealFor.length).toBeGreaterThanOrEqual(3)
      expect(city.notIdealFor.length).toBeGreaterThanOrEqual(2)
      expect(city.verificationChecklist.length).toBeGreaterThanOrEqual(3)
      strengthSignatures.add(Object.values(city.experienceStrengths).join("/"))
      staySignatures.add(Object.values(city.parentStayProfile).join("/"))
      carRecommendations.add(city.mobilityProfile.carRecommended)
    }
    expect(strengthSignatures.size).toBeGreaterThanOrEqual(4)
    expect(staySignatures.size).toBeGreaterThanOrEqual(4)
    expect(carRecommendations).toEqual(new Set([true, false]))
  })

  it("has direction strengths compatible with its three demo programs", () => {
    const directionToField: Record<(typeof directions)[number], keyof typeof cities[number]["experienceStrengths"]> = {
      schoolSchooling: "schoolSchooling",
      englishIntensive: "englishIntensive",
      subjectProject: "subjectProject",
      cultureActivity: "cultureActivity",
    }
    for (const city of cities) {
      const linked = programsDataset.programs.filter((program) => program.cityName === city.cityName)
      expect(linked).toHaveLength(3)
      for (const program of linked) {
        const key = Object.entries({
          school_schooling: "schoolSchooling",
          english_intensive: "englishIntensive",
          subject_project: "subjectProject",
          culture_activity: "cultureActivity",
        }).find(([source]) => source === program.primaryDirection)?.[1] as (typeof directions)[number]
        const field = directionToField[key]
        expect(["medium", "high"]).toContain(city.experienceStrengths[field])
      }
    }
  })

  it("contains no URLs, contacts, bookings or sensitive health details", () => {
    for (const city of cities) {
      const serialized = JSON.stringify(city)
      expect(serialized).not.toMatch(/https?:\/\//i)
      expect(serialized).not.toMatch(/@[A-Z0-9._%+-]+\.[A-Z]{2,}/i)
      expect(serialized).not.toMatch(/예약|booking|bookable/i)
      expect(serialized).not.toMatch(/알레르기|질환명|복용약|진단명|medication|allergy/i)
    }
  })
})
