import { describe, expect, it } from "vitest"
import dataset from "@/data/campfit/v3/demo-programs.json"

const programs = dataset.programs
const directions = ["school_schooling", "english_intensive", "subject_project", "culture_activity"] as const
const parentCompatible = ["guardian_stays_in_city", "family_accompanied", "day_program", "family_residential"] as const
const seasons = ["summer", "winter", "year_round"] as const
const koreanSupport = ["daily", "emergency_only", "preferred", "none", "unknown"] as const
const specialCare = ["unknown", "basic_support_possible", "not_supported"] as const
const profileLevels = ["low", "medium", "high"] as const
const supportKorean = ["daily", "emergency_only", "limited", "none", "unknown"] as const
const supportEnglish = ["strong", "moderate", "limited", "unknown"] as const
const supportAdaptation = ["strong", "moderate", "limited", "unknown"] as const
const supportCommunication = ["daily", "frequent", "issue_only", "limited", "unknown"] as const
const experienceByDirection: Record<(typeof directions)[number], readonly string[]> = {
  school_schooling: ["school_environment", "classroom_routine", "academic_structure", "regular_school_day_experience"],
  english_intensive: ["activity_based_english", "classroom_english", "conversational_english", "full_english_environment"],
  subject_project: ["coding", "environmental_project", "science_experiment", "maker", "engineering"],
  culture_activity: ["cultural_immersion", "local_life", "nature_activity", "marine_activity", "outdoor_adventure"],
}

function rawScenarioCandidates(input: {
  age: number
  season?: (typeof seasons)[number]
  durationWeeks: number | readonly number[]
  primaryDirection: (typeof directions)[number]
  englishLevels: readonly string[]
}) {
  const durations = Array.isArray(input.durationWeeks) ? input.durationWeeks : [input.durationWeeks]
  return programs.filter((program) => {
    const durationMatches = durations.some((duration) => program.availableDurationsWeeks.includes(duration))
    const seasonMatches = input.season === undefined || program.availableSeasons.includes(input.season)
    const englishMatches = program.englishLevels.some((level) => input.englishLevels.includes(level))
    return (
      program.ageMin <= input.age &&
      program.ageMax >= input.age &&
      seasonMatches &&
      durationMatches &&
      program.primaryDirection === input.primaryDirection &&
      parentCompatible.includes(program.parentParticipation as (typeof parentCompatible)[number]) &&
      englishMatches
    )
  })
}

