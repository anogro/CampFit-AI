import { CAMPFIT_V3_MAX_DURATION_WEEKS, CAMPFIT_V3_MIN_DURATION_WEEKS } from "@/types/campfitV3"
import type {
  CampfitV3BasicInfo,
  CampfitV3ConversationState,
  CampfitV3Fact,
  CampfitV3FactKey,
  CampfitV3FactSource,
  CampfitV3FactStatus,
  CampfitV3FactSubject,
  CampfitV3QuickReply,
  ExperienceDirectionKey,
  ExperienceGoalStrength,
} from "@/types/campfitV3"

const sourcePriority: Readonly<Record<CampfitV3FactSource, number>> = {
  ai_inference: 1,
  explicit_user_statement: 2,
  quick_reply: 3,
  structured_input: 4,
  user_correction: 5,
}

function inferFactStatus(source: CampfitV3FactSource, confidence: number): CampfitV3FactStatus {
  if (source === "user_correction" || source === "explicit_user_statement" || source === "quick_reply" || source === "structured_input") return "confirmed"
  return confidence >= 0.85 ? "known" : confidence > 0 ? "tentative" : "unknown"
}

export function createInitialConversationState(): CampfitV3ConversationState {
  return {
    facts: {},
    askedQuestionKeys: [],
    completedQuestionKeys: [],
    failedQuestionKeys: [],
    currentQuestionKey: null,
    questionCount: 0,
    progress: 0,
    unresolved: [],
    conflicts: [],
  }
}

export function createFact(input: {
  readonly key: CampfitV3FactKey
  readonly subject: CampfitV3FactSubject
  readonly value: unknown
  readonly source: CampfitV3FactSource
  readonly evidence: string
  readonly confidence?: number
  readonly status?: CampfitV3FactStatus
  readonly updatedAt?: string
}): CampfitV3Fact {
  const confidence = input.confidence ?? (input.source === "ai_inference" ? 0.7 : 1)
  return {
    key: input.key,
    subject: input.subject,
    value: input.value,
    source: input.source,
    confidence,
    status: input.status ?? inferFactStatus(input.source, confidence),
    evidence: input.evidence,
    updatedAt: input.updatedAt ?? new Date().toISOString(),
  }
}

export function mergeFacts(
  state: CampfitV3ConversationState,
  incomingFacts: readonly CampfitV3Fact[],
): CampfitV3ConversationState {
  const facts = { ...state.facts }
  const resolved = new Set<CampfitV3FactKey>()
  for (const incoming of incomingFacts) {
    const existing = facts[incoming.key]
    if (existing && sourcePriority[incoming.source] < sourcePriority[existing.source]) continue
    if (existing?.source === "ai_inference" && incoming.source === "ai_inference" && incoming.confidence < existing.confidence) continue
    if (incoming.source === "ai_inference" && incoming.evidence.trim().length === 0) continue
    const value = existing !== undefined && incoming.source !== "user_correction"
      && Array.isArray(existing.value) && Array.isArray(incoming.value) && incoming.value.length > 0
      ? Array.from(new Set([...existing.value, ...incoming.value]))
      : incoming.value
    facts[incoming.key] = value === incoming.value ? incoming : { ...incoming, value }
    if (incoming.status !== "tentative" && incoming.status !== "unknown" && incoming.source !== "ai_inference") resolved.add(incoming.key)
  }
  return {
    ...state,
    facts,
    unresolved: state.unresolved.filter((key) => !resolved.has(key)),
    conflicts: state.conflicts.filter((conflict) => !resolved.has(conflict.key)),
  }
}

export function markChangedExplicitFactsAsCorrections(
  state: CampfitV3ConversationState,
  incomingFacts: readonly CampfitV3Fact[],
  correctionLanguage = false,
): readonly CampfitV3Fact[] {
  return incomingFacts.map((incoming) => {
    const existing = state.facts[incoming.key]
    if (
      incoming.source !== "explicit_user_statement"
      || existing === undefined
      || sameValue(existing.value, incoming.value)
      || (Array.isArray(existing.value) && Array.isArray(incoming.value) && !correctionLanguage)
    ) {
      return incoming
    }
    return { ...incoming, source: "user_correction" as const, confidence: 1 }
  })
}

