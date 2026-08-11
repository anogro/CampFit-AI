import { CAMPFIT_V3_MAX_DURATION_WEEKS, CAMPFIT_V3_MIN_DURATION_WEEKS } from "@/types/campfitV3"
import { assessEnglishReadiness } from "@/lib/campfit/v3/englishReadiness"
import { extractParentExperienceNeedsValue, isParentExperienceNeedsValue } from "@/lib/campfit/v3/parentExperienceNeeds"
import type {
  CampfitV3BasicInfo,
  CampfitV3ConversationState,
  CampfitV3Fact,
  CampfitV3FactKey,
  CampfitV3FactSource,
  CampfitV3FactStatus,
  CampfitV3FactSubject,
  CampfitV3QuickReply,
  CampfitV3EnglishAssessmentType,
  CampfitV3EnglishEnvironmentType,
  CampfitV3EnglishExperienceType,
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
      ? mergeArrayValues(existing.value, incoming.value)
      : incoming.value
    facts[incoming.key] = value === incoming.value ? incoming : { ...incoming, value }
    if (incoming.status !== "tentative" && incoming.status !== "unknown" && incoming.source !== "ai_inference") resolved.add(incoming.key)
  }
  const excludedRegions = facts.excludedRegions?.value
  const preferredRegions = facts.preferredRegions?.value
  if (Array.isArray(excludedRegions) && Array.isArray(preferredRegions)) {
    const excluded = new Set(excludedRegions)
    const filtered = preferredRegions.filter((region) => !excluded.has(region))
    if (filtered.length !== preferredRegions.length) {
      const preferredFact = facts.preferredRegions
      if (preferredFact) facts.preferredRegions = { ...preferredFact, value: filtered }
    }
  }
  return {
    ...state,
    facts,
    unresolved: state.unresolved.filter((key) => !resolved.has(key)),
    conflicts: state.conflicts.filter((conflict) => !resolved.has(conflict.key)),
  }
}

