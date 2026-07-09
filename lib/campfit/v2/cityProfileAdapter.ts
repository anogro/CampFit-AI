import type { CityFitProfile, CityRegionGroup } from "@/types/campfitCity"

type CityRow = Record<string, unknown>

const southeastAsiaCountries = ["Philippines", "Malaysia", "Singapore", "Thailand", "Vietnam", "Indonesia", "Taiwan", "Japan"] as const
const oceaniaCountries = ["Australia", "New Zealand"] as const
const northAmericaCountries = ["USA", "United States", "Canada"] as const
const europeCountries = ["UK", "United Kingdom", "Ireland", "Malta", "France", "Germany", "Spain", "Portugal", "Denmark", "Netherlands"] as const
const domesticCountries = ["Korea", "South Korea", "Republic of Korea"] as const

export function toCityFitProfile(row: CityRow): CityFitProfile | null {
  const cityId = readString(row, ["id"])
  const cityName = readString(row, ["City name", "name", "city_name", "cityName", "title"])
  const countryName = readString(row, ["Country", "country", "country_name", "countryName"])
  if (cityId === undefined || cityName === undefined || countryName === undefined) return null

  const slug = readString(row, ["slug", "city_slug"])
  const description = readString(row, ["Description", "long Description"])
  const language = readString(row, ["Main Language", "Spoken Languages"])
  const visa = readString(row, ["Visa Type(Korean)"])
  const climate = readString(row, ["Climate note", "Suggested Display"])
  const safety = readString(row, ["Safety Level"])
  const medical = readString(row, ["Medical Access"])
  const koreanDensity = readString(row, ["Korean Population Density"])
  const localInsight = readString(row, ["Local Insight / Notes"])
  const schools = readString(row, ["Schools"])
  const style = readString(row, ["style"])
  const livingCost = readKrwNumber(row, ["LivingCost KRW", "monthly_living_cost_krw", "living_cost_krw_min"])
  const housingCost = readKrwNumber(row, ["HousingCost KRW", "housing_cost_krw", "housing_cost_krw_min"])
  const flightCost = readKrwNumber(row, ["Flight Cost KRW", "flight_per_person_krw_min", "airfare_krw_min", "avg_flight_krw_min"])
  const sourceFields = usedFields(row)
  const regionGroup = readRegion(row) ?? inferCityRegionGroup(countryName)
  const monthlyLivingCostKrwMax = livingCost === undefined ? undefined : livingCost + (housingCost ?? 0)
  const verifyBeforeConsulting = [
    ...(flightCost === undefined ? ["항공권 비용은 상담 전 확인이 필요합니다."] : ["항공권 비용은 비교용 추정으로만 확인하세요."]),
    "실제 캠프 공급과 숙소 조건은 상담 전 확인이 필요합니다.",
  ]

  return {
    cityId,
    ...(slug === undefined ? {} : { slug, cityPageUrl: `/cities/${slug}` }),
    cityName,
    countryName,
    regionGroup,
    ...(language === undefined ? {} : { languageFitNotes: [`주요 언어: ${language}`] }),
    ...(visa === undefined ? {} : { visaNotes: [visa] }),
    ...(livingCost === undefined ? {} : { monthlyLivingCostKrwMin: livingCost }),
    ...(monthlyLivingCostKrwMax === undefined ? {} : { monthlyLivingCostKrwMax }),
    ...(flightCost === undefined ? {} : { flightPerPersonKrwMin: flightCost, flightPerPersonKrwMax: flightCost }),
    ...(climate === undefined ? {} : { weatherNotes: [climate] }),
    ...(safety === undefined ? {} : { safetyNotes: [safety] }),
    ...(medical === undefined ? {} : { medicalAccessNotes: [medical] }),
    ...(koreanDensity === undefined ? {} : { koreanCommunityNotes: [`한국인 밀도: ${koreanDensity}`] }),
    parentStayFit: scoreParentStay(livingCost, housingCost, safety),
    beginnerEnglishFit: scoreBeginnerEnglish(language, regionGroup, style),
    schoolingFit: scoreSchooling(schools, language, regionGroup),
    familyEslFit: scoreFamilyEsl(livingCost, housingCost, language, safety),
    managedCampFit: scoreManagedCamp(regionGroup, koreanDensity, localInsight),
    koreanSupportLikelihood: scoreKoreanSupport(koreanDensity),
    budgetPressure: scoreBudgetPressure(livingCost, housingCost, flightCost),
    safetyComfort: scoreSafety(safety),
    medicalAccess: scoreMedical(medical),
    livingCostLevel: scoreLivingCost(livingCost, housingCost),
    weatherComfort: scoreWeather(climate),
    culturalExposure: scoreCulturalExposure(row),
    activityFit: scoreActivityFit(description, localInsight, style),
    travelBurden: scoreTravelBurden(regionGroup, flightCost),
    dataQuality: "city_data",
    sourceFields,
    notes: [
      ...(description === undefined ? [] : [description]),
      ...(localInsight === undefined ? [] : [localInsight]),
    ],
    verifyBeforeConsulting,
  }
}