export function isSemanticallyValidModelFact(input: {
  readonly key: CampfitV3FactKey
  readonly subject: CampfitV3FactSubject
  readonly value?: unknown
}): boolean {
  const subjects: Readonly<Record<CampfitV3FactKey, readonly CampfitV3FactSubject[]>> = {
    childEnglishLevel: ["child"],
    parentEnglishCommunication: ["parent"],
    isFirstOverseasEducationExperience: ["child"],
    dayProgramSeparationReadiness: ["child"],
    preferredActivities: ["preference"],
    destinationPreference: ["preference"],
    socialPreference: ["child", "preference"],
    desiredOutcomes: ["preference"],
    worries: ["parent", "family"],
    experienceGoals: ["preference"],
    preferredRegions: ["preference"],
    regionImportance: ["preference"],
    koreanSupportNeed: ["constraint"],
    parentCommunicationNeed: ["constraint"],
    beginnerSupportNeed: ["constraint"],
    initialAdaptationSupportNeed: ["constraint"],
    parentStayGoals: ["parent"],
    specialCareFollowUp: ["constraint"],
    studyOnlyAvoidance: ["preference"],
    budgetRangeKrw: ["constraint"],
    budgetIncludesFlight: ["constraint"],
    departureWindow: ["constraint"],
    durationWeeks: ["constraint"],
  }
  if (!subjects[input.key].includes(input.subject)) return false

  switch (input.key) {
    case "childEnglishLevel":
      return isOneOf(input.value, ["beginner", "basic", "intermediate", "advanced"])
    case "parentEnglishCommunication":
      return isOneOf(input.value, ["possible", "limited", "not_possible"])
    case "isFirstOverseasEducationExperience":
    case "beginnerSupportNeed":
    case "initialAdaptationSupportNeed":
    case "budgetIncludesFlight":
    case "studyOnlyAvoidance":
      return typeof input.value === "boolean"
    case "dayProgramSeparationReadiness":
      return isOneOf(input.value, ["needs_close_support", "with_initial_support", "ready"])
    case "preferredActivities":
      return isStringArray(input.value, 12)
    case "destinationPreference":
      return isStringArray(input.value, 8)
    case "socialPreference":
      return isStringArray(input.value, 8)
    case "desiredOutcomes":
      return isStringArray(input.value, 8)
    case "worries":
      return isStringArray(input.value, 8)
    case "experienceGoals":
      return isExperienceGoals(input.value)
    case "preferredRegions":
      return isStringArray(input.value, 4, ["southeast_asia", "oceania", "north_america", "europe"])
    case "regionImportance":
      return isOneOf(input.value, ["must", "strong", "soft", "no_preference"])
    case "koreanSupportNeed":
      return isOneOf(input.value, ["must_daily", "emergency_only", "preferred", "none"])
    case "parentCommunicationNeed":
      return isOneOf(input.value, ["daily", "issue_only", "occasional", "not_important"])
    case "parentStayGoals":
      return isStringArray(input.value, 6, ["restWellness", "cafeDining", "tourismCulture", "natureBeach", "remoteWork", "childScheduleFirst"])
    case "specialCareFollowUp":
      return isOneOf(input.value, ["none", "required", "unknown"])
    case "budgetRangeKrw":
      return isBudgetRange(input.value)
    case "departureWindow":
      return typeof input.value === "string" && input.value.trim().length >= 2 && input.value.trim().length <= 80
    case "durationWeeks":
      return typeof input.value === "number" && Number.isInteger(input.value) && input.value >= CAMPFIT_V3_MIN_DURATION_WEEKS && input.value <= CAMPFIT_V3_MAX_DURATION_WEEKS
  }
}

