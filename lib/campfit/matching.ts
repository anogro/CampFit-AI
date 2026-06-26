import { camps } from "@/data/campfit/camps"
import type {
  Camp,
  CampReadinessResult,
  CampRecommendation,
  CampfitInput,
  FitType,
  ParentAnalysis,
  ProgramType,
  RecommendationExplanation,
  SupportKey,
} from "@/types/campfit"
import { calculateDestinationFit, calculateTravelFit } from "@/lib/campfit/destinationFit"
import { average, clamp01, toPercentScore, weightedAverage } from "@/lib/campfit/utils"

const budgetMaxByRange = {
  under_3m: 3000000,
  "3m_5m": 5000000,
  "5m_8m": 8000000,
  over_8m: Number.POSITIVE_INFINITY,
} as const

export type MatchInput = {
  readonly input: CampfitInput
  readonly analysis: ParentAnalysis
  readonly readiness: CampReadinessResult
}

export function recommendCamps(matchInput: MatchInput): readonly CampRecommendation[] {
  const candidates = camps.filter((camp) => passesHardFilters(camp, matchInput.input))

  return candidates
    .map((camp) => scoreCamp(camp, matchInput))
    .sort((left, right) => right.score - left.score)
    .slice(0, 3)
}

export function buildNoCandidateMessage(input: CampfitInput): string {
  const hints = [
    "예산 상한",
    "희망 기간",
    input.koreanManagerRequired === "required" ? "한국인 관리자 필수 조건" : "",
    input.parentAccompanied === "required" ? "부모 동반 필수 조건" : "",
  ].filter((hint) => hint.length > 0)

  return `현재 조건에서는 추천 후보가 부족합니다. ${hints.join(", ")} 중 하나를 완화하면 더 넓은 선택지를 비교할 수 있습니다.`
}

function passesHardFilters(camp: Camp, input: CampfitInput): boolean {
  if (input.childAge < camp.ageMin || input.childAge > camp.ageMax) {
    return false
  }

  if (camp.budgetMinKrw > budgetMaxByRange[input.budgetRange]) {
    return false
  }

  if (!camp.durationWeeks.includes(input.durationWeeks)) {
    return false
  }

  if (input.koreanManagerRequired === "required" && !camp.koreanManager) {
    return false
  }

  if (input.parentAccompanied === "required" && !camp.parentAccompanied) {
    return false
  }

  return true
}

function scoreCamp(camp: Camp, matchInput: MatchInput): CampRecommendation {
  const goalFit = calculateGoalFit(camp, matchInput.analysis, matchInput.input.preferredProgramType)
  const supportFit = calculateSupportFit(camp, [
    ...matchInput.analysis.supportNeeded,
    ...matchInput.readiness.recommendedSupport,
  ])
  const challengeLoad = calculateChallengeLoad(camp)
  const childReadiness = calculateChildReadiness(matchInput.analysis, matchInput.readiness)
  const supportBuffer = calculateSupportBuffer(camp, [
    ...matchInput.analysis.supportNeeded,
    ...matchInput.readiness.recommendedSupport,
  ])
  const destinationFit = calculateDestinationFit(camp, matchInput.input.destinationPreference)
  const travelFit = calculateTravelFit(camp, matchInput.input.travelReadiness)
  const residualRisk = clamp01(challengeLoad - childReadiness - supportBuffer * 0.45)
  const growthPotential = calculateGrowthPotential(camp, matchInput.analysis, childReadiness)
  const finalScore = clamp01(
    goalFit * 0.28 +
      supportFit * 0.21 +
      growthPotential * 0.21 +
      (1 - residualRisk) * 0.14 +
      destinationFit * 0.09 +
      travelFit * 0.07,
  )
  const fitType = classifyFit({ challengeLoad, childReadiness, supportBuffer, growthPotential })

  return {
    camp,
    fitType,
    score: toPercentScore(finalScore),
    explanation: buildRuleBasedExplanation(camp, fitType, matchInput.analysis),
    debugScores: {
      goalFit,
      supportFit,
      challengeLoad,
      childReadiness,
      residualRisk,
      growthPotential,
    },
  }
}

function calculateGoalFit(camp: Camp, analysis: ParentAnalysis, preferredProgramType: ProgramType): number {
  const programBonus = preferredProgramType === "unsure" ? 0.55 : camp.programType === preferredProgramType ? 1 : 0.5
  const goal = analysis.parentGoal
  const difficulty = camp.difficulty

  return weightedAverage([
    { value: difficulty.englishExposure, weight: goal.englishGrowth },
    { value: 1 - Math.abs(difficulty.englishExposure - 0.62), weight: goal.confidenceGrowth },
    { value: average([difficulty.boardingIndependence, difficulty.parentSeparation]), weight: goal.independenceGrowth },
    { value: difficulty.foreignPeerInteraction, weight: goal.socialGrowth },
    { value: 1 - difficulty.parentSeparation * 0.65, weight: goal.safetyPriority },
    { value: difficulty.academicIntensity, weight: goal.academicResultPriority },
    { value: average([difficulty.foreignPeerInteraction, 1 - difficulty.academicIntensity * 0.45]), weight: goal.experiencePriority },
    { value: programBonus, weight: 0.6 },
  ])
}

function calculateSupportFit(camp: Camp, supportNeeded: readonly SupportKey[]): number {
  if (supportNeeded.length === 0) {
    return 0.55
  }

  return average(supportNeeded.map((key) => camp.supportBuffer[key]))
}

