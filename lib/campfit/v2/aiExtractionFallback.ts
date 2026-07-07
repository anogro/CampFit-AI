import { isCampfitV2QuestionKey } from "@/lib/campfit/v2/questionBank"
import type {
  AIExtractionResult,
  MissingSlot,
  NaturalConsultationInput,
  ProfileConflict,
  RequiredIntake,
} from "@/types/campfitV2"

export function buildFallbackExtraction(
  requiredIntake: RequiredIntake,
  naturalInput: NaturalConsultationInput,
): AIExtractionResult {
  const text = [
    naturalInput.situationText,
    naturalInput.childContextText ?? "",
    naturalInput.successAndConcernsText ?? "",
    naturalInput.additionalNotes ?? "",
  ].join(" ")
  const detectedRegions = detectRegions(text, requiredIntake.preferredRegionGroups)
  const detectedProgramTypes = detectProgramTypes(text)
  const riskSignals = detectRiskSignals(text)
  const parentGoals = detectParentGoals(text)
  const conflicts = detectConflicts(requiredIntake, detectedProgramTypes, riskSignals, parentGoals)
  const recommendedQuestionKeys = dedupeStrings([
    ...conflicts.map((conflict) => conflict.recommendedQuestionKey).filter((key) => key !== undefined),
    ...buildFallbackQuestionKeys(requiredIntake, riskSignals),
  ])

  return {
    understandingSummaryForUser: "입력된 필수 정보와 자연어 상담 내용을 바탕으로 지역, 프로그램 방향, 걱정 신호를 임시 구조화했습니다.",
    extractedProfile: {
      detectedRegions,
      detectedProgramTypes,
      parentGoals,
      childSignals: [],
      riskSignals,
      avoidSignals: detectAvoidSignals(text),
      flexibilitySignals: detectFlexibilitySignals(text),
    },
    missingSlots: buildMissingSlots(requiredIntake),
    conflicts,
    confidenceMap: {
      fallbackExtraction: 0.45,
      naturalLanguageSignals: text.trim().length > 0 ? 0.55 : 0.2,
    },
    recommendedQuestionKeys,
  }
}

function detectRegions(text: string, preferredRegionGroups: RequiredIntake["preferredRegionGroups"]): readonly string[] {
  const regions = [...preferredRegionGroups.filter((region) => region !== "undecided" && region !== "no_preference")]
  if (/호주|뉴질랜드|오세아니아/.test(text)) {
    regions.push("oceania")
  }

  if (/세부|필리핀|말레이시아|싱가포르|동남아/.test(text)) {
    regions.push("southeast_asia")
  }

  return dedupeStrings(regions)
}

function detectProgramTypes(text: string): readonly string[] {
  const programTypes: string[] = []
  if (/스쿨링|국제학교|정규수업/.test(text)) {
    programTypes.push("international_school_regular", "schooling")
  }

  if (/액티비티|스포츠|활동/.test(text)) {
    programTypes.push("activity_sports")
  }

  if (/어학원|ESL|영어수업/i.test(text)) {
    programTypes.push("language_school_esl")
  }

  return dedupeStrings(programTypes)
}

function detectRiskSignals(text: string): readonly string[] {
  const riskSignals: string[] = []
  if (/영어\s*초급|영어를\s*못|도움\s*요청\s*어려|못 알아들|영어가\s*걱정/.test(text)) {
    riskSignals.push("english_overload")
  }

  if (/떨어진 경험 없음|분리|부모와 떨어|혼자.*걱정/.test(text)) {
    riskSignals.push("separation_risk")
  }

  return riskSignals
}

function detectParentGoals(text: string): readonly string[] {
  const goals: string[] = []
  if (/영어.*실력|영어.*향상|영어.*성과/.test(text)) {
    goals.push("english_improvement")
  }

  if (/자신감/.test(text)) {
    goals.push("confidence")
  }

  if (/독립심|독립/.test(text)) {
    goals.push("independence")
  }

  return goals
}

function detectAvoidSignals(text: string): readonly string[] {
  const avoidSignals: string[] = []
  if (/피하고|싫|원하지/.test(text)) {
    avoidSignals.push("avoidance_mentioned")
  }

  return avoidSignals
}

