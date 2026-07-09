import {
  campfitV2QuestionKeys,
  conflictQuestionKeys,
  isCampfitV2QuestionKey,
  type CampfitV2QuestionKey,
} from "@/lib/campfit/v2/questionBank"
import type { AIExtractionResult, DynamicAnswer, RequiredIntake } from "@/types/campfitV2"

export type PlannedQuestionKey = {
  readonly questionKey: CampfitV2QuestionKey
  readonly priority: number
  readonly reason: string
}

type QuestionPlanningInput = {
  readonly requiredIntake: RequiredIntake
  readonly extraction: AIExtractionResult
  readonly answeredQuestions?: readonly DynamicAnswer[]
  readonly validQuestionKeys?: readonly string[]
}

const maxQuestions = 5

const requiredSlotToQuestionKey = {
  child_age_at_start: "child_age_at_start",
  duration_weeks: "duration_weeks",
  total_budget_all_in: "total_budget_all_in",
  parent_accompaniment_mode: "parent_accompaniment_mode",
  korean_support_need: "korean_support_need",
  preferred_regions: "preferred_regions",
  region_priority: "region_priority",
} as const satisfies Record<string, CampfitV2QuestionKey>

const defaultDynamicQuestionKeys = [
  "english_help_seeking",
  "english_comprehension",
  "separation_experience",
  "transition_readiness",
  "top_concerns",
  "flexibility",
] as const satisfies readonly CampfitV2QuestionKey[]

export function planCampfitV2Questions(input: QuestionPlanningInput): readonly PlannedQuestionKey[] {
  const validQuestionKeys = new Set(input.validQuestionKeys ?? campfitV2QuestionKeys)
  const candidates = [
    ...conflictCandidates(input.requiredIntake, input.extraction),
    ...missingSlotCandidates(input.requiredIntake, input.extraction),
    ...aiRecommendedCandidates(input.extraction),
    ...qualityQuestionCandidates(input.requiredIntake, input.extraction),
  ]
  return filterAlreadyAnswered(
    dedupeQuestionKeys(rankQuestionKeys(candidates).filter((item) => validQuestionKeys.has(item.questionKey))),
    input.answeredQuestions ?? [],
  ).slice(0, maxQuestions)
}

export function rankQuestionKeys(candidates: readonly PlannedQuestionKey[]): readonly PlannedQuestionKey[] {
  return [...candidates].sort((left, right) => left.priority - right.priority)
}

export function dedupeQuestionKeys(candidates: readonly PlannedQuestionKey[]): readonly PlannedQuestionKey[] {
  const seen = new Set<string>()
  const deduped: PlannedQuestionKey[] = []
  for (const candidate of candidates) {
    if (!seen.has(candidate.questionKey)) {
      seen.add(candidate.questionKey)
      deduped.push(candidate)
    }
  }

  return deduped
}

export function filterAlreadyAnswered(
  candidates: readonly PlannedQuestionKey[],
  answeredQuestions: readonly DynamicAnswer[],
): readonly PlannedQuestionKey[] {
  const answered = new Set(answeredQuestions.map((answer) => answer.questionKey))
  return candidates.filter((candidate) => !answered.has(candidate.questionKey))
}

function conflictCandidates(requiredIntake: RequiredIntake, extraction: AIExtractionResult): readonly PlannedQuestionKey[] {
  const candidates: PlannedQuestionKey[] = []
  for (const conflict of extraction.conflicts) {
    const key = conflict.recommendedQuestionKey
    if (key !== undefined && isCampfitV2QuestionKey(key) && isConflictQuestionKey(key)) {
      candidates.push({
        questionKey: key,
        priority: conflict.severity === "high" ? 10 : 20,
        reason: conflict.description,
      })
    }
  }

  if (hasOceaniaBudgetParentConflict(requiredIntake)) {
    candidates.push({
      questionKey: "conflict_oceania_budget_parent",
      priority: 5,
      reason: "오세아니아 선호, 낮은 항공권 포함 총예산, 부모 동행 조건이 동시에 있습니다.",
    })
  }

  if (hasSchoolingEnglishConflict(extraction)) {
    candidates.push({
      questionKey: "conflict_schooling_low_english",
      priority: 12,
      reason: "스쿨링 선호와 영어 준비도 부담 신호가 동시에 있습니다.",
    })
  }

  return candidates
}

function missingSlotCandidates(requiredIntake: RequiredIntake, extraction: AIExtractionResult): readonly PlannedQuestionKey[] {
  const requiredMissing = requiredMissingQuestionKeys(requiredIntake)
  const aiMissing = extraction.missingSlots
    .map((slot) => questionKeyForMissingSlot(slot.slotKey))
    .filter((key) => key !== undefined)

  return dedupeQuestionKeys([...requiredMissing, ...aiMissing].map((questionKey) => ({
    questionKey,
    priority: 40,
    reason: "추천 hard filter에 필요한 필수 정보가 비어 있습니다.",
  })))
}

