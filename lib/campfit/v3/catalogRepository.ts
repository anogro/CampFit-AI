import "server-only"

import { demoCityDefinitions } from "@/data/campfit/v3/demoCatalog"

import {
  extractSessionWindowsFromText,
  inferDirectionSignals,
  inferExperienceAssessment,
  inferParentScope,
  inferSpecialCareSupport,
  isPublicV3ProgramRow,
  isVisibleV3CityRow,
  parseDurationWeeks,
  type V3CatalogSource,
  type V3DirectionSignals,
  type V3ExperienceAssessment,
  type V3ParentScope,
  type V3SessionWindow,
} from "@/lib/campfit/v3/catalogPolicy"
import { createServerSupabaseClient } from "@/lib/campfit/supabaseServer"
import { inferCityRegionGroup } from "@/lib/campfit/v2/cityProfileAdapter"
import {
  isEnglishRequirementLevel,
  isInstructionLanguageMode,
  unknownProgramEnglishRequirement,
  type InstructionLanguageMode,
  type V3ProgramEnglishRequirement,
} from "@/lib/campfit/v3/englishRequirement"
import type { CityRegionGroup } from "@/types/campfitCity"
import type { Camp, DurationWeeks } from "@/types/campfit"

export type V3PriceOption = {
  readonly id?: string | null
  readonly adultCount: number | null
  readonly childCount: number | null
  readonly durationWeeks: number | null
  readonly currency: string | null
  readonly priceValue: number | null
  readonly status: string | null
  readonly accommodationType?: string | null
  readonly priceQuality?: "exact" | "official_surcharge" | "reference" | "inquiry" | null
  readonly note?: string | null
}

export type V3DemoCityProfile = {
  readonly costLevel: "low" | "medium" | "high"
  readonly livingEnvironment: "quiet" | "balanced" | "urban"
  readonly medicalLevel: "medium" | "high"
  readonly safetyLevel: "medium" | "high"
  readonly englishEnvironment: "medium" | "high"
  readonly stemStrength: "medium" | "high"
  readonly natureStrength: "low" | "medium" | "high"
  readonly internationality: "medium" | "high"
  readonly strengths: readonly string[]
}

export type V3CitySignalLevel = "low" | "medium" | "high" | "unknown"

export type V3CatalogCityProfile = {
  readonly safetyLevel: V3CitySignalLevel
  readonly medicalLevel: V3CitySignalLevel
  readonly internationality: V3CitySignalLevel
  readonly activityStrength: V3CitySignalLevel
  readonly natureStrength: V3CitySignalLevel
  readonly strengths: readonly string[]
  /** Flattened evidence from the Supabase Cities row for auditable matching. */
  readonly evidence: string
}

export type V3DemoProgramProfile = {
  readonly productCategory: "english" | "stem" | "sports" | "culture" | "schooling" | "project"
  readonly accommodationOptions: readonly string[]
  readonly priceQuality: "exact" | "official_surcharge" | "reference" | "inquiry"
  readonly priceNote: string
  readonly packageInclusions: V3ProgramPackageInclusions
  readonly strengths: readonly string[]
  readonly tradeoffs: readonly string[]
  readonly availableSeasons?: readonly string[]
}

export type V3ProgramMealPlan = "none" | "weekday_lunch" | "weekday_two_meals" | "full_board"

export type V3ProgramPackageInclusions = {
  readonly accommodationIncluded: boolean
  readonly mealPlan: V3ProgramMealPlan
  readonly localTransportIncluded: boolean
  readonly airportTransferIncluded: boolean
  readonly registrationFeeKrw: number | null
  readonly additionalAdultSurchargeKrw: number | null
  readonly additionalChildProgramPriceKrw: number | null
}

export type V3SessionAvailabilityStatus =
  | "confirmed_available"
  | "likely_available"
  | "needs_inquiry"
  | "confirmed_unavailable"
  | "closed"
  | "unknown"

export type V3SessionEvidence = {
  readonly source: string
  readonly value: string | number | null
  readonly confidence: "high" | "medium" | "low"
}

export type V3CatalogSessionVariant = {
  readonly programId: string
  readonly sessionId: string | null
  readonly startDate: string | null
  readonly endDate: string | null
  readonly availableDurationWeeks: readonly number[]
  readonly availabilityStatus: V3SessionAvailabilityStatus
  readonly status: string | null
  readonly label: string | null
  readonly note: string | null
  readonly source: "program_sessions" | "program_text" | "price_option"
  readonly evidence: readonly V3SessionEvidence[]
}

export type V3CatalogProgram = {
  readonly id: string
  readonly slug: string | null
  readonly name: string
  readonly city: string
  readonly country: string
  readonly programType: Camp["programType"]
  readonly directionSignals: V3DirectionSignals
  readonly experienceAssessment?: V3ExperienceAssessment
  readonly ageMin: number | null
  readonly ageMax: number | null
  readonly ageSource: "program" | "profile_inferred" | "unknown"
  readonly durationWeeks: readonly number[]
  readonly durationSource: "session_or_price" | "profile_or_text" | "unknown"
  readonly parentAccompanied: boolean
  readonly parentScope: V3ParentScope
  readonly koreanManager: boolean | null
  readonly koreanDailySupport: boolean | null
  readonly koreanEmergencySupport: boolean | null
  /** Optional commute evidence; absent means the catalog cannot verify school travel. */
  readonly commuteMinutes?: number | null
  readonly commuteTransferCount?: number | null
  readonly shuttleAvailable?: boolean | null
  readonly emergencySupport: boolean | null
  readonly beginnerClass: boolean | null
  readonly earlyAdaptationSupport: boolean | null
  readonly dailyParentReport: boolean | null
  readonly englishRequirement?: V3ProgramEnglishRequirement
  readonly traits: readonly string[]
  readonly specialCareSupport: "supported" | "unsupported" | "unknown"
  readonly budgetMinKrw: number | null
  readonly budgetMaxKrw: number | null
  readonly priceOptions: readonly V3PriceOption[]
  readonly sessionWindows: readonly V3SessionWindow[]
  /** Optional runtime session/price combinations; legacy callers may omit this. */
  readonly sessionVariants?: readonly V3CatalogSessionVariant[]
  readonly hasSessionRows: boolean
  readonly hasScheduledSessionRows: boolean
  readonly sessionStatusNeedsConfirmation: boolean
  readonly imageUrl: string | null
  /** Catalog-provided short/detailed description, when available. */
  readonly description?: string | null
  readonly status: "active"
  readonly catalogSource: "supabase" | "demo"
  readonly updatedAt: string | null
  readonly demoProfile?: V3DemoProgramProfile
  readonly packageInclusions?: V3ProgramPackageInclusions
}

export type V3CatalogCity = {
  readonly id: string
  readonly slug: string | null
  readonly name: string
  readonly country: string
  readonly regionGroup: CityRegionGroup
  readonly imageUrl: string | null
  readonly description: string | null
  readonly parentStayEvidence: string | null
  readonly flightCostKrw: number | null
  readonly livingCostMonthlyKrw: number | null
  readonly housingCostMonthlyKrw: number | null
  readonly catalogSource: "supabase" | "demo"
  readonly demoProfile?: V3DemoCityProfile
  readonly profile?: V3CatalogCityProfile
}

