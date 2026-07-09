import { koreanSupportNeed, parentAccompanimentMode, preferredProgramTypes, preferredRegions, riskSignals } from "@/lib/campfit/v2/profileAccess"
import type { CampfitV2MatchingResult } from "@/lib/campfit/v2/v2MatchingWrapper"
import type { CityFitProfile, CityRegionGroup, DestinationRecommendationV2 } from "@/types/campfitCity"
import type { ConsultingProfile, RegionGroup } from "@/types/campfitV2"

type DestinationStrategyKey = "keep_preferred_region" | "prioritize_child_fit" | "prioritize_budget_and_support"

type DestinationAdvisorInput = {
  readonly profile: ConsultingProfile
  readonly matchingResult: CampfitV2MatchingResult
  readonly cityFitProfiles: readonly CityFitProfile[]
}

type ScoredCity = {
  readonly city: CityFitProfile
  readonly score: number
}

const strategyKeys = ["keep_preferred_region", "prioritize_child_fit", "prioritize_budget_and_support"] as const

export function buildDestinationRecommendations(input: DestinationAdvisorInput): readonly DestinationRecommendationV2[] {
  if (input.cityFitProfiles.length === 0) return buildFallbackDestinationRecommendations(input.profile)

  const selected = new Set<string>()
  return strategyKeys.map((key) => {
    const scored = scoreCitiesForStrategy(key, input)
      .filter((candidate) => !selected.has(candidate.city.cityId))
      .sort((left, right) => right.score - left.score)
    const city = scored[0]
    if (city === undefined) return fallbackForStrategy(key, input.profile)
    selected.add(city.city.cityId)
    return recommendationFromCity(key, city.city, city.score, input)
  })
}

export function buildFallbackDestinationRecommendations(profile: ConsultingProfile): readonly DestinationRecommendationV2[] {
  return strategyKeys.map((key) => fallbackForStrategy(key, profile))
}

function scoreCitiesForStrategy(key: DestinationStrategyKey, input: DestinationAdvisorInput): readonly ScoredCity[] {
  return input.cityFitProfiles.map((city) => ({
    city,
    score: scoreCityForStrategy(key, city, input),
  }))
}

function scoreCityForStrategy(key: DestinationStrategyKey, city: CityFitProfile, input: DestinationAdvisorInput): number {
  const preferredRegionFit = regionFit(city.regionGroup, preferredRegions(input.profile))
  const budgetReality = 100 - (city.budgetPressure ?? 45)
  const parentStayFit = city.parentStayFit ?? 65
  const childAdaptationFit = childFit(city, input.profile)
  const beginnerEnglishFit = city.beginnerEnglishFit ?? 62
  const programSupplyFit = programFit(city, input.profile)
  const koreanSupportFit = supportFit(city, input.profile)
  const travelBurdenFit = 100 - (city.travelBurden ?? 55)
  const culturalExposureFit = city.culturalExposure ?? 68
  const safetyComfortFit = city.safetyComfort ?? 68
  const exactCandidateBump = input.matchingResult.recommendations.length > 1 ? 2 : 0

  switch (key) {
    case "keep_preferred_region":
      return clampScore(preferredRegionFit * 0.44 + programSupplyFit * 0.18 + culturalExposureFit * 0.14 + safetyComfortFit * 0.1 + beginnerEnglishFit * 0.08 + budgetReality * 0.06)
    case "prioritize_child_fit":
      return clampScore(childAdaptationFit * 0.28 + parentStayFit * 0.22 + beginnerEnglishFit * 0.18 + safetyComfortFit * 0.12 + travelBurdenFit * 0.1 + culturalExposureFit * 0.08 + exactCandidateBump)
    case "prioritize_budget_and_support":
      return clampScore(budgetReality * 0.28 + koreanSupportFit * 0.2 + parentStayFit * 0.16 + programSupplyFit * 0.14 + travelBurdenFit * 0.12 + childAdaptationFit * 0.1)
  }
}

