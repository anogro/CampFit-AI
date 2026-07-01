import type { CampfitInput, CampReadinessResult, EnglishSelfLevel, LevelOption, ReadinessAnswers, SupportKey } from "@/types/campfit"
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

export function scoreCampReadinessFromParentInput(input: CampfitInput): CampReadinessResult {
  const englishBase = scoreEnglishObservation(input.englishSelfLevel)
  const anxiety = scoreAnxietySignals(input.shynessLevel, input.separationTolerance)
  const basicInstructionUnderstanding = englishBase.basicInstructionUnderstanding
  const helpRequestAbility = Math.max(0.18, englishBase.helpRequestAbility - anxiety.helpPenalty)
  const survivalExpression = englishBase.survivalExpression
  const peerInteractionReadiness = Math.max(0.2, englishBase.peerInteractionReadiness - anxiety.socialPenalty)
  const basicSelfExpression = englishBase.basicSelfExpression

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

function scoreEnglishObservation(level: EnglishSelfLevel): {
  readonly basicInstructionUnderstanding: number
  readonly helpRequestAbility: number
  readonly survivalExpression: number
  readonly peerInteractionReadiness: number
  readonly basicSelfExpression: number
} {
  switch (level) {
    case "almost_none":
      return {
        basicInstructionUnderstanding: 0.24,
        helpRequestAbility: 0.2,
        survivalExpression: 0.18,
        peerInteractionReadiness: 0.26,
        basicSelfExpression: 0.18,
      }
    case "basic_expression":
      return {
        basicInstructionUnderstanding: 0.44,
        helpRequestAbility: 0.36,
        survivalExpression: 0.42,
        peerInteractionReadiness: 0.44,
        basicSelfExpression: 0.42,
      }
    case "simple_conversation":
      return {
        basicInstructionUnderstanding: 0.72,
        helpRequestAbility: 0.68,
        survivalExpression: 0.7,
        peerInteractionReadiness: 0.68,
        basicSelfExpression: 0.7,
      }
    case "comfortable":
      return {
        basicInstructionUnderstanding: 0.88,
        helpRequestAbility: 0.84,
        survivalExpression: 0.86,
        peerInteractionReadiness: 0.84,
        basicSelfExpression: 0.86,
      }
    case "unsure":
      return {
        basicInstructionUnderstanding: 0.4,
        helpRequestAbility: 0.34,
        survivalExpression: 0.34,
        peerInteractionReadiness: 0.38,
        basicSelfExpression: 0.34,
      }
  }
}

function scoreAnxietySignals(shyness: LevelOption, separation: LevelOption): {
  readonly englishAnxietySignal: number
  readonly communicationAttemptTendency: number
  readonly helpPenalty: number
  readonly socialPenalty: number
} {
  const shynessScore = levelToAnxiety(shyness)
  const separationScore = levelToAnxiety(separation)
  return {
    englishAnxietySignal: average([shynessScore, separationScore * 0.7]),
    communicationAttemptTendency: 1 - average([shynessScore * 0.75, separationScore * 0.45]),
    helpPenalty: shynessScore * 0.16,
    socialPenalty: shynessScore * 0.12 + separationScore * 0.06,
  }
}

function levelToAnxiety(level: LevelOption): number {
  switch (level) {
    case "low":
      return 0.22
    case "medium":
      return 0.5
    case "high":
      return 0.78
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