export type V3Catalog = {
  readonly programs: readonly V3CatalogProgram[]
  readonly cities: readonly V3CatalogCity[]
  readonly source: V3CatalogSource
  readonly warnings: readonly string[]
}

type Row = Record<string, unknown>

export async function loadV3Catalog(): Promise<V3Catalog> {
  const client = createServerSupabaseClient()
  if (client === null) return unavailableCatalog("Supabase 연결 설정을 확인할 수 없습니다.")

  const [programResult, priceResult, profileResult, cityResult, sessionResult, claimResult, evidenceResult, observationResult, demoProgramResult] = await Promise.all([
    client.from("programs").select("*"),
    client.from("program_price_options").select("*"),
    client.from("campfit_program_profiles").select("*"),
    client.from("Cities").select("*"),
    client.from("program_sessions").select("*"),
    client.from("program_provider_claims").select("id, program_id, claim_status, valid_until"),
    client.from("program_evidence_sources").select("id, program_id, verification_status, valid_until"),
    client.from("program_fact_observations").select("program_id, evidence_source_id, provider_claim_id, dimension_key, fact_key, observation_status, valid_until"),
    client.from("campfit_demo_programs").select("*"),
  ])

  if (programResult.error) {
    console.error("CampFit v3 programs read failed", programResult.error.message)
    return unavailableCatalog("프로그램 카탈로그를 불러오지 못했습니다.")
  }

  const queryResults = [programResult, priceResult, profileResult, cityResult, sessionResult]
  const failedQuery = queryResults.find((result) => result.error || !Array.isArray(result.data))
  if (failedQuery) {
    if (failedQuery.error) console.error("CampFit v3 catalog read failed", failedQuery.error.message)
    return unavailableCatalog("추천 카탈로그를 확인하지 못했습니다.")
  }

  const warnings: string[] = []
  const programRows = rowsFrom(programResult.data)
  const priceRows = optionalRows(priceResult, "program_price_options", warnings)
  const profileRows = optionalRows(profileResult, "campfit_program_profiles", warnings)
  const cityRows = optionalRows(cityResult, "Cities", warnings)
  const sessionRows = optionalRows(sessionResult, "program_sessions", warnings)
  const claimRows = optionalRows(claimResult, "program_provider_claims", warnings)
  const evidenceRows = optionalRows(evidenceResult, "program_evidence_sources", warnings)
  const observationRows = optionalRows(observationResult, "program_fact_observations", warnings)
  const demoRows = optionalRows(demoProgramResult, "campfit_demo_programs", warnings)
  const activeProfiles = profileRows.filter((row) => readBoolean(row, ["active"]) === true)
  const profileById = new Map(activeProfiles.flatMap((row) => {
    const programId = readString(row, ["program_id"])
    return programId ? [[programId, row] as const] : []
  }))
  const pricesById = groupPrices(priceRows)
  const sessionsById = groupSessions(sessionRows)
  const today = new Date().toISOString().slice(0, 10)
  const verifiedOfficialEnglishPrograms = verifiedOfficialEnglishProgramIds(claimRows, evidenceRows, observationRows, today)

  const productionPrograms = programRows.flatMap((row): readonly V3CatalogProgram[] => {
    if (!isActivePublicProgram(row, today)) return []
    const id = readString(row, ["id"])
    const name = readString(row, ["name", "title"])
    const city = readString(row, ["location_city", "city"])
    const country = readString(row, ["location_country", "country"])
    if (!id || !name || !city || !country) return []

    const profile = profileById.get(id)
    const priceOptions = pricesById.get(id) ?? []
    const sessionRowsForProgram = sessionsById.get(id) ?? []
    const mapped = mapProductionProgram({ row, profile, priceOptions, sessionRows: sessionRowsForProgram, id, name, city, country, today, catalogSource: "supabase", officialEnglishVerified: verifiedOfficialEnglishPrograms.has(id) })
    return [mapped]
  })
  const demoPrograms = mapDemoPrograms(demoRows, today)
  const programs = mergeCatalogPrograms(productionPrograms, demoPrograms).programs
  const cities = cityRows.flatMap((row) => mapCity(row))

  if (!cities.length) warnings.push("도시 카탈로그를 확인할 수 없어 프로그램 후보를 표시하지 않습니다.")
  return { programs, cities, source: "supabase", warnings }
}

/** Load the isolated demo table without ever mixing it into production mode. */
export async function loadDemoCatalogFromSupabase(): Promise<V3Catalog> {
  const client = createServerSupabaseClient()
  if (client === null) return unavailableCatalog("Supabase 연결 설정을 확인할 수 없습니다.")
  const [programResult, cityResult] = await Promise.all([
    client.from("campfit_demo_programs").select("*"),
    client.from("Cities").select("*"),
  ])
  if (programResult.error || !Array.isArray(programResult.data)) {
    if (programResult.error) console.error("CampFit v3 demo programs read failed", programResult.error.message)
    return unavailableCatalog("데모 프로그램 카탈로그를 불러오지 못했습니다.")
  }
  const warnings: string[] = []
  const cityRows = optionalRows(cityResult, "Cities", warnings)
  const today = new Date().toISOString().slice(0, 10)
  const programs = mapDemoPrograms(rowsFrom(programResult.data), today)
  const cities = cityRows.flatMap((row) => mapCity(row, "demo")).map((city) => {
    const demoDef = demoCityDefinitions.find((d) => d.name.toLowerCase() === city.name.toLowerCase())
    if (!demoDef) return city
    return {
      ...city,
      flightCostKrw: city.flightCostKrw ?? demoDef.flightCostKrw,
      livingCostMonthlyKrw: city.livingCostMonthlyKrw ?? demoDef.livingCostMonthlyKrw,
      housingCostMonthlyKrw: city.housingCostMonthlyKrw ?? demoDef.housingCostMonthlyKrw,
    }
  })
  if (!cities.length) warnings.push("도시 카탈로그를 확인할 수 없어 프로그램 후보를 표시하지 않습니다.")
  return { programs, cities, source: "demo", warnings }
}