describe("CampFit v3 synthetic demo catalog", () => {
  it("contains exactly 18 programs and six cities with three each", () => {
    expect(programs).toHaveLength(18)
    expect(new Set(programs.map((program) => program.cityName))).toEqual(
      new Set(["Chiang Mai", "Bali", "Cebu", "Singapore", "Auckland", "Gold Coast"]),
    )
    for (const city of new Set(programs.map((program) => program.cityName))) {
      expect(programs.filter((program) => program.cityName === city)).toHaveLength(3)
    }
  })

  it("keeps all records visibly synthetic and non-bookable", () => {
    expect(dataset.purpose).toBe("recommendation_demo_only")
    expect(dataset.disclaimer).toContain("시연용 참고 가격")
    for (const program of programs) {
      expect(program.dataSource).toBe("synthetic_demo")
      expect(program.isSynthetic).toBe(true)
      expect(program.isBookable).toBe(false)
      expect(program.verificationStatus).toBe("synthetic_demo")
      expect(program.detailUrl).toBeNull()
      expect(program.imageUrl).toBeNull()
      expect(program.name).toContain("시연용")
    }
  })

  it("covers every primary direction at least four times", () => {
    for (const direction of directions) {
      expect(programs.filter((program) => program.primaryDirection === direction).length).toBeGreaterThanOrEqual(4)
    }
    for (const program of programs) {
      expect(directions).toContain(program.primaryDirection)
      expect(program.secondaryDirections).not.toContain(program.primaryDirection)
      expect(program.secondaryDirections.length).toBeLessThanOrEqual(2)
    }
  })

  it("has valid ranges, enums, ids, durations, prices and varied filter data", () => {
    expect(new Set(programs.map((program) => program.id)).size).toBe(programs.length)
    expect(new Set(programs.map((program) => program.name)).size).toBe(programs.length)
    for (const program of programs) {
      expect(program.ageMin).toBeLessThanOrEqual(program.ageMax)
      expect(program.priceMinKrw).toBeLessThanOrEqual(program.priceMaxKrw)
      expect(program.availableDurationsWeeks.length).toBeGreaterThan(0)
      expect(program.availableSeasons.every((season) => seasons.includes(season as (typeof seasons)[number]))).toBe(true)
      expect(koreanSupport).toContain(program.koreanSupport)
      expect(specialCare).toContain(program.specialCareCapability)
      expect(program.verificationChecklist.length).toBeGreaterThanOrEqual(2)
      expect(program.verificationChecklist.length).toBeLessThanOrEqual(4)
      expect(program.shortDescription).toContain("시연용")
    }
    expect(programs.filter((program) => program.parentParticipation.startsWith("child_only")).length).toBeGreaterThanOrEqual(2)
    expect(programs.filter((program) => program.availableSeasons.length === 1 && program.availableSeasons[0] === "winter").length).toBeGreaterThanOrEqual(2)
    expect(programs.filter((program) => program.availableDurationsWeeks.length === 1 && program.availableDurationsWeeks[0] === 4).length).toBeGreaterThanOrEqual(1)
    expect(programs.some((program) => program.koreanSupport === "unknown" || program.koreanSupport === "none")).toBe(true)
    expect(programs.some((program) => program.priceMinKrw >= 6000000)).toBe(true)
  })

  it("contains differentiated child, parent and support metadata", () => {
    const profileSignatures = new Set<string>()
    for (const program of programs) {
      expect(program.childExperienceSignals.length).toBeGreaterThanOrEqual(4)
      expect(program.childExperienceSignals.length).toBeLessThanOrEqual(9)
      expect(program.parentCompatibilitySignals.length).toBeGreaterThanOrEqual(2)
      expect(program.parentCompatibilitySignals.length).toBeLessThanOrEqual(6)
      expect(program.idealFor.length).toBeGreaterThanOrEqual(2)
      expect(program.notIdealFor.length).toBeGreaterThanOrEqual(2)
      expect(program.whyItFits.length).toBeGreaterThanOrEqual(2)
      expect(program.priceBasis).toBe("child_program_only")
      expect(program.priceConfidence).toBe("synthetic_demo")
      expect(program.priceNotes).toContain("시연용 참고 가격")

      const fit = program.childFitProfile
      for (const key of ["noveltyLevel", "structureLevel", "socialIntensity", "physicalActivityLevel", "academicIntensity", "englishImmersionLevel", "separationDemand", "sensoryLoad"] as const) {
        expect(profileLevels).toContain(fit[key])
      }
      profileSignatures.add(Object.values(fit).join("/"))

      const support = program.supportProfile
      expect(supportKorean).toContain(support.koreanSupport)
      expect(supportEnglish).toContain(support.beginnerEnglishSupport)
      expect(supportAdaptation).toContain(support.initialAdaptationSupport)
      expect(supportCommunication).toContain(support.parentCommunication)
      expect(specialCare.filter((value) => value === support.specialCareCapability)).toHaveLength(1)
      expect(experienceByDirection[program.primaryDirection as (typeof directions)[number]].some((signal) => program.childExperienceSignals.includes(signal))).toBe(true)
      expect(program.childExperienceSignals.some((signal) => signal.includes("health") || signal.includes("allerg") || signal.includes("medication"))).toBe(false)
    }
    expect(profileSignatures.size).toBeGreaterThanOrEqual(6)
  })

  it("supports at least two raw candidates for each representative scenario", () => {
    const scenarioA = rawScenarioCandidates({ age: 8, season: "summer", durationWeeks: 2, primaryDirection: "culture_activity", englishLevels: ["beginner"] })
    const scenarioB = rawScenarioCandidates({ age: 10, durationWeeks: 3, primaryDirection: "school_schooling", englishLevels: ["intermediate"] })
    const scenarioC = rawScenarioCandidates({ age: 9, season: "summer", durationWeeks: [3, 4], primaryDirection: "subject_project", englishLevels: ["beginner", "basic", "intermediate"] })

    expect(scenarioA.length).toBeGreaterThanOrEqual(2)
    expect(scenarioB.length).toBeGreaterThanOrEqual(2)
    expect(scenarioC.length).toBeGreaterThanOrEqual(2)
    expect(scenarioA.map((program) => program.name)).toEqual(expect.arrayContaining(["치앙마이 자연·문화 영어활동 시연용", "발리 자연문화 가족활동 시연용"]))
    expect(scenarioB.map((program) => program.name)).toEqual(expect.arrayContaining(["치앙마이 국제학교 생활 체험 시연용", "오클랜드 국제학교 탐구생활 시연용"]))
    expect(scenarioC.map((program) => program.name)).toEqual(expect.arrayContaining(["발리 창의 해양 STEM 프로젝트 시연용", "싱가포르 주니어 STEM 랩 시연용"]))
  })

  it("contains deliberate exclusion evidence without calling product code", () => {
    const ageExcludedForEight = programs.filter((program) => program.ageMin > 8 || program.ageMax < 8)
    const winterOnly = programs.filter((program) => program.availableSeasons.length === 1 && program.availableSeasons[0] === "winter")
    const durationFourOnly = programs.filter((program) => program.availableDurationsWeeks.length === 1 && program.availableDurationsWeeks[0] === 4)
    const parentMismatch = programs.filter((program) => program.parentParticipation.startsWith("child_only"))
    const cultureDirectionMismatch = programs.filter((program) => program.primaryDirection !== "culture_activity")
    const overSevenMillion = programs.filter((program) => program.priceMinKrw > 7000000)

    expect(ageExcludedForEight.length).toBeGreaterThanOrEqual(1)
    expect(winterOnly.length).toBeGreaterThanOrEqual(2)
    expect(durationFourOnly.length).toBeGreaterThanOrEqual(1)
    expect(parentMismatch.length).toBeGreaterThanOrEqual(2)
    expect(cultureDirectionMismatch.length).toBeGreaterThanOrEqual(1)
    expect(overSevenMillion.length).toBeGreaterThanOrEqual(1)
  })
})
