import type { CampReadinessResult, ReadinessAnswers, SupportKey } from "@/types/campfit"
import { average } from "@/lib/campfit/utils"

const correctAnswers = {
  q1: "B",
  q2: "C",
  q3: "D",
  q4: "B",
} as const

export function scoreCampReadiness(answers: ReadinessAnswers): CampReadinessResult {
  const basicInstructionUnderstanding = scoreChoice(answers.q1, correctAnswers.q1)
  const helpRequestAbility = scoreChoice(answers.q2, correctAnswers.q2)
  const survivalExpression = scoreChoice(answers.q3, correctAnswers.q3)
  const peerInteractionReadiness = scoreChoice(answers.q4, correctAnswers.q4)
  const basicSelfExpression = scoreSelfExpression(answers.q5)
  const anxiety = scoreParentObservation(answers.q6)

  const readinessAverage = average([
    basicInstructionUnderstanding,
    helpRequestAbility,
    survivalExpression,
    peerInteractionReadiness,
    basicSelfExpression,
    anxiety.communicationAttemptTendency,
    1 - anxiety.englishAnxietySignal,
  ])

  return {
    basicInstructionUnderstanding,
    helpRequestAbility,
    survivalExpression,
    peerInteractionReadiness,
    basicSelfExpression,
    englishAnxietySignal: anxiety.englishAnxietySignal,
    communicationAttemptTendency: anxiety.communicationAttemptTendency,
    overallReadiness: classifyReadiness(readinessAverage),
    recommendedSupport: recommendSupport({
      helpRequestAbility,
      basicSelfExpression,
      englishAnxietySignal: anxiety.englishAnxietySignal,
      communicationAttemptTendency: anxiety.communicationAttemptTendency,
      readinessAverage,
    }),
  }
}

function scoreChoice(answer: string, correctAnswer: string): number {
  return answer === correctAnswer ? 1 : 0.25
}

function scoreSelfExpression(text: string): number {
  const trimmed = text.trim()
  if (trimmed.length === 0) {
    return 0.15
  }

  const words = trimmed.split(/\s+/).filter(Boolean)
  const hasLatin = /[A-Za-z]/.test(trimmed)
  const hasSentenceShape = words.length >= 3 && /[.!?]?$/.test(trimmed)

  if (hasLatin && hasSentenceShape) {
    return 0.86
  }

  if (hasLatin && words.length >= 1) {
    return 0.54
  }

  return 0.3
}

function scoreParentObservation(answer: ReadinessAnswers["q6"]): {
  readonly englishAnxietySignal: number
  readonly communicationAttemptTendency: number
} {
  switch (answer) {
    case "A":
      return { englishAnxietySignal: 0.22, communicationAttemptTendency: 0.88 }
    case "B":
      return { englishAnxietySignal: 0.58, communicationAttemptTendency: 0.5 }
    case "C":
      return { englishAnxietySignal: 0.86, communicationAttemptTendency: 0.22 }
    case "D":
      return { englishAnxietySignal: 0.48, communicationAttemptTendency: 0.58 }
  }
}

function classifyReadiness(value: number): CampReadinessResult["overallReadiness"] {
  if (value < 0.38) {
    return "early_adaptation"
  }

  if (value < 0.6) {
    return "basic_adaptation"
  }

  if (value < 0.78) {
    return "moderate_ready"
  }

  return "high_ready"
}

type SupportSignals = {
  readonly helpRequestAbility: number
  readonly basicSelfExpression: number
  readonly englishAnxietySignal: number
  readonly communicationAttemptTendency: number
  readonly readinessAverage: number
}

function recommendSupport(signals: SupportSignals): readonly SupportKey[] {
  const support = new Set<SupportKey>()

  if (signals.readinessAverage < 0.62) {
    support.add("beginner_class")
    support.add("early_adaptation_support")
  }

  if (signals.englishAnxietySignal > 0.55) {
    support.add("korean_manager")
    support.add("low_pressure_speaking_environment")
  }

  if (signals.communicationAttemptTendency < 0.55 || signals.helpRequestAbility < 0.5) {
    support.add("buddy_system")
    support.add("small_group_care")
  }

  if (signals.basicSelfExpression < 0.55) {
    support.add("beginner_class")
  }

  return Array.from(support).slice(0, 5)
}