function mapProductionProgram(input: {
  readonly row: Row
  readonly profile: Row | undefined
  readonly priceOptions: readonly V3PriceOption[]
  readonly sessionRows: readonly Row[]
  readonly id: string
  readonly name: string
  readonly city: string
  readonly country: string
  readonly today: string
  readonly catalogSource: "supabase" | "demo"
  readonly officialEnglishVerified: boolean
}): V3CatalogProgram {
  const rowAgeMin = readNumber(input.row, ["age_min"])
  const rowAgeMax = readNumber(input.row, ["age_max"])
  const profileAgeMin = readNumber(input.profile, ["age_min"])
  const profileAgeMax = readNumber(input.profile, ["age_max"])
  const ageSource = rowAgeMin !== undefined && rowAgeMax !== undefined
    ? "program"
    : profileAgeMin !== undefined && profileAgeMax !== undefined
      ? "profile_inferred"
      : "unknown"
  const ageMin = rowAgeMin ?? profileAgeMin ?? null
  const ageMax = rowAgeMax ?? profileAgeMax ?? null
  const scheduledSessionRows = input.sessionRows.filter((row) => readString(row, ["status"])?.toLowerCase() === "scheduled")
  const canonicalSessionWindows = mapCanonicalSessions(scheduledSessionRows)
  const explicitProgramWindows = mapExplicitProgramAvailability(input.row)
  const sessionWindows = canonicalSessionWindows.length ? canonicalSessionWindows : explicitProgramWindows
  const sessionDurationWeeks = scheduledSessionRows.flatMap((row) => {
    const weeks = readNumber(row, ["weeks"])
    return weeks === undefined ? [] : [weeks]
  })
  const priceDurationWeeks = input.priceOptions.flatMap((option) => option.durationWeeks === null ? [] : [option.durationWeeks])
  const profileDurationWeeks = durationNumbers([], readDurationBuckets(input.profile, ["duration_weeks"]))
  const rawDurationWeeks = parseDurationWeeks([
    readString(input.row, ["duration"]) ?? "",
    readString(input.row, ["duration_options"]) ?? "",
    readString(input.row, ["minimum_duration"]) ?? "",
  ].join(" "))
  const durationWeeks = uniqueNumbers([...sessionDurationWeeks, ...priceDurationWeeks, ...profileDurationWeeks, ...rawDurationWeeks])
  const durationSource = sessionDurationWeeks.length || priceDurationWeeks.length
    ? "session_or_price"
    : profileDurationWeeks.length || rawDurationWeeks.length
      ? "profile_or_text"
      : "unknown"
  const sourceText = programSourceText(input.row, input.profile)
  const sessionVariants = mapSessionVariants({
    programId: input.id,
    programRow: input.row,
    sessionRows: input.sessionRows,
    priceOptions: input.priceOptions,
    fallbackDurationWeeks: [...durationWeeks],
    today: input.today,
  })
  const programType = readProgramType(input.profile) ?? inferProgramType(input.row)
  const traits = readStringArray(input.profile, ["traits"])
  const experienceAssessment = inferExperienceAssessment({
    profileProgramType: readString(input.profile, ["program_type"]) ?? null,
    traits,
    sources: experienceSources(input.row, input.profile, input.sessionRows, input.name),
  })
  const parentScope = inferParentScope({
    participationText: readString(input.row, ["parent_participation_type"]) ?? "",
    accommodationText: [readString(input.row, ["accommodation_type"]), readString(input.row, ["item_accommodation"])].filter(Boolean).join(" "),
    groupText: readString(input.row, ["group_composition"]) ?? "",
    coverageText: readString(input.row, ["coverage_schedule"]) ?? "",
    nameText: input.name,
    profileParentAccompanied: readBoolean(input.profile, ["parent_accompanied"]) ?? null,
  })
  const koreanSignals = inferKoreanSignals(input.row, input.profile)
  const minimumCurrency = readString(input.row, ["minimum_price_currency", "base_price_currency", "currency"])
  const minimumValue = positiveNumber(readNumber(input.row, ["minimum_price_value", "base_price_value"]))
  const profileBudgetMin = positiveNumber(readNumber(input.profile, ["budget_min_krw"]))
  const profileBudgetMax = positiveNumber(readNumber(input.profile, ["budget_max_krw"]))
  const englishRequirement = resolveEnglishRequirement(input.profile, input.officialEnglishVerified)

  return {
    id: input.id,
    slug: readString(input.row, ["slug"]) ?? null,
    name: input.name,
    city: input.city,
    country: input.country,
    programType,
    directionSignals: inferDirectionSignals({
      profileProgramType: readString(input.profile, ["program_type"]) ?? null,
      traits,
      structuredText: structuredDirectionText(input.row),
      fallbackText: fallbackDirectionText(input.row, input.name),
    }),
    experienceAssessment,
    ageMin,
    ageMax,
    ageSource,
    durationWeeks,
    durationSource,
    parentAccompanied: parentScope.guardianNearbyCompatible === true,
    parentScope,
    koreanManager: koreanSignals.daily ?? readBoolean(input.profile, ["korean_manager"]) ?? null,
    koreanDailySupport: koreanSignals.daily,
    koreanEmergencySupport: koreanSignals.emergency,
    commuteMinutes: positiveNumber(readNumber(input.profile, ["commute_minutes", "estimated_commute_minutes", "travel_time_minutes"]) ?? readNumber(input.row, ["commute_minutes", "estimated_commute_minutes", "travel_time_minutes"])) ?? null,
    commuteTransferCount: nonnegativeNumber(readNumber(input.profile, ["commute_transfer_count", "transfer_count", "transfers"]) ?? readNumber(input.row, ["commute_transfer_count", "transfer_count", "transfers"])) ?? null,
    shuttleAvailable: readBoolean(input.profile, ["shuttle_available", "school_shuttle", "program_shuttle"]) ?? readBoolean(input.row, ["shuttle_available", "school_shuttle", "program_shuttle"]) ?? null,
    emergencySupport: readBoolean(input.row, ["emergency_support"]) ?? null,
    beginnerClass: readBoolean(input.profile, ["beginner_class"]) ?? null,
    earlyAdaptationSupport: readBoolean(input.profile, ["early_adaptation_support"]) ?? null,
    dailyParentReport: readBoolean(input.profile, ["daily_parent_report"]) ?? null,
    englishRequirement,
    traits,
    specialCareSupport: inferSpecialCareSupport(sourceText),
    budgetMinKrw: profileBudgetMin ?? (minimumCurrency?.toUpperCase() === "KRW" ? minimumValue ?? null : null),
    budgetMaxKrw: profileBudgetMax ?? null,
    priceOptions: input.priceOptions,
    sessionWindows,
    sessionVariants,
    hasSessionRows: input.sessionRows.length > 0,
    hasScheduledSessionRows: scheduledSessionRows.length > 0,
    sessionStatusNeedsConfirmation: sessionVariants.some((variant) => ["likely_available", "needs_inquiry", "unknown"].includes(variant.availabilityStatus)),
    imageUrl: readImage(input.row) ?? null,
    description: programDescription(input.row, input.profile),
    status: "active",
    catalogSource: input.catalogSource,
    updatedAt: readString(input.row, ["last_verified_at", "updated_at"]) ?? null,
  }
}

function unavailableCatalog(reason: string): V3Catalog {
  return { programs: [], cities: [], source: "unavailable", warnings: [reason] }
}

function isActivePublicProgram(row: Row, today: string): boolean {
  return isPublicV3ProgramRow(row, today)
}

