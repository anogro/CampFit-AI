import {
  campfitV3ParticipationAdaptationLevels,
  campfitV3ParticipationEvidenceSubjects,
  campfitV3ParentDistanceComfortLevels,
  campfitV3PeerInteractionStyleLevels,
  campfitV3ParticipationStyleLevels,
} from "@/types/campfitV3"
import type {
  CampfitV3ParticipationAxis,
  CampfitV3ParticipationProfile,
  CampfitV3ParticipationEvidenceSubject,
} from "@/types/campfitV3"

type ParticipationAxisKey =
  | "adaptation_to_new_environment"
  | "peer_interaction_style"
  | "parent_distance_comfort"
  | "participation_style"

type MutableParticipationProfile = {
  -readonly [K in keyof CampfitV3ParticipationProfile]: CampfitV3ParticipationProfile[K]
}

const emptyAxis = <T extends string>(level: T): CampfitV3ParticipationAxis<T> => ({
  level,
  evidence: [],
  confidence: 0,
  subject: "ambiguous",
})

export function emptyParticipationProfile(): CampfitV3ParticipationProfile {
  return {
    adaptation_to_new_environment: emptyAxis("unknown"),
    peer_interaction_style: emptyAxis("unknown"),
    parent_distance_comfort: emptyAxis("unknown"),
    participation_style: emptyAxis("unknown"),
    independent_class_participation: "unknown",
    parent_preference_evidence: [],
    ambiguous_evidence: [],
    raw_evidence: [],
  }
}

