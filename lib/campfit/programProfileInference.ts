import type { Camp, ProgramType, SupportBuffer, SupportKey } from "@/types/campfit"
import type { PriceOptionRow, ProgramProfileRow, ProgramRow } from "@/lib/campfit/programCatalogSchemas"
import {
  hasAny,
  inferAgeRange,
  inferBudgetRange,
  inferDurationWeeks,
  inferScore,
  textBlob,
} from "@/lib/campfit/programProfileSignals"
import { clamp01 } from "@/lib/campfit/utils"

type ConcreteProgramType = Exclude<ProgramType, "unsure">

type CatalogContext = {
  readonly program: ProgramRow
  readonly prices: readonly PriceOptionRow[]
  readonly profile: ProgramProfileRow | undefined
}

export function buildCampFromCatalog(context: CatalogContext): Camp | null {
  if (context.program.visible !== true || context.program.is_listed !== true) {
    return null
  }

  const inferred = inferProfile(context.program, context.prices)
  const profile = context.profile?.active === true ? context.profile : undefined
  const programType = profile?.program_type ?? inferred.programType
  const flags = {
    koreanManager: profile?.korean_manager ?? inferred.koreanManager,
    parentAccompanied: profile?.parent_accompanied ?? inferred.parentAccompanied,
    koreanDormOption: profile?.korean_dorm_option ?? inferred.koreanDormOption,
    beginnerClass: profile?.beginner_class ?? inferred.beginnerClass,
    buddySystem: profile?.buddy_system ?? inferred.buddySystem,
    dailyParentReport: profile?.daily_parent_report ?? inferred.dailyParentReport,
    lowPressureSpeaking: profile?.low_pressure_speaking_environment ?? inferred.lowPressureSpeaking,
    smallGroupCare: profile?.small_group_care ?? inferred.smallGroupCare,
  }

  const slugFields = context.program.slug ? { anogroProgramSlug: context.program.slug } : {}

  return {
    id: context.program.id,
    anogroProgramId: context.program.id,
    ...slugFields,
    name: context.program.title ?? context.program.name ?? profile?.program_name ?? "이름 미정 프로그램",
    country: profile?.country ?? context.program.country ?? context.program.location_country ?? "국가 확인 필요",
    city: profile?.city ?? context.program.city ?? context.program.location_city ?? "도시 확인 필요",
    programType,
    ageMin: profile?.age_min ?? inferred.ageMin,
    ageMax: profile?.age_max ?? inferred.ageMax,
    budgetMinKrw: profile?.budget_min_krw ?? inferred.budgetMinKrw,
    budgetMaxKrw: profile?.budget_max_krw ?? inferred.budgetMaxKrw,
    durationWeeks: profile?.duration_weeks?.length ? profile.duration_weeks : inferred.durationWeeks,
    koreanManager: flags.koreanManager,
    parentAccompanied: flags.parentAccompanied,
    koreanDormOption: flags.koreanDormOption,
    beginnerClass: flags.beginnerClass,
    buddySystem: flags.buddySystem,
    dailyParentReport: flags.dailyParentReport,
    lowPressureSpeaking: flags.lowPressureSpeaking,
    smallGroupCare: flags.smallGroupCare,
    traits: profile?.traits?.length ? profile.traits : inferred.traits,
    difficulty: {
      englishExposure: normalizeProfileScore(profile?.english_exposure, inferred.englishExposure),
      boardingIndependence: normalizeProfileScore(profile?.boarding_independence, inferred.boardingIndependence),
      academicIntensity: normalizeProfileScore(profile?.academic_intensity, inferred.academicIntensity),
      foreignPeerInteraction: normalizeProfileScore(profile?.foreign_peer_interaction, inferred.foreignPeerInteraction),
      parentSeparation: normalizeProfileScore(profile?.parent_separation, inferred.parentSeparation),
    },
    supportBuffer: buildSupportBuffer(flags),
  }
}