function recommendationFromCity(
  key: DestinationStrategyKey,
  city: CityFitProfile,
  score: number,
  input: DestinationAdvisorInput,
): DestinationRecommendationV2 {
  const title = cityLabel(city)
  switch (key) {
    case "keep_preferred_region":
      return {
        key,
        title,
        cityName: city.cityName,
        countryName: city.countryName,
        regionGroup: city.regionGroup,
        score,
        fitLabel: `${regionLabel(city.regionGroup)} 선호를 유지하면서 실제 가능성을 확인해볼 방향입니다.`,
        whyFits: compactList([firstNote(city), programModeReason(city, input.profile), "처음 원한 지역 방향을 크게 흔들지 않습니다."]),
        tradeoffs: compactList([budgetTradeoff(city), supportTradeoff(city, input.profile)]),
        verifyBeforeConsulting: city.verifyBeforeConsulting.slice(0, 3),
        ...(city.cityPageUrl === undefined ? {} : { cityPageUrl: city.cityPageUrl }),
        dataQuality: city.dataQuality,
      }
    case "prioritize_child_fit":
      return {
        key,
        title,
        cityName: city.cityName,
        countryName: city.countryName,
        regionGroup: city.regionGroup,
        score,
        fitLabel: "아이의 초반 적응과 부모 체류 가능성을 우선해서 볼 방향입니다.",
        whyFits: compactList([firstNote(city), "낯선 환경 적응 부담을 낮추는 조건을 우선 비교합니다.", parentStayReason(city)]),
        tradeoffs: compactList([schoolingTradeoff(city), supportTradeoff(city, input.profile)]),
        verifyBeforeConsulting: city.verifyBeforeConsulting.slice(0, 3),
        ...(city.cityPageUrl === undefined ? {} : { cityPageUrl: city.cityPageUrl }),
        dataQuality: city.dataQuality,
      }
    case "prioritize_budget_and_support":
      return {
        key,
        title,
        cityName: city.cityName,
        countryName: city.countryName,
        regionGroup: city.regionGroup,
        score,
        fitLabel: "예산과 관리 안정성을 함께 보며 현실적인 대안을 확인할 방향입니다.",
        whyFits: compactList([firstNote(city), budgetReason(city), "관리형 캠프나 가족 체류형 선택지를 함께 확인하기 좋습니다."]),
        tradeoffs: compactList([preferredRegionTradeoff(city, input.profile), supportTradeoff(city, input.profile)]),
        verifyBeforeConsulting: city.verifyBeforeConsulting.slice(0, 3),
        ...(city.cityPageUrl === undefined ? {} : { cityPageUrl: city.cityPageUrl }),
        dataQuality: city.dataQuality,
      }
  }
}

function fallbackForStrategy(key: DestinationStrategyKey, profile: ConsultingProfile): DestinationRecommendationV2 {
  const preferredRegion = preferredRegions(profile).find((region) => region !== "undecided" && region !== "no_preference")
  switch (key) {
    case "keep_preferred_region":
      return {
        key,
        title: `${regionLabel(preferredRegion ?? "oceania")} 도시권`,
        regionGroup: preferredRegion ?? "oceania",
        score: 64,
        fitLabel: "희망 지역을 유지하되 실제 도시와 프로그램 공급은 상담에서 확인해야 합니다.",
        whyFits: ["처음 원했던 지역 방향을 유지합니다.", "프로그램 방식은 방학캠프형부터 확인하는 편이 안전합니다."],
        tradeoffs: ["항공권과 체류비는 비교용 추정이 필요합니다.", "아이 영어 부담은 프로그램 난이도와 함께 확인해야 합니다."],
        verifyBeforeConsulting: ["도시별 항공권, 체류비, 실제 캠프 공급을 상담 전 확인하세요."],
        dataQuality: "fallback_direction",
      }
    case "prioritize_child_fit":
      return {
        key,
        title: "가족 체류와 영어 노출을 함께 보기 좋은 도시권",
        regionGroup: "unknown",
        score: 66,
        fitLabel: "아이 적응을 우선하면 부모 체류와 낮은 압박 환경을 함께 봐야 합니다.",
        whyFits: ["초반 적응과 부모 동행 조건을 먼저 맞춥니다.", "영어를 시험보다 생활 속 언어로 접하는 방향입니다."],
        tradeoffs: ["정규 스쿨링 경험은 약해질 수 있습니다.", "도시별 생활 지원은 상담 전 확인해야 합니다."],
        verifyBeforeConsulting: ["부모 체류 가능 숙소와 초급 영어 지원 범위를 확인하세요."],
        dataQuality: "fallback_direction",
      }
    case "prioritize_budget_and_support":
      return {
        key,
        title: "관리형 캠프 공급이 많은 동남아 도시권",
        regionGroup: "southeast_asia",
        score: 68,
        fitLabel: "예산과 관리 안정성을 우선하면 현실성 높은 대안입니다.",
        whyFits: ["항공권과 체류비 부담을 낮추기 쉽습니다.", "한국어 소통과 생활 관리 조건을 비교하기 좋습니다."],
        tradeoffs: ["처음 원한 지역과 다를 수 있습니다.", "국제학교 정규수업보다는 관리형 영어노출에 가까울 수 있습니다."],
        verifyBeforeConsulting: ["실제 프로그램 공급, 한국어 지원 범위, 포함 비용을 확인하세요."],
        dataQuality: "fallback_direction",
      }
  }
}

function regionFit(regionGroup: CityRegionGroup, preferred: readonly RegionGroup[]): number {
  if (preferred.length === 0 || preferred.includes("undecided") || preferred.includes("no_preference")) return 72
  if (regionGroup !== "unknown" && preferred.includes(regionGroup)) return 100
  return 38
}

