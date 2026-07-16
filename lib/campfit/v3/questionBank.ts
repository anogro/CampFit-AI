import type { CampfitV3ConversationState, CampfitV3QuickReply } from "@/types/campfitV3"
import { questionReplies } from "@/lib/campfit/v3/stateEngine"

export type CampfitV3Question = {
  readonly key: string
  readonly title: string
  readonly helper: string
  readonly quickReplies: readonly CampfitV3QuickReply[]
  readonly completedBy: readonly string[]
  readonly priority: number
  readonly shouldAsk?: (state: CampfitV3ConversationState) => boolean
}

export const campfitV3QuestionBank: readonly CampfitV3Question[] = [
  {
    key: "child_english_level",
    title: "기본 조건은 확인했어요. 이제 아이와 해외 캠프를 고민하게 된 상황을 편하게 말씀해주세요. 아이의 영어 경험과 좋아하는 활동, 캠프에서 기대하는 변화, 부모가 현지에서 어떻게 지내고 싶은지, 관심 있는 지역도 함께 말씀해주세요.",
    helper: "한 가지씩 답하지 않아도 괜찮아요. 떠오르는 내용을 자유롭게 적어주세요.",
    quickReplies: questionReplies([["beginner", "영어가 거의 낯설어요"], ["basic", "단어·짧은 표현 정도예요"], ["intermediate", "간단한 일상 대화가 가능해요"], ["advanced", "영어 수업도 참여할 수 있어요"]]),
    completedBy: ["childEnglishLevel"],
    priority: 100,
  },
  {
    key: "special_care_follow_up",
    title: "프로그램을 선택하기 전에 별도로 확인해야 할 건강·식사·복약 관련 사항이 있나요?",
    helper: "질환명이나 약 이름 등 상세정보는 입력하지 마세요. 자세한 내용은 프로그램 상담 시 별도로 확인합니다.",
    quickReplies: questionReplies([["none", "없어요"], ["required", "있어요. 상담할 때 별도로 확인할게요"], ["unknown", "아직 잘 모르겠어요"]]),
    completedBy: ["specialCareFollowUp"],
    priority: 95,
  },
  {
    key: "korean_support_need",
    title: "아이에게 필요한 현지 지원이 있다면 어떤 상황을 가장 먼저 생각하고 계세요? 한국어 지원은 매일 필요한지, 비상시에만 있으면 되는지도 함께 알려주세요.",
    helper: "상시 지원과 비상 상황 지원을 구분해 주세요.",
    quickReplies: questionReplies([["must_daily", "매일 한국어 지원이 꼭 필요해요"], ["emergency_only", "비상 상황에서만 필요해요"], ["preferred", "있으면 더 안심돼요"], ["none", "중요하지 않아요"]]),
    completedBy: ["koreanSupportNeed"],
    priority: 90,
  },
  {
    key: "parent_communication_need",
    title: "아이 프로그램 시간 동안 부모님은 어떤 방식으로 소식을 받고 지내고 싶으세요? 원격근무나 휴식처럼 부모님 일정도 함께 말씀해주셔도 좋아요.",
    helper: "필요한 연락 빈도를 기준으로 골라주세요.",
    quickReplies: questionReplies([["daily", "매일 간단히 공유받고 싶어요"], ["issue_only", "문제가 있을 때 바로 연락받고 싶어요"], ["occasional", "가끔 소식을 받으면 충분해요"], ["not_important", "중요하지 않아요"]]),
    completedBy: ["parentCommunicationNeed"],
    priority: 88,
  },
  {
    key: "primary_experience_goal",
    title: "이번 경험을 통해 아이에게 어떤 변화가 생기면 가장 좋을까요? 학교·영어·프로젝트·문화활동 중 하나를 골라도 되고, 기대하는 모습을 편하게 설명해주셔도 됩니다.",
    helper: "다른 목표가 함께 있다면 자유 입력으로 덧붙여도 좋아요.",
    quickReplies: questionReplies([["schoolSchooling", "국제학교·스쿨링 경험"], ["englishIntensive", "영어 자신감과 집중 노출"], ["subjectProject", "STEM·예술·프로젝트"], ["cultureActivity", "문화·활동과 즐거운 경험"]]),
    completedBy: ["experienceGoals"],
    priority: 80,
  },
  {
    key: "preferred_region",
    title: "마음에 두고 있는 나라나 도시가 있나요? 아직 정하지 않았다면 아이에게 어울릴 곳을 함께 찾아도 괜찮아요.",
    helper: "지역을 정하지 않았다면 상관없음을 선택해도 됩니다.",
    quickReplies: questionReplies([["southeast_asia", "동남아시아"], ["oceania", "오세아니아"], ["north_america", "북미"], ["europe", "유럽"], ["no_preference", "지역은 상관없어요"]]),
    completedBy: ["preferredRegions"],
    priority: 75,
  },
  {
    key: "region_importance",
    title: "희망 지역은 어느 정도로 중요한 조건인가요?",
    helper: "지역을 고정하면 프로그램 후보가 크게 줄어들 수 있어요.",
    quickReplies: questionReplies([["must", "이 지역만 가능해요"], ["strong", "이 지역을 우선하고 싶어요"], ["soft", "가능하면 좋지만 다른 곳도 괜찮아요"]]),
    completedBy: ["regionImportance"],
    priority: 74,
    shouldAsk: (state) => Array.isArray(state.facts.preferredRegions?.value) && state.facts.preferredRegions.value.length > 0,
  },
  {
    key: "parent_stay_goal",
    title: "아이 프로그램 시간에는 부모님이 어떻게 지내고 싶으세요?",
    helper: "도시를 비교할 때 부모님의 체류 목적도 함께 봅니다.",
    quickReplies: questionReplies([["restWellness", "휴식·웰니스"], ["cafeDining", "카페·식당과 현지 생활"], ["tourismCulture", "관광·문화"], ["natureBeach", "자연·해변"], ["remoteWork", "원격근무"], ["childScheduleFirst", "아이 일정이 가장 중요해요"]]),
    completedBy: ["parentStayGoals"],
    priority: 60,
  },
  {
    key: "first_overseas_experience",
    title: "이번이 아이의 첫 해외 교육 경험인가요?",
    helper: "첫 경험 여부는 초기 적응 지원을 판단할 때만 사용합니다.",
    quickReplies: questionReplies([["first", "네, 첫 경험이에요"], ["experienced", "아니요, 비슷한 경험이 있어요"]]),
    completedBy: ["isFirstOverseasEducationExperience"],
    priority: 50,
  },
  {
    key: "day_program_separation",
    title: "초반 안내가 있다면 아이가 낮 프로그램에 참여할 수 있을까요?",
    helper: "부모님은 같은 도시나 인근에 머무는 것을 전제로 합니다.",
    quickReplies: questionReplies([["needs_close_support", "처음에는 가까운 도움이 많이 필요해요"], ["with_initial_support", "초반 안내가 있으면 가능해요"], ["ready", "새로운 일정에도 잘 참여해요"]]),
    completedBy: ["dayProgramSeparationReadiness"],
    priority: 45,
    shouldAsk: (state) => state.facts.isFirstOverseasEducationExperience?.value === true,
  },
]

