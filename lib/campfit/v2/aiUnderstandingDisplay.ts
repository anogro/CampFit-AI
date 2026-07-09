import type { AIExtractionResult } from "@/types/campfitV2"

export type AIUnderstandingDisplaySections = {
  readonly parentDirection: readonly string[]
  readonly childConsiderations: readonly string[]
  readonly cautionPoints: readonly string[]
}

const signalSentences: Record<string, string> = {
  oceania: "호주·뉴질랜드 등 오세아니아 지역에 관심이 있습니다.",
  southeast_asia: "동남아 지역도 비교 후보로 볼 수 있습니다.",
  schooling: "스쿨링 또는 현지 학교 수업 체험을 선호합니다.",
  international_school_regular: "국제학교 수업 환경을 경험해보는 방향을 선호합니다.",
  international_school_experience: "국제학교 분위기를 경험해보는 방향을 선호합니다.",
  reduce_english_resistance: "영어를 공부처럼만 느끼기보다 부담을 줄이는 경험을 기대합니다.",
  natural_english_exposure: "영어를 자연스럽게 언어와 문화로 받아들이길 기대합니다.",
  cultural_exposure: "다양한 문화와 분위기를 경험하는 것을 중요하게 보고 있습니다.",
  slow_to_adapt: "낯선 환경에 적응하는 데 시간이 걸리는 편입니다.",
  slow_adaptation: "낯선 환경에 적응하는 데 시간이 걸리는 편입니다.",
  slow_warm_up: "낯선 환경에 적응하는 데 시간이 걸리는 편입니다.",
  socially_reserved: "낯선 친구에게 먼저 다가가는 데 다소 조심스러운 편입니다.",
  cautious_social_approach: "낯선 친구에게 먼저 다가가는 데 다소 조심스러운 편입니다.",
  shy: "낯선 친구에게 먼저 다가가는 데 다소 조심스러운 편입니다.",
  shyness: "낯선 친구에게 먼저 다가가는 데 다소 조심스러운 편입니다.",
  introverted: "낯선 친구에게 먼저 다가가는 데 다소 조심스러운 편입니다.",
  hesitant_to_socialize: "새로운 또래 관계를 시작할 때 초반 지원이 필요할 수 있습니다.",
  needs_initial_support: "새로운 환경에 들어갈 때 초반 지원이 필요할 수 있습니다.",
  teacher_support_needed: "초반에는 선생님이나 관리자의 세심한 지원이 도움이 될 수 있습니다.",
  korean_support_needed: "초반에는 한국어로 마음을 확인해줄 수 있는 지원이 도움이 될 수 있습니다.",
  english_proficiency_concern: "영어 초급으로 인해 수업 참여나 또래 관계에서 위축될 가능성을 걱정하고 있습니다.",
  low_english_proficiency: "영어 초급으로 인해 수업 참여나 또래 관계에서 위축될 가능성을 걱정하고 있습니다.",
  low_english_confidence: "영어 초급으로 인해 수업 참여나 또래 관계에서 위축될 가능성을 걱정하고 있습니다.",
  english_overload: "영어 초급으로 인해 수업 참여 부담이 생길 수 있습니다.",
  free_english_anxiety: "자유로운 영어 상황에서 위축될 가능성을 걱정하고 있습니다.",
  social_exclusion_anxiety: "또래 관계에서 소외될까 하는 걱정이 있습니다.",
  fear_of_social_exclusion: "또래 관계에서 소외될까 하는 걱정이 있습니다.",
  too_study_focused: "너무 공부 위주의 프로그램은 피하고 싶은 조건입니다.",
}

const rawKeyPattern = /\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b/

export function buildAIUnderstandingDisplaySections(summary: AIExtractionResult): AIUnderstandingDisplaySections {
  const extracted = summary.extractedProfile
  const parentDirection = uniqueSentences([
    ...sentencesFor(extracted["detectedRegions"]),
    ...sentencesFor(extracted["detectedProgramTypes"]),
    ...sentencesFor(extracted["parentGoals"]),
  ])
  const childConsiderations = uniqueSentences([
    ...sentencesFor(extracted["childSignals"]),
    ...sentencesFor(extracted["riskSignals"]),
  ])
  const cautionPoints = uniqueSentences([
    ...sentencesFor(extracted["avoidSignals"]),
    ...summary.conflicts.map((conflict) => sentenceForConflict(conflict.conflictKey, conflict.description)),
  ])

  return {
    parentDirection: withFallback(parentDirection, "부모님이 원하는 방향은 다음 질문에서 조금 더 구체화하겠습니다."),
    childConsiderations: withFallback(childConsiderations, "아이의 영어 사용과 적응 방식은 다음 질문에서 조금 더 확인하겠습니다."),
    cautionPoints: withFallback(cautionPoints, "현재 입력만으로는 큰 충돌 조건이 보이지 않습니다. 다음 질문에서 필요한 부분만 더 확인하겠습니다."),
  }
}

export function sentenceForSignal(signal: string): string | undefined {
  const normalized = normalizeSignal(signal)
  return signalSentences[normalized]
}

function sentencesFor(value: unknown): readonly string[] {
  return stringArray(value).flatMap((signal) => {
    const sentence = sentenceForSignal(signal)
    return sentence === undefined ? [] : [sentence]
  })
}

function sentenceForConflict(conflictKey: string, description: string): string {
  if (conflictKey === "conflict_schooling_low_english") {
    return "오세아니아 스쿨링은 방향성은 맞지만, 영어 초급 아이에게는 수업 참여 부담이 있을 수 있습니다."
  }

  if (conflictKey === "conflict_oceania_budget_parent") {
    return "오세아니아 지역과 부모 동반 체류를 함께 고려하면 현재 예산 안에서 선택지가 좁아질 수 있습니다."
  }

  if (conflictKey === "conflict_english_outcome_activity_preference") {
    return "너무 공부 위주의 프로그램은 부모님이 원하는 자연스러운 경험 방향과 맞지 않을 수 있습니다."
  }

  return rawKeyPattern.test(description) ? "현재 조건에서 일부 선호가 서로 부딪힐 수 있습니다." : description
}

function normalizeSignal(signal: string): string {
  return signal.trim().toLowerCase().replaceAll(" ", "_").replaceAll("-", "_")
}

function stringArray(value: unknown): readonly string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []
}

function uniqueSentences(values: readonly string[]): readonly string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))]
}

function withFallback(values: readonly string[], fallback: string): readonly string[] {
  return values.length > 0 ? values : [fallback]
}
