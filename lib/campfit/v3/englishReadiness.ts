import {
  campfitV3EnglishReadinessValues,
} from "@/types/campfitV3"
import type {
  CampfitV3ConversationState,
  CampfitV3EnglishReadiness,
} from "@/types/campfitV3"

export const englishReadinessLabels: Readonly<Record<CampfitV3EnglishReadiness, string>> = {
  support_required: "영어 지원이 꼭 필요한 단계",
  beginner_friendly: "초급자 친화적인 환경이 적합한 단계",
  general_program_ready: "일반 영어 프로그램 참여를 검토할 수 있는 단계",
  academic_ready: "영어 수업·학습형 프로그램까지 검토할 수 있는 단계",
  unknown: "영어 준비도를 더 확인할 필요가 있는 단계",
}

export type EnglishReadinessAssessment = {
  readonly readiness: CampfitV3EnglishReadiness
  readonly confidence: number
  readonly evidenceKeys: readonly string[]
  readonly missingEvidence: readonly string[]
  readonly sufficientForRecommendation: boolean
  readonly reason: string
}

export type EnglishEvidenceGap = "classroom_comprehension" | "speaking" | null

const readinessValues: ReadonlySet<string> = new Set(campfitV3EnglishReadinessValues)

export function assessEnglishReadiness(state: CampfitV3ConversationState): EnglishReadinessAssessment {
  const facts = state.facts
  const evidenceKeys: string[] = []
  const addEvidence = (key: string, present: boolean) => {
    if (present) evidenceKeys.push(key)
  }

  const legacyLevel = stringValue(facts.childEnglishLevel?.value)
  const legacyFactUsable = facts.childEnglishLevel !== undefined
    && facts.childEnglishLevel.status !== "unknown"
    && facts.childEnglishLevel.status !== "tentative"
    && !state.conflicts.some((conflict) => conflict.key === "childEnglishLevel")
  const experience = objectArrayValue(facts.childEnglishExperience?.value)
  const environment = stringArrayValue(facts.childEnglishEnvironment?.value)
  const assessments = objectArrayValue(facts.childEnglishAssessment?.value)
  const listening = stringValue(facts.childEnglishListening?.value)
  const speaking = stringValue(facts.childEnglishSpeaking?.value)
  const reading = stringValue(facts.childEnglishReading?.value)
  const writing = stringValue(facts.childEnglishWriting?.value)
  const usage = stringArrayValue(facts.childEnglishUsage?.value)

  addEvidence("childEnglishExperience", experience.length > 0)
  addEvidence("childEnglishEnvironment", environment.length > 0)
  addEvidence("childEnglishAssessment", assessments.length > 0)
  addEvidence("childEnglishListening", listening !== null && listening !== "unknown")
  addEvidence("childEnglishSpeaking", speaking !== null && speaking !== "unknown")
  addEvidence("childEnglishReading", reading !== null && reading !== "unknown")
  addEvidence("childEnglishWriting", writing !== null && writing !== "unknown")
  addEvidence("childEnglishUsage", usage.length > 0)

  const hasAbilityEvidence = [listening, speaking, reading, writing].some((value) => value !== null && value !== "unknown") || usage.length > 0
  if (!hasAbilityEvidence) {
    const legacy = legacyFactUsable ? readinessFromLegacyLevel(legacyLevel) : null
    if (legacy !== null) {
      return {
        readiness: legacy,
        confidence: 0.96,
        evidenceKeys,
        missingEvidence: missingEvidenceFor(legacy, listening, speaking, reading, writing, usage),
        sufficientForRecommendation: true,
        reason: "기존 영어 수준 선택값을 호환용으로 사용했습니다.",
      }
    }
    return {
      readiness: "unknown",
      confidence: 0.2,
      evidenceKeys,
      missingEvidence: ["듣기", "말하기", "읽기 또는 쓰기"],
      sufficientForRecommendation: false,
      reason: "영어 노출·환경·평가 정보만으로는 실제 프로그램 참여 준비도를 판단하지 않습니다.",
    }
  }

  const listeningScore = scoreListening(listening)
  const speakingScore = scoreSpeaking(speaking)
  const readingScore = scoreReading(reading)
  const writingScore = scoreWriting(writing)
  const usageScore = scoreUsage(usage)
  const receptiveEvidence = listeningScore > 0 || readingScore > 0
  const expressiveEvidence = speaking !== null && speaking !== "unknown"
    || writing !== null && writing !== "unknown"
    || usage.length > 0
  const sufficientForRecommendation = receptiveEvidence && expressiveEvidence

  const lowEnglish = !hasAbilityEvidence && legacyLevel === "beginner"
    || (speaking === "rarely_speaks" && listeningScore <= 1 && readingScore <= 1)
  const readiness: CampfitV3EnglishReadiness = lowEnglish
    ? "support_required"
    : listeningScore >= 3 && speakingScore >= 2 && readingScore >= 2 && writingScore >= 2
      ? "academic_ready"
      : listeningScore >= 2 && Math.max(speakingScore, usageScore) >= 2
        ? "general_program_ready"
        : "beginner_friendly"

  return {
    readiness,
    confidence: sufficientForRecommendation ? 0.92 : 0.62,
    evidenceKeys,
    missingEvidence: missingEvidenceFor(readiness, listening, speaking, reading, writing, usage),
    sufficientForRecommendation,
    reason: readinessReason(readiness, sufficientForRecommendation, evidenceKeys),
  }
}