function inferProfile(program: ProgramRow, prices: readonly PriceOptionRow[]) {
  const text = textBlob(program)
  const programType = inferProgramType(text)
  const parentAccompanied = hasAny(text, ["부모동반", "부모 동반", "가족캠프", "family", "parent", "보호자"])
  const boarding = hasAny(text, ["기숙", "boarding", "dorm", "숙소 포함", "아이만", "child_only"])
  const koreanManager = program.onsite_manager === true || program.local_presence === true || hasAny(text, ["한국어", "한국인", "korean"])
  const beginnerClass = hasAny(text, ["초급", "beginner", "입문", "기초", "young learner"])
  const buddySystem = hasAny(text, ["버디", "buddy", "멘토", "mentor"])
  const dailyParentReport = hasAny(text, ["리포트", "보고", "daily report", "생활 관리", "parent report"])
  const smallGroupCare = hasAny(text, ["소규모", "소그룹", "small group", "1:1", "관리형"]) || koreanManager
  const lowPressureSpeaking = programType === "activity" || programType === "creative_daycamp" || parentAccompanied
  const age = inferAgeRange(program)
  const budget = inferBudgetRange(program, prices)
  const durationWeeks = inferDurationWeeks(program, prices)

  return {
    programType,
    ageMin: age.min,
    ageMax: age.max,
    budgetMinKrw: budget.min,
    budgetMaxKrw: budget.max,
    durationWeeks,
    koreanManager,
    parentAccompanied,
    koreanDormOption: boarding && koreanManager,
    beginnerClass,
    buddySystem,
    dailyParentReport,
    lowPressureSpeaking,
    smallGroupCare,
    englishExposure: inferScore(text, 0.48, [
      ["영어몰입", 0.22],
      ["english", 0.12],
      ["어학", 0.14],
      ["schooling", 0.12],
      ["half-day", -0.12],
    ]),
    boardingIndependence: clamp01((boarding ? 0.72 : 0.28) + (parentAccompanied ? -0.24 : 0.08)),
    academicIntensity: inferScore(text, programType === "activity" || programType === "creative_daycamp" ? 0.36 : 0.58, [
      ["집중", 0.16],
      ["어학", 0.14],
      ["cambridge", 0.14],
      ["스포츠", -0.08],
      ["activity", -0.08],
      ["enrichment", -0.1],
    ]),
    foreignPeerInteraction: inferScore(text, 0.52, [
      ["국제", 0.1],
      ["international", 0.1],
      ["현지", 0.1],
      ["local", 0.08],
      ["한국", -0.08],
    ]),
    parentSeparation: clamp01((parentAccompanied ? 0.28 : 0.58) + (boarding ? 0.18 : 0)),
    traits: buildTraits(programType, {
      koreanManager,
      parentAccompanied,
      beginnerClass,
      boarding,
      lowPressureSpeaking,
      smallGroupCare,
    }),
  }
}

function inferProgramType(text: string): ConcreteProgramType {
  if (hasAny(text, ["가족캠프", "부모동반", "parent", "family"])) {
    return "family_esl"
  }
  if (hasAny(text, ["스쿨링", "schooling", "international school", "정규수업"])) {
    return "schooling"
  }
  if (hasAny(text, ["steam", "maker", "창의", "요리", "미술", "enrichment", "workshop"])) {
    return "creative_daycamp"
  }
  if (hasAny(text, ["스포츠", "sports", "activity", "액티비티", "outdoor"])) {
    return "activity"
  }
  if (hasAny(text, ["기숙", "boarding", "international", "global", "아이만"])) {
    return "international_camp"
  }
  return "managed_immersion"
}

function buildSupportBuffer(flags: {
  readonly koreanManager: boolean
  readonly parentAccompanied: boolean
  readonly koreanDormOption: boolean
  readonly beginnerClass: boolean
  readonly buddySystem: boolean
  readonly dailyParentReport: boolean
  readonly lowPressureSpeaking: boolean
  readonly smallGroupCare: boolean
}): SupportBuffer {
  const score = (enabled: boolean) => (enabled ? 0.82 : 0.28)
  return {
    beginner_class: score(flags.beginnerClass),
    korean_manager: score(flags.koreanManager),
    korean_dorm_option: score(flags.koreanDormOption),
    parent_accompanied: score(flags.parentAccompanied),
    buddy_system: score(flags.buddySystem),
    early_adaptation_support: score(flags.smallGroupCare || flags.koreanManager),
    daily_parent_report: score(flags.dailyParentReport),
    low_pressure_speaking_environment: score(flags.lowPressureSpeaking),
    small_group_care: score(flags.smallGroupCare),
  }
}

function buildTraits(
  programType: ConcreteProgramType,
  flags: {
    readonly koreanManager: boolean
    readonly parentAccompanied: boolean
    readonly beginnerClass: boolean
    readonly boarding: boolean
    readonly lowPressureSpeaking: boolean
    readonly smallGroupCare: boolean
  },
): readonly string[] {
  const traits = [labelForProgramType(programType)]
  if (flags.koreanManager) traits.push("한국어케어")
  if (flags.parentAccompanied) traits.push("가족동반")
  if (flags.beginnerClass) traits.push("초급지원")
  if (flags.boarding) traits.push("독립경험")
  if (flags.lowPressureSpeaking) traits.push("부담낮은노출")
  if (flags.smallGroupCare) traits.push("세심한관리")
  return traits.slice(0, 5)
}

function labelForProgramType(programType: ConcreteProgramType): string {
  switch (programType) {
    case "managed_immersion":
      return "관리형몰입"
    case "schooling":
      return "스쿨링"
    case "family_esl":
      return "가족ESL"
    case "activity":
      return "액티비티"
    case "creative_daycamp":
      return "창의데이캠프"
    case "international_camp":
      return "국제캠프"
  }
}

function normalizeProfileScore(value: number | null | undefined, fallback: number): number {
  if (value === null || value === undefined) {
    return fallback
  }
  return value > 1 ? clamp01(value / 5) : clamp01(value)
}
