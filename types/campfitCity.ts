import type { RegionGroup } from "@/types/campfitV2"

export const cityDataQualities = ["city_data", "region_inferred", "fallback_direction", "needs_verification"] as const
export type CityDataQuality = (typeof cityDataQualities)[number]
export type CityRegionGroup = RegionGroup | "unknown"

export type CityFitProfile = {
  readonly cityId: string
  readonly slug?: string
  readonly cityName: string
  readonly countryName: string
  readonly regionGroup: CityRegionGroup
  readonly cityPageUrl?: string
  readonly languageFitNotes?: readonly string[]
  readonly visaNotes?: readonly string[]
  readonly livingCostNotes?: readonly string[]
  readonly weatherNotes?: readonly string[]
  readonly safetyNotes?: readonly string[]
  readonly medicalAccessNotes?: readonly string[]
  readonly koreanCommunityNotes?: readonly string[]
  readonly monthlyLivingCostKrwMin?: number
  readonly monthlyLivingCostKrwMax?: number
  readonly flightPerPersonKrwMin?: number
  readonly flightPerPersonKrwMax?: number
  readonly parentStayFit?: number
  readonly beginnerEnglishFit?: number
  readonly schoolingFit?: number
  readonly familyEslFit?: number
  readonly managedCampFit?: number
  readonly koreanSupportLikelihood?: number
  readonly budgetPressure?: number
  readonly safetyComfort?: number
  readonly medicalAccess?: number
  readonly livingCostLevel?: number
  readonly weatherComfort?: number
  readonly culturalExposure?: number
  readonly activityFit?: number
  readonly travelBurden?: number
  readonly dataQuality: CityDataQuality
  readonly sourceFields?: readonly string[]
  readonly notes: readonly string[]
  readonly verifyBeforeConsulting: readonly string[]
}

export type DestinationRecommendationV2 = {
  readonly key: string
  readonly title: string
  readonly cityName?: string
  readonly countryName?: string
  readonly regionGroup: CityRegionGroup
  readonly score: number
  readonly fitLabel: string
  readonly whyFits: readonly string[]
  readonly tradeoffs: readonly string[]
  readonly verifyBeforeConsulting: readonly string[]
  readonly cityPageUrl?: string
  readonly dataQuality: CityDataQuality
}
