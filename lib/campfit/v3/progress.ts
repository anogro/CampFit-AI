import type { CampfitV3BasicInfo, CampfitV3ConversationState, CampfitV3FactKey } from "@/types/campfitV3"

const weightedSlots: readonly { readonly key: CampfitV3FactKey; readonly weight: number }[] = [
  { key: "childEnglishLevel", weight: 7 },
  { key: "isFirstOverseasEducationExperience", weight: 3 },
  { key: "dayProgramSeparationReadiness", weight: 2 },
  { key: "experienceGoals", weight: 15 },
  { key: "preferredRegions", weight: 6 },
  { key: "regionImportance", weight: 4 },
  { key: "koreanSupportNeed", weight: 6 },
  { key: "parentCommunicationNeed", weight: 6 },
  { key: "parentStayGoals", weight: 10 },
  { key: "specialCareFollowUp", weight: 6 },
]

export function calculateProgress(basicInfo: CampfitV3BasicInfo, state: CampfitV3ConversationState): number {
  const basicCredit = basicInfo.childAges.length && basicInfo.adultCount >= 1 ? 35 : 0
  const factCredit = weightedSlots.reduce((sum, slot) => {
    const fact = state.facts[slot.key]
    if (slot.key === "dayProgramSeparationReadiness" && state.facts.isFirstOverseasEducationExperience?.value === false) return sum + slot.weight
    if (!fact || fact.status === "unknown" || fact.status === "tentative" || state.conflicts.some((conflict) => conflict.key === slot.key)) return sum
    if (fact.source === "ai_inference") return sum + (fact.confidence >= 0.85 ? slot.weight * 0.5 : 0)
    return sum + slot.weight
  }, 0)
  return Math.min(100, Math.round(basicCredit + factCredit))
}

export function isReadyForRecommendation(state: CampfitV3ConversationState): boolean {
  const core: readonly CampfitV3FactKey[] = [
    "childEnglishLevel",
    "experienceGoals",
    "preferredRegions",
    "parentStayGoals",
    "specialCareFollowUp",
  ]
  return core.every((key) => {
    const fact = state.facts[key]
    return fact !== undefined
      && fact.status !== "unknown"
      && fact.status !== "tentative"
      && !state.conflicts.some((conflict) => conflict.key === key)
  })
}

export function progressMessage(progress: number): string {
  if (progress >= 100) return "상담이 완료됐어요. 결과를 확인해 주세요"
  if (progress >= 90) return "이제 결과에 필요한 마지막 조건을 확인하고 있어요"
  if (progress >= 70) return "가족에게 필요한 지원과 도시 조건을 살펴보고 있어요"
  if (progress >= 50) return "가족의 기본 조건을 확인했어요"
  return "아이와 가족이 원하는 경험을 정리하고 있어요"
}
