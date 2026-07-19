import {
  CAMPFIT_V3_DEMO_CATALOG_VERSION,
  demoCityDefinitions,
  demoProgramDefinitions,
  type DemoParentMode,
  type DemoPriceQuality,
  type DemoSeason,
} from "@/data/campfit/v3/demoCatalog"
import { inferCityRegionGroup } from "@/lib/campfit/v2/cityProfileAdapter"
import type { V3Catalog, V3CatalogCity, V3CatalogProgram, V3PriceOption } from "@/lib/campfit/v3/catalogRepository"
import type { V3DirectionSignals, V3ParentScope, V3SessionWindow } from "@/lib/campfit/v3/catalogPolicy"
import type { ExperienceDirectionKey } from "@/types/campfitV3"

export function loadDemoCatalog(referenceYear = new Date().getUTCFullYear()): V3Catalog {
  return {
    programs: demoProgramDefinitions.map((program) => mapDemoProgram(program, referenceYear)),
    cities: demoCityDefinitions.map((city): V3CatalogCity => ({
      id: city.id,
      slug: city.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
      name: city.name,
      country: city.country,
      regionGroup: inferCityRegionGroup(city.country),
      imageUrl: null,
      description: city.description,
      parentStayEvidence: city.parentStayEvidence,
      flightCostKrw: city.flightCostKrw,
      livingCostMonthlyKrw: city.livingCostMonthlyKrw,
      housingCostMonthlyKrw: city.housingCostMonthlyKrw,
      catalogSource: "demo",
      demoProfile: city.profile,
    })),
    source: "demo",
    warnings: [`${CAMPFIT_V3_DEMO_CATALOG_VERSION}: 실제 예약·운영·가격 확정 전 비교용 Demo Catalog입니다.`],
  }
}

function mapDemoProgram(definition: (typeof demoProgramDefinitions)[number], year: number): V3CatalogProgram {
  const parentScope = demoParentScope(definition.parentMode)
  const priceOptions = buildPriceOptions(definition.priceBaseKrw, definition.priceQuality, definition.durations, definition.accommodations)
  return {
    id: definition.id,
    slug: null,
    name: definition.name,
    city: definition.city,
    country: definition.country,
    programType: definition.programType,
    directionSignals: demoDirectionSignals(definition.primaryDirection, definition.secondaryDirections),
    ageMin: definition.ageMin,
    ageMax: definition.ageMax,
    ageSource: "program",
    durationWeeks: definition.durations,
    durationSource: "session_or_price",
    parentAccompanied: parentScope.guardianNearbyCompatible === true,
    parentScope,
    koreanManager: definition.koreanSupport === "daily",
    koreanDailySupport: definition.koreanSupport === "daily" ? true : definition.koreanSupport === "none" ? false : null,
    koreanEmergencySupport: definition.koreanSupport === "none" ? false : true,
    emergencySupport: true,
    beginnerClass: definition.beginnerClass,
    earlyAdaptationSupport: definition.earlyAdaptationSupport,
    dailyParentReport: definition.dailyParentReport,
    traits: definition.traits,
    specialCareSupport: definition.specialCareSupport,
    budgetMinKrw: definition.priceBaseKrw,
    budgetMaxKrw: definition.priceQuality === "inquiry" ? null : Math.round(definition.priceBaseKrw * 1.45),
    priceOptions,
    sessionWindows: demoSessionWindows(definition.seasons, definition.durations, year),
    hasSessionRows: true,
    hasScheduledSessionRows: true,
    sessionStatusNeedsConfirmation: false,
    imageUrl: null,
    status: "active",
    catalogSource: "demo",
    updatedAt: null,
    packageInclusions: definition.packageInclusions,
    demoProfile: {
      productCategory: definition.category,
      accommodationOptions: definition.accommodations,
      priceQuality: definition.priceQuality,
      priceNote: priceQualityNote(definition.priceQuality),
      packageInclusions: definition.packageInclusions,
      strengths: definition.strengths,
      tradeoffs: definition.tradeoffs,
    },
  }
}

