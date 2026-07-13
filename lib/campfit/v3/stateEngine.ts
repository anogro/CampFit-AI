import type {
  CampfitV3ConversationState,
  CampfitV3Fact,
  CampfitV3FactKey,
  CampfitV3FactSource,
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

export function createInitialConversationState(): CampfitV3ConversationState {
  return { facts: {}, askedQuestionKeys: [], currentQuestionKey: null, questionCount: 0, unresolved: [], conflicts: [] }
}

export function createFact(input: {
  readonly key: CampfitV3FactKey
  readonly subject: CampfitV3FactSubject
  readonly value: unknown
  readonly source: CampfitV3FactSource
  readonly evidence: string
  readonly confidence?: number
  readonly updatedAt?: string
}): CampfitV3Fact {
  return {
    key: input.key,
    subject: input.subject,
    value: input.value,
    source: input.source,
    confidence: input.confidence ?? (input.source === "ai_inference" ? 0.7 : 1),
    evidence: input.evidence,
    updatedAt: input.updatedAt ?? new Date().toISOString(),
  }
}

export function mergeFacts(
  state: CampfitV3ConversationState,
  incomingFacts: readonly CampfitV3Fact[],
): CampfitV3ConversationState {
  const facts = { ...state.facts }
  for (const incoming of incomingFacts) {
    const existing = facts[incoming.key]
    if (existing && sourcePriority[incoming.source] < sourcePriority[existing.source]) continue
    if (incoming.source === "ai_inference" && incoming.evidence.trim().length === 0) continue
    facts[incoming.key] = incoming
  }
  return { ...state, facts }
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

export function extractDeterministicFacts(message: string): readonly CampfitV3Fact[] {
  const text = message.trim()
  const facts: CampfitV3Fact[] = []
  const push = (key: CampfitV3FactKey, subject: CampfitV3FactSubject, value: unknown, evidence = text) => {
    facts.push(createFact({ key, subject, value, source: "explicit_user_statement", evidence: evidence.slice(0, 240) }))
  }

  if (/아이.{0,10}(영어.{0,5})?(초급|처음|거의 못|낯설)/.test(text)) push("childEnglishLevel", "child", "beginner")
  else if (/아이.{0,10}(영어.{0,5})?(중급|간단한 대화|일상 대화)/.test(text)) push("childEnglishLevel", "child", "intermediate")
  else if (/아이.{0,10}(영어.{0,5})?(고급|수업.*무리|편하게)/.test(text)) push("childEnglishLevel", "child", "advanced")

  if (/(저는|부모|엄마|아빠).{0,12}영어.{0,10}(가능|할 수|괜찮)/.test(text)) push("parentEnglishCommunication", "parent", "possible")
  if (/(첫|처음).{0,8}(해외|캠프|교육)/.test(text)) push("isFirstOverseasEducationExperience", "child", true)
  if (/(첫 경험이 아니|해외.*경험.*있)/.test(text)) push("isFirstOverseasEducationExperience", "child", false)

  const goals: Partial<Record<ExperienceDirectionKey, ExperienceGoalStrength>> = {}
  if (/(국제학교|현지학교|학교 분위기|스쿨링)/.test(text)) goals.schoolSchooling = "primary"
  if (/(영어 실력|영어 자신감|영어 집중|영어.*늘)/.test(text)) goals.englishIntensive = goals.schoolSchooling ? "secondary" : "primary"
  if (/(STEM|코딩|로봇|프로젝트|미술|스포츠|관심 분야)/i.test(text)) goals.subjectProject = "primary"
  if (/(문화|활동|체험|즐거운|자연스럽게)/.test(text)) goals.cultureActivity = "primary"
  if (Object.keys(goals).length) push("experienceGoals", "preference", completeGoals(goals))
  if (/(공부만|학업만|수업만).{0,8}(싫|피하)/.test(text)) push("studyOnlyAvoidance", "preference", true)

  if (/한국어/.test(text) && /(비상|아플 때|응급)/.test(text)) {
    push("koreanSupportNeed", "constraint", "emergency_only")
  } else if (/한국어.{0,8}(매일|꼭|필수|상시)/.test(text)) push("koreanSupportNeed", "constraint", "must_daily")
  else if (/한국어.{0,8}(필요 없|중요하지 않)/.test(text)) push("koreanSupportNeed", "constraint", "none")

  const stayGoals: string[] = []
  const parentStayContext = /(저는|부모|엄마|아빠|보호자|아이.{0,12}(캠프|프로그램).{0,12}시간)/.test(text)
  if (parentStayContext && /(쉬|휴식|마사지|웰니스)/.test(text)) stayGoals.push("restWellness")
  if (parentStayContext && /(카페|식당|맛집)/.test(text)) stayGoals.push("cafeDining")
  if (parentStayContext && /(관광|문화)/.test(text)) stayGoals.push("tourismCulture")
  if (parentStayContext && /(자연|해변|바다)/.test(text)) stayGoals.push("natureBeach")
  if (parentStayContext && /(원격근무|재택|일해야)/.test(text)) stayGoals.push("remoteWork")
  if (stayGoals.length) push("parentStayGoals", "parent", Array.from(new Set(stayGoals)))

  if (/(특별.*없|건강.*없|알레르기.*없|복약.*없)/.test(text)) push("specialCareFollowUp", "constraint", "none", "특별관리 후속 확인이 없다고 답함")
  else if (/(상담.*확인|별도.*확인|특별.*있)/.test(text)) push("specialCareFollowUp", "constraint", "required", "특별관리 후속 확인이 필요하다고 답함")
  else if (/(잘 모르|확실하지 않)/.test(text) && /(건강|식사|복약|특별)/.test(text)) push("specialCareFollowUp", "constraint", "unknown", "특별관리 후속 확인 여부를 아직 모른다고 답함")

  return facts
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