export function syncEnglishReadiness(state: CampfitV3ConversationState): CampfitV3ConversationState {
  const assessment = assessEnglishReadiness(state)
  const hasEnglishInput = assessment.evidenceKeys.length > 0
    || state.facts.childEnglishLevel !== undefined
    || state.facts.englishReadiness !== undefined
  if (!hasEnglishInput) return state

  const readinessFact = createFact({
    key: "englishReadiness",
    subject: "child",
    value: assessment.readiness,
    source: "ai_inference",
    confidence: assessment.confidence,
    status: assessment.recommendationSufficiency ? "known" : "tentative",
    evidence: assessment.reason,
  })
  const merged = mergeFacts(state, [readinessFact])
  const englishKeys: readonly CampfitV3FactKey[] = [
    "childEnglishLevel",
    "englishReadiness",
    "childEnglishExperience",
    "childEnglishEnvironment",
    "childEnglishAssessment",
    "childEnglishListening",
    "childEnglishSpeaking",
    "childEnglishReading",
    "childEnglishWriting",
    "childEnglishUsage",
  ]
  const unresolved = assessment.recommendationSufficiency
    ? merged.unresolved.filter((key) => !englishKeys.includes(key))
    : Array.from(new Set([
      ...merged.unresolved,
      ...(assessment.readiness === "unknown" ? ["englishReadiness" as const] : []),
    ]))
  const completedQuestionKeys = assessment.recommendationSufficiency
    ? merged.completedQuestionKeys
    : merged.completedQuestionKeys.filter((key) => key !== "child_english_level")
  return { ...merged, unresolved, completedQuestionKeys }
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
    childEnglishExperience: ["child"],
    childEnglishEnvironment: ["child"],
    childEnglishAssessment: ["child"],
    childEnglishListening: ["child"],
    childEnglishSpeaking: ["child"],
    childEnglishReading: ["child"],
    childEnglishWriting: ["child"],
    childEnglishUsage: ["child"],
    englishReadiness: ["child"],
    parentEnglishCommunication: ["parent"],
    isFirstOverseasEducationExperience: ["child"],
    dayProgramSeparationReadiness: ["child"],
    preferredActivities: ["preference"],
    destinationPreference: ["preference"],
    socialPreference: ["child", "preference"],
    desiredOutcomes: ["preference"],
    worries: ["parent", "family"],
    parentExperienceNeeds: ["preference"],
    experienceGoals: ["preference"],
    preferredRegions: ["preference"],
    excludedRegions: ["preference"],
    regionImportance: ["preference"],
    koreanSupportNeed: ["constraint"],
    programCommuteNeed: ["constraint"],
    programMealNeed: ["constraint"],
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
    case "childEnglishExperience":
      return isEnglishExperienceArray(input.value)
    case "childEnglishEnvironment":
      return isStringArray(input.value, 8, ["international_school", "overseas_school", "overseas_camp", "overseas_residence"])
    case "childEnglishAssessment":
      return isEnglishAssessmentArray(input.value)
    case "childEnglishListening":
      return isOneOf(input.value, ["understands_simple_instructions", "understands_class_explanation", "struggles_with_class_explanation", "unknown"])
    case "childEnglishSpeaking":
      return isOneOf(input.value, ["answers_simple_questions", "can_converse", "initiates_speech", "can_present_in_english", "difficulty_initiating", "rarely_speaks", "unknown"])
    case "childEnglishReading":
      return isOneOf(input.value, ["phonics_only", "reads_simple_text", "reads_english_books", "understands_english_books", "unknown"])
    case "childEnglishWriting":
      return isOneOf(input.value, ["simple_words", "simple_sentences", "can_explain_in_english", "unknown"])
    case "childEnglishUsage":
      return isStringArray(input.value, 8, ["speaks_with_foreigners", "answers_in_english", "initiates_in_english", "difficulty_initiating", "rarely_uses_english"])
    case "englishReadiness":
      return isOneOf(input.value, ["support_required", "beginner_friendly", "general_program_ready", "academic_ready", "unknown"])
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
    case "parentExperienceNeeds":
      return isParentExperienceNeedsValue(input.value)
    case "experienceGoals":
      return isExperienceGoals(input.value)
    case "preferredRegions":
      return isStringArray(input.value, 4, ["southeast_asia", "oceania", "north_america", "europe"])
    case "excludedRegions":
      return isStringArray(input.value, 4, ["southeast_asia", "oceania", "north_america", "europe"])
    case "regionImportance":
      return isOneOf(input.value, ["must", "strong", "soft", "no_preference"])
    case "koreanSupportNeed":
      return isOneOf(input.value, ["must_daily", "emergency_only", "preferred", "none"])
    case "programCommuteNeed":
      return isOneOf(input.value, ["simple_only", "shuttle_preferred", "any"])
    case "programMealNeed":
      return isOneOf(input.value, ["lunch_required", "meals_preferred", "any"])
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

  const childEnglishText = /(아이|애|첫째|둘째|첫째 아이|둘째 아이).{0,40}(영어|수업|대화)/iu.test(text)
    || currentQuestionKey === "child_english_level" && /(?:영어 수업|영어로 대화|단어나 짧은 표현|간단한 대화|일상 대화|초급|영어(?:는|가|를|에|로)\s*(?:거의\s*)?(?:처음|못|낯설)|중급|고급|beginner|basic|intermediate|advanced)/iu.test(text)
  if (childEnglishText && /(초급|처음|거의 못|낯설|첨|단어나 짧은 표현|beginner)/iu.test(text)) push("childEnglishLevel", "child", "beginner")
  else if (childEnglishText && /(간단한 문장|짧은 문장|듣고\s*말|이야기하고\s*듣|basic)/iu.test(text)) push("childEnglishLevel", "child", "basic")
  else if (childEnglishText && /(중급|간단한 대화|일상 대화|수업\s*(?:에|을)?\s*참여|영어\s*수업.{0,10}참여|참여할\s*정도|대화.*가능|intermediate)/iu.test(text)) push("childEnglishLevel", "child", "intermediate")
  else if (childEnglishText && /(고급|수업.*무리|편하게|advanced)/iu.test(text)) push("childEnglishLevel", "child", "advanced")

  const childEnglishEvidenceContext = currentQuestionKey === "child_english_level"
    || childEnglishText
    || /(아이|애|자녀|첫째|둘째).{0,48}(영어|수업|대화|읽|말|쓰기)/iu.test(text)
    || /(영어\s*유치원|영어\s*학원|AR\s*\d|Lexile|국제학교|해외\s*(?:학교|캠프|거주)|영어책|파닉스)/iu.test(text)
  const englishExperience: Array<{ type: CampfitV3EnglishExperienceType; durationYears: number | null; ongoing: boolean | null }> = []
  const deniedEnglishKindergarten = /(?:영어\s*유치원|영유).{0,10}(?:안\s*다녔|다니지\s*않|경험\s*없)|(?:안\s*다녔|다니지\s*않).{0,10}(?:영어\s*유치원|영유)/iu.test(text)
  if (childEnglishEvidenceContext && !deniedEnglishKindergarten && /(영어\s*유치원|영유)/iu.test(text)) englishExperience.push({ type: "english_kindergarten", durationYears: durationYearsFor(text, /(영어\s*유치원|영유)/iu), ongoing: ongoingFor(text, /(영어\s*유치원|영유)/iu) })
  if (childEnglishEvidenceContext && /(영어\s*학원|영어\s*어학원)/iu.test(text)) englishExperience.push({ type: "english_academy", durationYears: durationYearsFor(text, /(영어\s*학원|영어\s*어학원)/iu), ongoing: ongoingFor(text, /(영어\s*학원|영어\s*어학원)/iu) })
  if (childEnglishEvidenceContext && /(영어\s*수업|영어로\s*(?:하는\s*)?(?:수업|교육)|영어\s*과외)/iu.test(text)) englishExperience.push({ type: "english_class", durationYears: durationYearsFor(text, /(영어\s*수업|영어로\s*(?:하는\s*)?(?:수업|교육)|영어\s*과외)/iu), ongoing: ongoingFor(text, /(영어\s*수업|영어로\s*(?:하는\s*)?(?:수업|교육)|영어\s*과외)/iu) })
  if (childEnglishEvidenceContext && /(영어\s*몰입|몰입\s*교육|영어로만|영어\s*환경)/iu.test(text)) englishExperience.push({ type: "english_immersion", durationYears: durationYearsFor(text, /(영어\s*몰입|몰입\s*교육|영어로만|영어\s*환경)/iu), ongoing: ongoingFor(text, /(영어\s*몰입|몰입\s*교육|영어로만|영어\s*환경)/iu) })
  if (englishExperience.length) push("childEnglishExperience", "child", dedupeStructuredValues(englishExperience))

  const englishEnvironment: CampfitV3EnglishEnvironmentType[] = []
  if (childEnglishEvidenceContext && /(국제학교|international\s*school)/iu.test(text)) englishEnvironment.push("international_school")
  if (childEnglishEvidenceContext && /(해외\s*(?:학교|유학)|외국\s*학교|overseas\s*school)/iu.test(text)) englishEnvironment.push("overseas_school")
  if (childEnglishEvidenceContext && /(해외\s*캠프|해외캠프|overseas\s*camp)/iu.test(text)) englishEnvironment.push("overseas_camp")
  if (childEnglishEvidenceContext && /(해외\s*(?:거주|생활)|외국에서\s*살|overseas\s*residen)/iu.test(text)) englishEnvironment.push("overseas_residence")
  if (englishEnvironment.length) push("childEnglishEnvironment", "child", Array.from(new Set(englishEnvironment)))

  const englishAssessments: Array<{ type: CampfitV3EnglishAssessmentType; value: number | string }> = []
  const ar = childEnglishEvidenceContext ? text.match(/\bAR\s*(?:은|는)?\s*(\d+(?:\.\d+)?)/iu) : null
  if (ar?.[1] !== undefined) englishAssessments.push({ type: "ar", value: Number(ar[1]) })
  const lexile = childEnglishEvidenceContext ? text.match(/\bLexile\s*(?:은|는)?\s*(\d+)/iu) : null
  if (lexile?.[1] !== undefined) englishAssessments.push({ type: "lexile", value: Number(lexile[1]) })
  const exam = childEnglishEvidenceContext ? text.match(/\b(TOEFL|TOEIC|IELTS|Cambridge)\s*([A-Za-z0-9+.-]*)/iu) : null
  if (exam?.[0] !== undefined) englishAssessments.push({ type: "english_exam", value: exam[0].trim() })
  if (childEnglishEvidenceContext && /(영어\s*(?:시험|레벨|학년)|학교\s*영어\s*수준)/iu.test(text) && !englishAssessments.some((item) => item.type === "english_exam")) {
    englishAssessments.push({ type: "school_level", value: text.slice(0, 80) })
  }
  if (englishAssessments.length) push("childEnglishAssessment", "child", dedupeStructuredValues(englishAssessments))

  const listening = childEnglishEvidenceContext ? listeningEvidence(text) : null
  if (listening !== null) push("childEnglishListening", "child", listening)
  const speaking = childEnglishEvidenceContext ? speakingEvidence(text) : null
  if (speaking !== null) push("childEnglishSpeaking", "child", speaking)
  const reading = childEnglishEvidenceContext ? readingEvidence(text) : null
  if (reading !== null) push("childEnglishReading", "child", reading)
  const writing = childEnglishEvidenceContext ? writingEvidence(text) : null
  if (writing !== null) push("childEnglishWriting", "child", writing)
  const usage = childEnglishEvidenceContext ? usageEvidence(text) : []
  if (usage.length) push("childEnglishUsage", "child", usage)

  if (/(저는|제가|부모|엄마|아빠|보호자).{0,24}(영어|basic\s*communication|소통).{0,20}(가능|할 수|괜찮|소통|돼|되)/iu.test(text)) push("parentEnglishCommunication", "parent", "possible")
  if (/(첫|처음).{0,8}(해외|캠프|교육)/.test(text)) push("isFirstOverseasEducationExperience", "child", true)
  if (/(첫 경험이 아니|해외.*경험.*있)/.test(text)) push("isFirstOverseasEducationExperience", "child", false)

  const parentExperienceNeeds = extractParentExperienceNeedsValue(text)
  if (parentExperienceNeeds !== null) push("parentExperienceNeeds", "preference", parentExperienceNeeds)

  const goals: Partial<Record<ExperienceDirectionKey, ExperienceGoalStrength>> = {}
  const englishExposureContext = /(영어유치원|영어\s*환경|영어를?\s*(?:자연스럽게|계속|자주)\s*(?:접|배우)|영어\s*노출|영어\s*사용\s*기회|영어\s*경험|영어\s*감|영어.{0,12}(?:유지|확대|늘리))/iu.test(text)
  if (/(국제학교|현지학교|학교 분위기|학교 프로그램|학교 수업|스쿨링|학교처럼|시간표|수업 시간|학교식)/.test(text)) goals.schoolSchooling = "primary"
  if (/(영어 실력|영어 자신감|영어 집중|영어.*늘)/.test(text)) goals.englishIntensive = goals.schoolSchooling ? "secondary" : "primary"
  if (englishExposureContext) goals.englishIntensive = goals.schoolSchooling ? "secondary" : "primary"
  if (/(STEM|코딩|로봇|프로젝트|미술|스포츠|관심 분야)/i.test(text)) goals.subjectProject = "primary"
  const projectPreferredOverGeneralExperience = /(?:문화|활동|체험).{0,16}(?:보다|보다는|말고).{0,24}(?:STEM|코딩|로봇|프로젝트|과학|결과물)/i.test(text)
  if (!projectPreferredOverGeneralExperience && /(문화|활동|체험|즐거운)/.test(text)) goals.cultureActivity = "primary"
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

  // City selection priorities are separate from the child's program direction.
  // Keep them in the existing structured facts so extra consultation answers
  // reach the city scorer instead of remaining transcript-only text.
  const cityActivities = /activity|activities|tourism|culture|weekend|\uBCFC\uAC70\uB9AC|\uCCB4\uD5D8|\uAD00\uAD11|\uC8FC\uB9D0/iu.test(text)
  const cityNature = /nature|beach|park|outdoor|\uC790\uC5F0|\uD574\uBCC0|\uACF5\uC6D0/iu.test(text)
  if (cityActivities) preferredActivities.push("city_activities")
  if (cityNature) preferredActivities.push("city_nature")
  if (cityActivities || cityNature) push("preferredActivities", "preference", Array.from(new Set(preferredActivities)))

  const desiredOutcomes: string[] = []
  if (englishExposureContext) desiredOutcomes.push("english_exposure")
  if (/(영어.*(늘|성장|자신감)|영어를? 배우)/.test(text)) desiredOutcomes.push("english_confidence")
  if (/(적응|독립심|자신감|성장|새로운 경험)/.test(text)) desiredOutcomes.push("confidence_and_adaptation")
  if (/(친구|또래|사람을? 만나는)/.test(text)) desiredOutcomes.push("peer_connection")
  if (desiredOutcomes.length) push("desiredOutcomes", "preference", Array.from(new Set(desiredOutcomes)))
  if (/(새로운 곳|낯선 곳).{0,12}적응.{0,12}(시간|어려|도움|천천히)/.test(text)
    || /적응하는 데 시간이/.test(text)
    || /처음에는.{0,12}낯을? 가리/.test(text)) {
    push("initialAdaptationSupportNeed", "constraint", true)
  }

  const commuteMentioned = /(?:통학|대중교통|환승|셔틀|이동\s*(?:시간|거리)|차량)/iu.test(text)
  if (commuteMentioned) {
    if (/(힘들|어렵|짧|가까|간단|혼자|환승\s*없|오래\s*걸리)/iu.test(text)) push("programCommuteNeed", "constraint", "simple_only")
    else if (/(셔틀|차량|픽업)/iu.test(text)) push("programCommuteNeed", "constraint", "shuttle_preferred")
    else if (/(상관없|괜찮|무관)/iu.test(text)) push("programCommuteNeed", "constraint", "any")
  }

  const mealMentioned = /(도시락|점심|식사|급식|중식)/iu.test(text)
  if (mealMentioned) {
    if (/(꼭|필수|반드시|필요|없으면\s*안)/iu.test(text)) push("programMealNeed", "constraint", "lunch_required")
    else if (/(상관없|괜찮|무관)/iu.test(text)) push("programMealNeed", "constraint", "any")
    else push("programMealNeed", "constraint", "meals_preferred")
  }

  const worries: string[] = []
  if (/medical|hospital|health|emergency|\uBCD1\uC6D0|\uC758\uB8CC|\uC751\uAE09/iu.test(text)) worries.push("medical_access")
  if (/safety|security|\uCE58\uC548|\uC548\uC804/iu.test(text)) worries.push("city_safety")
  if (/racism|discrimination|multicultural|foreigner|\uC778\uC885|\uCC28\uBCC4|\uB2E4\uC778\uC885|\uC678\uAD6D\uC778/iu.test(text)) worries.push("foreign_friendliness")
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
  else if (/한국어\s*지원/.test(text)) push("koreanSupportNeed", "constraint", "unknown")

  const stayGoals: string[] = []
  const parentStayContext = /(저는|부모|엄마|아빠|보호자|아이.{0,12}(캠프|프로그램).{0,12}시간)/.test(text)
  if (parentStayContext && /(쉬|휴식|마사지|웰니스)/.test(text)) stayGoals.push("restWellness")
  if (parentStayContext && /(카페|식당|맛집)/.test(text)) stayGoals.push("cafeDining")
  if (parentStayContext && /(관광|문화)/.test(text)) stayGoals.push("tourismCulture")
  if (parentStayContext && /(자연|해변|바다)/.test(text)) stayGoals.push("natureBeach")
  if (parentStayContext && /(원격근무|재택|일해야|일할 예정|일할 거|카페.{0,8}일)/.test(text)) stayGoals.push("remoteWork")
  if (stayGoals.length) push("parentStayGoals", "parent", Array.from(new Set(stayGoals)))

  const regionMatchers: readonly [string, RegExp, RegExp][] = [
    ["oceania", /(호주|뉴질랜드|오세아니아|오클랜드|Auckland)/iu, /(호주|뉴질랜드|오세아니아|오클랜드|Auckland).{0,20}(너무\s*멀|멀어서|비행시간|비행.*길|피하|제외|싫)/iu],
    ["southeast_asia", /(동남아|필리핀|세부|태국|치앙마이|싱가포르|말레이시아)/iu, /(동남아|필리핀|세부|태국|치앙마이|싱가포르|말레이시아).{0,20}(너무\s*멀|멀어서|비행시간|비행.*길|피하|제외|싫)/iu],
    ["north_america", /(북미|미국|캐나다)/iu, /(북미|미국|캐나다).{0,20}(너무\s*멀|멀어서|비행시간|비행.*길|피하|제외|싫)/iu],
    ["europe", /(유럽|영국|아일랜드|몰타)/iu, /(유럽|영국|아일랜드|몰타).{0,20}(너무\s*멀|멀어서|비행시간|비행.*길|피하|제외|싫)/iu],
  ]
  const regions = regionMatchers.filter(([, matcher]) => matcher.test(text)).map(([region]) => region)
  const excludedRegions = regionMatchers.filter(([, , excludedMatcher]) => excludedMatcher.test(text)).map(([region]) => region)
  const preferredRegions = regions.filter((region) => !excludedRegions.includes(region))
  if (excludedRegions.length) push("excludedRegions", "preference", Array.from(new Set(excludedRegions)))
  if (preferredRegions.length) {
    push("preferredRegions", "preference", Array.from(new Set(preferredRegions)))
    if (/(가장|우선|먼저).{0,16}(좋|보|원|선호)/.test(text) || /(가장 좋|우선).{0,24}다른 (지역|곳)도 괜찮/.test(text)) {
      push("regionImportance", "preference", "strong")
    } else if (/(다른 (지역|곳)|어디든|지역.*상관).{0,12}(괜찮|가능|상관없)/.test(text)) {
      push("regionImportance", "preference", "soft")
    }
  } else if (excludedRegions.length) {
    push("preferredRegions", "preference", [])
    push("regionImportance", "preference", "no_preference")
  } else if (/(지역|나라는?).{0,8}(상관없|어디든)/.test(text)
    || /(^|[\s,])상관없(?:긴\s*한데|긴하지만|어도|어요|습니다)/.test(text)
    || /(딱히|특정).{0,16}(없|정하지|생각한 곳)/.test(text)
    || /(마음에 두고 있는|정해 둔).{0,12}(곳|도시|나라).{0,8}(없|아직)/.test(text)) {
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

function mergeArrayValues(existing: readonly unknown[], incoming: readonly unknown[]): readonly unknown[] {
  const values = [...existing, ...incoming]
  const seen = new Set<string>()
  return values.filter((value) => {
    const key = typeof value === "object" && value !== null ? JSON.stringify(value) : `${typeof value}:${String(value)}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function dedupeStructuredValues<T>(values: readonly T[]): readonly T[] {
  const seen = new Set<string>()
  return values.filter((value) => {
    const key = JSON.stringify(value)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function durationYearsFor(text: string, context: RegExp): number | null {
  const match = experienceDurationContext(text, context).match(/(\d+(?:\.\d+)?)\s*년/iu)
  if (!match?.[1]) return null
  const value = Number(match[1])
  return Number.isFinite(value) && value >= 0 && value <= 20 ? value : null
}

function ongoingFor(text: string, context: RegExp): boolean | null {
  const match = text.match(context)
  if (match?.index === undefined) return null
  const afterText = text.slice(match.index, match.index + 48)
  const beforeText = text.slice(Math.max(0, match.index - 20), match.index)
  if (/(그만|중단|예전|다녔지만)/iu.test(beforeText) || /(그만|중단|예전|다녔지만|다녔고\s*(?:지금은|현재는)?)/iu.test(afterText)) return false
  if (/(계속|현재|지금도|다니고\s*있|재학)/iu.test(afterText + beforeText)) return true
  return null
}

function experienceContext(text: string, context: RegExp): string {
  const match = text.match(context)
  if (match?.index === undefined) return ""
  return text.slice(Math.max(0, match.index - 12), match.index + 48)
}

function experienceDurationContext(text: string, context: RegExp): string {
  const match = text.match(context)
  if (match?.index === undefined) return ""
  return text.slice(match.index, match.index + 48)
}

function listeningEvidence(text: string): "understands_simple_instructions" | "understands_class_explanation" | "struggles_with_class_explanation" | null {
  if (/(?:선생님|교사|수업).{0,24}(?:설명|말).{0,10}(?:잘\s*)?(?:못\s*알아(?:듣|들)|이해\s*못)/iu.test(text)
    || /(?:선생님|교사).{0,24}설명(?:은|이|을)?\s*(?:어려|힘들)/iu.test(text)) return "struggles_with_class_explanation"
  if (/(영어로\s*(?:하는\s*)?(?:수업|설명)).{0,10}(?:잘\s*)?(?:못\s*알아(?:듣|들)|이해\s*못)/iu.test(text)
    || /영어로\s*(?:하는\s*)?설명(?:은|이|을)?\s*(?:어려|힘들)/iu.test(text)) return "struggles_with_class_explanation"
  if (/외국인\s*선생님.{0,20}(?:설명|수업).{0,16}(?:잘\s*)?(?:알아듣|이해|따라)/iu.test(text)) return "understands_class_explanation"
  if (/외국인\s*선생님.{0,20}(대충|조금|간단히).{0,12}(알아듣|이해)/iu.test(text)) return "understands_simple_instructions"
  if (/(원어민|외국인).{0,20}(말|설명).{0,12}(대충|조금|잘)?\s*(알아듣|이해)/iu.test(text)) return "understands_simple_instructions"
  if (/(선생님|교사|수업).{0,20}(설명|말).{0,20}(잘\s*)?(알아듣|이해|따라)/iu.test(text)
    || /(영어로\s*(?:하는\s*)?(수업|설명)).{0,20}(이해|따라|들을|듣|참여)/iu.test(text)) return "understands_class_explanation"
  if (/(간단한\s*(지시|안내|설명)|외국인\s*선생님.{0,20}(알아듣|이해)|듣고\s*말|말을\s*듣)/iu.test(text)) return "understands_simple_instructions"
  return null
}

function speakingEvidence(text: string): "answers_simple_questions" | "can_converse" | "initiates_speech" | "can_present_in_english" | "difficulty_initiating" | "rarely_speaks" | null {
  if (/(먼저\s*말|말을?\s*먼저|자발적으로\s*말)/iu.test(text) && /(잘\s*못|어려|힘들|않)/iu.test(text)) return "difficulty_initiating"
  if (/(말하기|영어로\s*말|회화).{0,20}(어려|힘들|잘\s*못|자신\s*없)|먼저\s*말하.{0,8}(못|어려|자신\s*없)/iu.test(text)) return "difficulty_initiating"
  if (/(대답|질문에\s*답).{0,12}(잘\s*못|어려|힘들)/iu.test(text)) return "difficulty_initiating"
  if (/영어로\s*(?:수업|발표).{0,24}(?:문제(?:는)?\s*없|무리\s*없|가능)/iu.test(text)) return "can_present_in_english"
  if (/(?:외국인|원어민).{0,24}대화.{0,32}(?:문제(?:는)?\s*없|무리\s*없|가능)/iu.test(text)) return "can_converse"
  if (/(먼저\s*말|자발적으로\s*영어로\s*말|스스로\s*말)/iu.test(text)) return "initiates_speech"
  if (/(영어로\s*곧잘\s*말|영어로\s*편하게\s*(?:말|대화)|유창하게\s*말|영어로\s*대화가?\s*(?:잘\s*)?가능)/iu.test(text)) return "can_converse"
  if (/(간단한\s*(?:질문|대화)|질문에\s*(?:답|대답)|짧은\s*대화|대화가?\s*가능|간단히\s*대답|대답(?:은|을)?\s*(?:할\s*수|가능|할\s*수\s*있))/iu.test(text)) return "answers_simple_questions"
  if (/실제로\s*말.{0,16}(?:안\s*(?:나오|나와)|잘\s*안\s*(?:나오|나와))/iu.test(text)) return "rarely_speaks"
  if (/(영어는\s*거의\s*(?:처음|못)|영어로\s*말을?\s*거의\s*안)/iu.test(text)) return "rarely_speaks"
  return null
}

function readingEvidence(text: string): "phonics_only" | "reads_simple_text" | "reads_english_books" | "understands_english_books" | null {
  if (/(영어책|영어\s*책|영어로\s*된\s*책).{0,16}(읽고|읽으면서|이해)/iu.test(text) || /(읽고\s*이해|독해가?\s*가능)/iu.test(text)) return "understands_english_books"
  if (/(영어책|영어\s*책|영어\s*동화책).{0,12}(읽|보)/iu.test(text)) return "reads_english_books"
  if (/(간단한\s*(글|문장)|짧은\s*글).{0,12}(읽|읽을)/iu.test(text)) return "reads_simple_text"
  if (/(파닉스|phonics)/iu.test(text)) return "phonics_only"
  return null
}

function writingEvidence(text: string): "simple_words" | "simple_sentences" | "can_explain_in_english" | null {
  if (/(영어로\s*(?:글을\s*(쓰|써)|작문)|영어\s*작문|영어로\s*자기\s*생각을\s*(쓰|써)|(?:아이|자녀|스스로|직접).{0,20}영어로\s*설명|영어로\s*설명.{0,8}(?:할\s*수|가능|잘\s*해))/iu.test(text)) return "can_explain_in_english"
  if (/(영어로\s*(간단한\s*)?(문장|글).{0,8}(쓰|써|작성)|문장\s*쓰기)/iu.test(text)) return "simple_sentences"
  if (/(영어\s*단어.{0,8}(쓰|써|적)|단어\s*쓰기)/iu.test(text)) return "simple_words"
  return null
}

function usageEvidence(text: string): readonly string[] {
  const values: string[] = []
  if (/(외국인|원어민).{0,20}(?:대화|이야기|소통)|(?:외국인|원어민).{0,20}(?:과|와|랑|하고).{0,12}(?:말|대화|소통)/iu.test(text)) values.push("speaks_with_foreigners")
  if (/외국\s*친구.{0,20}(?:영어|영어로).{0,12}(?:쓰|사용)/iu.test(text)) values.push("speaks_with_foreigners")
  if (/(영어로\s*(질문에\s*)?(답|대답)|영어\s*질문에\s*대답)/iu.test(text)) values.push("answers_in_english")
  if (/(먼저\s*영어로\s*말|자발적으로\s*영어|스스로\s*영어로\s*말)/iu.test(text)) values.push("initiates_in_english")
  if (/(영어를?\s*(거의|잘)\s*(사용|안\s*쓰)|영어\s*사용\s*기회가?\s*(적|없))/iu.test(text)) values.push("rarely_uses_english")
  if (/(영어로\s*먼저\s*말하.{0,8}(못|어려)|영어\s*사용.{0,8}(소극|어려))/iu.test(text)) values.push("difficulty_initiating")
  return Array.from(new Set(values))
}

function isEnglishExperienceArray(value: unknown): value is readonly { readonly type: CampfitV3EnglishExperienceType; readonly durationYears: number | null; readonly ongoing: boolean | null }[] {
  return Array.isArray(value) && value.length <= 8 && value.every((item) => {
    if (typeof item !== "object" || item === null || Array.isArray(item)) return false
    const record = item as Record<string, unknown>
    return isOneOf(record["type"], ["english_kindergarten", "english_academy", "english_class", "english_immersion"])
      && (record["durationYears"] === null || (typeof record["durationYears"] === "number" && Number.isFinite(record["durationYears"]) && record["durationYears"] >= 0 && record["durationYears"] <= 20))
      && (record["ongoing"] === null || typeof record["ongoing"] === "boolean")
  })
}

function isEnglishAssessmentArray(value: unknown): value is readonly { readonly type: CampfitV3EnglishAssessmentType; readonly value: number | string }[] {
  return Array.isArray(value) && value.length <= 8 && value.every((item) => {
    if (typeof item !== "object" || item === null || Array.isArray(item)) return false
    const record = item as Record<string, unknown>
    return isOneOf(record["type"], ["ar", "lexile", "english_exam", "school_level"])
      && ((typeof record["value"] === "number" && Number.isFinite(record["value"])) || (typeof record["value"] === "string" && record["value"].trim().length > 0 && record["value"].length <= 80))
  })
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
    parentExperienceNeeds: "부모가 기대하는 경험",
    experienceGoals: "원하는 경험",
    preferredRegions: "희망 지역",
    excludedRegions: "제외 지역",
    koreanSupportNeed: "한국어 지원",
    programCommuteNeed: "프로그램 이동 조건",
    programMealNeed: "식사·도시락 조건",
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