export function applyQuickReply(
  state: CampfitV3ConversationState,
  questionKey: string,
  replyKey: string,
  label: string,
): CampfitV3ConversationState {
  const facts = factsFromQuickReply(questionKey, replyKey, label)
  return mergeFacts(state, facts)
}

export function factsFromQuickReply(questionKey: string, replyKey: string, label: string): readonly CampfitV3Fact[] {
  const fact = (key: CampfitV3FactKey, subject: CampfitV3FactSubject, value: unknown) =>
    createFact({ key, subject, value, source: "quick_reply", evidence: label })

  switch (questionKey) {
    case "child_english_level":
      return [fact("childEnglishLevel", "child", replyKey)]
    case "primary_experience_goal":
      return [fact("experienceGoals", "preference", goalStrengths(replyKey))]
    case "preferred_region":
      return replyKey === "no_preference"
        ? [fact("preferredRegions", "preference", []), fact("regionImportance", "preference", "no_preference")]
        : [fact("preferredRegions", "preference", [replyKey])]
    case "region_importance":
      return [fact("regionImportance", "preference", replyKey)]
    case "korean_support_need":
      return [fact("koreanSupportNeed", "constraint", replyKey)]
    case "parent_communication_need":
      return [fact("parentCommunicationNeed", "constraint", replyKey)]
    case "parent_stay_goal":
      return [fact("parentStayGoals", "parent", [replyKey])]
    case "first_overseas_experience":
      return [fact("isFirstOverseasEducationExperience", "child", replyKey === "first")]
    case "day_program_separation":
      return [fact("dayProgramSeparationReadiness", "child", replyKey)]
    case "special_care_follow_up":
      return [
        createFact({
          key: "specialCareFollowUp",
          subject: "constraint",
          value: replyKey,
          source: "quick_reply",
          evidence: "특별관리 후속 확인 여부를 선택함",
        }),
      ]
    default:
      return []
  }
}