function mapDemoPrograms(rows: readonly Row[], today: string): readonly V3CatalogProgram[] {
  return rows.flatMap((row): readonly V3CatalogProgram[] => {
    if (!isActivePublicProgram(row, today)) return []
    const id = readString(row, ["id"])
    const name = readString(row, ["name", "title"])
    const city = readString(row, ["location_city", "city"])
    const country = readString(row, ["location_country", "country"])
    if (!id || !name || !city || !country) return []

    let payload: Record<string, any> = {}
    try {
      const rawPayload = row["detail_payload"]
      if (typeof rawPayload === "string") {
        payload = JSON.parse(rawPayload) as Record<string, any>
      } else if (rawPayload && typeof rawPayload === "object") {
        payload = rawPayload as Record<string, any>
      }
    } catch (e) {
      console.error("Failed to parse detail_payload for demo program", id, e)
    }

    const durationWeeks = demoDurationWeeks(row, payload)
    const durationText = durationWeeks.map((weeks) => `${weeks}주`).join(", ")
    const referencePriceValue = positiveNumber(readNumber(row, ["minimum_price_value", "base_price_value", "display_price"]) ?? readNumber(payload, ["priceBaseKrw", "minimumPriceKrw", "basePriceKrw", "price"]))
    const referencePriceCurrency = readString(row, ["minimum_price_currency", "base_price_currency", "currency"]) ?? readString(payload, ["currency", "priceCurrency"])
    const parentMode = readString(payload, ["parentMode", "parent_mode"]) ?? ""
    const accommodationValues = readLooseStringArray(payload, ["accommodations", "accommodationOptions"])
    const parentParticipationText = parentMode === "child_only"
      ? "child only participation"
      : parentMode === "family" || parentMode === "day"
        ? "parent recommended"
        : ""
    const accommodationText = [
      readString(row, ["accommodation_type", "item_accommodation"]),
      ...accommodationValues,
      parentMode === "family" ? "family stay" : null,
      parentMode === "day" ? "day program" : null,
    ].filter((value): value is string => Boolean(value && value.trim())).join(", ")

    const mergedRow = {
      ...row,
      ...payload,
      duration: durationText || readString(row, ["duration"]) || "",
      duration_options: durationText || readString(row, ["duration_options"]) || "",
      parent_participation_type: parentParticipationText || readString(row, ["parent_participation_type"]) || "",
      accommodation_type: accommodationText || readString(row, ["accommodation_type"]) || "",
      minimum_price_value: referencePriceValue ?? readNumber(row, ["minimum_price_value", "base_price_value"]),
      minimum_price_currency: referencePriceCurrency ?? readString(row, ["minimum_price_currency", "base_price_currency", "currency"]),
    }

    const demoProfile = {
      ...payload,
      beginner_class: payload["beginnerClass"],
      early_adaptation_support: payload["earlyAdaptationSupport"],
      daily_parent_report: payload["dailyParentReport"],
      special_care_support: payload["specialCareSupport"],
      inferred_english_requirement_level: payload["demoEnglishRequirementLevel"],
      inferred_english_requirement_confidence: payload["demoEnglishRequirementConfidence"],
      inferred_english_requirement_version: payload["demoEnglishRequirementVersion"],
      demo_english_requirement_source: payload["demoEnglishRequirementSource"],
      demo_english_requirement_text: payload["demoEnglishRequirementText"],
      demo_english_exposure: payload["demoEnglishExposure"],
    }

    const mapped = mapProductionProgram({ row: mergedRow, profile: demoProfile, priceOptions: [], sessionRows: [], id, name, city, country, today, catalogSource: "demo", officialEnglishVerified: false })
    return [{
      ...mapped,
      demoProfile: mapDemoProgramProfile(payload, accommodationValues),
      packageInclusions: mapDemoPackageInclusions(payload),
    }]
  })
}

function demoDurationWeeks(row: Row, payload: Row): readonly number[] {
  const values = [
    payload["durations"],
    payload["durationWeeks"],
    payload["availableDurationsWeeks"],
    payload["duration_options"],
    payload["duration"],
    row["duration"],
    row["duration_options"],
    row["minimum_duration"],
  ].flatMap(parseDemoDurationValue)
  return uniqueNumbers(values.filter((weeks) => weeks >= 1 && weeks <= 12))
}

function parseDemoDurationValue(value: unknown): readonly number[] {
  if (Array.isArray(value)) return value.flatMap(parseDemoDurationValue)
  if (typeof value === "number" && Number.isFinite(value)) return [Math.trunc(value)]
  if (typeof value !== "string") return []
  return Array.from(value.matchAll(/\d+(?:\.\d+)?/gu)).flatMap((match) => {
    const parsed = Number(match[0])
    return Number.isFinite(parsed) ? [Math.trunc(parsed)] : []
  })
}

function mapDemoProgramProfile(payload: Row, accommodations: readonly string[]): V3DemoProgramProfile {
  const category = readString(payload, ["category", "productCategory"])
  const priceQuality = readString(payload, ["priceQuality"])
  return {
    productCategory: isDemoProductCategory(category) ? category : "english",
    accommodationOptions: accommodations,
    priceQuality: isDemoPriceQuality(priceQuality) ? priceQuality : "reference",
    priceNote: readString(payload, ["priceNote"]) ?? "참고 가격이며 기간·구성별 실제 견적은 확인이 필요합니다.",
    packageInclusions: mapDemoPackageInclusions(payload),
    strengths: readLooseStringArray(payload, ["strengths"]),
    tradeoffs: readLooseStringArray(payload, ["tradeoffs"]),
    availableSeasons: readLooseStringArray(payload, ["seasons", "availableSeasons"]),
  }
}

function mapDemoPackageInclusions(payload: Row): V3ProgramPackageInclusions {
  const raw = readRecord(payload, ["packageInclusions"]) ?? undefined
  return {
    accommodationIncluded: readBoolean(raw, ["accommodationIncluded"]) ?? false,
    mealPlan: isDemoMealPlan(readString(raw, ["mealPlan"])) ? readString(raw, ["mealPlan"]) as V3ProgramMealPlan : "none",
    localTransportIncluded: readBoolean(raw, ["localTransportIncluded"]) ?? false,
    airportTransferIncluded: readBoolean(raw, ["airportTransferIncluded"]) ?? false,
    registrationFeeKrw: positiveNumber(readNumber(raw, ["registrationFeeKrw"])) ?? null,
    additionalAdultSurchargeKrw: positiveNumber(readNumber(raw, ["additionalAdultSurchargeKrw"])) ?? null,
    additionalChildProgramPriceKrw: positiveNumber(readNumber(raw, ["additionalChildProgramPriceKrw"])) ?? null,
  }
}

function isDemoProductCategory(value: string | undefined): value is V3DemoProgramProfile["productCategory"] {
  return value === "english" || value === "stem" || value === "sports" || value === "culture" || value === "schooling" || value === "project"
}

function isDemoPriceQuality(value: string | undefined): value is V3DemoProgramProfile["priceQuality"] {
  return value === "exact" || value === "official_surcharge" || value === "reference" || value === "inquiry"
}

function isDemoMealPlan(value: string | undefined): value is V3ProgramMealPlan {
  return value === "none" || value === "weekday_lunch" || value === "weekday_two_meals" || value === "full_board"
}

export function mergeCatalogPrograms(
  productionPrograms: readonly V3CatalogProgram[],
  demoPrograms: readonly V3CatalogProgram[],
): { readonly programs: readonly V3CatalogProgram[]; readonly duplicateCount: number } {
  const seen = new Set<string>()
  const programs: V3CatalogProgram[] = []
  let duplicateCount = 0
  for (const program of [...productionPrograms, ...demoPrograms]) {
    const keys = programIdentityKeys(program)
    if (keys.some((key) => seen.has(key))) {
      duplicateCount += 1
      continue
    }
    keys.forEach((key) => seen.add(key))
    programs.push(program)
  }
  return { programs, duplicateCount }
}