function demoDirectionSignals(primary: ExperienceDirectionKey, secondary: readonly ExperienceDirectionKey[]): V3DirectionSignals {
  return {
    schoolSchooling: primary === "schoolSchooling" ? 98 : secondary.includes("schoolSchooling") ? 68 : 18,
    englishIntensive: primary === "englishIntensive" ? 98 : secondary.includes("englishIntensive") ? 68 : 18,
    subjectProject: primary === "subjectProject" ? 98 : secondary.includes("subjectProject") ? 68 : 18,
    cultureActivity: primary === "cultureActivity" ? 98 : secondary.includes("cultureActivity") ? 68 : 18,
  }
}

function demoParentScope(mode: DemoParentMode): V3ParentScope {
  if (mode === "child_only") return { participationMode: "child_only_allowed", stayMode: "child_residential", guardianNearbyCompatible: false }
  if (mode === "day") return { participationMode: "parent_recommended", stayMode: "day", guardianNearbyCompatible: true }
  return { participationMode: "parent_recommended", stayMode: "family_stay", guardianNearbyCompatible: true }
}

function buildPriceOptions(
  basePriceKrw: number,
  quality: DemoPriceQuality,
  durations: readonly number[],
  accommodations: readonly string[],
): readonly V3PriceOption[] {
  const options: V3PriceOption[] = []
  const familyCombinations = [
    [1, 1], [1, 2], [1, 3],
    [2, 1], [2, 2], [2, 3],
  ] as const
  for (const duration of durations) {
    for (const [adultCount, childCount] of familyCombinations) {
      for (const accommodationType of accommodations) {
        options.push(priceOption({ basePriceKrw, quality, duration, adultCount, childCount, accommodationType }))
      }
    }
  }
  return options
}

function priceOption(input: {
  readonly basePriceKrw: number
  readonly quality: DemoPriceQuality
  readonly duration: number
  readonly adultCount: number
  readonly childCount: number
  readonly accommodationType: string
}): V3PriceOption {
  const scaled = input.basePriceKrw * input.duration / 4
  const familyFactor = 0.7 + input.childCount * 0.3 + input.adultCount * 0.18
  const accommodationFactor = input.accommodationType === "Residence"
    ? 0.95
    : input.accommodationType === "1BR"
      ? 1.1
      : input.accommodationType === "2BR"
        ? 1.25
        : input.accommodationType === "Hotel"
          ? 1.18
          : input.accommodationType === "Homestay"
            ? 0.85
            : input.accommodationType === "숙소미포함"
              ? 0.72
              : 1
  const priceValue = input.quality === "inquiry" ? null : Math.round(scaled * familyFactor * accommodationFactor / 10_000) * 10_000
  return {
    id: `demo-price-${input.duration}-${input.adultCount}-${input.childCount}-${input.accommodationType}`,
    adultCount: input.adultCount,
    childCount: input.childCount,
    durationWeeks: input.duration,
    currency: "KRW",
    priceValue,
    status: "active",
    accommodationType: input.accommodationType,
    priceQuality: input.quality,
    note: priceQualityNote(input.quality),
  }
}

function demoSessionWindows(seasons: readonly DemoSeason[], durations: readonly number[], year: number): readonly V3SessionWindow[] {
  const windows: V3SessionWindow[] = []
  for (const season of seasons) {
    const ranges = season === "summer"
      ? [[`${year}-06-01`, `${year}-08-31`] as const, [`${year + 1}-06-01`, `${year + 1}-08-31`] as const]
      : season === "winter"
        ? [[`${year}-12-01`, `${year + 1}-02-28`] as const, [`${year + 1}-12-01`, `${year + 2}-02-28`] as const]
        : [[`${year}-01-01`, `${year}-12-31`] as const, [`${year + 1}-01-01`, `${year + 1}-12-31`] as const]
    for (const [startDate, endDate] of ranges) {
      for (const weeks of durations) {
        windows.push({ startDate, endDate, weeks, status: "scheduled", source: "program_sessions", precision: "exact" })
      }
    }
  }
  return windows
}

function priceQualityNote(quality: DemoPriceQuality): string {
  if (quality === "exact") return "가족 구성·기간·숙소 variant 기준의 비교용 가격"
  if (quality === "official_surcharge") return "기준 가격에 공식 추가요금이 있을 수 있어 최종 견적 확인 필요"
  if (quality === "reference") return "기준 가격만 확인된 참고값"
  return "가족 구성·기간·숙소별 실제 가격 문의 필요"
}