export function extractDeterministicFacts(
  message: string,
  basicInfo?: CampfitV3BasicInfo,
  currentQuestionKey?: string | null,
): readonly CampfitV3Fact[] {
  const text = message.trim()
  const facts: CampfitV3Fact[] = []
  const push = (key: CampfitV3FactKey, subject: CampfitV3FactSubject, value: unknown, evidence = text) => {
    facts.push(createFact({ key, subject, value, source: "explicit_user_statement", evidence: evidence.slice(0, 240) }))
  }

  if (/(아이|애).{0,12}(영어.{0,5})?(초급|처음|거의 못|낯설|첨|beginner)/iu.test(text)) push("childEnglishLevel", "child", "beginner")
  else if (/(아이|애).{0,12}(영어.{0,5})?(중급|간단한 대화|일상 대화|intermediate)/iu.test(text)) push("childEnglishLevel", "child", "intermediate")
  else if (/(아이|애).{0,12}(영어.{0,5})?(고급|수업.*무리|편하게|advanced)/iu.test(text)) push("childEnglishLevel", "child", "advanced")

  if (/(저는|제가|부모|엄마|아빠|보호자).{0,24}(영어|basic\s*communication|소통).{0,20}(가능|할 수|괜찮|소통|돼|되)/iu.test(text)) push("parentEnglishCommunication", "parent", "possible")
  if (/(첫|처음).{0,8}(해외|캠프|교육)/.test(text)) push("isFirstOverseasEducationExperience", "child", true)
  if (/(첫 경험이 아니|해외.*경험.*있)/.test(text)) push("isFirstOverseasEducationExperience", "child", false)

  const goals: Partial<Record<ExperienceDirectionKey, ExperienceGoalStrength>> = {}
  if (/(국제학교|현지학교|학교 분위기|학교 프로그램|학교 수업|스쿨링|학교처럼|시간표|수업 시간|학교식)/.test(text)) goals.schoolSchooling = "primary"
  if (/(영어 실력|영어 자신감|영어 집중|영어.*늘)/.test(text)) goals.englishIntensive = goals.schoolSchooling ? "secondary" : "primary"
  if (/(STEM|코딩|로봇|프로젝트|미술|스포츠|관심 분야)/i.test(text)) goals.subjectProject = "primary"
  const projectPreferredOverGeneralExperience = /(?:문화|활동|체험).{0,16}(?:보다|보다는|말고).{0,24}(?:STEM|코딩|로봇|프로젝트|과학|결과물)/i.test(text)
  if (!projectPreferredOverGeneralExperience && /(문화|활동|체험|즐거운|자연스럽게)/.test(text)) goals.cultureActivity = "primary"
  if (Object.keys(goals).length) push("experienceGoals", "preference", completeGoals(goals))
  if (/(공부만|학업만|수업만).{0,8}(싫|피하)/.test(text)) push("studyOnlyAvoidance", "preference", true)

  const destinationPreference = [
    [/(싱가포르|Singapore)/i, "Singapore"],
    [/(뉴질랜드|New\s+Zealand)/i, "New Zealand"],
    [/(오클랜드|Auckland)/i, "Auckland"],
    [/(호주|Australia)/i, "Australia"],
    [/(세부|Cebu)/i, "Cebu"],
    [/(치앙마이|Chiang\s+Mai)/i, "Chiang Mai"],
    [/(발리|Bali)/i, "Bali"],
  ].flatMap(([pattern, city]) => pattern instanceof RegExp && pattern.test(text) ? [city] : [])
  if (destinationPreference.length) push("destinationPreference", "preference", Array.from(new Set(destinationPreference)))

  const socialPreference: string[] = []
  if (/(사람을? 만나는|친구.{0,8}(사귀|좋아|만나|놀)|또래|사교|사람들과? 어울|활발하게)/.test(text)) socialPreference.push("people_and_peer_interaction")
  if (/(소규모|조용한|천천히 친해|낯을 가리|적응에 시간이)/.test(text)) socialPreference.push("gentle_social_start")
  if (socialPreference.length) push("socialPreference", "child", Array.from(new Set(socialPreference)))

  const preferredActivities: string[] = []
  if (/(로봇|로보틱스|robotics)/i.test(text)) preferredActivities.push("robotics")
  if (/(과학|science|STEM)/i.test(text)) preferredActivities.push("science")
  if (/(코딩|coding)/i.test(text)) preferredActivities.push("coding")
  if (preferredActivities.length) push("preferredActivities", "preference", Array.from(new Set(preferredActivities)))

  const desiredOutcomes: string[] = []
  if (/(영어.*(늘|성장|자신감)|영어를? 배우)/.test(text)) desiredOutcomes.push("english_confidence")
  if (/(적응|독립심|자신감|성장|새로운 경험)/.test(text)) desiredOutcomes.push("confidence_and_adaptation")
  if (/(친구|또래|사람을? 만나는)/.test(text)) desiredOutcomes.push("peer_connection")
  if (desiredOutcomes.length) push("desiredOutcomes", "preference", Array.from(new Set(desiredOutcomes)))
  if (/(새로운 곳|낯선 곳).{0,12}적응.{0,12}(시간|어려|도움|천천히)/.test(text)
    || /적응하는 데 시간이/.test(text)
    || /처음에는.{0,12}낯을? 가리/.test(text)) {
    push("initialAdaptationSupportNeed", "constraint", true)
  }

  const worries: string[] = []
  if (/(걱정|불안|염려|우려)/.test(text)) {
    if (/(영어|소통|말)/.test(text)) worries.push("communication")
    if (/(적응|낯선|처음)/.test(text)) worries.push("initial_adaptation")
    if (!worries.length) worries.push("general_fit")
  }
  if (worries.length) push("worries", "parent", Array.from(new Set(worries)))

  if (/한국어/.test(text) && /(비상|아플 때|응급)/.test(text)) {
    push("koreanSupportNeed", "constraint", "emergency_only")
  } else if (/한국어.{0,8}(매일|꼭|필수|상시)/.test(text)) push("koreanSupportNeed", "constraint", "must_daily")
  else if (/한국어.{0,12}(필요 없|중요하지 않|없어도|없으면).{0,8}(괜찮|돼|좋)/.test(text)) push("koreanSupportNeed", "constraint", "none")
  else if (/한국어.{0,40}꼭\s*있어야\s*하는\s*건?\s*아니/.test(text)
    || /한국어.{0,30}(있으면|가능).{0,24}(안심|좋|선호).{0,20}(꼭|필수).{0,12}(아니|없)/.test(text)) push("koreanSupportNeed", "constraint", "preferred")

  const stayGoals: string[] = []
  const parentStayContext = /(저는|부모|엄마|아빠|보호자|아이.{0,12}(캠프|프로그램).{0,12}시간)/.test(text)
  if (parentStayContext && /(쉬|휴식|마사지|웰니스)/.test(text)) stayGoals.push("restWellness")
  if (parentStayContext && /(카페|식당|맛집)/.test(text)) stayGoals.push("cafeDining")
  if (parentStayContext && /(관광|문화)/.test(text)) stayGoals.push("tourismCulture")
  if (parentStayContext && /(자연|해변|바다)/.test(text)) stayGoals.push("natureBeach")
  if (parentStayContext && /(원격근무|재택|일해야|카페.{0,8}일)/.test(text)) stayGoals.push("remoteWork")
  if (stayGoals.length) push("parentStayGoals", "parent", Array.from(new Set(stayGoals)))

  const regions: string[] = []
  if (/(호주|뉴질랜드|오세아니아|오클랜드|Auckland)/i.test(text)) regions.push("oceania")
  if (/(동남아|필리핀|세부|태국|치앙마이|싱가포르|말레이시아)/.test(text)) regions.push("southeast_asia")
  if (/(북미|미국|캐나다)/.test(text)) regions.push("north_america")
  if (/(유럽|영국|아일랜드|몰타)/.test(text)) regions.push("europe")
  if (regions.length) {
    push("preferredRegions", "preference", Array.from(new Set(regions)))
    if (/(가장|우선|먼저).{0,16}(좋|보|원|선호)/.test(text) || /(가장 좋|우선).{0,24}다른 (지역|곳)도 괜찮/.test(text)) {
      push("regionImportance", "preference", "strong")
    } else if (/(다른 (지역|곳)|어디든|지역.*상관).{0,12}(괜찮|가능|상관없)/.test(text)) {
      push("regionImportance", "preference", "soft")
    }
  } else if (/(지역|나라는?).{0,8}(상관없|어디든)/.test(text)) {
    push("preferredRegions", "preference", [])
    push("regionImportance", "preference", "no_preference")
  }

  const budgetRange = parseBudgetRange(text, basicInfo)
  if (budgetRange !== null) push("budgetRangeKrw", "constraint", budgetRange)
  if (/(항공|비행기|항공료).{0,20}(포함|합|같이|까지)/.test(text) || /(예산|비용).{0,12}포함.{0,8}(항공|비행기|항공료)/.test(text)) {
    push("budgetIncludesFlight", "constraint", true)
  } else if (/(항공|비행기|항공료).{0,12}(제외|빼고)/.test(text)) {
    push("budgetIncludesFlight", "constraint", false)
  }

  const departureWindow = parseDepartureWindow(text)
  if (departureWindow !== null) push("departureWindow", "constraint", departureWindow)

  const durationWeeks = parseDurationWeeks(text)
  if (durationWeeks !== null) push("durationWeeks", "constraint", durationWeeks)

  const careContext = currentQuestionKey === "special_care_follow_up"
    || /(건강|식사|알레르기|복약|약|특별관리|특별히\s*신경|신경\s*써야|기관과?.{0,8}(확인|전달|알려)|기관에.{0,8}(전달|알려))/.test(text)
  const careRequired = careContext && (
    /(상담|별도|추가).{0,10}(확인|문의|필요)/.test(text)
    || /(확인|지원|기관에?.{0,8}(전달|알려)).{0,12}(필요|해야)/.test(text)
    || /특별히.{0,16}(신경\s*써야|확인해야|부분|사항)/.test(text)
    || /(있어요|있습니다|있는 편|없는 것은 아니|없지는 않)/.test(text)
  )
  const careUnknown = careContext && /(잘 모르|모르겠|확실하지 않|아직 미정)/.test(text)
  const careNone = careContext && (
    /^(없어요|없습니다|없음)[.!\s]*$/.test(text)
    || /(특별관리|특별히\s*신경|건강|식사|알레르기|복약).{0,10}(사항|문제|필요한 것|확인할 것|신경 쓸 것)?[은는이가 ]{0,3}(전혀 )?없(어요|습니다|음)/.test(text)
  ) && !/(없는 것은 아니|없지는 않|없다고 할 수 없|없지만)/.test(text)
  if (careRequired) push("specialCareFollowUp", "constraint", "required", "특별관리 후속 확인이 필요하다고 답함")
  else if (careUnknown) push("specialCareFollowUp", "constraint", "unknown", "특별관리 후속 확인 여부를 아직 모른다고 답함")
  else if (careNone) push("specialCareFollowUp", "constraint", "none", "특별관리 후속 확인이 없다고 답함")

  return facts
}

