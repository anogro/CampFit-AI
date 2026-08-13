import type { CampfitV3BasicInfo, CampfitV3ConversationState, CampfitV3FactKey } from "@/types/campfitV3"
import { assessEnglishReadiness } from "@/lib/campfit/v3/englishReadiness"
import { activityRecommendationSufficiency } from "@/lib/campfit/v3/activityPreferences"
import { hasParentExperienceNeeds } from "@/lib/campfit/v3/parentExperienceNeeds"

export type CampfitV3CoreRecommendationReadiness = {
  readonly parentExperienceNeeds: boolean
  readonly englishReadiness: boolean
  readonly activityPreferences: boolean
  readonly preferredRegion: boolean
  readonly completeCount: number
  readonly ready: boolean
}

export function calculateProgress(basicInfo: CampfitV3BasicInfo, state: CampfitV3ConversationState): number {
  const basicCredit = basicInfo.childAges.length && basicInfo.adultCount >= 1 ? 35 : 0
  if (basicCredit === 0) return 0
  const readiness = coreRecommendationReadiness(state)
  if (readiness.ready) return 100
  return Math.min(100, basicCredit + Math.round((65 * readiness.completeCount) / 4))
}

export function isReadyForRecommendation(state: CampfitV3ConversationState): boolean {
  return coreRecommendationReadiness(state).ready
}

export function coreRecommendationReadiness(state: CampfitV3ConversationState): CampfitV3CoreRecommendationReadiness {
  const parentExperienceNeeds = isParentExperienceNeedsSufficient(state)
  const englishReadiness = isEnglishReadinessSufficient(state)
  const activityPreferences = isActivityPreferenceSufficient(state)
  const preferredRegion = isPreferredRegionResolved(state)
  const completeCount = [parentExperienceNeeds, englishReadiness, activityPreferences, preferredRegion].filter(Boolean).length
  return {
    parentExperienceNeeds,
    englishReadiness,
    activityPreferences,
    preferredRegion,
    completeCount,
    ready: completeCount === 4,
  }
}

export function isParentExperienceNeedsSufficient(state: CampfitV3ConversationState): boolean {
  const parentNeeds = state.facts.parentExperienceNeeds
  if (isStableFact(state, "parentExperienceNeeds") && hasParentExperienceNeeds(parentNeeds?.value)) return true

  // Keep quick-reply and older persisted experienceGoals states compatible
  // while natural-language turns use the richer parentExperienceNeeds shape.
  const legacyGoals = state.facts.experienceGoals?.value
  return isStableFact(state, "experienceGoals") && hasMeaningfulExperienceGoals(legacyGoals)
}

export function isActivityPreferenceSufficient(state: CampfitV3ConversationState): boolean {
  const fact = state.facts.activityPreferences
  return isStableFact(state, "activityPreferences")
    && (fact?.status === "confirmed" || activityRecommendationSufficiency(fact?.value))
}

export function isPreferredRegionResolved(state: CampfitV3ConversationState): boolean {
  if (isStableFact(state, "preferredRegions")) {
    const value = state.facts.preferredRegions?.value
    if (Array.isArray(value)) return true
  }
  return isStableFact(state, "excludedRegions") && Array.isArray(state.facts.excludedRegions?.value)
}

export function isEnglishReadinessSufficient(state: CampfitV3ConversationState): boolean {
  return assessEnglishReadiness(state).recommendationSufficiency
}

export function progressMessage(progress: number): string {
  if (progress >= 100) return "추천에 필요한 조건을 정리했어요. 결과를 확인해 주세요"
  if (progress >= 85) return "추천에 필요한 핵심 기준을 거의 정리했어요"
  if (progress >= 68) return "아이에게 맞는 활동과 지역을 살펴보고 있어요"
  if (progress >= 51) return "가족이 원하는 경험과 영어 준비도를 정리하고 있어요"
  return "아이와 가족이 원하는 경험을 정리하고 있어요"
}

function isStableFact(state: CampfitV3ConversationState, key: CampfitV3FactKey): boolean {
  const fact = state.facts[key]
  return fact !== undefined
    && fact.status !== "unknown"
    && fact.status !== "tentative"
    && !state.conflicts.some((conflict) => conflict.key === key)
}

function hasMeaningfulExperienceGoals(value: unknown): boolean {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false
  return Object.values(value as Record<string, unknown>).some((item) => item !== "none" && item !== "unspecified" && item !== null && item !== undefined)
}
