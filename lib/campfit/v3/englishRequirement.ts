import type { CampfitV3EnglishReadiness } from "@/types/campfitV3"

export const englishRequirementLevels = [
  "no_requirement",
  "beginner_friendly",
  "general_english",
  "academic_english",
  "unknown",
] as const

export type EnglishRequirementLevel = (typeof englishRequirementLevels)[number]
export type EnglishRequirementSource = "official" | "inferred" | "demo_fixture" | "unknown"
export type EnglishRequirementMatchStatus =
  | "comfortable"
  | "manageable_with_support"
  | "english_burden_possible"
  | "official_requirement_mismatch"
  | "unknown"

export const instructionLanguageModes = [
  "english_only",
  "english_led",
  "bilingual",
  "activity_with_english",
  "other",
  "unknown",
] as const

export type InstructionLanguageMode = (typeof instructionLanguageModes)[number]

export type V3ProgramEnglishRequirement = {
  readonly level: EnglishRequirementLevel
  readonly source: EnglishRequirementSource
  readonly confidence: number | null
  readonly version: string | null
  readonly officialVerified: boolean
  readonly officialText: string | null
  readonly officialQualification: Record<string, unknown> | null
  readonly instructionLanguageMode: InstructionLanguageMode | null
  readonly beginnerParticipation: boolean | null
  /** Only populated when an official qualification explicitly maps to a readiness floor. */
  readonly officialMinimumReadiness: CampfitV3EnglishReadiness | null
}

export type EnglishRequirementMatch = {
  readonly status: EnglishRequirementMatchStatus
  readonly label: string
  readonly explanation: string
  readonly scoreAdjustment: number
  readonly verification: readonly string[]
}

const readinessRank: Readonly<Record<CampfitV3EnglishReadiness, number>> = {
  unknown: -1,
  support_required: 0,
  beginner_friendly: 1,
  general_program_ready: 2,
  academic_ready: 3,
}

const requirementRank: Readonly<Record<Exclude<EnglishRequirementLevel, "unknown">, number>> = {
  no_requirement: 0,
  beginner_friendly: 1,
  general_english: 2,
  academic_english: 3,
}

export const englishMatchLabels: Readonly<Record<EnglishRequirementMatchStatus, string>> = {
  comfortable: "현재 영어 준비도로 무리 없이 참여할 가능성이 높아요.",
  manageable_with_support: "조금 도전적일 수 있지만 지원이 있으면 고려할 수 있어요.",
  english_burden_possible: "원하는 경험에는 잘 맞지만 영어 부담이 있을 수 있어요.",
  official_requirement_mismatch: "공식 영어 조건을 충족하지 못할 가능성이 있어요.",
  unknown: "프로그램 영어 요구 수준을 아직 확인하지 못했어요.",
}

export function unknownProgramEnglishRequirement(): V3ProgramEnglishRequirement {
  return {
    level: "unknown",
    source: "unknown",
    confidence: null,
    version: null,
    officialVerified: false,
    officialText: null,
    officialQualification: null,
    instructionLanguageMode: null,
    beginnerParticipation: null,
    officialMinimumReadiness: null,
  }
}

export function isEnglishRequirementLevel(value: unknown): value is EnglishRequirementLevel {
  return typeof value === "string" && (englishRequirementLevels as readonly string[]).includes(value)
}

export function isInstructionLanguageMode(value: unknown): value is InstructionLanguageMode {
  return typeof value === "string" && (instructionLanguageModes as readonly string[]).includes(value)
}

export function assessEnglishRequirementMatch(
  readiness: CampfitV3EnglishReadiness,
  requirement: V3ProgramEnglishRequirement | null | undefined,
): EnglishRequirementMatch {
  const resolved = requirement ?? unknownProgramEnglishRequirement()
  if (resolved.officialVerified && resolved.officialMinimumReadiness !== null && readiness !== "unknown"
    && readinessRank[readiness] < readinessRank[resolved.officialMinimumReadiness]) {
    return match("official_requirement_mismatch", -12, ["공식 영어 자격조건과 아이의 현재 준비도 확인"])
  }

  if (resolved.level === "unknown" || readiness === "unknown") return match("unknown", 0, [])
  if (resolved.level === "no_requirement") return match("comfortable", 0, [])

  const delta = readinessRank[readiness] - requirementRank[resolved.level]
  if (delta >= 0) return match("comfortable", 0, [])
  if (delta === -1) return match("manageable_with_support", -2, ["영어 수업 방식과 초반 지원 범위 확인"])
  return match("english_burden_possible", -4, ["영어 설명·발표·프로젝트 참여 수준과 지원 범위 확인"])
}

function match(
  status: EnglishRequirementMatchStatus,
  scoreAdjustment: number,
  verification: readonly string[],
): EnglishRequirementMatch {
  return {
    status,
    label: englishMatchLabels[status],
    explanation: englishMatchLabels[status],
    scoreAdjustment,
    verification,
  }
}

export function officialSourceLabel(source: EnglishRequirementSource): string {
  if (source === "official") return "공식 확인"
  if (source === "inferred") return "설명 기반 추론"
  if (source === "demo_fixture") return "데모 테스트 데이터"
  return "확인되지 않음"
}