export function canonicalizeSpecialCareMessage(message: string): string {
  const value = extractDeterministicFacts(message, undefined, "special_care_follow_up")
    .find((fact) => fact.key === "specialCareFollowUp")?.value
  if (value === "none") return "없어요"
  if (value === "unknown") return "아직 잘 모르겠어요"
  return "있어요. 상담할 때 별도로 확인할게요"
}

export function containsSensitiveHealthDetail(message: string): boolean {
  const text = message.normalize("NFKC")
  const explicitDetailTerm = /(알레르기|질환명?|진단명?|병력|복용약|복용량|약\s*이름|약명|처방약|투약|복약|밀리그램|\bmg\b)/i
  const namedCondition = /(천식|당뇨|아토피|뇌전증|간질|ADHD|자폐|우울증|공황장애|갑상선|심장병|크론병|셀리악)/i
  const foodReaction = /(땅콩|견과류|우유|계란|달걀|밀|대두|갑각류|새우).{0,10}(알레르기|못\s*먹|과민)/i
  const medicationSchedule = /(복용|투약|처방).{0,24}(약|정|캡슐|시럽|\d+\s*(회|mg|밀리그램))/i
  return explicitDetailTerm.test(text)
    || namedCondition.test(text)
    || foodReaction.test(text)
    || medicationSchedule.test(text)
}

function sameValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function isOneOf(value: unknown, allowed: readonly string[]): boolean {
  return typeof value === "string" && allowed.includes(value)
}

function isStringArray(value: unknown, max: number, allowed?: readonly string[]): boolean {
  return Array.isArray(value)
    && value.length <= max
    && value.every((item) => typeof item === "string" && (allowed === undefined || allowed.includes(item)))
}

function isExperienceGoals(value: unknown): boolean {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  const keys = ["schoolSchooling", "englishIntensive", "subjectProject", "cultureActivity"] as const
  const strengths = ["primary", "secondary", "mentioned", "none"] as const
  return Object.keys(record).length === keys.length
    && keys.every((key) => isOneOf(record[key], strengths))
}

function isBudgetRange(value: unknown): boolean {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  return typeof record["min"] === "number"
    && Number.isInteger(record["min"])
    && record["min"] >= 0
    && typeof record["max"] === "number"
    && Number.isInteger(record["max"])
    && record["max"] > 0
    && record["min"] <= record["max"]
}

function parseBudgetRange(text: string, basicInfo?: CampfitV3BasicInfo): { readonly min: number; readonly max: number } | null {
  if (!/(예산|비용|원까지|까지는|만원|만 원|원 정도)/.test(text)) return null
  const range = text.match(/(\d+(?:\.\d+)?)\s*(?:만)?\s*[~～-]\s*(\d+(?:\.\d+)?)\s*만\s*원/)
  if (range?.[1] && range[2]) {
    const min = Math.round(Number(range[1]) * 10_000)
    const max = Math.round(Number(range[2]) * 10_000)
    return Number.isFinite(min) && Number.isFinite(max) && min <= max ? { min, max } : null
  }
  const matches = [...text.matchAll(/(\d+(?:\.\d+)?)\s*(?:만\s*원|만원|만|원|까지|정도|이라고|생각)/g)]
  const latest = matches.at(-1)?.[1]
  if (latest === undefined) return null
  const max = Math.round(Number(latest) * 10_000)
  if (!Number.isFinite(max) || max <= 0) return null
  const currentMin = basicInfo?.budgetMinKrw ?? 0
  return { min: Math.min(currentMin, max), max }
}

