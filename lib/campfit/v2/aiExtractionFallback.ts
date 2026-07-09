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
  const avoidSignals = detectAvoidSignals(text)
  const conflicts = detectConflicts(requiredIntake, detectedProgramTypes, riskSignals, parentGoals)
  const recommendedQuestionKeys = dedupeStrings([
    ...conflicts.map((conflict) => conflict.recommendedQuestionKey).filter((key) => key !== undefined),
    ...buildFallbackQuestionKeys(requiredIntake, riskSignals),
  ])

  return {
    understandingSummaryForUser: "입력하신 필수 조건과 상담 내용을 바탕으로 추천 방향과 주의할 점을 먼저 정리했습니다.",
    extractedProfile: {
      detectedRegions,
      detectedProgramTypes,
      parentGoals,
      childSignals: detectChildSignals(text),
      riskSignals,
      avoidSignals,
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

  if (/싱가포르|말레이시아|동남아|태국|필리핀/.test(text)) {
    regions.push("southeast_asia")
  }

  return dedupeStrings(regions)
}

function detectProgramTypes(text: string): readonly string[] {
  const programTypes: string[] = []
  if (/스쿨링|현지\s*학교|학교\s*수업|정규\s*수업/.test(text)) {
    programTypes.push("international_school_regular", "schooling")
  }

  if (/국제학교\s*분위기|국제학교\s*경험|국제학교/.test(text)) {
    programTypes.push("international_school_experience")
  }

  if (/액티비티|스포츠|활동/.test(text)) {
    programTypes.push("activity_sports")
  }

  if (/어학원|ESL|영어\s*수업/i.test(text)) {
    programTypes.push("language_school_esl")
  }

  return dedupeStrings(programTypes)
}

function detectChildSignals(text: string): readonly string[] {
  const childSignals: string[] = []
  if (/낯선 환경|적응.*시간|긴장|느린 적응|낯을\s*가리|낯가림/.test(text)) {
    childSignals.push("slow_to_adapt")
  }

  if (/친구.*먼저|소극적|조심스러운|낯선 친구|낯을\s*가리|낯가림/.test(text)) {
    childSignals.push("socially_reserved")
  }

  return dedupeStrings(childSignals)
}

function detectRiskSignals(text: string): readonly string[] {
  const riskSignals: string[] = []
  if (/영어\s*초급|영어.*걱정|수업.*부담|수업.*못\s*따라|영어.*위축|자유로운 영어.*위축/.test(text)) {
    riskSignals.push("english_proficiency_concern", "english_overload")
  }

  if (/또래.*소외|소외|친구.*못\s*사귈|또래.*위축/.test(text)) {
    riskSignals.push("social_exclusion_anxiety")
  }

  if (/떨어진 경험.*없|분리|부모.*떨어|혼자.*걱정/.test(text)) {
    riskSignals.push("separation_risk")
  }

  return dedupeStrings(riskSignals)
}

function detectParentGoals(text: string): readonly string[] {
  const goals: string[] = []
  if (/영어.*(실력\s*향상|늘었으면|레벨업|수업\s*효과|학업\s*성과|말하기\s*실력|점수|레벨|성과)/.test(text)) {
    goals.push("english_improvement")
  }

  if (/영어.*(언어로|거부감|자연스럽|부담을?\s*줄|싫어하지)/.test(text)) {
    goals.push("reduce_english_resistance", "natural_english_exposure")
  }

  if (/문화|분위기|국제학교\s*분위기|다양한\s*문화/.test(text)) {
    goals.push("cultural_exposure")
  }

  if (/국제학교\s*분위기|국제학교\s*경험/.test(text)) {
    goals.push("international_school_experience")
  }

  if (/자신감/.test(text)) {
    goals.push("confidence")
  }

  if (/독립|자립/.test(text)) {
    goals.push("independence")
  }

  return dedupeStrings(goals)
}

function detectAvoidSignals(text: string): readonly string[] {
  const avoidSignals: string[] = []
  if (/공부\s*위주|학업\s*위주|너무\s*공부|공부처럼만/.test(text)) {
    avoidSignals.push("too_study_focused")
  }

  if (/피하고|원하지|싫어/.test(text)) {
    avoidSignals.push("avoidance_mentioned")
  }

  return dedupeStrings(avoidSignals)
}

function detectFlexibilitySignals(text: string): readonly string[] {
  const flexibilitySignals: string[] = []
  if (/조정|상관없|넓히|바꿀 수/.test(text)) {
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
      description: "오세아니아 지역과 부모 동반 체류를 함께 고려하면 현재 예산 안에서 선택지가 좁아질 수 있습니다.",
      severity: "high",
      recommendedQuestionKey: "conflict_oceania_budget_parent",
    })
  }

  if (
    detectedProgramTypes.some((programType) => programType === "international_school_regular" || programType === "schooling") &&
    riskSignals.some((risk) => risk === "english_overload" || risk === "english_proficiency_concern")
  ) {
    conflicts.push({
      conflictKey: "conflict_schooling_low_english",
      description: "오세아니아 스쿨링은 방향성은 맞지만, 영어 초급 아이에게는 수업 참여 부담이 있을 수 있습니다.",
      severity: "medium",
      recommendedQuestionKey: "conflict_schooling_low_english",
    })
  }

  if (parentGoals.includes("independence") && riskSignals.includes("separation_risk")) {
    conflicts.push({
      conflictKey: "conflict_independence_parent_anxiety",
      description: "독립성을 키우고 싶은 목표와 부모 분리 불안이 함께 있습니다.",
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

  if (riskSignals.some((risk) => risk === "english_overload" || risk === "english_proficiency_concern")) {
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
