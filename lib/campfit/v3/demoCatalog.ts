import demoCitiesJson from "@/data/campfit/v3/demo-cities.json"
import demoProgramsJson from "@/data/campfit/v3/demo-programs.json"
import { inferCityRegionGroup } from "@/lib/campfit/v2/cityProfileAdapter"
import type {
  V3Catalog,
  V3CatalogCity,
  V3CatalogProgram,
  V3DemoCityProfile,
  V3DemoLevel,
  V3DemoProgramProfile,
  V3PriceOption,
} from "@/lib/campfit/v3/catalogRepository"
import type { V3DirectionSignals, V3ParentScope, V3SessionWindow } from "@/lib/campfit/v3/catalogPolicy"
import type { ExperienceDirectionKey } from "@/types/campfitV3"

type DemoProgramRaw = {
  readonly id: string
  readonly name: string
  readonly cityName: string
  readonly ageMin: number
  readonly ageMax: number
  readonly availableSeasons: readonly string[]
  readonly availableDurationsWeeks: readonly number[]
  readonly parentParticipation: string
  readonly accommodationMode: string
  readonly primaryDirection: string
  readonly secondaryDirections: readonly string[]
  readonly englishLevels: readonly string[]
  readonly koreanSupport: string
  readonly parentCommunication: string
  readonly specialCareCapability: string
  readonly priceMinKrw: number
  readonly priceMaxKrw: number
  readonly shortDescription: string
  readonly childExperienceSignals: readonly string[]
  readonly childFitProfile: Readonly<Record<string, V3DemoLevel>>
  readonly parentCompatibilitySignals: readonly string[]
  readonly supportProfile: Readonly<Record<string, string>>
  readonly idealFor: readonly string[]
  readonly notIdealFor: readonly string[]
  readonly whyItFits: readonly string[]
  readonly priceConfidence: string
  readonly priceNotes: string
  readonly verificationChecklist: readonly string[]
  readonly imageUrl: string | null
  readonly detailUrl: string | null
  readonly displayBadge: string
}

type DemoCityRaw = {
  readonly id: string
  readonly cityName: string
  readonly shortSummary: string
  readonly cityArchetype: readonly string[]
  readonly experienceStrengths: Readonly<Record<string, V3DemoLevel>>
  readonly parentStayProfile: Readonly<Record<string, V3DemoLevel>>
  readonly childStayProfile: Readonly<Record<string, V3DemoLevel>>
  readonly mobilityProfile: Readonly<Record<string, string | boolean>>
  readonly costProfile: Readonly<Record<string, string>>
  readonly environmentProfile: Readonly<Record<string, V3DemoLevel>>
  readonly supportEnvironment: Readonly<Record<string, V3DemoLevel>>
  readonly citySignals: readonly string[]
  readonly idealFor: readonly string[]
  readonly notIdealFor: readonly string[]
  readonly verificationChecklist: readonly string[]
  readonly displayBadge: string
}

const countryByCity: Readonly<Record<string, string>> = {
  "Chiang Mai": "Thailand",
  Bali: "Indonesia",
  Cebu: "Philippines",
  Singapore: "Singapore",
  Auckland: "New Zealand",
  "Gold Coast": "Australia",
}

const directionByDemoKey: Readonly<Record<string, ExperienceDirectionKey>> = {
  school_schooling: "schoolSchooling",
  english_intensive: "englishIntensive",
  subject_project: "subjectProject",
  culture_activity: "cultureActivity",
}

export function loadDemoCatalog(referenceYear = new Date().getUTCFullYear()): V3Catalog {
  const cities = (demoCitiesJson.cities as readonly DemoCityRaw[]).map((city) => mapDemoCity(city))
  const programs = (demoProgramsJson.programs as readonly DemoProgramRaw[]).map((program) => mapDemoProgram(program, referenceYear))
  return {
    programs,
    cities,
    source: "demo",
    warnings: ["시연용 가상 카탈로그입니다. 실제 운영·예약·가격 정보로 확정하지 마세요."],
  }
}