export function extractParticipationProfile(message: string): CampfitV3ParticipationProfile | null {
  const text = message.trim()
  if (!text) return null

  const profile = emptyParticipationProfile() as MutableParticipationProfile
  const rawEvidence: string[] = []
  const parentPreferenceEvidence: string[] = []
  const ambiguousEvidence: string[] = []

  const addEvidence = (target: string[], evidence: string): void => {
    const value = evidence.trim().slice(0, 240)
    if (value && !target.includes(value)) target.push(value)
  }
  const evidenceFor = (pattern: RegExp): string => {
    const match = text.match(pattern)
    if (match?.index === undefined) return text.slice(0, 240)
    const start = Math.max(0, text.lastIndexOf(".", match.index) + 1)
    const endMatch = text.slice(match.index).search(/[.!?。！？]/u)
    const end = endMatch < 0 ? text.length : match.index + endMatch + 1
    return text.slice(start, end).trim().slice(0, 240)
  }
  const setAxis = <K extends ParticipationAxisKey>(
    key: K,
    level: MutableParticipationProfile[K] extends CampfitV3ParticipationAxis<infer T> ? T : never,
    pattern: RegExp,
    subject: CampfitV3ParticipationEvidenceSubject = "child_state",
  ): void => {
    const evidence = evidenceFor(pattern)
    addEvidence(rawEvidence, evidence)
    const current = profile[key] as CampfitV3ParticipationAxis<string>
    const nextEvidence = [...current.evidence, evidence]
      .filter((item, index, values) => values.indexOf(item) === index)
      .slice(0, 3)
    profile[key] = {
      level: level as string,
      evidence: nextEvidence,
      confidence: subject === "ambiguous" ? 0.45 : 0.92,
      subject,
    } as MutableParticipationProfile[K]
  }

  if (/(?:새로운|처음\s*가|낯선).{0,18}(?:곳|환경|장소|프로그램).{0,18}(?:첫날|처음).{0,10}(?:긴장|어려|힘들)|첫날.{0,12}(?:긴장|힘들).{0,24}(?:다음날|그\s*다음부터|익숙)/iu.test(text)) {
    setAxis("adaptation_to_new_environment", "warm_up_needed", /(?:새로운|처음\s*가|낯선)|첫날/iu)
  }
  if (/(?:새로운|낯선).{0,18}(?:곳|환경|장소).{0,20}(?:금방|바로|잘)\s*적응|적응이\s*(?:빠르|금방)|처음부터\s*(?:괜찮|편안)/iu.test(text)) {
    setAxis("adaptation_to_new_environment", "quick_to_adapt", /(?:금방|바로|잘)\s*적응|적응이\s*(?:빠르|금방)/iu)
  }

  if (/(?:처음에는|처음엔|처음\s*보는\s*친구).{0,14}(?:낯을?\s*(?:가리|가려)|좀\s*가리|조용)|낯을?\s*많이\s*(?:가리|가려)|친해지면.{0,18}(?:친구|또래).{0,18}(?:잘\s*(?:어울리|놀)|괜찮)/iu.test(text)) {
    setAxis("peer_interaction_style", "initially_cautious_after_warm_up", /(?:처음에는|처음엔|처음\s*보는\s*친구|낯을?\s*(?:가리|가려)|친해지면).{0,32}(?:친구|또래|어울리|놀|자신감)/iu)
  }
  if (/(?:사람이?\s*많은|큰\s*그룹|대규모).{0,16}(?:조용|말이?\s*없)|(?:몇\s*명|소규모|작은\s*그룹).{0,18}(?:말을?\s*잘|잘\s*(?:어울리|놀))/iu.test(text)) {
    setAxis("peer_interaction_style", "small_group_comfortable", /(?:사람이?\s*많은|큰\s*그룹|몇\s*명|소규모|작은\s*그룹)/iu)
  }
  if (/(?:먼저|스스로).{0,12}(?:친구|또래|말을?\s*걸|다가가).{0,12}(?:잘|곧잘|편하게)|친구에게\s*먼저\s*말/iu.test(text)) {
    setAxis("peer_interaction_style", "initiates_easily", /(?:먼저|스스로).{0,24}(?:친구|또래|말)/iu)
  }

  if (/(?:수업|프로그램).{0,12}(?:혼자|엄마\s*없이|부모\s*없이).{0,16}(?:잘\s*들어가|참여|가능|괜찮)/iu.test(text)
    || /(?:혼자|엄마\s*없이|부모\s*없이).{0,16}(?:수업|프로그램).{0,16}(?:잘|괜찮|가능)/iu.test(text)) {
    profile.independent_class_participation = "ready"
    addEvidence(rawEvidence, evidenceFor(/(?:수업|프로그램|엄마\s*없이|부모\s*없이).{0,28}(?:혼자|잘\s*들어가|참여)/iu))
  } else if (/(?:수업|프로그램).{0,12}(?:혼자|엄마\s*없이|부모\s*없이).{0,16}(?:어려|못|불안|힘들)/iu.test(text)) {
    profile.independent_class_participation = "needs_support"
    addEvidence(rawEvidence, evidenceFor(/(?:수업|프로그램|엄마\s*없이|부모\s*없이).{0,28}(?:혼자|어려|불안)/iu))
  }

  if (/(?:엄마|아빠|부모|보호자|제가|저).{0,18}(?:멀리|떨어져).{0,18}(?:불안|힘들|어려|걱정)|(?:가까이|근처|같은\s*호텔|같은\s*리조트).{0,18}(?:있으면|있을\s*때).{0,18}(?:안심|편안|괜찮)/iu.test(text)
    && /(?:아이|자녀|불안해해|힘들어해|어려워해|걱정)/iu.test(text)) {
    setAxis("parent_distance_comfort", "proximity_needed", /(?:멀리|떨어져|가까이|근처|같은\s*호텔|같은\s*리조트)/iu)
  } else if (/(?:엄마|아빠|부모).{0,18}없이.{0,20}(?:하루\s*종일|괜찮|잘\s*지내)|부모와\s*떨어져.{0,16}(?:괜찮|편안)/iu.test(text)) {
    setAxis("parent_distance_comfort", "comfortable_without_parent", /(?:엄마|아빠|부모).{0,32}(?:없이|떨어져)/iu)
  }

  if (/(?:같은\s*호텔|같은\s*리조트|도보권|바로\s*근처|가까이\s*있으면).{0,20}(?:좋|선호|안심|편할)/iu.test(text)
    && !/(?:아이|자녀).{0,18}(?:불안|힘들|어려)/iu.test(text)) {
    const evidence = evidenceFor(/(?:같은\s*호텔|같은\s*리조트|도보권|바로\s*근처|가까이\s*있으면)/iu)
    addEvidence(parentPreferenceEvidence, evidence)
    addEvidence(rawEvidence, evidence)
  }

  if (/(?:새로운|처음).{0,16}(?:활동|놀이).{0,16}(?:바로|먼저).{0,10}(?:해보|참여)|바로\s*해보는\s*편|새로운\s*활동도\s*잘\s*시작/iu.test(text)) {
    setAxis("participation_style", "active_starter", /(?:새로운|처음).{0,28}(?:활동|놀이|해보)/iu)
  }
  if (/(?:처음에는|먼저).{0,12}(?:지켜|구경|관찰).{0,24}(?:다른\s*아이|친구).{0,20}(?:보고|하는\s*걸).{0,12}(?:따라|참여)/iu.test(text)) {
    setAxis("participation_style", "observation_first", /(?:지켜|구경|관찰).{0,40}(?:따라|참여)/iu)
  }
  if (/(?:순서|정해진|구조화|단계가?\s*있는).{0,18}(?:활동|프로그램).{0,18}(?:편|좋|선호)/iu.test(text)) {
    setAxis("participation_style", "structured_preferred", /(?:순서|정해진|구조화|단계가?\s*있는).{0,24}(?:활동|프로그램)/iu)
  }
  if (/(?:자유롭게|자율적|자유\s*활동).{0,18}(?:하는|참여|좋|편)/iu.test(text)) {
    setAxis("participation_style", "free_activity_preferred", /(?:자유롭게|자율적|자유\s*활동)/iu)
  }

  if (/(?:외국인|원어민).{0,18}(?:앞|보면|만나).{0,18}(?:말을?\s*(?:잘\s*)?(?:못|안)|어려|긴장)/iu.test(text)) {
    const evidence = evidenceFor(/(?:외국인|원어민).{0,36}(?:말|어려|긴장)/iu)
    addEvidence(ambiguousEvidence, evidence)
    addEvidence(rawEvidence, evidence)
  }

  profile.parent_preference_evidence = parentPreferenceEvidence.slice(0, 3)
  profile.ambiguous_evidence = ambiguousEvidence.slice(0, 3)
  profile.raw_evidence = rawEvidence.slice(0, 6)
  const hasEvidence = profile.raw_evidence.length > 0
    || profile.parent_preference_evidence.length > 0
    || profile.ambiguous_evidence.length > 0
  return hasEvidence ? profile : null
}