function aiRecommendedCandidates(extraction: AIExtractionResult): readonly PlannedQuestionKey[] {
  return extraction.recommendedQuestionKeys.filter(isCampfitV2QuestionKey).map((questionKey) => ({
    questionKey,
    priority: isConflictQuestionKey(questionKey) ? 15 : 70,
    reason: "AI extraction이 추천 품질 향상을 위해 필요하다고 판단했습니다.",
  }))
}

function qualityQuestionCandidates(
  requiredIntake: RequiredIntake,
  extraction: AIExtractionResult,
): readonly PlannedQuestionKey[] {
  const riskSignals = getStringArray(extraction.extractedProfile, "riskSignals")
  const keys: CampfitV2QuestionKey[] = []
  if (riskSignals.includes("english_overload")) {
    keys.push("english_help_seeking", "english_comprehension")
  }

  if (riskSignals.includes("separation_risk")) {
    keys.push("separation_experience", "transition_readiness")
  }

  if (requiredIntake.koreanSupportNeed === "undecided") {
    keys.push("korean_support_need")
  }

  keys.push(...defaultDynamicQuestionKeys)
  return dedupeQuestionKeys(keys.map((questionKey) => ({
    questionKey,
    priority: questionKey === "flexibility" ? 95 : 80,
    reason: "추천 품질을 높이기 위한 핵심 동적 질문입니다.",
  })))
}

function requiredMissingQuestionKeys(requiredIntake: RequiredIntake): readonly CampfitV2QuestionKey[] {
  const keys: CampfitV2QuestionKey[] = []
  if (requiredIntake.durationWeeksMin === undefined && requiredIntake.durationWeeksMax === undefined) {
    keys.push("duration_weeks")
  }

  if (requiredIntake.totalBudgetAllInKrwMin === undefined && requiredIntake.totalBudgetAllInKrwMax === undefined) {
    keys.push("total_budget_all_in")
  }

  if (requiredIntake.parentAccompanimentMode === "undecided") {
    keys.push("parent_accompaniment_mode")
  }

  if (requiredIntake.koreanSupportNeed === "undecided") {
    keys.push("korean_support_need")
  }

  if (
    requiredIntake.preferredRegionGroups.length === 0 ||
    requiredIntake.preferredRegionGroups.includes("undecided")
  ) {
    keys.push("preferred_regions")
  }

  if (requiredIntake.regionPriority === "low" && requiredIntake.preferredRegionGroups.includes("oceania")) {
    keys.push("region_priority")
  }

  return keys
}

function hasOceaniaBudgetParentConflict(requiredIntake: RequiredIntake): boolean {
  return (
    requiredIntake.preferredRegionGroups.includes("oceania") &&
    (requiredIntake.totalBudgetAllInKrwMax ?? Number.POSITIVE_INFINITY) <= 5_000_000 &&
    ["parent_required", "parent_can_stay"].includes(requiredIntake.parentAccompanimentMode)
  )
}

function hasSchoolingEnglishConflict(extraction: AIExtractionResult): boolean {
  const programTypes = getStringArray(extraction.extractedProfile, "detectedProgramTypes")
  const riskSignals = getStringArray(extraction.extractedProfile, "riskSignals")
  return (
    programTypes.some((programType) => programType === "international_school_regular" || programType === "schooling") &&
    riskSignals.includes("english_overload")
  )
}

function getStringArray(record: Record<string, unknown>, key: string): readonly string[] {
  const value = record[key]
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((item): item is string => typeof item === "string")
}

function isConflictQuestionKey(value: CampfitV2QuestionKey): boolean {
  return conflictQuestionKeys.some((questionKey) => questionKey === value)
}

function questionKeyForMissingSlot(slotKey: string): CampfitV2QuestionKey | undefined {
  switch (slotKey) {
    case "child_age_at_start":
      return requiredSlotToQuestionKey.child_age_at_start
    case "duration_weeks":
      return requiredSlotToQuestionKey.duration_weeks
    case "total_budget_all_in":
      return requiredSlotToQuestionKey.total_budget_all_in
    case "parent_accompaniment_mode":
      return requiredSlotToQuestionKey.parent_accompaniment_mode
    case "korean_support_need":
      return requiredSlotToQuestionKey.korean_support_need
    case "preferred_regions":
      return requiredSlotToQuestionKey.preferred_regions
    case "region_priority":
      return requiredSlotToQuestionKey.region_priority
    default:
      return undefined
  }
}