function programIdentityKeys(program: V3CatalogProgram): readonly string[] {
  const keys = [`id:${normalizeIdentity(program.id)}`]
  const slug = normalizeIdentity(program.slug ?? "")
  if (slug) keys.push(`slug:${slug}`)
  return keys
}

function normalizeIdentity(value: string): string {
  return value.trim().replace(/^\/+|\/+$/g, "").toLowerCase()
}

function resolveEnglishRequirement(profile: Row | undefined, officialEnglishVerified: boolean): V3ProgramEnglishRequirement {
  if (!profile) return unknownProgramEnglishRequirement()

  const officialLevel = readString(profile, ["official_english_requirement_level"])
  if (officialEnglishVerified && isEnglishRequirementLevel(officialLevel) && officialLevel !== "unknown") {
    const qualification = readRecord(profile, ["official_english_qualification"])
    const minimumReadiness = qualification?.["minimum_readiness"]
    return {
      level: officialLevel,
      source: "official",
      confidence: null,
      version: null,
      officialVerified: true,
      officialText: readString(profile, ["official_english_requirement_text"]) ?? null,
      officialQualification: qualification,
      instructionLanguageMode: readInstructionLanguageMode(profile),
      beginnerParticipation: readBoolean(profile, ["official_beginner_participation"]) ?? null,
      officialMinimumReadiness: isReadinessValue(minimumReadiness) ? minimumReadiness : null,
    }
  }

  const inferredLevel = readString(profile, ["inferred_english_requirement_level"])
  const inferredConfidence = readNumber(profile, ["inferred_english_requirement_confidence"]) ?? null
  const demoSource = readString(profile, ["demo_english_requirement_source"]) === "demo_fixture"
  if (isEnglishRequirementLevel(inferredLevel) && inferredLevel !== "unknown" && (demoSource || inferredConfidence !== null && inferredConfidence >= 0.5)) {
    return {
      level: inferredLevel,
      source: demoSource ? "demo_fixture" : "inferred",
      confidence: inferredConfidence,
      version: readString(profile, ["inferred_english_requirement_version"]) ?? null,
      officialVerified: false,
      officialText: null,
      officialQualification: null,
      instructionLanguageMode: null,
      beginnerParticipation: null,
      officialMinimumReadiness: null,
    }
  }

  return unknownProgramEnglishRequirement()
}

function readInstructionLanguageMode(row: Row): InstructionLanguageMode | null {
  const value = readString(row, ["official_instruction_language_mode"])
  return isInstructionLanguageMode(value) ? value : null
}

function readRecord(row: Row | undefined, keys: readonly string[]): Record<string, unknown> | null {
  if (!row) return null
  for (const key of keys) {
    const value = row[key]
    if (typeof value === "object" && value !== null && !Array.isArray(value)) return value as Record<string, unknown>
  }
  return null
}

function isReadinessValue(value: unknown): value is NonNullable<V3ProgramEnglishRequirement["officialMinimumReadiness"]> {
  return value === "support_required"
    || value === "beginner_friendly"
    || value === "general_program_ready"
    || value === "academic_ready"
    || value === "unknown"
}

function verifiedOfficialEnglishProgramIds(
  claims: readonly Row[],
  evidenceSources: readonly Row[],
  observations: readonly Row[],
  today: string,
): ReadonlySet<string> {
  const verifiedSources = new Map<string, string>()
  for (const source of evidenceSources) {
    const id = readString(source, ["id"])
    const programId = readString(source, ["program_id"])
    const status = readString(source, ["verification_status"])?.toLowerCase()
    if (id && programId && isCurrentRow(source, today) && isVerifiedStatus(status)) verifiedSources.set(id, programId)
  }
  const verifiedClaims = new Map<string, string>()
  for (const claim of claims) {
    const id = readString(claim, ["id"])
    const programId = readString(claim, ["program_id"])
    const status = readString(claim, ["claim_status"])?.toLowerCase()
    if (id && programId && isCurrentRow(claim, today) && isVerifiedStatus(status)) verifiedClaims.set(id, programId)
  }
  const programIds = new Set<string>()
  for (const observation of observations) {
    if (readString(observation, ["dimension_key"]) !== "english_requirement") continue
    if (readString(observation, ["fact_key"]) !== "requirement_level") continue
    if (!isVerifiedStatus(readString(observation, ["observation_status"])?.toLowerCase())) continue
    if (!isCurrentRow(observation, today)) continue
    const programId = readString(observation, ["program_id"])
    const evidenceSourceId = readString(observation, ["evidence_source_id"])
    const providerClaimId = readString(observation, ["provider_claim_id"])
    if (!programId || !evidenceSourceId || verifiedSources.get(evidenceSourceId) !== programId) continue
    if (providerClaimId && verifiedClaims.get(providerClaimId) !== programId) continue
    programIds.add(programId)
  }
  return programIds
}

function isVerifiedStatus(status: string | undefined): boolean {
  return status === "verified" || status === "approved" || status === "confirmed" || status === "active" || status === "published"
}

function isCurrentRow(row: Row, today: string): boolean {
  const validUntil = readDate(row, ["valid_until"])
  return validUntil === undefined || validUntil >= today
}

function mapCity(row: Row, catalogSource: "supabase" | "demo" = "supabase"): readonly V3CatalogCity[] {
  if (!isVisibleV3CityRow(row)) return []
  const id = readString(row, ["id"])
  const name = readString(row, ["City name", "name", "city_name", "title"])
  const country = readString(row, ["Country", "country", "country_name"])
  if (!id || !name || !country) return []
  const description = readString(row, ["Description", "long Description", "Local Insight / Notes"]) ?? null
  const parentStayEvidence = [
    description,
    readString(row, ["style"]),
    readString(row, ["Local Insight / Notes"]),
    readString(row, ["Schools"]),
  ].filter(Boolean).join(" ") || null
  const profileEvidence = Object.entries(row)
    .flatMap(([key, value]) => {
      if (typeof value === "string" && value.trim()) return [`${key}: ${value.trim()}`]
      if (typeof value === "number" && Number.isFinite(value)) return [`${key}: ${value}`]
      if (typeof value === "boolean") return [`${key}: ${value}`]
      return []
    })
    .join(" | ")
  return [{
    id,
    slug: readString(row, ["slug", "city_slug"]) ?? null,
    name,
    country,
    regionGroup: inferCityRegionGroup(country),
    imageUrl: readImage(row) ?? null,
    description,
    parentStayEvidence,
    flightCostKrw: positiveNumber(readNumber(row, ["Flight Cost KRW"])) ?? null,
    livingCostMonthlyKrw: positiveNumber(readNumber(row, ["LivingCost KRW"])) ?? null,
    housingCostMonthlyKrw: positiveNumber(readNumber(row, ["HousingCost KRW"])) ?? null,
    catalogSource,
    profile: {
      safetyLevel: readCitySignal(row, ["safety", "Safety", "safety_level", "Safety Level", "security", "Security"], profileEvidence, /safety|security|\uCE58\uC548|\uC548\uC804/iu),
      medicalLevel: readCitySignal(row, ["medical", "Medical", "medical_level", "Medical Level", "hospital", "Hospital", "healthcare", "Healthcare"], profileEvidence, /medical|hospital|healthcare|health|emergency|\uBCD1\uC6D0|\uC758\uB8CC|\uC751\uAE09/iu),
      internationality: readCitySignal(row, ["internationality", "Internationality", "international", "International", "multicultural", "Multicultural", "foreigner_friendly", "Foreigners"], profileEvidence, /international|multicultural|foreigner|diverse|racism|\uB2E4\uC778\uC885|\uC678\uAD6D\uC778|\uC778\uC885|\uCC28\uBCC4/iu),
      activityStrength: readCitySignal(row, ["activities", "Activities", "activity_strength", "Activity Strength", "tourism", "Tourism", "weekend"], profileEvidence, /activities?|tourism|culture|entertainment|weekend|\uBCFC\uAC70\uB9AC|\uCCB4\uD5D8|\uAD00\uAD11|\uC8FC\uB9D0/iu),
      natureStrength: readCitySignal(row, ["nature", "Nature", "nature_strength", "Nature Strength", "outdoors", "Outdoor"], profileEvidence, /nature|beach|park|outdoor|mountain|\uC790\uC5F0|\uD574\uBCC0|\uACF5\uC6D0/iu),
      strengths: [description, readString(row, ["Local Insight / Notes"]), readString(row, ["style"])].filter((value): value is string => Boolean(value)),
      evidence: profileEvidence,
    },
  }]
}