function childFit(city: CityFitProfile, profile: ConsultingProfile): number {
  const risks = riskSignals(profile)
  const separationWeight = risks.includes("separation_risk") ? 0.34 : 0.2
  const englishWeight = risks.includes("english_overload") ? 0.28 : 0.18
  return clampScore((city.parentStayFit ?? 65) * separationWeight + (city.beginnerEnglishFit ?? 62) * englishWeight + (city.safetyComfort ?? 68) * 0.22 + (100 - (city.travelBurden ?? 55)) * 0.16)
}

function programFit(city: CityFitProfile, profile: ConsultingProfile): number {
  const preferences = preferredProgramTypes(profile)
  if (preferences.some((value) => value.includes("school"))) return city.schoolingFit ?? 62
  if (preferences.some((value) => value.includes("family"))) return city.familyEslFit ?? 64
  if (preferences.some((value) => value.includes("managed"))) return city.managedCampFit ?? 64
  return Math.max(city.schoolingFit ?? 0, city.familyEslFit ?? 0, city.managedCampFit ?? 0, 62)
}

function supportFit(city: CityFitProfile, profile: ConsultingProfile): number {
  const supportNeed = koreanSupportNeed(profile)
  if (supportNeed === "resident_korean_manager" || supportNeed === "daily_korean_communication") {
    return city.koreanSupportLikelihood ?? 55
  }
  return Math.max(city.koreanSupportLikelihood ?? 55, 66)
}

function cityLabel(city: CityFitProfile): string {
  return `${city.cityName}, ${city.countryName}`
}

function firstNote(city: CityFitProfile): string {
  return city.notes[0] ?? `${city.cityName}의 도시 조건은 상담 전 추가 확인이 필요합니다.`
}

function programModeReason(city: CityFitProfile, profile: ConsultingProfile): string {
  const preferences = preferredProgramTypes(profile)
  if (preferences.some((value) => value.includes("school"))) return "국제학교 방학캠프나 학교 체험형 가능성을 먼저 확인합니다."
  if ((city.familyEslFit ?? 0) >= (city.managedCampFit ?? 0)) return "가족동반 ESL이나 활동형 프로그램과 함께 보기 좋습니다."
  return "관리형 영어노출 프로그램과 함께 비교하기 좋습니다."
}

function parentStayReason(city: CityFitProfile): string {
  return (city.parentStayFit ?? 0) >= 75 ? "부모 체류 현실성을 함께 볼 수 있습니다." : "부모 체류 조건은 상담 전 확인이 필요합니다."
}

function budgetReason(city: CityFitProfile): string {
  return (city.budgetPressure ?? 55) <= 45 ? "생활비와 항공권 부담을 낮춰 비교하기 좋습니다." : "비용은 낮지 않지만 관리 조건과 함께 비교할 수 있습니다."
}

function budgetTradeoff(city: CityFitProfile): string {
  return (city.budgetPressure ?? 55) >= 70 ? "항공권과 체류비 부담이 커질 수 있습니다." : "비용은 비교용 추정이므로 실제 견적 확인이 필요합니다."
}

function supportTradeoff(city: CityFitProfile, profile: ConsultingProfile): string {
  const need = koreanSupportNeed(profile)
  if (need === "not_needed") return "비상 시 소통 경로는 별도로 확인하세요."
  return (city.koreanSupportLikelihood ?? 55) >= 65 ? "한국어 지원 범위와 운영 시간을 확인하세요." : "한국어 지원 가능성은 상담 전 확인이 필요합니다."
}

function schoolingTradeoff(city: CityFitProfile): string {
  return (city.schoolingFit ?? 0) >= 75 ? "정규수업 난이도는 아이 영어 준비도와 함께 확인하세요." : "정규 스쿨링보다 가족동반 ESL이나 활동형에 가까울 수 있습니다."
}

function preferredRegionTradeoff(city: CityFitProfile, profile: ConsultingProfile): string {
  const preferred = preferredRegions(profile)
  if (city.regionGroup !== "unknown" && preferred.includes(city.regionGroup)) return "희망 지역 안에서도 비용과 지원 조건을 비교해야 합니다."
  return "처음 원한 지역과 달라질 수 있습니다."
}

function regionLabel(region: CityRegionGroup): string {
  switch (region) {
    case "southeast_asia":
      return "동남아"
    case "oceania":
      return "호주·뉴질랜드 등 오세아니아"
    case "north_america":
      return "북미"
    case "europe":
      return "유럽"
    case "domestic":
      return "국내"
    case "no_preference":
      return "지역 무관"
    case "undecided":
      return "아직 미정"
    case "unknown":
      return "검토 가능한"
  }
}

function compactList(items: readonly string[]): readonly string[] {
  return items.filter((item) => item.trim().length > 0).slice(0, 3)
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)))
}
