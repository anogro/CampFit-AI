import type { ExperienceDirectionKey } from "@/types/campfitV3"

export type V3CatalogSource = "supabase" | "demo" | "unavailable"

export type V3ParticipationMode =
  | "parent_required"
  | "parent_recommended"
  | "child_only_allowed"
  | "unknown"

export type V3StayMode = "day" | "family_stay" | "child_residential" | "homestay" | "mixed" | "unknown"

export type V3ChildParticipationMode = "day_independent" | "parent_joint" | "residential_child_only" | "mixed" | "unknown"

export type V3ParentProgramParticipation = "required" | "allowed" | "not_allowed" | "not_applicable" | "unknown"

export type V3ParentCityStayCompatibility = "compatible" | "incompatible" | "unknown"

export type V3ParentLodgingCompatibility = "same_lodging_available" | "nearby_lodging_possible" | "not_available" | "unknown"

export type V3ChildLodgingMode = "with_parent" | "residential_camp" | "homestay" | "day_only" | "mixed" | "unknown"

export type V3ParentFitStatus = "match" | "mismatch" | "needs_confirmation" | "unknown"

export type V3ParentStayPreferences = {
  readonly parentCityStay: "required" | "not_required" | "unknown"
  readonly parentProgramParticipation: "required" | "not_required" | "unknown"
  readonly sameLodging: "required" | "optional" | "unknown"
  readonly childResidential: "allowed" | "not_allowed" | "unknown"
  readonly dayProgramIndependent: "allowed" | "not_allowed" | "unknown"
  readonly nearbyLodging: "allowed" | "not_allowed" | "unknown"
}

export type V3ParentScopeAssessment = {
  readonly childParticipationMode: V3ChildParticipationMode
  readonly parentProgramParticipation: V3ParentProgramParticipation
  readonly parentCityStayCompatibility: V3ParentCityStayCompatibility
  readonly parentLodgingCompatibility: V3ParentLodgingCompatibility
  readonly childLodgingMode: V3ChildLodgingMode
  readonly parentFitStatus: V3ParentFitStatus
  readonly parentFitReasons: readonly string[]
  readonly evidence: readonly string[]
  readonly conflict: boolean
}

export type V3ParentScope = {
  readonly participationMode: V3ParticipationMode
  readonly stayMode: V3StayMode
  readonly guardianNearbyCompatible: boolean | null
  /** Internal normalized assessment; legacy fields remain for existing catalog fixtures and callers. */
  readonly assessment?: V3ParentScopeAssessment
}

export type V3SessionWindow = {
  readonly startDate: string
  readonly endDate: string
  readonly weeks: number | null
  readonly status: string | null
  readonly source: "program_sessions" | "program_text"
  readonly precision: "exact" | "season"
}

export type V3DirectionSignals = Readonly<Record<ExperienceDirectionKey, number>>

export type ExperienceTag =
  | "school"
  | "english_intensive"
  | "english_immersive"
  | "stem"
  | "science"
  | "technology"
  | "coding"
  | "robotics"
  | "maker"
  | "design"
  | "creative_project"
  | "problem_solving"
  | "nature"
  | "environment"
  | "outdoor"
  | "sports"
  | "culture"
  | "local_experience"
  | "arts"
  | "performance"
  | "leadership"
  | "collaboration"
  | "presentation"
  | "life_skills"

export type ExperienceSignalStatus =
  | "confirmed_strong"
  | "confirmed_moderate"
  | "confirmed_weak"
  | "unknown"

export type V3ExperienceEvidence = {
  readonly source: string
  readonly value: string
  readonly tags: readonly ExperienceTag[]
  readonly confidence: "high" | "medium" | "low"
}

export type V3ExperienceTagSignal = {
  readonly tag: ExperienceTag
  readonly score: number
  readonly status: ExperienceSignalStatus
  readonly confidence: "high" | "medium" | "low"
  readonly evidence: readonly V3ExperienceEvidence[]
}

export type V3ExperienceAssessment = {
  readonly tags: readonly V3ExperienceTagSignal[]
  readonly directionScores: V3DirectionSignals
  readonly directionStatuses: Readonly<Record<ExperienceDirectionKey, ExperienceSignalStatus>>
  readonly primaryDirection: ExperienceDirectionKey
  readonly secondaryDirections: readonly ExperienceDirectionKey[]
  readonly evidence: readonly V3ExperienceEvidence[]
  readonly confidence: "high" | "medium" | "low"
}

export type V3DateRange = {
  readonly startDate: string
  readonly endDate: string
}

type CatalogRow = Readonly<Record<string, unknown>>

export function isPublicV3ProgramRow(row: CatalogRow, today: string): boolean {
  if (readRowString(row, "status")?.toLowerCase() !== "active") return false
  if (row["visible"] !== true || row["is_listed"] !== true) return false
  const expiredAt = readRowString(row, "list_expired_at")
  return expiredAt === undefined || expiredAt.slice(0, 10) >= today
}

/** Cities created before the listing flag existed remain readable; only an explicit false is private. */
export function isVisibleV3CityRow(row: CatalogRow): boolean {
  return row["is_listed"] !== false
}