function readCitySignal(row: Row, keys: readonly string[], evidence: string, categoryPattern: RegExp): V3CitySignalLevel {
  for (const key of keys) {
    const number = readNumber(row, [key])
    if (number !== undefined) return number >= 75 ? "high" : number >= 45 ? "medium" : "low"
    const value = readString(row, [key])
    if (value) return levelFromText(value)
  }
  const categoryEvidence = evidence.split(" | ").filter((item) => categoryPattern.test(item)).join(" ")
  if (!categoryEvidence) return "unknown"
  return levelFromText(categoryEvidence)
}

function levelFromText(value: string): V3CitySignalLevel {
  if (/(excellent|very\s*high|strong|best|high|excellent|\uB9E4\uC6B0\s*\uC88B|\uB192)/iu.test(value)) return "high"
  if (/(low|poor|weak|limited|bad|\uB0AE|\uB0AE\uC74C|\uBD80\uC871)/iu.test(value)) return "low"
  if (/(medium|moderate|average|balanced|\uBCF4\uD1B5|\uC911\uAC04)/iu.test(value)) return "medium"
  return "medium"
}

function optionalRows(
  result: { readonly data: unknown; readonly error: { readonly message: string } | null },
  label: string,
  warnings: string[],
): readonly Row[] {
  if (result.error) {
    console.error(`CampFit v3 ${label} read failed`, result.error.message)
    warnings.push(`${label} 데이터를 확인하지 못했습니다.`)
    return []
  }
  return rowsFrom(result.data)
}

function rowsFrom(data: unknown): readonly Row[] {
  return Array.isArray(data) ? data.filter((item): item is Row => typeof item === "object" && item !== null) : []
}

function groupPrices(rows: readonly Row[]): ReadonlyMap<string, readonly V3PriceOption[]> {
  const map = new Map<string, V3PriceOption[]>()
  for (const row of rows) {
    const status = readString(row, ["status"])
    if (status?.toLowerCase() !== "active") continue
    const id = readString(row, ["program_id"])
    if (!id) continue
    const item: V3PriceOption = {
      id: readString(row, ["id"]) ?? null,
      adultCount: readNumber(row, ["adult_count"]) ?? null,
      childCount: readNumber(row, ["child_count"]) ?? null,
      durationWeeks: readNumber(row, ["duration_weeks"]) ?? null,
      currency: readString(row, ["currency"]) ?? null,
      priceValue: positiveNumber(readNumber(row, ["price_value"])) ?? null,
      status,
    }
    map.set(id, [...(map.get(id) ?? []), item])
  }
  return map
}

function groupSessions(rows: readonly Row[]): ReadonlyMap<string, readonly Row[]> {
  const map = new Map<string, Row[]>()
  for (const row of rows) {
    const id = readString(row, ["program_id"])
    if (!id) continue
    map.set(id, [...(map.get(id) ?? []), row])
  }
  return map
}

function mapCanonicalSessions(rows: readonly Row[]): readonly V3SessionWindow[] {
  return rows.flatMap((row): readonly V3SessionWindow[] => {
    if (readString(row, ["status"])?.toLowerCase() !== "scheduled") return []
    const startDate = readDate(row, ["start_date"])
    const endDate = readDate(row, ["end_date"])
    if (!startDate || !endDate) return []
    return [{
      startDate,
      endDate,
      weeks: readNumber(row, ["weeks"]) ?? null,
      status: readString(row, ["status"]) ?? null,
      source: "program_sessions",
      precision: "exact",
    }]
  })
}

function mapExplicitProgramAvailability(row: Row): readonly V3SessionWindow[] {
  const startDate = readDate(row, ["start_date", "available_start_date", "session_start_date"])
  const endDate = readDate(row, ["end_date", "available_end_date", "session_end_date"])
  if (startDate && endDate) {
    return [{
      startDate,
      endDate,
      weeks: readNumber(row, ["weeks", "duration_weeks"]) ?? null,
      status: readString(row, ["availability_status", "session_status"]) ?? null,
      source: "program_text",
      precision: "exact",
    }]
  }
  const explicitText = [
    readString(row, ["session_dates"]),
    readString(row, ["availability_dates"]),
    readString(row, ["date_range"]),
    readString(row, ["operating_period"]),
  ].filter((value): value is string => Boolean(value)).join(" ")
  return explicitText ? extractSessionWindowsFromText(explicitText) : []
}

