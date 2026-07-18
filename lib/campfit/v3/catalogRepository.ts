import "server-only"

import {
  extractSessionWindowsFromText,
  inferDirectionSignals,
  inferParentScope,
  inferSpecialCareSupport,
  isPublicV3ProgramRow,
  isVisibleV3CityRow,
  parseDurationWeeks,
  type V3CatalogSource,
  type V3DirectionSignals,
  type V3ParentScope,
  type V3SessionWindow,
} from "@/lib/campfit/v3/catalogPolicy"
import { createServerSupabaseClient } from "@/lib/campfit/supabaseServer"
import { inferCityRegionGroup } from "@/lib/campfit/v2/cityProfileAdapter"
import type { CityRegionGroup } from "@/types/campfitCity"
import type { Camp, DurationWeeks } from "@/types/campfit"

export type V3PriceOption = {
  readonly adultCount: number | null
  readonly childCount: number | null
  readonly durationWeeks: number | null
  readonly currency: string | null
  readonly priceValue: number | null
  readonly status: string | null
}

export type V3CatalogProgram = {
  readonly id: string
  readonly slug: string | null
  readonly name: string
  readonly city: string
  readonly country: string
  readonly programType: Camp["programType"]
  readonly directionSignals: V3DirectionSignals
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
  readonly emergencySupport: boolean | null
  readonly beginnerClass: boolean | null
  readonly earlyAdaptationSupport: boolean | null
  readonly dailyParentReport: boolean | null
  readonly traits: readonly string[]
  readonly specialCareSupport: "supported" | "unsupported" | "unknown"
  readonly budgetMinKrw: number | null
  readonly budgetMaxKrw: number | null
  readonly priceOptions: readonly V3PriceOption[]
  readonly sessionWindows: readonly V3SessionWindow[]
  readonly hasSessionRows: boolean
  readonly hasScheduledSessionRows: boolean
  readonly sessionStatusNeedsConfirmation: boolean
  readonly imageUrl: string | null
  readonly status: "active"
  readonly catalogSource: "supabase"
  readonly updatedAt: string | null
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
  readonly catalogSource: "supabase"
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

  const [programResult, priceResult, profileResult, cityResult, sessionResult] = await Promise.all([
    client.from("programs").select("*"),
    client.from("program_price_options").select("*"),
    client.from("campfit_program_profiles").select("*"),
    client.from("Cities").select("*"),
    client.from("program_sessions").select("*"),
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
  const activeProfiles = profileRows.filter((row) => readBoolean(row, ["active"]) === true)
  const profileById = new Map(activeProfiles.flatMap((row) => {
    const programId = readString(row, ["program_id"])
    return programId ? [[programId, row] as const] : []
  }))
  const pricesById = groupPrices(priceRows)
  const sessionsById = groupSessions(sessionRows)
  const today = new Date().toISOString().slice(0, 10)

  const programs = programRows.flatMap((row): readonly V3CatalogProgram[] => {
    if (!isActivePublicProgram(row, today)) return []
    const id = readString(row, ["id"])
    const name = readString(row, ["name", "title"])
    const city = readString(row, ["location_city", "city"])
    const country = readString(row, ["location_country", "country"])
    if (!id || !name || !city || !country) return []

    const profile = profileById.get(id)
    const priceOptions = pricesById.get(id) ?? []
    const sessionRowsForProgram = sessionsById.get(id) ?? []
    const mapped = mapProductionProgram({ row, profile, priceOptions, sessionRows: sessionRowsForProgram, id, name, city, country })
    return [mapped]
  })
  const cities = cityRows.flatMap((row) => mapCity(row))

  if (!cities.length) warnings.push("도시 카탈로그를 확인할 수 없어 프로그램 후보를 표시하지 않습니다.")
  return { programs, cities, source: "supabase", warnings }
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
  const explicitProgramWindows = input.sessionRows.length === 0 ? mapExplicitProgramAvailability(input.row) : []
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
  const programType = readProgramType(input.profile) ?? inferProgramType(input.row)
  const traits = readStringArray(input.profile, ["traits"])
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
    emergencySupport: readBoolean(input.row, ["emergency_support"]) ?? null,
    beginnerClass: readBoolean(input.profile, ["beginner_class"]) ?? null,
    earlyAdaptationSupport: readBoolean(input.profile, ["early_adaptation_support"]) ?? null,
    dailyParentReport: readBoolean(input.profile, ["daily_parent_report"]) ?? null,
    traits,
    specialCareSupport: inferSpecialCareSupport(sourceText),
    budgetMinKrw: profileBudgetMin ?? (minimumCurrency?.toUpperCase() === "KRW" ? minimumValue ?? null : null),
    budgetMaxKrw: profileBudgetMax ?? null,
    priceOptions: input.priceOptions,
    sessionWindows,
    hasSessionRows: input.sessionRows.length > 0,
    hasScheduledSessionRows: scheduledSessionRows.length > 0,
    sessionStatusNeedsConfirmation: scheduledSessionRows.length > 0 && canonicalSessionWindows.length === 0,
    imageUrl: readImage(input.row) ?? null,
    status: "active",
    catalogSource: "supabase",
    updatedAt: readString(input.row, ["last_verified_at", "updated_at"]) ?? null,
  }
}

function unavailableCatalog(reason: string): V3Catalog {
  return { programs: [], cities: [], source: "unavailable", warnings: [reason] }
}

function isActivePublicProgram(row: Row, today: string): boolean {
  return isPublicV3ProgramRow(row, today)
}

function mapCity(row: Row): readonly V3CatalogCity[] {
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
    catalogSource: "supabase",
  }]
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
    const status = readString(row, ["status"])?.toLowerCase() ?? "unknown"
    if (["inactive", "cancelled", "canceled", "archived", "deleted"].includes(status)) continue
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
    if (typeof value === "string" && /^\s*-?[\d,.]+\s*$/.test(value)) {
      const parsed = Number(value.replace(/,/g, ""))
      if (Number.isFinite(parsed)) return parsed
    }
  }
  return undefined
}

function positiveNumber(value: number | null | undefined): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined
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