function mapDemoProgram(raw: DemoProgramRaw, referenceYear: number): V3CatalogProgram {
  const country = countryByCity[raw.cityName] ?? ""
  const primary = directionByDemoKey[raw.primaryDirection] ?? "cultureActivity"
  const secondary = raw.secondaryDirections.flatMap((key) => directionByDemoKey[key] ? [directionByDemoKey[key]!] : [])
  const directionSignals = demoDirectionSignals(primary, secondary)
  const parentScope = demoParentScope(raw.parentParticipation, raw.accommodationMode)
  const support = raw.supportProfile
  const specialCare = raw.specialCareCapability === "not_supported"
    ? "unsupported"
    : raw.specialCareCapability === "basic_support_possible"
      ? "supported"
      : "unknown"
  const profile: V3DemoProgramProfile = {
    dataSource: "synthetic_demo",
    isBookable: false,
    verificationStatus: "synthetic_demo",
    primaryDirection: raw.primaryDirection,
    secondaryDirections: raw.secondaryDirections,
    availableSeasons: raw.availableSeasons,
    availableDurationsWeeks: raw.availableDurationsWeeks,
    childExperienceSignals: raw.childExperienceSignals,
    childFitProfile: raw.childFitProfile,
    parentCompatibilitySignals: raw.parentCompatibilitySignals,
    supportProfile: raw.supportProfile,
    idealFor: raw.idealFor,
    notIdealFor: raw.notIdealFor,
    whyItFits: raw.whyItFits,
    verificationChecklist: raw.verificationChecklist,
    priceConfidence: raw.priceConfidence,
    priceNotes: raw.priceNotes,
    displayBadge: raw.displayBadge,
  }
  const priceOptions: readonly V3PriceOption[] = raw.availableDurationsWeeks.map((weeks) => ({
    adultCount: 0,
    childCount: 1,
    durationWeeks: weeks,
    currency: "KRW",
    priceValue: priceForDuration(raw.priceMinKrw, raw.priceMaxKrw, weeks, raw.availableDurationsWeeks),
    status: "active",
  }))
  return {
    id: raw.id,
    slug: null,
    name: raw.name,
    city: raw.cityName,
    country,
    programType: primary === "schoolSchooling" ? "schooling" : primary === "subjectProject" ? "creative_daycamp" : primary === "cultureActivity" ? "activity" : "managed_immersion",
    directionSignals,
    ageMin: raw.ageMin,
    ageMax: raw.ageMax,
    ageSource: "program",
    durationWeeks: raw.availableDurationsWeeks,
    durationSource: "session_or_price",
    parentAccompanied: parentScope.guardianNearbyCompatible === true,
    parentScope,
    koreanManager: support["koreanSupport"] === "daily",
    koreanDailySupport: support["koreanSupport"] === "daily" ? true : support["koreanSupport"] === "none" ? false : null,
    koreanEmergencySupport: support["koreanSupport"] === "daily" || support["koreanSupport"] === "emergency_only"
      ? true
      : support["koreanSupport"] === "none" ? false : null,
    emergencySupport: true,
    beginnerClass: raw.englishLevels.includes("beginner") || raw.englishLevels.includes("basic"),
    earlyAdaptationSupport: support["initialAdaptationSupport"] === "strong" || support["initialAdaptationSupport"] === "moderate",
    dailyParentReport: support["parentCommunication"] === "daily" || support["parentCommunication"] === "frequent",
    traits: [...raw.childExperienceSignals, ...raw.parentCompatibilitySignals],
    specialCareSupport: specialCare,
    budgetMinKrw: raw.priceMinKrw,
    budgetMaxKrw: raw.priceMaxKrw,
    priceOptions,
    sessionWindows: demoSessionWindows(raw.availableSeasons, raw.availableDurationsWeeks, referenceYear),
    hasSessionRows: true,
    hasScheduledSessionRows: true,
    sessionStatusNeedsConfirmation: false,
    imageUrl: raw.imageUrl,
    status: "active",
    catalogSource: "demo",
    updatedAt: null,
    demoProfile: profile,
  }
}