function parseDepartureWindow(text: string): string | null {
  if (!/(출발|시기|방학)/.test(text)) return null
  const named = text.match(/((?:다음|이번)?\s*(?:여름|겨울|봄)방학)/)?.[1]
  if (named) return named.replace(/\s+/g, " ").trim()
  const month = text.match(/((?:20\d{2}년\s*)?\d{1,2}월(?:\s*(?:초|중순|말))?)/)?.[1]
  return month?.trim() ?? null
}

function parseDurationWeeks(text: string): number | null {
  if (!/(기간|체류|캠프|주로|주까지|주 정도)/.test(text)) return null
  const range = text.match(/(\d{1,2})\s*[~～-]\s*(\d{1,2})\s*주/)
  if (range?.[2]) {
    const value = Number(range[2])
    return value >= CAMPFIT_V3_MIN_DURATION_WEEKS && value <= CAMPFIT_V3_MAX_DURATION_WEEKS ? value : null
  }
  const matches = [...text.matchAll(/(\d{1,2})\s*주/g)]
  const latest = matches.at(-1)?.[1]
  if (latest === undefined) return null
  const value = Number(latest)
  return value >= CAMPFIT_V3_MIN_DURATION_WEEKS && value <= CAMPFIT_V3_MAX_DURATION_WEEKS ? value : null
}

export function summarizeFacts(state: CampfitV3ConversationState): readonly string[] {
  const labels: Partial<Record<CampfitV3FactKey, string>> = {
    childEnglishLevel: "아이 영어 수준",
    experienceGoals: "원하는 경험",
    preferredRegions: "희망 지역",
    koreanSupportNeed: "한국어 지원",
    parentCommunicationNeed: "부모 연락",
    parentStayGoals: "부모 체류 목적",
    specialCareFollowUp: "별도 확인 사항",
  }
  return Object.entries(state.facts).flatMap(([key, fact]) => {
    const label = labels[key as CampfitV3FactKey]
    if (!label || !fact) return []
    return [`${label}: ${displayValue(fact.value)}`]
  })
}

export function questionReplies(labels: readonly [string, string][]): readonly CampfitV3QuickReply[] {
  return labels.map(([key, label]) => ({ key, label }))
}

function goalStrengths(primary: string): Readonly<Record<ExperienceDirectionKey, ExperienceGoalStrength>> {
  return completeGoals({ [primary]: "primary" })
}

function completeGoals(values: Partial<Record<ExperienceDirectionKey, ExperienceGoalStrength>>): Readonly<Record<ExperienceDirectionKey, ExperienceGoalStrength>> {
  return {
    schoolSchooling: values.schoolSchooling ?? "none",
    englishIntensive: values.englishIntensive ?? "none",
    subjectProject: values.subjectProject ?? "none",
    cultureActivity: values.cultureActivity ?? "none",
  }
}

function displayValue(value: unknown): string {
  if (Array.isArray(value)) return value.length ? value.join(", ") : "지역 무관"
  if (typeof value === "object" && value !== null) {
    return Object.entries(value).filter(([, item]) => item !== "none").map(([key, item]) => `${key} ${String(item)}`).join(", ")
  }
  if (typeof value === "boolean") return value ? "예" : "아니요"
  return String(value)
}