export function inferParentScope(input: {
  readonly participationText: string
  readonly accommodationText: string
  readonly groupText: string
  readonly coverageText: string
  readonly nameText: string
  readonly profileParentAccompanied: boolean | null
}): V3ParentScope {
  const participation = normalizeText(input.participationText)
  const accommodation = normalizeText(input.accommodationText)
  const fallback = normalizeText([input.groupText, input.coverageText, input.nameText].join(" "))
  const parentRequired = /(부모\s*동반\s*필수|parent[_\s-]*(?:required|must)|guardian[_\s-]*required)/i.test(participation)
  const parentRecommended = /(부모\s*동반\s*권장|parent[_\s-]*recommended|부모동반\/현지\s*체류형)/i.test(participation)
  const childOnly = isExplicitChildOnlyParticipation(participation)
  const homestay = /(homestay|홈스테이)/i.test(accommodation)
  const residential = /(boarding|residential|기숙|dormitor|residence|학생\s*숙소|campus\s*residence)/i.test(accommodation)
  const dayProgram = /(day[_\s-]*(?:camp|program|programme)|낮\s*프로그램|통학형)/i.test(accommodation)
  const lodgingSeparate = /(숙소\s*별도|accommodation[_\s-]*(?:not[_\s-]*included|separate)|self[-_\s]*arranged)/i.test(accommodation)
  const accommodationAbsent = /(숙소\s*(?:없음|제공\s*없음)|accommodation[_\s-]*(?:unavailable|none))/i.test(accommodation)
  const accommodationUnclear = /accommodation[_\s-]*not[_\s-]*described/i.test(accommodation)
  const day = dayProgram || lodgingSeparate || accommodationAbsent || accommodationUnclear
  const familyStay = /(family[_\s-]*stay|가족\s*숙소|부모\s*숙박)/i.test(accommodation)
  const mixed = /(self[-_\s]*arranged|자체\s*숙소|선택\s*가능|option|mixed)/i.test(accommodation)
  const parentCityStayIncompatible = /(부모\s*현지\s*체류\s*(?:불가|불가능)|보호자\s*현지\s*체류\s*(?:불가|불가능)|parents?\s*(?:cannot|can't|not\s*allowed)\s*stay\s*nearby|no\s+(?:parent|guardian)\s*stay\s*nearby)/i.test(accommodation)
  const parentLodgingUnavailable = /(부모\s*(?:숙소|숙박)\s*(?:불가|불가능|제공\s*없음)|보호자\s*(?:숙소|숙박)\s*(?:불가|불가능|제공\s*없음)|(?:parent|guardian)\s*(?:lodging|accommodation)\s*(?:unavailable|not\s*available|not\s*provided))/i.test(accommodation)
  const clearDay = dayProgram || lodgingSeparate || accommodationAbsent

  const participationMode: V3ParticipationMode = childOnly
    ? "child_only_allowed"
    : parentRequired
      ? "parent_required"
      : parentRecommended
      ? "parent_recommended"
      : "unknown"

  const profileConflict = (childOnly && input.profileParentAccompanied === true)
    || ((parentRequired || parentRecommended) && input.profileParentAccompanied === false)
  const rawConflict = childOnly && (parentRequired || parentRecommended)
  const lodgingConflict = (parentRequired || parentRecommended) && parentCityStayIncompatible
  const conflict = profileConflict || rawConflict || lodgingConflict
  const evidence = [
    input.participationText.trim() ? `parent_participation_type: ${input.participationText.trim()}` : null,
    input.accommodationText.trim() ? `accommodation_type: ${input.accommodationText.trim()}` : null,
    input.groupText.trim() ? `group_composition: ${input.groupText.trim()}` : null,
    input.coverageText.trim() ? `coverage_schedule: ${input.coverageText.trim()}` : null,
    input.profileParentAccompanied !== null ? `profile.parent_accompanied: ${String(input.profileParentAccompanied)}` : null,
  ].filter((value): value is string => value !== null)
  const conflictReason = conflict ? ["원본 참여 정보와 profile·숙소 정보가 충돌해 확인이 필요합니다."] : []

  const makeScope = (values: {
    readonly stayMode: V3StayMode
    readonly guardianNearbyCompatible: boolean | null
    readonly childParticipationMode: V3ChildParticipationMode
    readonly parentProgramParticipation: V3ParentProgramParticipation
    readonly parentCityStayCompatibility: V3ParentCityStayCompatibility
    readonly parentLodgingCompatibility: V3ParentLodgingCompatibility
    readonly childLodgingMode: V3ChildLodgingMode
    readonly parentFitStatus: V3ParentFitStatus
    readonly parentFitReasons?: readonly string[]
  }): V3ParentScope => ({
    participationMode,
    stayMode: values.stayMode,
    guardianNearbyCompatible: values.guardianNearbyCompatible,
    assessment: {
      childParticipationMode: values.childParticipationMode,
      parentProgramParticipation: values.parentProgramParticipation,
      parentCityStayCompatibility: values.parentCityStayCompatibility,
      parentLodgingCompatibility: values.parentLodgingCompatibility,
      childLodgingMode: values.childLodgingMode,
      parentFitStatus: conflict ? "needs_confirmation" : values.parentFitStatus,
      parentFitReasons: Array.from(new Set([...conflictReason, ...(values.parentFitReasons ?? [])])),
      evidence,
      conflict,
    },
  })

  // Child-only describes who joins the program, not whether a parent can stay in the same city.
  if (childOnly) {
    const childLodgingMode: V3ChildLodgingMode = homestay
      ? "homestay"
      : residential
        ? "residential_camp"
        : familyStay
          ? "with_parent"
          : dayProgram || lodgingSeparate || accommodationAbsent
            ? "day_only"
            : "unknown"
    const parentCityStayCompatibility: V3ParentCityStayCompatibility = parentCityStayIncompatible
      ? "incompatible"
      : dayProgram || lodgingSeparate || accommodationAbsent || familyStay
        ? "compatible"
        : "unknown"
    const parentLodgingCompatibility: V3ParentLodgingCompatibility = parentLodgingUnavailable
      ? "not_available"
      : familyStay
        ? "same_lodging_available"
        : dayProgram || lodgingSeparate || accommodationAbsent
          ? "nearby_lodging_possible"
          : "unknown"
    return makeScope({
      stayMode: homestay ? "homestay" : residential ? "child_residential" : clearDay ? "day" : "unknown",
      guardianNearbyCompatible: parentCityStayCompatibility === "compatible" ? true : parentCityStayCompatibility === "incompatible" ? false : null,
      childParticipationMode: homestay || residential ? "residential_child_only" : dayProgram || lodgingSeparate || accommodationAbsent ? "day_independent" : "unknown",
      parentProgramParticipation: "not_allowed",
      parentCityStayCompatibility,
      parentLodgingCompatibility,
      childLodgingMode,
      parentFitStatus: parentCityStayCompatibility === "incompatible" ? "mismatch" : parentCityStayCompatibility === "compatible" ? "match" : "unknown",
      parentFitReasons: [
        "아이의 프로그램 참여는 보호자 없이 가능한 형태로 표시되어 있습니다.",
        ...(parentCityStayCompatibility === "unknown" ? ["부모가 같은 도시·근처에 머무를 수 있는지는 별도 확인이 필요합니다."] : []),
        ...(childLodgingMode === "residential_camp" || childLodgingMode === "homestay" ? ["아이 숙소가 기숙형·홈스테이인지 확인이 필요합니다."] : []),
        ...(parentLodgingCompatibility === "not_available" ? ["프로그램 내 부모 숙소는 제공되지 않는 것으로 표시되어 있습니다."] : []),
      ],
    })
  }

  const explicitParentParticipation = parentRequired || parentRecommended
  const inferredParentProgramParticipation: V3ParentProgramParticipation = parentRequired
    ? "required"
    : parentRecommended
      ? "allowed"
      : "unknown"
  const inferredChildParticipation = parentRequired ? "parent_joint" : parentRecommended ? "mixed" : "unknown"
  const inferredChildLodging: V3ChildLodgingMode = homestay
    ? "homestay"
    : residential
      ? "residential_camp"
      : familyStay
        ? "with_parent"
        : dayProgram || lodgingSeparate || accommodationAbsent || accommodationUnclear
          ? "day_only"
          : mixed
            ? "mixed"
            : "unknown"

  // Explicit participation and accommodation fields always outrank labels or names.
  if ((parentRequired || parentRecommended) && (homestay || residential) && !day && !familyStay) {
    return makeScope({
      stayMode: "mixed",
      guardianNearbyCompatible: null,
      childParticipationMode: "mixed",
      parentProgramParticipation: inferredParentProgramParticipation,
      parentCityStayCompatibility: "unknown",
      parentLodgingCompatibility: "unknown",
      childLodgingMode: inferredChildLodging,
      parentFitStatus: "needs_confirmation",
      parentFitReasons: ["부모 프로그램 참여 정보와 아이 숙소 운영 방식이 함께 확인되어야 합니다."],
    })
  }
  if (explicitParentParticipation) {
    const parentCityStayCompatibility: V3ParentCityStayCompatibility = parentCityStayIncompatible ? "incompatible" : "compatible"
    const parentLodgingCompatibility: V3ParentLodgingCompatibility = parentLodgingUnavailable
      ? "not_available"
      : familyStay
        ? "same_lodging_available"
        : dayProgram || lodgingSeparate || accommodationAbsent
          ? "nearby_lodging_possible"
          : "unknown"
    return makeScope({
      stayMode: clearDay ? "day" : familyStay ? "family_stay" : mixed ? "mixed" : "unknown",
      guardianNearbyCompatible: parentCityStayCompatibility === "incompatible" ? false : true,
      childParticipationMode: inferredChildParticipation,
      parentProgramParticipation: inferredParentProgramParticipation,
      parentCityStayCompatibility,
      parentLodgingCompatibility,
      childLodgingMode: inferredChildLodging,
      parentFitStatus: parentCityStayCompatibility === "incompatible" ? "mismatch" : parentLodgingCompatibility === "unknown" ? "needs_confirmation" : "match",
      parentFitReasons: [
        ...(parentLodgingCompatibility === "unknown" ? ["부모가 같은 도시·근처에서 머무를 숙소 형태는 확인이 필요합니다."] : []),
        ...(parentLodgingCompatibility === "not_available" ? ["프로그램 내 부모 숙소는 제공되지 않는 것으로 표시되어 있습니다."] : []),
      ],
    })
  }
  if (homestay && !day) {
    return makeScope({
      stayMode: "homestay",
      guardianNearbyCompatible: null,
      childParticipationMode: "residential_child_only",
      parentProgramParticipation: "unknown",
      parentCityStayCompatibility: "unknown",
      parentLodgingCompatibility: "unknown",
      childLodgingMode: "homestay",
      parentFitStatus: "unknown",
      parentFitReasons: ["홈스테이 참여는 확인되지만 부모의 같은 도시·근처 체류 가능 여부는 확인이 필요합니다."],
    })
  }
  if (day) {
    return makeScope({
      stayMode: clearDay ? "day" : "unknown",
      guardianNearbyCompatible: clearDay ? true : null,
      childParticipationMode: clearDay ? "day_independent" : "unknown",
      parentProgramParticipation: "not_applicable",
      parentCityStayCompatibility: clearDay ? "compatible" : "unknown",
      parentLodgingCompatibility: clearDay ? "nearby_lodging_possible" : "unknown",
      childLodgingMode: clearDay ? "day_only" : "unknown",
      parentFitStatus: clearDay ? "match" : "unknown",
      parentFitReasons: accommodationUnclear ? ["프로그램이 낮 운영인지와 부모 숙소를 별도로 확인해야 합니다."] : [],
    })
  }
  if (familyStay) {
    return makeScope({
      stayMode: "family_stay",
      guardianNearbyCompatible: true,
      childParticipationMode: "mixed",
      parentProgramParticipation: "allowed",
      parentCityStayCompatibility: "compatible",
      parentLodgingCompatibility: "same_lodging_available",
      childLodgingMode: "with_parent",
      parentFitStatus: "match",
    })
  }
  if (mixed) {
    return makeScope({
      stayMode: "mixed",
      guardianNearbyCompatible: null,
      childParticipationMode: "mixed",
      parentProgramParticipation: "unknown",
      parentCityStayCompatibility: "unknown",
      parentLodgingCompatibility: "nearby_lodging_possible",
      childLodgingMode: "mixed",
      parentFitStatus: "needs_confirmation",
      parentFitReasons: ["부모와 아이의 실제 숙소 배치를 확인해야 합니다."],
    })
  }
  if (residential) {
    return makeScope({
      stayMode: "child_residential",
      guardianNearbyCompatible: null,
      childParticipationMode: "residential_child_only",
      parentProgramParticipation: "unknown",
      parentCityStayCompatibility: "unknown",
      parentLodgingCompatibility: "unknown",
      childLodgingMode: "residential_camp",
      parentFitStatus: "unknown",
      parentFitReasons: ["아이 기숙형 숙소는 표시되어 있지만 부모의 같은 도시·근처 체류 가능 여부는 확인이 필요합니다."],
    })
  }

  // Use group/coverage/name only when the structured fields did not decide the scope.
  if (!participation && !accommodation) {
    if (/(부모\s*동반\s*(?:필수|권장)|family\s*camp|가족\s*캠프|가족형)/i.test(fallback)) {
      const fallbackParentRequired = /(필수|required|must)/i.test(fallback)
      const fallbackDay = /(day\s*(?:camp|program)|통학형|낮\s*프로그램)/i.test(fallback)
      return {
        ...makeScope({
          stayMode: fallbackDay ? "day" : "unknown",
          guardianNearbyCompatible: true,
          childParticipationMode: fallbackParentRequired ? "parent_joint" : "mixed",
          parentProgramParticipation: fallbackParentRequired ? "required" : "allowed",
          parentCityStayCompatibility: "compatible",
          parentLodgingCompatibility: fallbackDay ? "nearby_lodging_possible" : "unknown",
          childLodgingMode: fallbackDay ? "day_only" : "unknown",
          parentFitStatus: fallbackDay ? "match" : "needs_confirmation",
          parentFitReasons: fallbackDay ? [] : ["부모 숙소 형태는 확인이 필요합니다."],
        }),
        participationMode: fallbackParentRequired ? "parent_required" : "parent_recommended",
      }
    }
    if (/(homestay|홈스테이|boarding|residential|기숙|dormitor)/i.test(fallback)) {
      const fallbackHomestay = /homestay|홈스테이/i.test(fallback)
      return makeScope({
        stayMode: fallbackHomestay ? "homestay" : "child_residential",
        guardianNearbyCompatible: null,
        childParticipationMode: "residential_child_only",
        parentProgramParticipation: "unknown",
        parentCityStayCompatibility: "unknown",
        parentLodgingCompatibility: "unknown",
        childLodgingMode: fallbackHomestay ? "homestay" : "residential_camp",
        parentFitStatus: "unknown",
        parentFitReasons: ["아이 숙소는 확인되지만 부모 체류 방식은 확인이 필요합니다."],
      })
    }
    if (/(day\s*(?:camp|program)|통학형|낮\s*프로그램|월\s*[-~]\s*금|monday\s*[-–]\s*friday)/i.test(fallback)) {
      return makeScope({
        stayMode: "day",
        guardianNearbyCompatible: true,
        childParticipationMode: "day_independent",
        parentProgramParticipation: "not_applicable",
        parentCityStayCompatibility: "compatible",
        parentLodgingCompatibility: "nearby_lodging_possible",
        childLodgingMode: "day_only",
        parentFitStatus: "match",
      })
    }
  }
  if (input.profileParentAccompanied === true) {
    return makeScope({
      stayMode: "unknown",
      guardianNearbyCompatible: true,
      childParticipationMode: "unknown",
      parentProgramParticipation: "allowed",
      parentCityStayCompatibility: "compatible",
      parentLodgingCompatibility: "unknown",
      childLodgingMode: "unknown",
      parentFitStatus: "needs_confirmation",
      parentFitReasons: ["profile상 부모 동반은 표시되지만 프로그램 참여와 숙소 형태는 확인이 필요합니다."],
    })
  }
  return makeScope({
    stayMode: "unknown",
    guardianNearbyCompatible: null,
    childParticipationMode: "unknown",
    parentProgramParticipation: "unknown",
    parentCityStayCompatibility: "unknown",
    parentLodgingCompatibility: "unknown",
    childLodgingMode: "unknown",
    parentFitStatus: "unknown",
    parentFitReasons: ["부모 참여·도시 체류·숙소 정보가 충분하지 않아 확인이 필요합니다."],
  })
}

export function inferDirectionSignals(input: {
  readonly profileProgramType: string | null
  readonly traits: readonly string[]
  readonly structuredText?: string
  readonly fallbackText?: string
}): V3DirectionSignals {
  const profileType = normalizeText(input.profileProgramType ?? "")
  const structuredText = normalizeText([...input.traits, input.structuredText ?? ""].join(" "))
  const scores: Record<ExperienceDirectionKey, number> = {
    schoolSchooling: 10,
    englishIntensive: 10,
    subjectProject: 10,
    cultureActivity: 10,
  }

  if (profileType === "schooling") scores.schoolSchooling = 95
  if (profileType === "managed_immersion" || profileType === "family_esl") scores.englishIntensive = 90
  if (profileType === "creative_daycamp") scores.subjectProject = 95
  if (profileType === "activity") scores.cultureActivity = 95
  if (profileType === "international_camp") {
    scores.schoolSchooling = 45
    scores.englishIntensive = 45
    scores.cultureActivity = 45
  }

  applyDirectionKeywords(scores, structuredText)
  // Description/name text is only a fallback when structured evidence produced no usable match.
  if (Math.max(...Object.values(scores)) < 55) {
    applyDirectionKeywords(scores, normalizeText(input.fallbackText ?? ""))
  }
  return scores
}

export function inferExperienceAssessment(input: {
  readonly profileProgramType: string | null
  readonly traits: readonly string[]
  readonly sources: readonly {
    readonly source: string
    readonly text: string
    readonly confidence?: "high" | "medium" | "low"
  }[]
}): V3ExperienceAssessment {
  const profileType = normalizeText(input.profileProgramType ?? "")
  const directionScores: Record<ExperienceDirectionKey, number> = {
    schoolSchooling: profileType === "schooling" ? 95 : 10,
    englishIntensive: profileType === "managed_immersion" || profileType === "family_esl" ? 90 : 10,
    subjectProject: profileType === "creative_daycamp" ? 95 : 10,
    cultureActivity: profileType === "activity" ? 95 : 10,
  }
  const evidence: V3ExperienceEvidence[] = []
  const tagEvidence = new Map<ExperienceTag, V3ExperienceEvidence[]>()

  const profileTags = profileExperienceTags(profileType)
  if (profileTags.length) {
    addExperienceEvidence(tagEvidence, evidence, {
      source: "program_profile.program_type",
      value: input.profileProgramType ?? "",
      tags: profileTags,
      confidence: "high",
    })
  }
  if (input.traits.length) {
    addSourceExperienceEvidence(tagEvidence, evidence, "program_profile.traits", input.traits.join(", "), input.traits.join(" "), "high")
  }
  for (const source of input.sources) {
    const text = source.text.trim()
    if (!text) continue
    const confidence = source.confidence ?? sourceConfidence(source.source)
    addSourceExperienceEvidence(tagEvidence, evidence, source.source, text, text, confidence)
  }

  const tags = [...tagEvidence.entries()].map(([tag, tagEvidenceItems]): V3ExperienceTagSignal => {
    const score = Math.max(...tagEvidenceItems.map((item) => evidenceScore(item.confidence)))
    const confidence = scoreConfidence(score)
    return { tag, score, status: signalStatus(score), confidence, evidence: tagEvidenceItems }
  }).sort((left, right) => right.score - left.score || left.tag.localeCompare(right.tag))

  for (const signal of tags) {
    for (const direction of directionsForExperienceTag(signal.tag)) {
      directionScores[direction] = Math.max(directionScores[direction], signal.score)
    }
  }
  const directionKeys: readonly ExperienceDirectionKey[] = ["schoolSchooling", "englishIntensive", "subjectProject", "cultureActivity"]
  const directionStatuses = Object.fromEntries(directionKeys.map((key) => [key, signalStatus(directionScores[key]!)])) as Record<ExperienceDirectionKey, ExperienceSignalStatus>
  const sortedDirections = [...directionKeys].sort((left, right) => directionScores[right]! - directionScores[left]!)
  const primaryDirection = sortedDirections[0] ?? "cultureActivity"
  const primaryScore = directionScores[primaryDirection]
  const secondaryDirections = sortedDirections
    .filter((key) => key !== primaryDirection && directionStatuses[key] !== "unknown" && directionScores[key] >= primaryScore - 20)
    .slice(0, 2)
  const confidence = evidence.length ? scoreConfidence(Math.max(...evidence.map((item) => evidenceScore(item.confidence)))) : "low"
  return {
    tags,
    directionScores,
    directionStatuses,
    primaryDirection,
    secondaryDirections,
    evidence,
    confidence,
  }
}

const experienceTagPatterns: Readonly<Record<ExperienceTag, readonly RegExp[]>> = {
  school: [/\b(?:school|schooling|academic|classroom)\b/i, /\uD559\uAD50|\uD559\uC2B5|\uC218\uC5C5/u],
  english_intensive: [/\b(?:english\s+intensive|esl|language\s+school|english\s+class)\b/i, /\uC601\uC5B4\s*(?:\uC9D1\uC911|\uC218\uC5C5)/u],
  english_immersive: [/\b(?:immersion|immersive|english[-\s]+led|use\s+english|english\s+environment)\b/i, /\uC601\uC5B4\s*(?:\uBAB0\uC785|\uD65C\uC6A9|\uD658\uACBD)/u],
  stem: [/\b(?:stem|steam)\b/i, /\uACFC\uD559\s*\uAE30\uC220/u],
  science: [/\b(?:science|experiment|laboratory|physics|chemistry|biology)\b/i, /\uACFC\uD559|\uC2E4\uD5D8/u],
  technology: [/\b(?:technology|engineering|computer\s+science|digital|electronics)\b/i, /\uACF5\uD559|\uAE30\uC220|\uC804\uC790/u],
  coding: [/\b(?:coding|programming)\b/i, /\uCF54\uB529|\uD504\uB85C\uADF8\uB798\uBC0D/u],
  robotics: [/\brobot(?:ics)?\b/i, /\uB85C\uBD07/u],
  maker: [/\b(?:maker|building|construction|hands[-\s]+on|prototype|craft)\b/i, /\uB9CC\uB4E4\uAE30|\uC81C\uC791/u],
  design: [/\b(?:design(?:\s+thinking)?)\b/i, /\uB514\uC790\uC778|\uC124\uACC4/u],
  creative_project: [/\bcreative[-\s]+project\b|\bproject[-\s]+based\b/i, /\uCC3D\uC758\s*(?:\uD65C\uB3D9|\uD504\uB85C\uC81D\uD2B8)|\uCC3D\uC791\s*\uD65C\uB3D9/u],
  problem_solving: [/\bproblem[-\s]+solving\b|\bdesign\s+challenge\b/i, /\uBB38\uC81C\s*\uD574\uACB0|\uCC3C\uB9B0\uC9C0/u],
  nature: [/\b(?:nature|forest|ecology|marine|plant|animal|wildlife)\b/i, /\uC790\uC5F0|\uC0B0\uB9BC|\uC0DD\uD0DC|\uD574\uC591|\uC2DD\uBB3C|\uB3D9\uBB3C/u],
  environment: [/\b(?:environment|ecology|sustainability)\b/i, /\uD658\uACBD|\uC0DD\uD0DC|\uC9C0\uC18D\uAC00\uB2A5/u],
  outdoor: [/\boutdoor\b(?!\s+pool)|\bhiking\b|\bfield\s+trip\b|\bgardening\b/i, /\uC57C\uC678\s*(?:\uD65C\uB3D9|\uCCB4\uD5D8)|\uC0B0\uCC45|\uC57C\uC678/u],
  sports: [/\b(?:sports?|football|soccer|basketball|swimming)\b/i, /\uC2A4\uD3EC\uCE20|\uCD95\uAD6C|\uB18D\uAD6C|\uC218\uC601/u],
  culture: [/\b(?:culture|heritage|history|traditional|museum)\b/i, /\uBB38\uD654|\uC720\uC0B0|\uC5ED\uC0AC|\uC804\uD1B5|\uBC15\uBB3C\uAD00/u],
  local_experience: [/\b(?:local\s+culture|community|city\s+exploration|cultural\s+exchange)\b/i, /\uC9C0\uC5ED\s*\uBB38\uD654|\uCEE4\uBBA4\uB2C8\uD2F0|\uB3C4\uC2DC\s*\uD0D0\uBC29|\uBB38\uD654\s*\uAD50\uB958/u],
  arts: [/\b(?:art|drawing|painting|music|dance|drama|theater)\b/i, /\uBBF8\uC220|\uADF8\uB9BC|\uD68C\uD654|\uC74C\uC545|\uB304\uC2A4|\uC5F0\uADF9/u],
  performance: [/\b(?:performance|concert|stage)\b/i, /\uACF5\uC5F0|\uCF58\uC11C\uD2B8|\uBB34\uB300/u],
  leadership: [/\bleadership\b/i, /\uB9AC\uB354\uC2ED/u],
  collaboration: [/\b(?:teamwork|group\s+project|collaboration|team)\b/i, /\uD611\uB825|\uD300\uC6CC\uD06C|\uADF8\uB8F9\s*\uD504\uB85C\uC81D\uD2B8/u],
  presentation: [/\b(?:presentation|debate|communication)\b/i, /\uBC1C\uD45C|\uD1A0\uB860|\uC18C\uD1B5/u],
  life_skills: [/\blife[-\s]+skills?\b|\bindependence\b/i, /\uC0DD\uD65C\s*\uAE30\uC220|\uC790\uB9BD/u],
}

function profileExperienceTags(profileType: string): readonly ExperienceTag[] {
  if (profileType === "schooling") return ["school"]
  if (profileType === "managed_immersion") return ["english_immersive"]
  if (profileType === "family_esl") return ["english_intensive"]
  if (profileType === "creative_daycamp") return ["creative_project"]
  if (profileType === "activity") return ["culture"]
  return []
}

function addSourceExperienceEvidence(
  tagEvidence: Map<ExperienceTag, V3ExperienceEvidence[]>,
  evidence: V3ExperienceEvidence[],
  source: string,
  value: string,
  text: string,
  confidence: "high" | "medium" | "low",
): void {
  const tags = matchExperienceTags(text)
  if (!tags.length) return
  addExperienceEvidence(tagEvidence, evidence, { source, value, tags, confidence })
}

function addExperienceEvidence(
  tagEvidence: Map<ExperienceTag, V3ExperienceEvidence[]>,
  evidence: V3ExperienceEvidence[],
  item: V3ExperienceEvidence,
): void {
  const existing = evidence.find((candidate) => candidate.source === item.source && candidate.value === item.value)
  if (!existing) evidence.push(item)
  for (const tag of item.tags) {
    const items = tagEvidence.get(tag) ?? []
    if (!items.some((candidate) => candidate.source === item.source && candidate.value === item.value)) items.push(item)
    tagEvidence.set(tag, items)
  }
}

function matchExperienceTags(text: string): readonly ExperienceTag[] {
  const normalized = normalizeText(text).replace(/[-_]+/g, " ")
  const tags = (Object.entries(experienceTagPatterns) as readonly [ExperienceTag, readonly RegExp[]][])
    .filter(([, patterns]) => patterns.some((pattern) => pattern.test(normalized)))
    .map(([tag]) => tag)
  const hasProject = /\bproject\b|\uD504\uB85C\uC81D\uD2B8/u.test(normalized)
  if (hasProject && /\b(?:creative|maker|design|prototype|problem|group)\b|\uCC3D\uC758|\uB9CC\uB4E4\uAE30|\uB514\uC790\uC778|\uBB38\uC81C/u.test(normalized) && !tags.includes("creative_project")) {
    return [...tags, "creative_project"]
  }
  return tags
}

function directionsForExperienceTag(tag: ExperienceTag): readonly ExperienceDirectionKey[] {
  if (["school"].includes(tag)) return ["schoolSchooling"]
  if (["english_intensive", "english_immersive"].includes(tag)) return ["englishIntensive"]
  if (["stem", "science", "technology", "coding", "robotics", "maker", "design", "creative_project", "problem_solving"].includes(tag)) return ["subjectProject"]
  if (["culture", "local_experience", "nature", "environment", "outdoor", "sports", "arts", "performance", "life_skills"].includes(tag)) return ["cultureActivity"]
  return ["schoolSchooling", "englishIntensive"]
}

function sourceConfidence(source: string): "high" | "medium" | "low" {
  if (/profile|activity|curriculum|category|subject|traits/i.test(source)) return "high"
  if (/session|highlight/i.test(source)) return "medium"
  return "low"
}

function evidenceScore(confidence: "high" | "medium" | "low"): number {
  return confidence === "high" ? 90 : confidence === "medium" ? 55 : 25
}

function scoreConfidence(score: number): "high" | "medium" | "low" {
  return score >= 85 ? "high" : score >= 50 ? "medium" : "low"
}

function signalStatus(score: number): ExperienceSignalStatus {
  return score <= 15 ? "unknown" : score >= 85 ? "confirmed_strong" : score >= 50 ? "confirmed_moderate" : "confirmed_weak"
}

function applyDirectionKeywords(scores: Record<ExperienceDirectionKey, number>, text: string): void {
  if (/(international\s*school|국제학교|현지학교|schooling|정규\s*수업|school\s*class|학교\s*환경)/i.test(text)) {
    scores.schoolSchooling = Math.max(scores.schoolSchooling, 88)
  }
  if (/(english|영어|esl|language\s*school|어학|immersion|몰입)/i.test(text)) {
    scores.englishIntensive = Math.max(scores.englishIntensive, 82)
  }
  if (/(\bstem\b|\bsteam\b|\bcoding\b|코딩|\brobot(?:ics)?\b|로봇|\bmaker\b|\bscience\b|과학|\btechnology\b|\bengineering\b|\bproject(?:s)?\b|프로젝트|\bcreative\s+(?:project|arts?)\b|창의\s*(?:활동|프로젝트|창작)|\bart\s+project\b|예술\s*프로젝트|\bmusic\s+(?:project|production)\b|음악\s*(?:프로젝트|제작)|\bsports?\s+specialt(?:y|ies)\b|스포츠\s*특화)/i.test(text)) {
    scores.subjectProject = Math.max(scores.subjectProject, 90)
  }
  if (/(culture|문화|activity|액티비티|sports|스포츠|outdoor|야외|excursion|현장\s*체험|nature|자연|beach|해변)/i.test(text)) {
    scores.cultureActivity = Math.max(scores.cultureActivity, 86)
  }
}

export function inferSpecialCareSupport(text: string): "supported" | "unsupported" | "unknown" {
  const normalized = normalizeText(text)
  if (/(특별\s*(?:식사|건강|복약).{0,12}(?:지원\s*불가|대응\s*불가)|알레르기.{0,12}(?:지원\s*불가|대응\s*불가)|(?:special\s*diet|allerg|medication).{0,18}(?:not\s*supported|unavailable|cannot))/i.test(normalized)) {
    return "unsupported"
  }
  if (/(특별\s*식사\s*(?:지원|대응)|알레르기\s*(?:지원|대응)|복약\s*(?:지원|관리)|special\s*diet\s*support|allergy\s*support|medication\s*(?:support|management))/i.test(normalized)) {
    return "supported"
  }
  return "unknown"
}

export function parseDurationWeeks(text: string): readonly number[] {
  const values = new Set<number>()
  const normalized = text.replace(/[–—]/g, "-")
  for (const match of normalized.matchAll(/(\d{1,2})\s*[-~]\s*(\d{1,2})\s*(?:주|weeks?)/gi)) {
    const start = Number(match[1])
    const end = Number(match[2])
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 1 || end < start || end > 20) continue
    for (let value = start; value <= end; value += 1) values.add(value)
  }
  for (const match of normalized.matchAll(/(\d{1,2})\s*(?:주|weeks?)/gi)) {
    const value = Number(match[1])
    if (value >= 1 && value <= 20) values.add(value)
  }
  for (const match of normalized.matchAll(/(\d{1,3})\s*(?:days?|일|nights?|박)/gi)) {
    const days = Number(match[1])
    if (days >= 5 && days <= 140) values.add(Math.max(1, Math.round(days / 7)))
  }
  return [...values].sort((left, right) => left - right)
}

export function extractSessionWindowsFromText(text: string): readonly V3SessionWindow[] {
  const monthPhrase = parseMonthPhraseRange(text)
  if (monthPhrase && extractExactDates(text).length === 0) {
    return [{ startDate: monthPhrase.startDate, endDate: monthPhrase.endDate, weeks: null, status: null, source: "program_text", precision: "season" }]
  }
  const exactDates = extractExactDates(text)
  if (exactDates.length) {
    const windows: V3SessionWindow[] = []
    for (let index = 0; index < exactDates.length; index += 2) {
      const startDate = exactDates[index]
      if (!startDate) continue
      const endDate = exactDates[index + 1] ?? startDate
      windows.push({ startDate, endDate, weeks: inferredWeeks(startDate, endDate), status: null, source: "program_text", precision: "exact" })
    }
    return windows
  }

  const season = text.match(/(20\d{2}).{0,28}(여름|summer|겨울|winter)/i)
  if (!season) return []
  const year = Number(season[1])
  const kind = season[2]?.toLowerCase()
  if (kind === "겨울" || kind === "winter") {
    return [{ startDate: `${year}-12-01`, endDate: `${year + 1}-02-${daysInMonth(year + 1, 2)}`, weeks: null, status: null, source: "program_text", precision: "season" }]
  }
  return [{ startDate: `${year}-06-01`, endDate: `${year}-08-31`, weeks: null, status: null, source: "program_text", precision: "season" }]
}

export function parseDepartureRange(value: string, now = new Date()): V3DateRange | null {
  const text = value.trim()
  const monthPhrase = parseMonthPhraseRange(text, now)
  if (monthPhrase && extractExactDates(text).length === 0) return monthPhrase
  if (!text || /(미정|모르|undecided)/i.test(text)) return null
  const exactDates = extractExactDates(text)
  if (exactDates.length >= 2) return { startDate: exactDates[0]!, endDate: exactDates[1]! }
  if (exactDates.length === 1) return relativeExactDateRange(text, exactDates[0]!) ?? { startDate: exactDates[0]!, endDate: exactDates[0]! }

  const explicitMonth = text.match(/(20\d{2})\s*(?:[.\-/]|년\s*)(\d{1,2})(?:\s*월)?(?!\s*[.\-/]\s*\d)/)
  if (explicitMonth) {
    const year = Number(explicitMonth[1])
    const month = Number(explicitMonth[2])
    if (month >= 1 && month <= 12) return monthRange(year, month)
  }

  const explicitSeason = text.match(/(20\d{2}).{0,16}(여름|summer|겨울|winter)/i)
  if (explicitSeason) return seasonRange(Number(explicitSeason[1]), String(explicitSeason[2]))

  const today = utcDateParts(now)
  if (/(다음|내년).{0,8}(여름|summer)/i.test(text)) return seasonRange(today.year + 1, "여름")
  if (/(다음|내년).{0,8}(겨울|winter)/i.test(text)) return seasonRange(today.year + 1, "겨울")
  if (/(여름|summer)/i.test(text)) {
    const year = today.month <= 8 ? today.year : today.year + 1
    return seasonRange(year, "여름")
  }
  if (/(겨울|winter)/i.test(text)) {
    const year = today.month <= 2 ? today.year - 1 : today.month <= 12 ? today.year : today.year + 1
    return seasonRange(year, "겨울")
  }
  const withinMonths = text.match(/(\d{1,2})\s*개월\s*이내/)
  if (withinMonths) {
    const months = Number(withinMonths[1])
    const end = new Date(Date.UTC(today.year, today.month - 1 + months, today.day))
    return { startDate: toIsoDate(today.year, today.month, today.day), endDate: isoFromDate(end) }
  }
  return null
}

export function rangesOverlap(left: V3DateRange, right: V3DateRange): boolean {
  return left.startDate <= right.endDate && right.startDate <= left.endDate
}

export function isoToday(now = new Date()): string {
  const parts = utcDateParts(now)
  return toIsoDate(parts.year, parts.month, parts.day)
}

function extractExactDates(text: string): readonly string[] {
  const values: string[] = []
  const pattern = /(20\d{2})\s*(?:[.\-/]|년\s*)(\d{1,2})\s*(?:[.\-/]|월\s*)(\d{1,2})\s*일?/g
  for (const match of text.matchAll(pattern)) {
    const year = Number(match[1])
    const month = Number(match[2])
    const day = Number(match[3])
    if (isValidDate(year, month, day)) values.push(toIsoDate(year, month, day))
  }
  return values
}

function parseMonthPhraseRange(text: string, now = new Date()): V3DateRange | null {
  const today = utcDateParts(now)
  const yearMatch = text.match(/(20\d{2})\s*(?:\uB144)/u)
  const year = Number(yearMatch?.[1] ?? today.year)

  const monthRange = text.match(/(\d{1,2})\s*(?:\uC6D4)?\s*[~\u301C\-]\s*(\d{1,2})\s*(?:\uC6D4)?/u)
  if (monthRange) {
    const startMonth = Number(monthRange[1])
    const endMonth = Number(monthRange[2])
    if (startMonth >= 1 && startMonth <= 12 && endMonth >= startMonth && endMonth <= 12) {
      return { startDate: toIsoDate(year, startMonth, 1), endDate: toIsoDate(year, endMonth, daysInMonth(year, endMonth)) }
    }
  }

  const crossMonth = text.match(/(\d{1,2})\s*(?:\uC6D4)\s*(?:\uCD08|\uC911\uC21C|\uB9D0)\s*(?:\uBD80\uD130)?\s*(\d{1,2})\s*(?:\uC6D4)\s*(?:\uC0AC\uC774)?/u)
  if (crossMonth) {
    const startMonth = Number(crossMonth[1])
    const endMonth = Number(crossMonth[2])
    const qualifier = text.match(/(\d{1,2})\s*(?:\uC6D4)\s*(\uCD08|\uC911\uC21C|\uB9D0)/u)?.[2]
    if (qualifier && startMonth >= 1 && startMonth <= 12 && endMonth >= startMonth && endMonth <= 12) {
      return {
        startDate: qualifiedMonthStart(year, startMonth, qualifier),
        endDate: toIsoDate(year, endMonth, daysInMonth(year, endMonth)),
      }
    }
  }

  const qualified = text.match(/(\d{1,2})\s*(?:\uC6D4)\s*(\uCD08|\uC911\uC21C|\uB9D0)/u)
  if (!qualified) return null
  const month = Number(qualified[1])
  if (month < 1 || month > 12) return null
  return {
    startDate: qualifiedMonthStart(year, month, qualified[2]!),
    endDate: qualifiedMonthEnd(year, month, qualified[2]!),
  }
}

function relativeExactDateRange(text: string, date: string): V3DateRange | null {
  const parsed = Date.parse(date + "T00:00:00Z")
  if (!Number.isFinite(parsed)) return null
  if (/(?:\uC774\uD6C4|\uBD80\uD130|after|onward)/i.test(text)) {
    return { startDate: date, endDate: isoFromDate(new Date(parsed + 90 * 86_400_000)) }
  }
  if (/(?:\uC774\uC804|\uC804\uAE4C\uC9C0|before|until)/i.test(text)) {
    return { startDate: isoFromDate(new Date(parsed - 90 * 86_400_000)), endDate: date }
  }
  if (/(?:\uC804\uD6C4|\uC988\uC74C|around)/i.test(text)) {
    return { startDate: isoFromDate(new Date(parsed - 14 * 86_400_000)), endDate: isoFromDate(new Date(parsed + 14 * 86_400_000)) }
  }
  return null
}

function qualifiedMonthStart(year: number, month: number, qualifier: string): string {
  if (/\uCD08/u.test(qualifier)) return toIsoDate(year, month, 1)
  if (/\uC911\uC21C/u.test(qualifier)) return toIsoDate(year, month, 11)
  return toIsoDate(year, month, 21)
}

function qualifiedMonthEnd(year: number, month: number, qualifier: string): string {
  if (/\uCD08/u.test(qualifier)) return toIsoDate(year, month, 10)
  if (/\uC911\uC21C/u.test(qualifier)) return toIsoDate(year, month, 20)
  return toIsoDate(year, month, daysInMonth(year, month))
}

function seasonRange(year: number, season: string): V3DateRange {
  if (/겨울|winter/i.test(season)) {
    return { startDate: `${year}-12-01`, endDate: `${year + 1}-02-${daysInMonth(year + 1, 2)}` }
  }
  return { startDate: `${year}-06-01`, endDate: `${year}-08-31` }
}

function monthRange(year: number, month: number): V3DateRange {
  return { startDate: toIsoDate(year, month, 1), endDate: toIsoDate(year, month, daysInMonth(year, month)) }
}

function inferredWeeks(startDate: string, endDate: string): number | null {
  const start = Date.parse(`${startDate}T00:00:00Z`)
  const end = Date.parse(`${endDate}T00:00:00Z`)
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null
  return Math.max(1, Math.round(((end - start) / 86_400_000 + 1) / 7))
}

function isValidDate(year: number, month: number, day: number): boolean {
  if (year < 2000 || year > 2100 || month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return false
  return true
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

function toIsoDate(year: number, month: number, day: number): string {
  return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`
}

function isoFromDate(value: Date): string {
  return value.toISOString().slice(0, 10)
}

function utcDateParts(value: Date): { readonly year: number; readonly month: number; readonly day: number } {
  return { year: value.getUTCFullYear(), month: value.getUTCMonth() + 1, day: value.getUTCDate() }
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ")
}

function isExplicitChildOnlyParticipation(value: string): boolean {
  return /(아이\s*단독\s*(?:참여|참가)|아동\s*단독\s*(?:참여|참가)|주니어\s*단독\s*(?:참여|참가|캠프)|보호자\s*없이\s*(?:참여|참가)|부모\s*없이\s*(?:참여|참가)|학생\s*단독\s*(?:참여|참가)|child[-_\s]*only|child[-_\s]*alone|unaccompanied|without\s+(?:a\s+)?parent|student[-_\s]*only|junior[-_\s]*(?:residential|camp))/i.test(value)
}

function readRowString(row: CatalogRow, key: string): string | undefined {
  const value = row[key]
  return typeof value === "string" && value.trim() ? value.trim() : undefined
}