export function inferCityRegionGroup(countryName: string): CityRegionGroup {
  if (containsCountry(oceaniaCountries, countryName)) return "oceania"
  if (containsCountry(southeastAsiaCountries, countryName)) return "southeast_asia"
  if (containsCountry(northAmericaCountries, countryName)) return "north_america"
  if (containsCountry(europeCountries, countryName)) return "europe"
  if (containsCountry(domesticCountries, countryName)) return "domestic"
  return "unknown"
}

function readRegion(row: CityRow): CityRegionGroup | undefined {
  const value = readString(row, ["region_group", "regionGroup", "region"])
  if (value === undefined) return undefined
  switch (value) {
    case "southeast_asia":
    case "oceania":
    case "north_america":
    case "europe":
    case "domestic":
    case "no_preference":
    case "undecided":
    case "unknown":
      return value
    default:
      return undefined
  }
}

function readString(row: CityRow, keys: readonly string[]): string | undefined {
  for (const key of keys) {
    const value = row[key]
    if (typeof value === "string" && value.trim().length > 0) return value.trim()
  }
  return undefined
}

function readKrwNumber(row: CityRow, keys: readonly string[]): number | undefined {
  for (const key of keys) {
    const value = row[key]
    const parsed = parseKrwNumber(value)
    if (parsed !== undefined) return parsed
  }
  return undefined
}

function parseKrwNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value)
  if (typeof value !== "string") return undefined
  const digits = value.replace(/[^\d.]/g, "")
  if (digits.length === 0) return undefined
  const parsed = Number(digits)
  return Number.isFinite(parsed) ? Math.round(parsed) : undefined
}

function usedFields(row: CityRow): readonly string[] {
  return Object.entries(row)
    .filter(([, value]) => value !== null && value !== undefined && String(value).trim().length > 0)
    .map(([key]) => key)
}

function scoreParentStay(livingCost: number | undefined, housingCost: number | undefined, safety: string | undefined): number {
  return clampScore((100 - scoreLivingCost(livingCost, housingCost)) * 0.55 + scoreSafety(safety) * 0.45)
}

function scoreBeginnerEnglish(language: string | undefined, regionGroup: CityRegionGroup, style: string | undefined): number {
  const englishFit = language?.toLowerCase().includes("english") ? 78 : 52
  const regionBoost = regionGroup === "oceania" || regionGroup === "north_america" || regionGroup === "europe" ? 8 : 0
  const flexibleBoost = style?.includes("유연") ? 8 : 0
  return clampScore(englishFit + regionBoost + flexibleBoost)
}