export function isEnglishReadiness(value: unknown): value is CampfitV3EnglishReadiness {
  return typeof value === "string" && readinessValues.has(value)
}

function readinessFromLegacyLevel(value: string | null): CampfitV3EnglishReadiness | null {
  if (value === "beginner") return "support_required"
  if (value === "basic") return "beginner_friendly"
  if (value === "intermediate") return "general_program_ready"
  if (value === "advanced") return "academic_ready"
  return null
}

function missingEvidenceFor(
  readiness: CampfitV3EnglishReadiness,
  listening: string | null,
  speaking: string | null,
  reading: string | null,
  writing: string | null,
  usage: readonly string[],
): readonly string[] {
  const missing: string[] = []
  if (listening === null || listening === "unknown") missing.push("듣기")
  if (speaking === null || speaking === "unknown") missing.push("말하기")
  if (reading === null || reading === "unknown") missing.push("읽기")
  if (writing === null || writing === "unknown") missing.push("쓰기")
  if (readiness === "academic_ready") return missing
  if (usage.length === 0 && !missing.includes("말하기")) missing.push("실제 영어 사용")
  return missing
}

function readinessReason(
  readiness: CampfitV3EnglishReadiness,
  sufficient: boolean,
  evidenceKeys: readonly string[],
): string {
  if (!sufficient) return "영어 노출 정보는 확인했지만 듣기와 말하기를 함께 판단할 evidence가 더 필요합니다."
  if (readiness === "support_required") return "영어 이해·표현 부담을 고려해 초반 지원과 쉬운 안내가 있는 프로그램을 우선합니다."
  if (readiness === "beginner_friendly") return "확인된 receptive·expressive evidence를 바탕으로 초급자 친화적 프로그램부터 비교합니다."
  if (readiness === "general_program_ready") return "듣기와 말하기 evidence가 모두 확인되어 일반 활동형 영어 프로그램을 검토할 수 있습니다."
  if (readiness === "academic_ready") return "듣기·말하기·읽기·쓰기 evidence가 고르게 확인되어 학습형 수업까지 검토할 수 있습니다."
  return `현재 확인된 영어 evidence ${evidenceKeys.length}개만으로는 준비도를 확정하지 않습니다.`
}

function scoreListening(value: string | null): number {
  if (value === "understands_class_explanation") return 3
  if (value === "understands_simple_instructions") return 1
  return 0
}

function scoreSpeaking(value: string | null): number {
  if (value === "initiates_speech") return 3
  if (value === "can_present_in_english") return 3
  if (value === "can_converse") return 2
  if (value === "answers_simple_questions") return 1
  return 0
}

/**
 * Selects the smallest missing English evidence to ask about next. This is
 * intentionally narrower than missingEvidence: an AR score is not reading
 * evidence, and a reading fact must never trigger another reading question.
 */
export function englishEvidenceGap(state: CampfitV3ConversationState): EnglishEvidenceGap {
  const facts = state.facts
  const listening = stringValue(facts.childEnglishListening?.value)
  const speaking = stringValue(facts.childEnglishSpeaking?.value)
  const reading = stringValue(facts.childEnglishReading?.value)
  const assessments = objectArrayValue(facts.childEnglishAssessment?.value)
  const hasListening = listening !== null && listening !== "unknown"
  const hasSpeaking = speaking !== null && speaking !== "unknown"
    || stringArrayValue(facts.childEnglishUsage?.value).length > 0

  if (hasListening && hasSpeaking) return null
  if (!hasListening && (assessments.length > 0 || reading !== null && reading !== "unknown" || hasSpeaking)) {
    return "classroom_comprehension"
  }
  if (hasListening && !hasSpeaking) return "speaking"
  return null
}

function scoreReading(value: string | null): number {
  if (value === "understands_english_books") return 3
  if (value === "reads_english_books") return 2
  if (value === "reads_simple_text") return 1
  return 0
}

function scoreWriting(value: string | null): number {
  if (value === "can_explain_in_english") return 3
  if (value === "simple_sentences") return 2
  if (value === "simple_words") return 1
  return 0
}

function scoreUsage(values: readonly string[]): number {
  let score = 0
  if (values.includes("speaks_with_foreigners")) score = Math.max(score, 2)
  if (values.includes("answers_in_english")) score = Math.max(score, 1)
  if (values.includes("initiates_in_english")) score = Math.max(score, 3)
  return score
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" ? value : null
}

function stringArrayValue(value: unknown): readonly string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string") ? value : []
}

function objectArrayValue(value: unknown): readonly Record<string, unknown>[] {
  return Array.isArray(value)
    && value.every((item) => typeof item === "object" && item !== null && !Array.isArray(item))
    ? value as readonly Record<string, unknown>[]
    : []
}
