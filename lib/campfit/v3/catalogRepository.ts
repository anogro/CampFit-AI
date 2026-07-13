import "server-only"

import { loadCampfitProgramCatalog } from "@/lib/campfit/supabaseProgramCatalog"
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
}

export type V3CatalogProgram = {
  readonly id: string
  readonly slug: string | null
  readonly name: string
  readonly city: string
  readonly country: string
  readonly programType: Camp["programType"]
  readonly ageMin: number
  readonly ageMax: number
  readonly durationWeeks: readonly number[]
  readonly parentAccompanied: boolean
  readonly koreanManager: boolean | null
  readonly beginnerClass: boolean | null
  readonly dailyParentReport: boolean | null
  readonly traits: readonly string[]
  readonly budgetMinKrw: number | null
  readonly budgetMaxKrw: number | null
  readonly priceOptions: readonly V3PriceOption[]
  readonly imageUrl: string | null
}

export type V3CatalogCity = {
  readonly id: string
  readonly slug: string | null
  readonly name: string
  readonly country: string
  readonly regionGroup: CityRegionGroup
  readonly imageUrl: string | null
  readonly description: string | null
  readonly flightCostKrw: number | null
  readonly livingCostMonthlyKrw: number | null
  readonly housingCostMonthlyKrw: number | null
}

export type V3Catalog = {
  readonly programs: readonly V3CatalogProgram[]
  readonly cities: readonly V3CatalogCity[]
}

type Row = Record<string, unknown>

export async function loadV3Catalog(): Promise<V3Catalog> {
  const legacyPrograms = await loadCampfitProgramCatalog()
  const client = createServerSupabaseClient()
  if (client === null) return fallbackCatalog(legacyPrograms)

  const [programResult, priceResult, profileResult, cityResult] = await Promise.all([
    client.from("programs").select("*"),
    client.from("program_price_options").select("*"),
    client.from("campfit_program_profiles").select("*"),
    client.from("Cities").select("*"),
  ])
  const programRows = safeRows(programResult.data, programResult.error, "programs")
  const priceRows = safeRows(priceResult.data, priceResult.error, "program_price_options")
  const profileRows = safeRows(profileResult.data, profileResult.error, "campfit_program_profiles")
  const cityRows = safeRows(cityResult.data, cityResult.error, "Cities")
  if (!programRows.length) return fallbackCatalog(legacyPrograms)

  const legacyById = new Map(legacyPrograms.map((program) => [program.id, program]))
  const profileById = new Map(profileRows.map((row) => [readString(row, ["program_id"]) ?? "", row]))
  const pricesById = groupPrices(priceRows)
  const programs = programRows.flatMap((row): readonly V3CatalogProgram[] => {
    const id = readString(row, ["id"])
    if (!id || readBoolean(row, ["visible"]) === false || readBoolean(row, ["is_listed"]) === false) return []
    const legacy = legacyById.get(id)
    const profile = profileById.get(id)
    const name = readString(row, ["name", "title"])
    const city = readString(row, ["location_city", "city"])
    const country = readString(row, ["location_country", "country"])
    if (!name || !city || !country) return []
    const parentAccompanied = legacy?.parentAccompanied ?? readBoolean(profile, ["parent_accompanied"]) ?? inferParentAccompanied(row)
    if (!parentAccompanied) return []
    const durations = durationNumbers(pricesById.get(id) ?? [], legacy?.durationWeeks ?? [])
    return [{
      id,
      slug: readString(row, ["slug"]) ?? null,
      name,
      city,
      country,
      programType: legacy?.programType ?? inferProgramType(row),
      ageMin: legacy?.ageMin ?? readNumber(row, ["age_min"]) ?? 5,
      ageMax: legacy?.ageMax ?? readNumber(row, ["age_max"]) ?? 12,
      durationWeeks: durations,
      parentAccompanied,
      koreanManager: legacy?.koreanManager ?? readBoolean(profile, ["korean_manager"]) ?? null,
      beginnerClass: legacy?.beginnerClass ?? readBoolean(profile, ["beginner_class"]) ?? null,
      dailyParentReport: legacy?.dailyParentReport ?? readBoolean(profile, ["daily_parent_report"]) ?? null,
      traits: legacy?.traits ?? readStringArray(profile, ["traits"]),
      budgetMinKrw: positiveNumber(legacy?.budgetMinKrw) ?? positiveNumber(readNumber(profile, ["budget_min_krw"])) ?? positiveNumber(readNumber(row, ["minimum_price_value", "base_price_value"])) ?? null,
      budgetMaxKrw: positiveNumber(legacy?.budgetMaxKrw) ?? positiveNumber(readNumber(profile, ["budget_max_krw"])) ?? positiveNumber(readNumber(row, ["base_price_value"])) ?? null,
      priceOptions: pricesById.get(id) ?? [],
      imageUrl: readImage(row) ?? null,
    }]
  })
  const cities = cityRows.flatMap(mapCity)
  return { programs: programs.length ? programs : fallbackCatalog(legacyPrograms).programs, cities: cities.length ? cities : deriveCities(programs) }
}