export function selectNextQuestion(state: CampfitV3ConversationState, suggestedQuestionKey: string | null = null): CampfitV3Question | null {
  const current = getQuestion(state.currentQuestionKey)
  if (current !== null && shouldAsk(current, state) && !isQuestionCompleted(current, state)) return current
  const suggested = getQuestion(suggestedQuestionKey)
  if (suggested !== null && shouldAsk(suggested, state) && !isQuestionCompleted(suggested, state)) return suggested
  const asked = new Set(state.askedQuestionKeys)
  const retry = [...campfitV3QuestionBank]
    .sort((left, right) => questionValue(right, state) - questionValue(left, state))
    .find((question) => asked.has(question.key) && shouldAsk(question, state) && !isQuestionCompleted(question, state))
  if (retry !== undefined) return retry
  if (state.questionCount >= 10) return null
  return [...campfitV3QuestionBank]
    .sort((left, right) => questionValue(right, state) - questionValue(left, state))
    .find((question) => {
      if (asked.has(question.key)) return false
      if (!shouldAsk(question, state)) return false
      return !isQuestionCompleted(question, state)
    }) ?? null
}

export function getQuestion(key: string | null): CampfitV3Question | null {
  return key === null ? null : campfitV3QuestionBank.find((question) => question.key === key) ?? null
}

export function allowedQuestionKeys(state: CampfitV3ConversationState): readonly string[] {
  return campfitV3QuestionBank
    .filter((question) => shouldAsk(question, state) && !isQuestionCompleted(question, state))
    .map((question) => question.key)
}

export function isQuestionCompleted(question: CampfitV3Question, state: CampfitV3ConversationState): boolean {
  if (state.completedQuestionKeys.includes(question.key)) return true
  return question.completedBy.every((key) => {
    const fact = state.facts[key as keyof typeof state.facts]
    if (fact === undefined || fact.status === "unknown" || fact.status === "tentative") return false
    return !state.conflicts.some((conflict) => conflict.key === key)
  })
}

function questionValue(question: CampfitV3Question, state: CampfitV3ConversationState): number {
  const unresolvedBoost = question.completedBy.some((key) => state.unresolved.includes(key as CampfitV3ConversationState["unresolved"][number])) ? 18 : 0
  const conflictBoost = question.completedBy.some((key) => state.conflicts.some((conflict) => conflict.key === key)) ? 24 : 0
  return question.priority + unresolvedBoost + conflictBoost
}

function shouldAsk(question: CampfitV3Question, state: CampfitV3ConversationState): boolean {
  return question.shouldAsk === undefined || question.shouldAsk(state)
}