function detectFlexibilitySignals(text: string): readonly string[] {
  const flexibilitySignals: string[] = []
  if (/조정|상관없|넓힐|바꿀/.test(text)) {
    flexibilitySignals.push("flexibility_mentioned")
  }

  return flexibilitySignals
}

function detectConflicts(
  requiredIntake: RequiredIntake,
  detectedProgramTypes: readonly string[],
  riskSignals: readonly string[],
  parentGoals: readonly string[],
): readonly ProfileConflict[] {
  const conflicts: ProfileConflict[] = []
  const wantsOceania = requiredIntake.preferredRegionGroups.includes("oceania")
  const hasParentStay = ["parent_required", "parent_can_stay"].includes(requiredIntake.parentAccompanimentMode)
  const lowBudget = (requiredIntake.totalBudgetAllInKrwMax ?? Number.POSITIVE_INFINITY) <= 5_000_000
  if (wantsOceania && lowBudget && hasParentStay) {
    conflicts.push({
      conflictKey: "conflict_oceania_budget_parent",
      description: "오세아니아 선호, 제한적인 항공권 포함 총예산, 부모 동행 조건이 함께 있어 후보가 제한될 수 있습니다.",
      severity: "high",
      recommendedQuestionKey: "conflict_oceania_budget_parent",
    })
  }

  if (
    detectedProgramTypes.some((programType) => programType === "international_school_regular" || programType === "schooling") &&
    riskSignals.includes("english_overload")
  ) {
    conflicts.push({
      conflictKey: "conflict_schooling_low_english",
      description: "국제학교/스쿨링 방향은 맞지만 현재 영어 준비도 기준에서는 부담이 클 수 있습니다.",
      severity: "medium",
      recommendedQuestionKey: "conflict_schooling_low_english",
    })
  }

  if (parentGoals.includes("independence") && riskSignals.includes("separation_risk")) {
    conflicts.push({
      conflictKey: "conflict_independence_parent_anxiety",
      description: "독립심 성장을 기대하지만 부모 분리 부담 신호가 함께 있습니다.",
      severity: "medium",
      recommendedQuestionKey: "conflict_independence_parent_anxiety",
    })
  }

  return conflicts
}

function buildFallbackQuestionKeys(requiredIntake: RequiredIntake, riskSignals: readonly string[]): readonly string[] {
  const keys: string[] = []
  if (requiredIntake.parentAccompanimentMode === "undecided") {
    keys.push("parent_accompaniment_mode")
  }

  if (requiredIntake.koreanSupportNeed === "undecided") {
    keys.push("korean_support_need")
  }

  if (riskSignals.includes("english_overload")) {
    keys.push("english_help_seeking", "english_comprehension")
  }

  if (riskSignals.includes("separation_risk")) {
    keys.push("separation_experience", "transition_readiness")
  }

  keys.push("top_concerns", "flexibility")
  return keys.filter(isCampfitV2QuestionKey)
}

function buildMissingSlots(requiredIntake: RequiredIntake): readonly MissingSlot[] {
  const missingSlots: MissingSlot[] = []
  if (requiredIntake.durationWeeksMin === undefined && requiredIntake.durationWeeksMax === undefined) {
    missingSlots.push({ slotKey: "duration_weeks", reason: "가능한 캠프 기간이 필요합니다.", importance: "high" })
  }

  if (requiredIntake.totalBudgetAllInKrwMin === undefined && requiredIntake.totalBudgetAllInKrwMax === undefined) {
    missingSlots.push({ slotKey: "total_budget_all_in", reason: "항공권 포함 총예산 범위가 필요합니다.", importance: "high" })
  }

  if (requiredIntake.parentAccompanimentMode === "undecided") {
    missingSlots.push({ slotKey: "parent_accompaniment_mode", reason: "부모 동행 가능 형태가 필요합니다.", importance: "high" })
  }

  return missingSlots
}

function dedupeStrings(values: readonly string[]): readonly string[] {
  return [...new Set(values)]
}