function mapDemoCity(raw: DemoCityRaw): V3CatalogCity {
  const country = countryByCity[raw.cityName] ?? ""
  const profile: V3DemoCityProfile = {
    dataSource: "synthetic_demo_profile",
    isSyntheticProfile: true,
    cityArchetype: raw.cityArchetype,
    experienceStrengths: raw.experienceStrengths,
    parentStayProfile: raw.parentStayProfile,
    childStayProfile: raw.childStayProfile,
    mobilityProfile: raw.mobilityProfile,
    costProfile: raw.costProfile,
    environmentProfile: raw.environmentProfile,
    supportEnvironment: raw.supportEnvironment,
    citySignals: raw.citySignals,
    idealFor: raw.idealFor,
    notIdealFor: raw.notIdealFor,
    verificationChecklist: raw.verificationChecklist,
    displayBadge: raw.displayBadge,
  }
  return {
    id: raw.id,
    slug: null,
    name: raw.cityName,
    country,
    regionGroup: inferCityRegionGroup(country),
    imageUrl: null,
    description: raw.shortSummary,
    parentStayEvidence: raw.citySignals.join(" "),
    flightCostKrw: null,
    livingCostMonthlyKrw: null,
    housingCostMonthlyKrw: null,
    catalogSource: "demo",
    demoProfile: profile,
  }
}

function demoDirectionSignals(primary: ExperienceDirectionKey, secondary: readonly ExperienceDirectionKey[]): V3DirectionSignals {
  return {
    schoolSchooling: primary === "schoolSchooling" ? 98 : secondary.includes("schoolSchooling") ? 64 : 12,
    englishIntensive: primary === "englishIntensive" ? 98 : secondary.includes("englishIntensive") ? 64 : 12,
    subjectProject: primary === "subjectProject" ? 98 : secondary.includes("subjectProject") ? 64 : 12,
    cultureActivity: primary === "cultureActivity" ? 98 : secondary.includes("cultureActivity") ? 64 : 12,
  }
}

function demoParentScope(participation: string, accommodation: string): V3ParentScope {
  if (participation === "child_only_boarding") return { participationMode: "child_only_allowed", stayMode: "child_residential", guardianNearbyCompatible: false }
  if (participation === "child_only_homestay") return { participationMode: "child_only_allowed", stayMode: "homestay", guardianNearbyCompatible: false }
  if (participation === "family_residential") return { participationMode: "parent_recommended", stayMode: "family_stay", guardianNearbyCompatible: true }
  if (accommodation === "family_arranged") return { participationMode: "parent_recommended", stayMode: "day", guardianNearbyCompatible: true }
  return { participationMode: "parent_recommended", stayMode: "day", guardianNearbyCompatible: true }
}

function priceForDuration(min: number, max: number, weeks: number, options: readonly number[]): number {
  if (options.length <= 1) return min
  const ratio = (weeks - Math.min(...options)) / Math.max(1, Math.max(...options) - Math.min(...options))
  return Math.round(min + (max - min) * ratio)
}

function demoSessionWindows(seasons: readonly string[], durations: readonly number[], year: number): readonly V3SessionWindow[] {
  const windows: V3SessionWindow[] = []
  for (const season of seasons) {
    const ranges = season === "winter"
      ? [[`${year}-12-01`, `${year + 1}-02-28`] as const]
      : season === "summer"
        ? [[`${year}-06-01`, `${year}-08-31`] as const, [`${year + 1}-06-01`, `${year + 1}-08-31`] as const]
        : [[`${year}-01-01`, `${year}-12-31`] as const, [`${year + 1}-01-01`, `${year + 1}-12-31`] as const]
    for (const [start, end] of ranges) {
      for (const weeks of durations) {
        const startDate = start
        const endDate = end
        windows.push({ startDate, endDate, weeks, status: "scheduled", source: "program_sessions", precision: "exact" })
      }
    }
  }
  return windows
}