function fallbackCatalog(programs: readonly Camp[]): V3Catalog {
  const mapped = programs.filter((program) => program.parentAccompanied).map((program): V3CatalogProgram => ({
    id: program.id,
    slug: program.anogroProgramSlug ?? null,
    name: program.name,
    city: program.city,
    country: program.country,
    programType: program.programType,
    ageMin: program.ageMin,
    ageMax: program.ageMax,
    durationWeeks: durationNumbers([], program.durationWeeks),
    parentAccompanied: true,
    koreanManager: program.koreanManager,
    beginnerClass: program.beginnerClass,
    dailyParentReport: program.dailyParentReport,
    traits: program.traits,
    budgetMinKrw: positiveNumber(program.budgetMinKrw) ?? null,
    budgetMaxKrw: positiveNumber(program.budgetMaxKrw) ?? null,
    priceOptions: [],
    imageUrl: null,
  }))
  return { programs: mapped, cities: deriveCities(mapped) }
}

function mapCity(row: Row): readonly V3CatalogCity[] {
  if (readBoolean(row, ["is_listed"]) === false) return []
  const id = readString(row, ["id"])
  const name = readString(row, ["City name", "name", "city_name", "title"])
  const country = readString(row, ["Country", "country", "country_name"])
  if (!id || !name || !country) return []
  return [{
    id,
    slug: readString(row, ["slug", "city_slug"]) ?? null,
    name,
    country,
    regionGroup: inferCityRegionGroup(country),
    imageUrl: readImage(row) ?? null,
    description: readString(row, ["Description", "long Description", "Local Insight / Notes"]) ?? null,
    flightCostKrw: readNumber(row, ["Flight Cost KRW"]) ?? null,
    livingCostMonthlyKrw: readNumber(row, ["LivingCost KRW"]) ?? null,
    housingCostMonthlyKrw: readNumber(row, ["HousingCost KRW"]) ?? null,
  }]
}

function deriveCities(programs: readonly V3CatalogProgram[]): readonly V3CatalogCity[] {
  const pairs = new Map<string, { readonly city: string; readonly country: string }>()
  for (const program of programs) pairs.set(`${program.city}|${program.country}`, { city: program.city, country: program.country })
  return Array.from(pairs.values()).map((item) => ({
    id: `${item.country}-${item.city}`.toLowerCase().replace(/\s+/g, "-"),
    slug: null,
    name: item.city,
    country: item.country,
    regionGroup: inferCityRegionGroup(item.country),
    imageUrl: null,
    description: null,
    flightCostKrw: null,
    livingCostMonthlyKrw: null,
    housingCostMonthlyKrw: null,
  }))
}

function safeRows(data: unknown, error: { readonly message: string } | null, label: string): readonly Row[] {
  if (error) {
    console.error(`CampFit v3 ${label} read failed`, error.message)
    return []
  }
  return Array.isArray(data) ? data.filter((item): item is Row => typeof item === "object" && item !== null) : []
}

function groupPrices(rows: readonly Row[]): ReadonlyMap<string, readonly V3PriceOption[]> {
  const map = new Map<string, V3PriceOption[]>()
  for (const row of rows) {
    if (readString(row, ["status"]) === "inactive") continue
    const id = readString(row, ["program_id"])
    if (!id) continue
    const item: V3PriceOption = {
      adultCount: readNumber(row, ["adult_count"]) ?? null,
      childCount: readNumber(row, ["child_count"]) ?? null,
      durationWeeks: readNumber(row, ["duration_weeks"]) ?? null,
      currency: readString(row, ["currency"]) ?? null,
      priceValue: positiveNumber(readNumber(row, ["price_value"])) ?? null,
    }
    map.set(id, [...(map.get(id) ?? []), item])
  }
  return map
}

function durationNumbers(prices: readonly V3PriceOption[], legacy: readonly DurationWeeks[]): readonly number[] {
  const fromPrices = prices.flatMap((price) => price.durationWeeks === null ? [] : [price.durationWeeks])
  const fromLegacy = legacy.flatMap((value) => value === "1w" ? [1] : value === "2w" ? [2] : value === "3_4w" ? [3, 4] : [])
  return Array.from(new Set([...fromPrices, ...fromLegacy])).sort((a, b) => a - b)
}

function inferProgramType(row: Row): Camp["programType"] {
  const text = `${readString(row, ["program_type", "program_focus", "title", "name"]) ?? ""}`.toLowerCase()
  if (/school|스쿨|국제학교/.test(text)) return "schooling"
  if (/family|가족/.test(text)) return "family_esl"
  if (/stem|project|creative|코딩|예술/.test(text)) return "creative_daycamp"
  if (/activity|문화|액티비티/.test(text)) return "activity"
  return "family_esl"
}

function inferParentAccompanied(row: Row): boolean {
  const text = `${readString(row, ["parent_participation_type", "accommodation_type", "program_type", "title", "name"]) ?? ""}`.toLowerCase()
  if (/boarding|기숙|homestay|홈스테이|unaccompanied|단독/.test(text)) return false
  return /parent|family|guardian|부모|가족|보호자|day/.test(text)
}

function readImage(row: Row): string | undefined {
  for (const key of ["thumb_url", "cover_image_url", "hero_image_url", "Picture", "picture", "image_url"]) {
    const value = row[key]
    const found = imageValue(value)
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

function readNumber(row: Row | undefined, keys: readonly string[]): number | undefined {
  if (!row) return undefined
  for (const key of keys) {
    const value = row[key]
    if (typeof value === "number" && Number.isFinite(value)) return value
    if (typeof value === "string") {
      const parsed = Number(value.replace(/[^\d.-]/g, ""))
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