export function isParticipationProfileValue(value: unknown): value is CampfitV3ParticipationProfile {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  const axes: readonly [string, readonly string[]][] = [
    ["adaptation_to_new_environment", campfitV3ParticipationAdaptationLevels],
    ["peer_interaction_style", campfitV3PeerInteractionStyleLevels],
    ["parent_distance_comfort", campfitV3ParentDistanceComfortLevels],
    ["participation_style", campfitV3ParticipationStyleLevels],
  ]
  if (!(["ready", "needs_support", "unknown"] as readonly string[]).includes(record["independent_class_participation"] as string)) return false
  for (const [key, levels] of axes) {
    const axis = record[key]
    if (typeof axis !== "object" || axis === null || Array.isArray(axis)) return false
    const item = axis as Record<string, unknown>
    if (!levels.includes(item["level"] as string)
      || !campfitV3ParticipationEvidenceSubjects.includes(item["subject"] as CampfitV3ParticipationEvidenceSubject)
      || typeof item["confidence"] !== "number" || (item["confidence"] as number) < 0 || (item["confidence"] as number) > 1
      || !isEvidenceArray(item["evidence"], 3)) return false
  }
  return isEvidenceArray(record["parent_preference_evidence"], 3)
    && isEvidenceArray(record["ambiguous_evidence"], 3)
    && isEvidenceArray(record["raw_evidence"], 6)
}

export function participationRecommendationSufficiency(value: unknown): boolean {
  if (!isParticipationProfileValue(value)) return false
  const knownAxis = [
    value.adaptation_to_new_environment.level !== "unknown",
    value.peer_interaction_style.level !== "unknown",
    value.parent_distance_comfort.level !== "unknown",
    value.participation_style.level !== "unknown",
    value.independent_class_participation !== "unknown",
  ].filter(Boolean).length
  return knownAxis >= 2 || value.parent_preference_evidence.length > 0
}