function mapSessionVariants(input: {
  readonly programId: string
  readonly programRow: Row
  readonly sessionRows: readonly Row[]
  readonly priceOptions: readonly V3PriceOption[]
  readonly fallbackDurationWeeks: readonly number[]
  readonly today: string
}): readonly V3CatalogSessionVariant[] {
  const variants: V3CatalogSessionVariant[] = []
  for (const row of input.sessionRows) {
    const rawStatus = readString(row, ["status"]) ?? null
    const normalizedStatus = rawStatus?.toLowerCase() ?? "unknown"
    const startDate = readDate(row, ["start_date", "session_start_date", "available_start_date"]) ?? null
    const endDate = readDate(row, ["end_date", "session_end_date", "available_end_date"]) ?? null
    const rowDuration = readNumber(row, ["weeks", "duration_weeks"])
    const note = readString(row, ["note", "notes", "description", "session_note"])
    const label = readString(row, ["label", "name", "title"])
    const textDurations = parseDurationWeeks([note, label].filter(Boolean).join(" "))
    const programTextDurations = parseDurationWeeks([
      readString(input.programRow, ["duration"]),
      readString(input.programRow, ["duration_options"]),
      readString(input.programRow, ["minimum_duration"]),
      readString(input.programRow, ["short_description"]),
      readString(input.programRow, ["detailed_description"]),
    ].filter(Boolean).join(" "))
    const availableDurationWeeks = uniqueNumbers([
      ...(rowDuration === undefined ? input.priceOptions.flatMap((option) => option.durationWeeks === null ? [] : [option.durationWeeks]) : [rowDuration]),
      ...textDurations,
      ...programTextDurations,
    ])
    const availabilityStatus = sessionAvailabilityStatus({ normalizedStatus, startDate, endDate, today: input.today })
    variants.push({
      programId: input.programId,
      sessionId: readString(row, ["id", "session_id"]) ?? null,
      startDate,
      endDate,
      availableDurationWeeks,
      availabilityStatus,
      status: rawStatus,
      label: label ?? null,
      note: note ?? null,
      source: "program_sessions",
      evidence: [
        { source: "program_sessions.status", value: rawStatus, confidence: rawStatus ? "high" : "low" },
        { source: "program_sessions.start_date", value: startDate, confidence: startDate ? "high" : "low" },
        { source: "program_sessions.end_date", value: endDate, confidence: endDate ? "high" : "low" },
        { source: "program_sessions.weeks", value: rowDuration ?? null, confidence: rowDuration === undefined ? "low" : "high" },
        ...textDurations.map((weeks) => ({ source: "program_sessions.note", value: weeks, confidence: "medium" as const })),
      ],
    })
  }

  for (const window of mapExplicitProgramAvailability(input.programRow)) {
    variants.push({
      programId: input.programId,
      sessionId: null,
      startDate: window.startDate,
      endDate: window.endDate,
      availableDurationWeeks: uniqueNumbers([
        ...(window.weeks === null ? [] : [window.weeks]),
        ...input.fallbackDurationWeeks,
      ]),
      availabilityStatus: window.endDate < input.today ? "closed" : "likely_available",
      status: window.status,
      label: null,
      note: null,
      source: "program_text",
      evidence: [
        { source: "program_text.start_date", value: window.startDate, confidence: window.precision === "exact" ? "medium" : "low" },
        { source: "program_text.end_date", value: window.endDate, confidence: window.precision === "exact" ? "medium" : "low" },
        { source: "program_text.duration", value: window.weeks, confidence: window.weeks === null ? "low" : "medium" },
      ],
    })
  }

  if (variants.length === 0 && input.priceOptions.length > 0) {
    const durations = uniqueNumbers([
      ...input.priceOptions.flatMap((option) => option.durationWeeks === null ? [] : [option.durationWeeks]),
      ...input.fallbackDurationWeeks,
    ])
    variants.push({
      programId: input.programId,
      sessionId: null,
      startDate: null,
      endDate: null,
      availableDurationWeeks: durations,
      availabilityStatus: "likely_available",
      status: null,
      label: null,
      note: null,
      source: "price_option",
      evidence: [{ source: "program_price_options.duration_weeks", value: durations.length ? durations.join(",") : null, confidence: durations.length ? "high" : "low" }],
    })
  }
  return variants
}

function sessionAvailabilityStatus(input: {
  readonly normalizedStatus: string
  readonly startDate: string | null
  readonly endDate: string | null
  readonly today: string
}): V3SessionAvailabilityStatus {
  if (["cancelled", "canceled", "archived", "deleted", "closed", "ended", "complete", "completed"].includes(input.normalizedStatus)) return "closed"
  if (["inquiry", "inquire", "contact", "contact_required", "waitlist"].includes(input.normalizedStatus)) return "needs_inquiry"
  if (["unavailable", "not_available", "full", "sold_out"].includes(input.normalizedStatus)) return "confirmed_unavailable"
  if (input.endDate && input.endDate < input.today) return "closed"
  if (["scheduled", "active", "open", "confirmed", "available"].includes(input.normalizedStatus)) {
    return input.startDate && input.endDate ? "confirmed_available" : "likely_available"
  }
  return input.startDate && input.endDate ? "likely_available" : "unknown"
}

function inferKoreanSignals(row: Row, profile: Row | undefined): { readonly daily: boolean | null; readonly emergency: boolean | null } {
  const languages = readLooseStringArray(row, ["languages_supported", "program_languages"])
  const hasKorean = languages.some((value) => /(korean|한국어|ko(?:-|_)?kr)/i.test(value))
  const hasAnyLanguageData = languages.length > 0
  const onsite = readBoolean(row, ["onsite_manager"])
  const emergency = readBoolean(row, ["emergency_support"])
  const coverage = readString(row, ["coverage_schedule"])
  const localPresence = readString(row, ["local_presence"])
  const inferredProfile = readBoolean(profile, ["korean_manager"])
  const daily = hasKorean && (onsite === true || Boolean(coverage) || Boolean(localPresence))
    ? true
    : hasAnyLanguageData && !hasKorean
      ? false
      : inferredProfile === true
        ? null
        : null
  const emergencyKorean = hasKorean && emergency === true
    ? true
    : emergency === false || (hasAnyLanguageData && !hasKorean)
      ? false
      : null
  return { daily, emergency: emergencyKorean }
}

function programSourceText(row: Row, profile: Row | undefined): string {
  const values = [
    readString(row, ["name", "title"]), readString(row, ["program_type"]), readString(row, ["program_focus"]),
    readString(row, ["curriculum_type"]), readString(row, ["short_description"]), readString(row, ["detailed_description"]),
    readString(row, ["item_education_program"]), readString(row, ["requirements"]), readString(row, ["care_level"]),
    readString(row, ["care_types"]), readString(row, ["accommodation_type"]), readString(row, ["parent_participation_type"]),
    readString(row, ["duration"]), readString(row, ["duration_options"]), readString(row, ["minimum_duration"]),
    ...readStringArray(profile, ["traits"]),
  ]
  const detailPayload = row["detail_payload"]
  if (detailPayload !== null && detailPayload !== undefined) values.push(JSON.stringify(detailPayload).slice(0, 4_000))
  return values.filter((value): value is string => typeof value === "string" && value.trim().length > 0).join(" ")
}

function programDescription(row: Row, profile: Row | undefined): string | null {
  const profileStrength = readStringArray(profile, ["strengths"])[0] ?? null
  return [
    profileStrength,
    readString(row, ["short_description", "detailed_description", "item_education_program"]),
    readString(profile, ["description", "summary", "highlights", "activity", "activities"]),
  ].find((value): value is string => Boolean(value?.trim())) ?? null
}

function structuredDirectionText(row: Row): string {
  return [
    readString(row, ["program_type"]),
    readString(row, ["program_focus"]),
    readString(row, ["curriculum_type"]),
  ].filter((value): value is string => Boolean(value)).join(" ")
}

function fallbackDirectionText(row: Row, name: string): string {
  return [
    name,
    readString(row, ["short_description"]),
    readString(row, ["detailed_description"]),
    readString(row, ["item_education_program"]),
  ].filter((value): value is string => Boolean(value)).join(" ")
}