function calculateChallengeLoad(camp: Camp): number {
  return weightedAverage([
    { value: camp.difficulty.englishExposure, weight: 0.26 },
    { value: camp.difficulty.boardingIndependence, weight: 0.2 },
    { value: camp.difficulty.academicIntensity, weight: 0.2 },
    { value: camp.difficulty.foreignPeerInteraction, weight: 0.16 },
    { value: camp.difficulty.parentSeparation, weight: 0.18 },
  ])
}

function calculateChildReadiness(analysis: ParentAnalysis, readiness: CampReadinessResult): number {
  const readinessScore = average([
    readiness.basicInstructionUnderstanding,
    readiness.helpRequestAbility,
    readiness.survivalExpression,
    readiness.peerInteractionReadiness,
    readiness.basicSelfExpression,
    readiness.communicationAttemptTendency,
    1 - readiness.englishAnxietySignal,
  ])

  return weightedAverage([
    { value: analysis.childProfile.englishReadiness, weight: 0.2 },
    { value: analysis.childProfile.socialConfidence, weight: 0.16 },
    { value: analysis.childProfile.separationTolerance, weight: 0.18 },
    { value: analysis.childProfile.newEnvironmentAdaptability, weight: 0.14 },
    { value: analysis.childProfile.challengeTolerance, weight: 0.12 },
    { value: readinessScore, weight: 0.2 },
  ])
}

function calculateSupportBuffer(camp: Camp, supportNeeded: readonly SupportKey[]): number {
  const baseSupport = average([
    camp.koreanManager ? 0.8 : 0.25,
    camp.beginnerClass ? 0.75 : 0.25,
    camp.buddySystem ? 0.66 : 0.28,
    camp.smallGroupCare ? 0.68 : 0.3,
  ])

  if (supportNeeded.length === 0) {
    return baseSupport
  }

  return average([baseSupport, calculateSupportFit(camp, supportNeeded)])
}

function calculateGrowthPotential(camp: Camp, analysis: ParentAnalysis, childReadiness: number): number {
  const goalAmbition = average([
    analysis.parentGoal.englishGrowth,
    analysis.parentGoal.confidenceGrowth,
    analysis.parentGoal.independenceGrowth,
    analysis.parentGoal.socialGrowth,
  ])
  const productiveChallenge = 1 - Math.abs(calculateChallengeLoad(camp) - (childReadiness + 0.18))

  return clamp01(goalAmbition * 0.48 + productiveChallenge * 0.52)
}

function classifyFit(input: {
  readonly challengeLoad: number
  readonly childReadiness: number
  readonly supportBuffer: number
  readonly growthPotential: number
}): FitType {
  const residual = input.challengeLoad - input.childReadiness - input.supportBuffer * 0.45

  if (residual > 0.24) {
    return "overreach"
  }

  if (input.challengeLoad < input.childReadiness - 0.2 && input.growthPotential < 0.62) {
    return "underchallenge"
  }

  if (input.challengeLoad > input.childReadiness + 0.06) {
    return "stretch"
  }

  return "comfort"
}

function buildRuleBasedExplanation(
  camp: Camp,
  fitType: FitType,
  analysis: ParentAnalysis,
): RecommendationExplanation {
  const goalText = topGoalText(analysis)
  const supportText = camp.traits.slice(0, 3).join(", ")

  return {
    reason: `${goalText} 목표와 ${camp.name}의 ${supportText} 특성이 잘 맞습니다. 아이의 현재 준비도만으로 배제하기보다 완충장치와 도전 강도를 함께 볼 때 비교 가치가 있습니다.`,
    caution: cautionByFitType(fitType, camp),
    questionsBeforeConsultation: [
      "초급반 또는 적응 지원이 실제로 어떤 방식으로 운영되는지 확인해 주세요.",
      camp.parentAccompanied
        ? "부모님과 떨어져 참여하는 시간이 하루에 어느 정도인지 확인해 주세요."
        : "초기 3-5일 생활 적응을 누가 어떻게 확인하는지 상담 전에 물어보세요.",
      "최종 비용에 포함되지 않는 교재, 액티비티, 생활 관리 비용이 있는지 확인해 주세요.",
    ],
  }
}

function topGoalText(analysis: ParentAnalysis): string {
  const goals = [
    { label: "영어 노출 확대", value: analysis.parentGoal.englishGrowth },
    { label: "자신감 회복", value: analysis.parentGoal.confidenceGrowth },
    { label: "독립심 성장", value: analysis.parentGoal.independenceGrowth },
    { label: "또래 교류", value: analysis.parentGoal.socialGrowth },
    { label: "안정적 적응", value: analysis.parentGoal.safetyPriority },
  ]
  const sorted = goals.sort((left, right) => right.value - left.value)
  return sorted[0]?.label ?? "캠프 적응"
}

function cautionByFitType(fitType: FitType, camp: Camp): string {
  switch (fitType) {
    case "comfort":
      return "안정적으로 시작하기 좋은 선택입니다. 다만 영어 성장 목표가 강하다면 실제 영어 노출 시간과 수업 밀도를 확인해야 합니다."
    case "stretch":
      return "도전 요소가 있지만 완충장치가 함께 있어 성장형 선택지가 될 수 있습니다. 초기 적응 지원과 생활 보고 체계를 확인해 주세요."
    case "overreach":
      return "현재 준비도 대비 부담이 커질 수 있습니다. 기간을 줄이거나 한국어 지원, 초급반, 버디 제도를 강화한 조건으로 조정하는 편이 좋습니다."
    case "underchallenge":
      return "안정성은 높지만 성장 자극이 부족할 수 있습니다. 영어 노출과 현지 또래 교류가 충분한지 확인해 주세요."
  }
}