export function participationProfileValueIsGrounded(
  value: unknown,
  factEvidence: string,
  userMessage: string,
): boolean {
  if (!isParticipationProfileValue(value)) return false
  const allEvidence = [
    ...value.raw_evidence,
    ...value.parent_preference_evidence,
    ...value.ambiguous_evidence,
    factEvidence,
  ].filter(Boolean)
  if (!allEvidence.some((evidence) => evidenceOverlapsMessage(evidence, userMessage))) return false
  const checks: readonly [string, boolean][] = [
    [value.adaptation_to_new_environment.level, value.adaptation_to_new_environment.level === "unknown" || /(?:첫날|처음|새로운|낯선|적응|익숙)/iu.test(userMessage)],
    [value.peer_interaction_style.level, value.peer_interaction_style.level === "unknown" || /(?:낯|친해|친구|또래|사람|그룹|어울|놀)/iu.test(userMessage)],
    [value.parent_distance_comfort.level, value.parent_distance_comfort.level === "unknown" || /(?:엄마|아빠|부모|보호자|가까이|근처|멀리|떨어져|호텔|리조트)/iu.test(userMessage)],
    [value.participation_style.level, value.participation_style.level === "unknown" || /(?:활동|지켜|관찰|따라|참여|해보|순서|자유)/iu.test(userMessage)],
  ]
  return checks.every(([, supported]) => supported)
}

export function participationProfileAcknowledgement(value: unknown): string | null {
  if (!isParticipationProfileValue(value)) return null
  if (value.parent_preference_evidence.length > 0 && value.independent_class_participation === "ready") {
    return "아이 자체는 혼자 수업에 참여할 수 있고, 부모님은 가까이 계시면 더 안심되는 조건이군요."
  }
  if (value.parent_distance_comfort.level === "proximity_needed") {
    return "수업은 참여할 수 있지만 부모님이 가까이 계시면 아이가 더 편안해하는 편이군요."
  }
  if (value.peer_interaction_style.level === "small_group_comfortable") {
    return "사람이 많을 때는 조용해질 수 있지만, 소규모에서는 또래와 잘 어울리는 편이군요."
  }
  if (value.peer_interaction_style.level === "initially_cautious_after_warm_up") {
    return "처음에는 적응할 시간이 조금 필요하지만 익숙해지면 또래와 잘 어울리는 편이군요."
  }
  if (value.participation_style.level === "observation_first") {
    return "처음에는 다른 아이들을 지켜본 뒤 익숙해지면 따라 참여하는 편이군요."
  }
  if (value.participation_style.level === "active_starter") {
    return "새로운 활동도 바로 시도해보는 편이군요."
  }
  if (value.adaptation_to_new_environment.level === "warm_up_needed") {
    return "새로운 환경에서는 첫 적응 시간이 조금 필요하지만 이후에는 괜찮아지는 편이군요."
  }
  if (value.adaptation_to_new_environment.level === "quick_to_adapt") {
    return "새로운 환경에도 비교적 빠르게 적응하는 편이군요."
  }
  if (value.ambiguous_evidence.length > 0) {
    return "낯선 사람 앞에서 말할 때 어려움이 있다는 점은 확인했어요. 영어 표현과 새로운 환경 중 어느 쪽 영향이 큰지는 아직 단정하지 않을게요."
  }
  return null
}

function isEvidenceArray(value: unknown, max: number): value is readonly string[] {
  return Array.isArray(value) && value.length <= max && value.every((item) => typeof item === "string" && item.trim().length > 0 && item.length <= 240)
}

function evidenceOverlapsMessage(evidence: string, message: string): boolean {
  const normalizedEvidence = normalizeEvidence(evidence)
  const normalizedMessage = normalizeEvidence(message)
  if (normalizedEvidence.length >= 4 && normalizedMessage.includes(normalizedEvidence)) return true
  const tokens = normalizedEvidence.split(" ").filter((token) => token.length >= 2)
  return tokens.length > 0 && tokens.filter((token) => normalizedMessage.includes(token)).length >= Math.min(2, tokens.length)
}

function normalizeEvidence(value: string): string {
  return value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim()
}