function scoreSchooling(schools: string | undefined, language: string | undefined, regionGroup: CityRegionGroup): number {
  const schoolCount = schools?.split(",").filter((item) => item.trim().length > 0).length ?? 0
  const languageBoost = language?.toLowerCase().includes("english") ? 8 : 0
  const regionBoost = regionGroup === "oceania" || regionGroup === "north_america" || regionGroup === "europe" ? 10 : 0
  return clampScore(48 + Math.min(28, schoolCount * 4) + languageBoost + regionBoost)
}

function scoreFamilyEsl(livingCost: number | undefined, housingCost: number | undefined, language: string | undefined, safety: string | undefined): number {
  return clampScore(scoreParentStay(livingCost, housingCost, safety) * 0.55 + (language?.toLowerCase().includes("english") ? 78 : 58) * 0.45)
}

function scoreManagedCamp(regionGroup: CityRegionGroup, koreanDensity: string | undefined, localInsight: string | undefined): number {
  const regionFit = regionGroup === "southeast_asia" ? 78 : 54
  const koreanFit = scoreKoreanSupport(koreanDensity)
  const insightBoost = localInsight?.includes("프로그램") || localInsight?.includes("캠프") ? 8 : 0
  return clampScore(regionFit * 0.6 + koreanFit * 0.4 + insightBoost)
}

function scoreKoreanSupport(koreanDensity: string | undefined): number {
  if (koreanDensity?.includes("높음")) return 86
  if (koreanDensity?.includes("중간")) return 64
  if (koreanDensity?.includes("낮음")) return 38
  return 55
}

function scoreBudgetPressure(livingCost: number | undefined, housingCost: number | undefined, flightCost: number | undefined): number {
  const monthly = (livingCost ?? 1_300_000) + (housingCost ?? 1_500_000)
  const flight = flightCost ?? 1_200_000
  return clampScore((monthly / 5_000_000) * 65 + (flight / 2_000_000) * 35)
}

function scoreSafety(safety: string | undefined): number {
  if (safety?.includes("매우안전")) return 95
  if (safety?.includes("안전")) return 86
  if (safety?.includes("일반")) return 72
  if (safety?.includes("보통")) return 64
  if (safety?.includes("주의")) return 42
  return 65
}

function scoreMedical(medical: string | undefined): number {
  if (medical?.includes("국제 병원")) return 86
  if (medical?.includes("영어 진료")) return 76
  if (medical !== undefined) return 62
  return 60
}

function scoreLivingCost(livingCost: number | undefined, housingCost: number | undefined): number {
  const monthly = (livingCost ?? 1_300_000) + (housingCost ?? 1_500_000)
  return clampScore((monthly / 5_000_000) * 100)
}

function scoreWeather(climate: string | undefined): number {
  if (climate?.includes("온화")) return 86
  if (climate?.includes("건기")) return 76
  if (climate?.includes("덥")) return 62
  if (climate?.includes("추움")) return 54
  return 66
}

function scoreCulturalExposure(row: CityRow): number {
  const culture = readString(row, ["Multiculture Index", "Description", "long Description"])
  if (culture?.includes("초다문화")) return 90
  if (culture?.includes("다문화")) return 80
  if (culture?.includes("이민국")) return 74
  return 66
}

function scoreActivityFit(description: string | undefined, localInsight: string | undefined, style: string | undefined): number {
  const text = `${description ?? ""} ${localInsight ?? ""} ${style ?? ""}`
  const matches = ["자연", "활동", "체험", "해변", "유연"].filter((keyword) => text.includes(keyword)).length
  return clampScore(58 + matches * 8)
}

function scoreTravelBurden(regionGroup: CityRegionGroup, flightCost: number | undefined): number {
  const base = regionGroup === "southeast_asia" || regionGroup === "domestic" ? 34 : regionGroup === "oceania" ? 72 : 82
  const flightPenalty = flightCost === undefined ? 8 : flightCost > 1_400_000 ? 10 : flightCost < 800_000 ? -8 : 0
  return clampScore(base + flightPenalty)
}

function containsCountry(countries: readonly string[], countryName: string): boolean {
  return countries.some((country) => country.toLowerCase() === countryName.trim().toLowerCase())
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)))
}