function experienceSources(
  row: Row,
  profile: Row | undefined,
  sessionRows: readonly Row[],
  name: string,
): readonly { readonly source: string; readonly text: string; readonly confidence: "high" | "medium" | "low" }[] {
  const sources: { source: string; text: string; confidence: "high" | "medium" | "low" }[] = []
  const add = (source: string, values: readonly string[], confidence: "high" | "medium" | "low") => {
    const text = values.map((value) => value.trim()).filter(Boolean).join(" ")
    if (text) sources.push({ source, text, confidence })
  }

  add("program.activity", readTextValues(row, ["activity", "activities", "activity_type", "activity_types"]), "high")
  add("program.highlights", readTextValues(row, ["highlights", "program_highlights", "activity_highlights"]), "medium")
  add("program.subject", readTextValues(row, ["subject", "subjects", "subject_area", "subject_areas"]), "high")
  add("program.category", readTextValues(row, ["category", "categories", "program_category"]), "high")
  add("program.curriculum", readTextValues(row, ["curriculum", "curriculum_type", "program_focus"]), "high")
  add("program.description", readTextValues(row, ["short_description", "detailed_description", "item_education_program"]), "low")
  add("program.name", [name], "low")
  const detailPayloadText = row?.["detail_payload"] === undefined || row?.["detail_payload"] === null
    ? ""
    : typeof row["detail_payload"] === "string"
      ? row["detail_payload"]
      : JSON.stringify(row["detail_payload"])
  add("program.detail_payload", detailPayloadText ? [detailPayloadText.slice(0, 4_000)] : [], "low")
  add("program_profile.activity", readTextValues(profile, ["activity", "activities", "highlights"]), "high")

  for (const [index, session] of sessionRows.entries()) {
    add(`program_sessions[${index}]`, readTextValues(session, ["label", "name", "title", "note", "notes", "description", "activities", "subject"]), "medium")
  }
  return sources
}

function durationNumbers(prices: readonly V3PriceOption[], legacy: readonly DurationWeeks[]): readonly number[] {
  const fromPrices = prices.flatMap((price) => price.durationWeeks === null ? [] : [price.durationWeeks])
  const fromLegacy = legacy.flatMap((value) => value === "1w" ? [1] : value === "2w" ? [2] : value === "3_4w" ? [3, 4] : [])
  return uniqueNumbers([...fromPrices, ...fromLegacy])
}

function readDurationBuckets(row: Row | undefined, keys: readonly string[]): readonly DurationWeeks[] {
  const allowed = new Set<DurationWeeks>(["1w", "2w", "3_4w"])
  return readStringArray(row, keys).filter((value): value is DurationWeeks => allowed.has(value as DurationWeeks))
}

function inferProgramType(row: Row): Camp["programType"] {
  const text = programSourceText(row, undefined).toLowerCase()
  if (/school|스쿨|국제학교|정규\s*수업/.test(text)) return "schooling"
  if (/family|가족/.test(text)) return "family_esl"
  if (/stem|steam|project|creative\s+(?:project|arts?)|코딩|로봇|과학|예술\s*프로젝트|창의\s*(?:프로젝트|창작)|maker|sports?\s+specialt(?:y|ies)|스포츠\s*특화/.test(text)) return "creative_daycamp"
  if (/activity|문화|액티비티|스포츠|outdoor/.test(text)) return "activity"
  if (/international\s*camp|국제\s*캠프/.test(text)) return "international_camp"
  return "managed_immersion"
}

function readProgramType(row: Row | undefined): Camp["programType"] | undefined {
  const value = readString(row, ["program_type"])
  return ["managed_immersion", "schooling", "family_esl", "activity", "creative_daycamp", "international_camp"].includes(value ?? "")
    ? value as Camp["programType"]
    : undefined
}

function readImage(row: Row): string | undefined {
  for (const key of ["thumb_url", "cover_image_url", "hero_image_url", "Picture", "picture", "image_url"]) {
    const found = imageValue(row[key])
    if (found) return found
  }
  const heroes = row["hero_images"]
  return Array.isArray(heroes) ? imageValue(heroes[0]) : undefined
}

function imageValue(value: unknown): string | undefined {
  if (typeof value === "string" && /^https?:\/\//.test(value)) return value
  if (Array.isArray(value)) return imageValue(value[0])
  if (typeof value === "object" && value !== null) {
    const record = value as Row
    return readString(record, ["url", "src"])
      ?? imageValue((record["thumbnails"] as Row | undefined)?.["large"])
      ?? imageValue((record["thumbnails"] as Row | undefined)?.["full"])
  }
  return undefined
}

function readString(row: Row | undefined, keys: readonly string[]): string | undefined {
  if (!row) return undefined
  for (const key of keys) {
    const value = row[key]
    if (typeof value === "string" && value.trim()) return value.trim()
  }
  return undefined
}

function readDate(row: Row | undefined, keys: readonly string[]): string | undefined {
  const value = readString(row, keys)
  if (!value) return undefined
  const date = value.slice(0, 10)
  return /^20\d{2}-\d{2}-\d{2}$/.test(date) ? date : undefined
}

function readNumber(row: Row | undefined, keys: readonly string[]): number | undefined {
  if (!row) return undefined
  for (const key of keys) {
    const value = row[key]
    if (typeof value === "number" && Number.isFinite(value)) return value
    if (typeof value === "string") {
      const cleaned = value.replace(/KRW|krw|[\s,]/g, "")
      if (/^-?[\d.]+(?:e-?\d+)?$/.test(cleaned)) {
        const parsed = Number(cleaned)
        if (Number.isFinite(parsed)) return parsed
      }
    }
  }
  return undefined
}

function positiveNumber(value: number | null | undefined): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined
}

function nonnegativeNumber(value: number | null | undefined): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined
}

function readBoolean(row: Row | undefined, keys: readonly string[]): boolean | undefined {
  if (!row) return undefined
  for (const key of keys) {
    const value = row[key]
    if (typeof value === "boolean") return value
  }
  return undefined
}

function readStringArray(row: Row | undefined, keys: readonly string[]): readonly string[] {
  if (!row) return []
  for (const key of keys) {
    const value = row[key]
    if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string")
  }
  return []
}

function readTextValues(row: Row | undefined, keys: readonly string[]): readonly string[] {
  if (!row) return []
  const values: string[] = []
  for (const key of keys) {
    const value = row[key]
    if (typeof value === "string" && value.trim()) {
      values.push(value.trim())
      continue
    }
    if (Array.isArray(value)) {
      values.push(...value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim()))
    }
  }
  return values
}

function readLooseStringArray(row: Row | undefined, keys: readonly string[]): readonly string[] {
  if (!row) return []
  for (const key of keys) {
    const value = row[key]
    if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string")
    if (typeof value === "string" && value.trim()) {
      try {
        const parsed: unknown = JSON.parse(value)
        if (Array.isArray(parsed)) return parsed.filter((item): item is string => typeof item === "string")
      } catch {
        return value.split(/[,;/|]/).map((item) => item.trim()).filter(Boolean)
      }
      return [value.trim()]
    }
  }
  return []
}

function uniqueNumbers(values: readonly number[]): readonly number[] {
  return [...new Set(values.filter((value) => Number.isFinite(value) && value > 0))].sort((left, right) => left - right)
}
