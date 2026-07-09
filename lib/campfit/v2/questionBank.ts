export const campfitV2QuestionKeys = [
  "child_age_at_start",
  "departure_window",
  "duration_weeks",
  "total_budget_all_in",
  "budget_scope",
  "traveler_count",
  "preferred_regions",
  "region_priority",
  "parent_accompaniment_mode",
  "korean_support_need",
  "accommodation_preferences",
  "english_comprehension",
  "english_help_seeking",
  "english_speaking_anxiety",
  "separation_experience",
  "transition_readiness",
  "social_confidence",
  "adaptability",
  "resilience",
  "daily_life_independence",
  "activity_tolerance",
  "primary_goals",
  "challenge_preference",
  "preferred_program_types",
  "international_school_intent",
  "english_outcome_expectation",
  "korean_peer_ratio_preference",
  "top_concerns",
  "avoid_conditions",
  "unacceptable_outcome",
  "flexibility",
  "mismatch_tolerance",
  "special_care_needs",
  "conflict_oceania_budget_parent",
  "conflict_schooling_low_english",
  "conflict_low_korean_ratio_high_korean_support",
  "conflict_independence_parent_anxiety",
  "conflict_english_outcome_activity_preference",
] as const

export type CampfitV2QuestionKey = (typeof campfitV2QuestionKeys)[number]

export const conflictQuestionKeys = [
  "conflict_oceania_budget_parent",
  "conflict_schooling_low_english",
  "conflict_low_korean_ratio_high_korean_support",
  "conflict_independence_parent_anxiety",
  "conflict_english_outcome_activity_preference",
] as const satisfies readonly CampfitV2QuestionKey[]

const validQuestionKeySet = new Set<string>(campfitV2QuestionKeys)

export function isCampfitV2QuestionKey(value: string): value is CampfitV2QuestionKey {
  return validQuestionKeySet.has(value)
}
